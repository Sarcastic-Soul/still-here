// Creating and filling a vault: used by the seed script and the owner's editor.
import { sql } from "./db";
import { embed, toVector } from "./embed";
import { randomBytes } from "node:crypto";
import { audit } from "./audit";
import { setVaultOwner, shareLetter, shareNote } from "./fga";

// A new real vault: the signed-in owner, the people they trust, a weekly switch and a private push topic.
export async function createVault(owner: { name: string; email: string; sub: string }, trusted: { name: string; relation: string; email: string }[]) {
  const slug = `v-${randomBytes(6).toString("hex")}`;
  const topic = `still-here-${randomBytes(12).toString("hex")}`;
  const { vaultId, ownerId } = await sql.begin(async (tx) => {
    const [v] = await tx`insert into vaults (slug, owner_name, ntfy_topic) values (${slug}, ${owner.name}, ${topic}) returning id`;
    await tx`insert into switch (vault_id) values (${v.id})`;
    const [o] = await tx`
      insert into people (vault_id, role, name, relation, email, auth0_sub)
      values (${v.id}, 'owner', ${owner.name}, 'owner', ${owner.email}, ${owner.sub}) returning id`;
    for (const t of trusted) {
      await tx`insert into people (vault_id, role, name, relation, email) values (${v.id}, 'trusted', ${t.name}, ${t.relation}, ${t.email})`;
    }
    await audit(v.id, "owner", "vault_created", { trusted: trusted.length }, tx);
    return { vaultId: v.id as string, ownerId: o.id as string };
  });
  await setVaultOwner(vaultId, ownerId);
  return vaultId;
}

export async function deleteNote(vaultId: string, id: string) {
  const [old] = await sql`delete from notes where id = ${id} and vault_id = ${vaultId} returning shared_with`;
  if (old) await shareNote(vaultId, id, [], old.shared_with);
}

export async function addNote(vaultId: string, note: { title: string; body: string; sharedWith: string[]; source?: string }) {
  const vec = toVector(await embed(`${note.title}\n${note.body}`));
  const [row] = await sql`
    insert into notes (vault_id, title, body, shared_with, embedding, source)
    values (${vaultId}, ${note.title}, ${note.body}, ${note.sharedWith}::uuid[], ${vec}::vector, ${note.source ?? "owner"})
    returning id`;
  await shareNote(vaultId, row.id, note.sharedWith);
  return row.id as string;
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
