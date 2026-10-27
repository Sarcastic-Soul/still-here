// "Ask Anish's notes". The open model answers a family member's question, but only from notes
// that Auth0 FGA says this person may read, and code checks every citation before the answer
// is shown. If the notes don't cover it, the person is told so plainly.
import { audit } from "./audit";
import { sql } from "./db";
import { filterReadable } from "./fga";
import { chat, parseJson, type ModelKey } from "./llm";
import { searchNotes } from "./search";
import { getPerson, getVaultById } from "./vault";

const CONTEXT_NOTES = 6;

export type AskResult = {
  outcome: "answered" | "no_note" | "refused";
  answer: string;
  citations: { id: string; title: string }[];
  candidates: number;
  allowed: number;
  model?: string;
  questionId?: string;
};

const SYSTEM = (owner: string, asker: string) => `You help ${asker} find practical facts that ${owner} wrote down before he died.
You are not ${owner}. Never speak as him, never add feelings or memories, never guess.
Answer ONLY from the notes below. Each note has a label like [n1].
If the notes do not answer the question, set "no_note" to true and leave "answer" empty.
Otherwise write a short, plain answer (1-4 sentences) and list every label you used in "cited".
Reply with JSON only: {"answer": string, "cited": string[], "no_note": boolean}`;

export async function ask(opts: { vaultId: string; personId: string; question: string; model?: ModelKey; log?: boolean }): Promise<AskResult> {
  const { vaultId, personId } = opts;
  const question = opts.question.trim().slice(0, 500);
  const [vault, person] = await Promise.all([getVaultById(vaultId), getPerson(personId)]);
  if (!vault || !person || person.vault_id !== vaultId) throw new Error("unknown person for this vault");
  const noNote = `${vault.owner_name} didn't leave a note about that.`;

  const hits = await searchNotes(vaultId, question);
  // FGA decides. Notes this person may not read never reach the model.
  const readable = new Set(await filterReadable(personId, "note", hits.map((h) => h.id)));
  const allowed = hits.filter((h) => readable.has(h.id)).slice(0, CONTEXT_NOTES);

  let result: AskResult;
  let usageId: string | null = null;
  if (!allowed.length) {
    result = { outcome: "no_note", answer: noNote, citations: [], candidates: hits.length, allowed: 0 };
  } else {
    const labels = new Map(allowed.map((h, i) => [`n${i + 1}`, h]));
    const notes = [...labels].map(([label, h]) => `[${label}] ${h.title}\n${h.body}`).join("\n\n");
    const res = await chat({
      job: "answer",
      vaultId,
      model: opts.model,
      json: true,
      maxTokens: 1200,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM(vault.owner_name, person.name) },
        { role: "user", content: `Notes:\n\n${notes}\n\nQuestion from ${person.name}: ${question}` },
      ],
    });
    usageId = res.usageId;
    let parsed: { answer?: string; cited?: string[]; no_note?: boolean } = {};
    try {
      parsed = parseJson(res.text);
    } catch {
      parsed = {};
    }
    const cited = [...new Set((parsed.cited ?? []).map((c) => String(c).replace(/[[\]]/g, "").trim()))];
    const valid = cited.every((c) => labels.has(c));
    if (parsed.no_note || !parsed.answer?.trim() || !cited.length) {
      result = { outcome: "no_note", answer: noNote, citations: [], candidates: hits.length, allowed: allowed.length, model: opts.model };
    } else if (!valid) {
      // The model cited something that was not in front of it. Don't show the answer.
      result = { outcome: "refused", answer: noNote, citations: [], candidates: hits.length, allowed: allowed.length, model: opts.model };
    } else {
      result = {
        outcome: "answered",
        answer: parsed.answer.trim().replace(/\s*\[n\d+\]/g, ""),
        citations: cited.map((c) => ({ id: labels.get(c)!.id, title: labels.get(c)!.title })),
        candidates: hits.length,
        allowed: allowed.length,
        model: opts.model,
      };
    }
  }

  if (opts.log !== false) {
    const [row] = await sql`
      insert into questions (vault_id, person_id, question, outcome, answer, cited, candidates, allowed, usage_id)
      values (${vaultId}, ${personId}, ${question}, ${result.outcome}, ${result.answer},
              ${result.citations.map((c) => c.id)}::uuid[], ${result.candidates}, ${result.allowed}, ${usageId})
      returning id`;
    result.questionId = row.id;
    await audit(vaultId, `person:${personId}`, "asked", { question_id: row.id, outcome: result.outcome, candidates: result.candidates, allowed: result.allowed });
  }
  return result;
}
