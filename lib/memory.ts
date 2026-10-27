// The optional line on a check-in ("moved my FD to SBI") becomes a current fact in Backboard.
// Backboard finds the facts closest to the line; the open model decides whether the line is a
// new fact, replaces one of those, or is not a fact at all ("all good"). A replaced fact is
// updated in place, so the handbook never reads the stale version.
import { audit } from "./audit";
import { addMemory, createAssistant, listMemories, searchMemories, updateMemory, type Memory } from "./backboard";
import { sql } from "./db";
import { maybe } from "./env";
import { chat, parseJson } from "./llm";

const SYSTEM = `You keep a short list of current facts about a person's money, papers and accounts.
You get one new line the person wrote, and the existing facts closest to it, each with an id.
Decide:
- "none": the line holds no lasting fact (a greeting, a mood, "nothing changed").
- "replaces": the line changes one existing fact (same account, policy or thing, new value or place). Give its id.
- "new": a lasting fact that changes none of the existing ones.
Write "fact" as one plain sentence about the person, by name, that stands on its own, using only what the line says.
Reply with JSON only: {"action": "none" | "new" | "replaces", "id": string | null, "fact": string | null}`;

export type Remembered = { action: "none" | "new" | "replaces"; fact?: string; replaced?: string };

async function assistantFor(vaultId: string) {
  const [v] = await sql`select backboard_assistant_id, owner_name from vaults where id = ${vaultId}`;
  if (v.backboard_assistant_id) return { id: v.backboard_assistant_id as string, name: v.owner_name as string };
  const id = await createAssistant(`Still Here · ${v.owner_name}`);
  await sql`update vaults set backboard_assistant_id = ${id} where id = ${vaultId}`;
  return { id, name: v.owner_name as string };
}

export async function remember(vaultId: string, line: string, at = new Date()): Promise<Remembered> {
  const text = line.trim().slice(0, 500);
  if (!text || !maybe("BACKBOARD_API_KEY")) return { action: "none" };
  const { id: assistant, name } = await assistantFor(vaultId);
  const close = await searchMemories(assistant, text, 5);

  const res = await chat({
    job: "memory",
    vaultId,
    json: true,
    maxTokens: 600,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `The person: ${name}\nNew line: ${text}\n\nExisting facts:\n${close.map((m) => `[${m.id}] ${m.content}`).join("\n") || "(none)"}` },
    ],
  });
  const d = parseJson<{ action?: string; id?: string | null; fact?: string | null }>(res.text);
  const fact = d.fact?.trim().slice(0, 300);
  const old = close.find((m) => m.id === d.id);

  if (d.action === "replaces" && old && fact) {
    await updateMemory(assistant, old.id, fact);
    await audit(vaultId, "model", "memory_replaced", { memory_id: old.id, usage_id: res.usageId });
    return { action: "replaces", fact, replaced: old.content };
  }
  if ((d.action === "new" || d.action === "replaces") && fact) {
    await addMemory(assistant, fact, { at: at.toISOString(), source: "check-in" });
    await audit(vaultId, "model", "memory_added", { usage_id: res.usageId });
    return { action: "new", fact };
  }
  return { action: "none" };
}

// For a background job: a failed memory write must never undo a check-in
export async function rememberQuietly(vaultId: string, line: string | null | undefined) {
  if (!line) return;
  try {
    await remember(vaultId, line);
  } catch (e) {
    console.error("backboard memory failed:", (e as Error).message);
  }
}

export async function currentFacts(vaultId: string): Promise<Memory[]> {
  const [v] = await sql`select backboard_assistant_id from vaults where id = ${vaultId}`;
  if (!v?.backboard_assistant_id || !maybe("BACKBOARD_API_KEY")) return [];
  return listMemories(v.backboard_assistant_id);
}

export async function memoryCounts(vaultId: string) {
  const [r] = await sql`
    select count(*) filter (where action = 'memory_added')::int as added,
           count(*) filter (where action = 'memory_replaced')::int as replaced
    from audit_log where vault_id = ${vaultId}`;
  return r as { added: number; replaced: number };
}
