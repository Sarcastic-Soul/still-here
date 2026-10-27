// Real numbers for the landing page, read from the database rather than written by hand.
import { sql } from "./db";

export async function landingStats(vaultId: string) {
  const [[notes], [handbook], [answers]] = await Promise.all([
    sql`select count(*)::int as n, count(*) filter (where cardinality(shared_with) = 0)::int as private from notes where vault_id = ${vaultId}`,
    sql`
      select h.model, jsonb_array_length(h.sections) as sections, h.sections, h.dropped, u.cost_usd::float as cost, u.output_tokens, u.model as used_model
      from handbooks h left join usage u on u.id = h.usage_id
      where h.vault_id = ${vaultId} and u.provider = 'ultramarine'
      order by h.created_at desc limit 1`,
    sql`select count(*)::int as n, avg(cost_usd)::float as cost from usage where job = 'answer' and ok`,
  ]);
  const items = handbook ? (handbook.sections as { items: unknown[] }[]).reduce((n, s) => n + s.items.length, 0) : 0;
  return {
    notes: notes.n as number,
    privateNotes: notes.private as number,
    handbook: handbook ? { items, dropped: (handbook.dropped as unknown[]).length, cost: handbook.cost as number, model: handbook.used_model as string } : null,
    answerCost: answers.n ? (answers.cost as number) : null,
  };
}
