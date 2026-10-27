import { sql } from "./db";
import { filterReadable } from "./fga";

// Every letter in the vault is a candidate; FGA decides which ones this person sees.
export async function lettersFor(vaultId: string, personId: string) {
  const all = await sql<{ id: string; title: string; body: string; recipient_id: string }[]>`
    select id, title, body, recipient_id from letters where vault_id = ${vaultId} order by created_at`;
  const ok = new Set(await filterReadable(personId, "letter", all.map((l) => l.id)));
  return all.filter((l) => ok.has(l.id)).map(({ id, title, body }) => ({ id, title, body }));
}
