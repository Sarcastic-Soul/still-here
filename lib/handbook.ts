// The "what my family needs to know" handbook, written while the owner is alive.
// A model reads the owner's documents (policies, statements, subscription emails) and drafts
// sections for each trusted person. Code keeps only items that cite a real document, then
// renders a .docx. Every run is stored with its model, tokens and cost.
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { audit } from "./audit";
import { sql } from "./db";
import { chat, parseJson, type ModelKey } from "./llm";
import { getPeople, getVaultById } from "./vault";

export type HandbookItem = { text: string; sources: string[] };
export type HandbookSection = { audience: string; title: string; items: HandbookItem[] };

const SYSTEM = `You prepare a practical handbook for the family of a person who has died.
You are given that person's documents, each with a label like [d1], and the people the handbook is for.
Write what each person needs to DO or KNOW: what exists, where it is, deadlines, amounts, phone numbers,
what renews and must be cancelled or kept. Use only facts in the documents. Do not invent anything.
No condolences, no feelings, no advice beyond what the documents support.
Every item must cite the labels of the documents it comes from in "sources".
Audience is the key of one person, or "everyone" for items that apply to all of them.
Reply with JSON only:
{"sections": [{"audience": string, "title": string, "items": [{"text": string, "sources": string[]}]}]}`;

export async function runHandbook(opts: { vaultId: string; model?: ModelKey; maxTokens?: number }) {
  const vault = await getVaultById(opts.vaultId);
  if (!vault) throw new Error("no vault");
  const people = (await getPeople(vault.id)).filter((p) => p.role === "trusted");
  const docs = await sql<{ id: string; kind: string; title: string; body: string }[]>`
    select id, kind, title, body from documents where vault_id = ${vault.id} order by created_at`;
  const labels = new Map(docs.map((d, i) => [`d${i + 1}`, d]));
  const keys = new Map(people.map((p) => [p.name.toLowerCase(), p]));

  const res = await chat({
    job: "handbook",
    vaultId: vault.id,
    model: opts.model,
    json: true,
    maxTokens: opts.maxTokens ?? 8000,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content:
          `The person who died: ${vault.owner_name}.\n` +
          `People (key: who):\n${people.map((p) => `- ${p.name.toLowerCase()}: ${p.name}, ${p.relation}`).join("\n")}\n` +
          `- everyone: all of them\n\nDocuments:\n\n` +
          [...labels].map(([l, d]) => `[${l}] (${d.kind}) ${d.title}\n${d.body}`).join("\n\n"),
      },
    ],
  });

  const raw = parseJson<{ sections?: HandbookSection[] }>(res.text).sections ?? [];
  // Code keeps only what it can check: a known audience, and sources that are real documents.
  const sections: HandbookSection[] = [];
  const dropped: { item: HandbookItem; why: string }[] = [];
  for (const s of raw) {
    const audience = String(s.audience ?? "").toLowerCase();
    if (audience !== "everyone" && !keys.has(audience)) {
      for (const item of s.items ?? []) dropped.push({ item, why: `unknown audience ${audience}` });
      continue;
    }
    const items: HandbookItem[] = [];
    for (const item of s.items ?? []) {
      const sources = (item.sources ?? []).map((x) => String(x).replace(/[[\]]/g, ""));
      if (!item.text?.trim() || !sources.length) dropped.push({ item, why: "no source" });
      else if (!sources.every((x) => labels.has(x))) dropped.push({ item, why: "source not a document" });
      else items.push({ text: item.text.trim(), sources: sources.map((x) => labels.get(x)!.id) });
    }
    if (items.length) sections.push({ audience, title: String(s.title ?? "").trim() || "Notes", items });
  }

  const docx = await renderDocx(vault.owner_name, sections, docs, people);
  const [row] = await sql`
    insert into handbooks (vault_id, model, sections, dropped, docx, usage_id)
    values (${vault.id}, ${opts.model ?? "default"}, ${sql.json(sections as never)}, ${sql.json(dropped as never)}, ${docx}, ${res.usageId})
    returning id`;
  await audit(vault.id, "model", "handbook_written", {
    handbook_id: row.id,
    model: opts.model,
    items: sections.reduce((n, s) => n + s.items.length, 0),
    dropped: dropped.length,
    cost_usd: res.costUsd,
  });
  return { id: row.id as string, sections, dropped, docx, usage: res };
}

async function renderDocx(
  owner: string,
  sections: HandbookSection[],
  docs: { id: string; title: string }[],
  people: { name: string; relation: string }[],
) {
  const docTitle = new Map(docs.map((d) => [d.id, d.title]));
  const who = (audience: string) => {
    if (audience === "everyone") return "For everyone";
    const p = people.find((x) => x.name.toLowerCase() === audience);
    return p ? `For ${p.name} (${p.relation})` : audience;
  };
  // Group by audience: "everyone" first, then each person
  const order = ["everyone", ...people.map((p) => p.name.toLowerCase())];
  const sorted = [...sections].sort((a, b) => order.indexOf(a.audience) - order.indexOf(b.audience));

  const children: Paragraph[] = [
    new Paragraph({ text: `What my family needs to know`, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [new TextRun({ text: `${owner}'s handbook, drafted from his documents by Still Here.`, italics: true })],
    }),
    new Paragraph({ text: "" }),
  ];
  let lastAudience = "";
  for (const s of sorted) {
    if (s.audience !== lastAudience) {
      children.push(new Paragraph({ text: who(s.audience), heading: HeadingLevel.HEADING_1 }));
      lastAudience = s.audience;
    }
    children.push(new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_2 }));
    for (const item of s.items) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun(item.text),
            new TextRun({ text: `  (from: ${item.sources.map((id) => docTitle.get(id)).join("; ")})`, size: 18, color: "666666" }),
          ],
        }),
      );
    }
  }
  children.push(
    new Paragraph({ text: "" }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "Every line above cites the document it came from. Lines without a real source were removed by code.", size: 18, color: "666666" })],
    }),
  );
  return Packer.toBuffer(new Document({ creator: "Still Here", title: `${owner}'s handbook`, sections: [{ children }] }));
}
