// Creating and filling a vault: used by the seed script and the owner's editor.
import { sql } from "./db";
import { embed, toVector } from "./embed";
import { shareLetter, shareNote } from "./fga";

export async function addNote(vaultId: string, note: { title: string; body: string; sharedWith: string[]; source?: string }) {
  const vec = toVector(await embed(`${note.title}\n${note.body}`));
  const [row] = await sql`
    insert into notes (vault_id, title, body, shared_with, embedding, source)
    values (${vaultId}, ${note.title}, ${note.body}, ${note.sharedWith}::uuid[], ${vec}::vector, ${note.source ?? "owner"})
    returning id`;
  await shareNote(vaultId, row.id, note.sharedWith);
  return row.id as string;
}

export async function updateNote(vaultId: string, id: string, note: { title: string; body: string; sharedWith: string[] }) {
  const [old] = await sql`select shared_with from notes where id = ${id} and vault_id = ${vaultId}`;
  if (!old) throw new Error("no such note");
  const vec = toVector(await embed(`${note.title}\n${note.body}`));
  await sql`
    update notes set title = ${note.title}, body = ${note.body}, shared_with = ${note.sharedWith}::uuid[],
      embedding = ${vec}::vector, updated_at = now()
    where id = ${id}`;
  await shareNote(vaultId, id, note.sharedWith, old.shared_with);
}

export async function addLetter(vaultId: string, letter: { recipientId: string; title: string; body: string }) {
  const [row] = await sql`
    insert into letters (vault_id, recipient_id, title, body)
    values (${vaultId}, ${letter.recipientId}, ${letter.title}, ${letter.body}) returning id`;
  await shareLetter(vaultId, row.id, letter.recipientId);
  return row.id as string;
}

// Deletes a vault and everything in it. The audit log trigger allows this one path only.
export async function deleteVault(slug: string) {
  await sql.begin(async (tx) => {
    await tx`select set_config('still_here.vault_reset', 'on', true)`;
    await tx`delete from vaults where slug = ${slug}`;
  });
}
