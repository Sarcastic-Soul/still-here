// What the switch looks like right now, for the timeline page.
import { sql } from "./db";
import type { SwitchRow } from "./vault";

export type VaultStatus = Awaited<ReturnType<typeof vaultStatus>>;

export async function vaultStatus(vaultId: string) {
  // One round trip: the database is far from some hosts, and the demo polls this every second or two
  const [row] = await sql`
    select
      (select row_to_json(s) from switch s where s.vault_id = ${vaultId}) as s,
      (select coalesce(json_agg(p order by p.role, p.name), '[]') from (
        select id, role, name, relation, auth0_sub from people where vault_id = ${vaultId}) p) as people,
      (select coalesce(json_agg(a order by a.round desc, a.sent_at), '[]') from (
        select person_id, round, status, sent_at, decided_at from approvals where vault_id = ${vaultId}) a) as approvals,
      (select coalesce(json_agg(l order by l.id desc), '[]') from (
        select id, at, actor, action, detail from audit_log where vault_id = ${vaultId} order by id desc limit 50) l) as audit,
      (select coalesce(json_agg(c order by c.sent_at desc), '[]') from (
        select id, kind, sent_at, answered_at, line from checkins where vault_id = ${vaultId} order by sent_at desc limit 20) c) as checkins`;
  const s = row.s as Omit<SwitchRow, "last_answer_at" | "last_ping_at" | "last_chance_at" | "released_at"> & { last_answer_at: string } & Record<"last_ping_at" | "last_chance_at" | "released_at", string | null>;
  const people = row.people as { id: string; role: "owner" | "trusted"; name: string; relation: string; auth0_sub: string | null }[];
  const approvals = row.approvals as { person_id: string; round: number; status: string; sent_at: string; decided_at: string | null }[];
  const audit = row.audit as { id: number; at: string; actor: string; action: string; detail: Record<string, unknown> }[];
  const checkins = row.checkins as { id: string; kind: string; sent_at: string; answered_at: string | null; line: string | null }[];
  // Approvals only mean something while confirming, or as the record of a release
  const current = s.state === "confirming" || s.state === "released" ? approvals.filter((a) => a.round === s.round) : [];
  return {
    state: s.state,
    switch: {
      every_seconds: s.every_seconds,
      miss_limit: s.miss_limit,
      grace_seconds: s.grace_seconds,
      missed_count: s.missed_count,
      last_answer_at: s.last_answer_at,
      last_ping_at: s.last_ping_at,
      last_chance_at: s.last_chance_at,
      released_at: s.released_at,
      round: s.round,
    },
    people: people.map((p) => ({ id: p.id, role: p.role, name: p.name, relation: p.relation, linked: !!p.auth0_sub })),
    approvals: current,
    checkins,
    audit,
  };
}
