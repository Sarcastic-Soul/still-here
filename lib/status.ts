// What the switch looks like right now, for the timeline page.
import { sql } from "./db";
import { getPeople, getSwitch } from "./vault";

export async function vaultStatus(vaultId: string) {
  const [s, people, approvals, audit, checkins] = await Promise.all([
    getSwitch(vaultId),
    getPeople(vaultId),
    sql`select person_id, round, status, sent_at, decided_at from approvals where vault_id = ${vaultId} order by round desc, sent_at`,
    sql`select id, at, actor, action, detail from audit_log where vault_id = ${vaultId} order by id desc limit 50`,
    sql`select id, kind, sent_at, answered_at, line from checkins where vault_id = ${vaultId} order by sent_at desc limit 20`,
  ]);
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
