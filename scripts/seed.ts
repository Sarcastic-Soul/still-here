// Rebuilds the public demo vault from db/demo-data.ts: people, notes (with embeddings and
// FGA tuples), letters and documents. Demo timings squeeze a week into a few seconds.
import { audit } from "../lib/audit";
import { sql } from "../lib/db";
import { setVaultOwner, unmarkReleased } from "../lib/fga";
import { addLetter, addNote, deleteVault } from "../lib/vault-admin";
import { DEMO_DOCUMENTS, DEMO_LETTERS, DEMO_NOTES, DEMO_OWNER, DEMO_PEOPLE } from "../db/demo-data";

const old = await sql`select id from vaults where slug = 'demo'`;
if (old[0]) await unmarkReleased(old[0].id);
await deleteVault("demo");

const [vault] = await sql`insert into vaults (slug, owner_name, is_demo) values ('demo', ${DEMO_OWNER.name}, true) returning id`;
await sql`insert into switch (vault_id, every_seconds, miss_limit, grace_seconds) values (${vault.id}, 6, 3, 6)`;
const [owner] = await sql`
  insert into people (vault_id, role, name, relation, email) values (${vault.id}, 'owner', ${DEMO_OWNER.name}, 'owner', ${DEMO_OWNER.email})
  returning id`;
await setVaultOwner(vault.id, owner.id);

const ids: Record<string, string> = {};
for (const p of DEMO_PEOPLE) {
  const [row] = await sql`
    insert into people (vault_id, role, name, relation, email) values (${vault.id}, 'trusted', ${p.name}, ${p.relation}, ${p.email})
    returning id`;
  ids[p.key] = row.id;
}

for (const n of DEMO_NOTES) {
  await addNote(vault.id, { title: n.title, body: n.body, sharedWith: n.for.map((k) => ids[k]) });
  process.stdout.write(".");
}
for (const l of DEMO_LETTERS) await addLetter(vault.id, { recipientId: ids[l.to], title: l.title, body: l.body });
for (const d of DEMO_DOCUMENTS) {
  await sql`insert into documents (vault_id, kind, title, body) values (${vault.id}, ${d.kind}, ${d.title}, ${d.body})`;
}
await audit(vault.id, "system", "vault_created", { demo: true });

console.log(`\ndemo vault ${vault.id}: ${DEMO_NOTES.length} notes, ${DEMO_LETTERS.length} letters, ${DEMO_DOCUMENTS.length} documents`);
console.log("people:", JSON.stringify({ owner: owner.id, ...ids }));
await sql.end();
