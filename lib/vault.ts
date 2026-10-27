import type postgres from "postgres";
import { sql } from "./db";

export type Vault = { id: string; slug: string; owner_name: string; is_demo: boolean; ntfy_topic: string | null };
export type Person = {
  id: string;
  vault_id: string;
  role: "owner" | "trusted";
  name: string;
  relation: string;
  email: string;
  auth0_sub: string | null;
};
export type SwitchState = "alive" | "missed" | "confirming" | "released";
export type SwitchRow = {
  vault_id: string;
  state: SwitchState;
  every_seconds: number;
  miss_limit: number;
  grace_seconds: number;
  last_answer_at: Date;
  last_ping_at: Date | null;
  missed_count: number;
  last_chance_at: Date | null;
  round: number;
  released_at: Date | null;
  updated_at: Date;
};

export async function getVault(slug: string): Promise<Vault | null> {
  const [v] = await sql<Vault[]>`select id, slug, owner_name, is_demo, ntfy_topic from vaults where slug = ${slug}`;
  return v ?? null;
}

export async function getVaultById(id: string): Promise<Vault | null> {
  const [v] = await sql<Vault[]>`select id, slug, owner_name, is_demo, ntfy_topic from vaults where id = ${id}`;
  return v ?? null;
}

export async function getPeople(vaultId: string, db: typeof sql | postgres.TransactionSql = sql): Promise<Person[]> {
  return db<Person[]>`select id, vault_id, role, name, relation, email, auth0_sub from people where vault_id = ${vaultId} order by role, name`;
}

export async function getPerson(id: string): Promise<Person | null> {
  const [p] = await sql<Person[]>`select id, vault_id, role, name, relation, email, auth0_sub from people where id = ${id}`;
  return p ?? null;
}

export async function getSwitch(vaultId: string): Promise<SwitchRow> {
  const [s] = await sql<SwitchRow[]>`select * from switch where vault_id = ${vaultId}`;
  return s;
}

// Links a signed-in Auth0 user to their person row (by verified email) the first time they sign in.
export async function personForSession(user: { sub: string; email?: string | null; email_verified?: boolean }): Promise<Person[]> {
  if (user.email && user.email_verified) {
    await sql`update people set auth0_sub = ${user.sub} where lower(email) = lower(${user.email}) and auth0_sub is null`;
  }
  return sql<Person[]>`select id, vault_id, role, name, relation, email, auth0_sub from people where auth0_sub = ${user.sub}`;
}
