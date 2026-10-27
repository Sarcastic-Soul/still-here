// The public demo vault: no sign-up. Visitors play the owner and both trusted people.
import { sql } from "./db";
import { getVault, type Vault } from "./vault";

export async function demoVault(): Promise<Vault> {
  const v = await getVault("demo");
  if (!v) throw new Error("demo vault missing: run bun run seed");
  return v;
}

export async function demoPerson(vaultId: string, personId: unknown) {
  if (typeof personId !== "string") return null;
  const [p] = await sql`select id, role, name from people where vault_id = ${vaultId} and id = ${personId}::uuid`.catch(() => []);
  return p ?? null;
}

// Keeps the free Groq quota alive when the demo link gets shared around
export async function demoQuestionsLastHour(vaultId: string) {
  const [r] = await sql`select count(*)::int as n from questions where vault_id = ${vaultId} and created_at > now() - interval '1 hour'`;
  return r.n as number;
}
