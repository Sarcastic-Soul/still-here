"use server";
// Everything the signed-in owner can change. Each action checks the session itself.
import { revalidatePath } from "next/cache";
import { auth0 } from "@/lib/auth0";
import { sql } from "@/lib/db";
import { runHandbook } from "@/lib/handbook";
import { appUrl, push } from "@/lib/ntfy";
import { currentPeople } from "@/lib/session";
import { checkIn } from "@/lib/switch";
import { addLetter, addNote, createVault, deleteNote } from "@/lib/vault-admin";
import { getPeople, getVaultById } from "@/lib/vault";

export type Result = { ok?: string; error?: string } | null;

const text = (f: FormData, k: string, max = 4000) => String(f.get(k) ?? "").trim().slice(0, max);
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

async function ownerRow() {
  const owner = (await currentPeople()).find((p) => p.role === "owner");
  if (!owner) throw new Error("Only the owner of a vault can do this.");
  return owner;
}

// Wraps an action so a thrown error comes back as a message on the form
const guard = (fn: (f: FormData) => Promise<string>) => async (_: Result, f: FormData): Promise<Result> => {
  try {
    const ok = await fn(f);
    revalidatePath("/me");
    return { ok };
  } catch (e) {
    return { error: (e as Error).message };
  }
};

export const createVaultAction = guard(async (f) => {
  const session = await auth0.getSession();
  if (!session?.user.email) throw new Error("Sign in first.");
  if (!session.user.email_verified) throw new Error("Verify your email with Auth0 first, then sign in again.");
  if ((await currentPeople()).some((p) => p.role === "owner")) throw new Error("You already have a vault.");
  const name = text(f, "name", 60);
  if (!name) throw new Error("Write your name.");
  const trusted = [0, 1, 2]
    .map((i) => ({ name: text(f, `t${i}_name`, 60), relation: text(f, `t${i}_relation`, 40), email: text(f, `t${i}_email`, 200).toLowerCase() }))
    .filter((t) => t.name || t.email);
  if (trusted.length < 2) throw new Error("Name two people you trust. Both must say yes before anything opens.");
  for (const t of trusted) {
    if (!t.name || !isEmail(t.email)) throw new Error("Each trusted person needs a name and an email.");
    if (t.email === session.user.email.toLowerCase()) throw new Error("You can't be your own trusted person.");
  }
  if (new Set(trusted.map((t) => t.email)).size !== trusted.length) throw new Error("Use a different email for each person.");
  await createVault({ name, email: session.user.email, sub: session.user.sub }, trusted);
  return "Vault created.";
});

export const checkInAction = guard(async (f) => {
  const owner = await ownerRow();
  const r = await checkIn(owner.vault_id, { line: text(f, "line", 500), channel: "web" });
  if (!r.ok) throw new Error("This vault has been released. It can't be undone from here.");
  return r.was === "alive" ? "Answered. See you next week." : "Answered. The switch is back to alive.";
});

export const testPushAction = guard(async () => {
  const owner = await ownerRow();
  const vault = await getVaultById(owner.vault_id);
  const sent = await push({ topic: vault?.ntfy_topic, title: "Still Here: test", message: "This is how the weekly question will arrive.", click: appUrl("/me"), priority: 3 });
  if (!sent) throw new Error("ntfy did not accept the push. Try again in a minute.");
  return "Sent. Check your phone.";
});

export const addNoteAction = guard(async (f) => {
  const owner = await ownerRow();
  const title = text(f, "title", 120), body = text(f, "body", 4000);
  if (!title || !body) throw new Error("A note needs a title and some text.");
  const [{ n }] = await sql`select count(*)::int as n from notes where vault_id = ${owner.vault_id}`;
  if (n >= 200) throw new Error("A vault holds up to 200 notes.");
  const people = (await getPeople(owner.vault_id)).filter((p) => p.role === "trusted");
  const shared = f.getAll("shared").map(String).filter((id) => people.some((p) => p.id === id));
  await addNote(owner.vault_id, { title, body, sharedWith: shared });
  return shared.length ? "Saved. Only the people you ticked can ever ask about it." : "Saved. Nobody can ask about it: it is shared with no one.";
});

export const deleteNoteAction = guard(async (f) => {
  const owner = await ownerRow();
  await deleteNote(owner.vault_id, text(f, "id", 64));
  return "Deleted.";
});

export const addLetterAction = guard(async (f) => {
  const owner = await ownerRow();
  const to = text(f, "to", 64), body = text(f, "body", 8000);
  const person = (await getPeople(owner.vault_id)).find((p) => p.id === to && p.role === "trusted");
  if (!person) throw new Error("Pick who the letter is for.");
  if (!body) throw new Error("Write the letter first.");
  await addLetter(owner.vault_id, { recipientId: person.id, title: `For ${person.name}`, body });
  return `Sealed. ${person.name} can read it only after release.`;
});

export const deleteLetterAction = guard(async (f) => {
  const owner = await ownerRow();
  await sql`delete from letters where id = ${text(f, "id", 64)} and vault_id = ${owner.vault_id}`;
  return "Deleted.";
});

export const addDocumentAction = guard(async (f) => {
  const owner = await ownerRow();
  const title = text(f, "title", 160), body = text(f, "body", 6000);
  const kind = ["policy", "statement", "subscription", "other"].includes(text(f, "kind")) ? text(f, "kind") : "other";
  if (!title || !body) throw new Error("Paste the document text and give it a title.");
  const [{ n }] = await sql`select count(*)::int as n from documents where vault_id = ${owner.vault_id}`;
  if (n >= 40) throw new Error("A vault holds up to 40 documents.");
  await sql`insert into documents (vault_id, kind, title, body) values (${owner.vault_id}, ${kind}, ${title}, ${body})`;
  return "Added.";
});

export const deleteDocumentAction = guard(async (f) => {
  const owner = await ownerRow();
  await sql`delete from documents where id = ${text(f, "id", 64)} and vault_id = ${owner.vault_id}`;
  return "Deleted.";
});

export const handbookAction = guard(async () => {
  const owner = await ownerRow();
  const [{ docs }] = await sql`select count(*)::int as docs from documents where vault_id = ${owner.vault_id}`;
  if (!docs) throw new Error("Add at least one document first.");
  const [{ runs }] = await sql`select count(*)::int as runs from handbooks where vault_id = ${owner.vault_id} and created_at > now() - interval '1 day'`;
  if (runs >= 5) throw new Error("Five handbooks a day is the limit. Try again tomorrow.");
  const h = await runHandbook({ vaultId: owner.vault_id, model: "ultramarine-1-flash" });
  const items = h.sections.reduce((n, s) => n + s.items.length, 0);
  return `Written: ${items} lines kept, ${h.dropped.length} dropped for missing sources. Cost $${h.usage.costUsd.toFixed(4)}.`;
});
