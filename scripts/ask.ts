// Ask a vault's notes as one person: bun run ask <vault slug> <person name> "<question>"
import { ask } from "../lib/ask";
import { sql } from "../lib/db";
import type { ModelKey } from "../lib/llm";

const [slug, name, ...rest] = process.argv.slice(2);
const [person] = await sql`
  select p.id, p.vault_id from people p join vaults v on v.id = p.vault_id
  where v.slug = ${slug} and lower(p.name) = lower(${name})`;
if (!person) throw new Error(`no person ${name} in vault ${slug}`);
const res = await ask({ vaultId: person.vault_id, personId: person.id, question: rest.join(" "), model: process.env.MODEL as ModelKey | undefined });
console.log(JSON.stringify(res, null, 2));
await sql.end();
