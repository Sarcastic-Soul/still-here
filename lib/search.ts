// Hybrid search over the owner's notes on Tiger: BM25 (pg_textsearch) catches exact words like
// "LIC" or a policy number, DiskANN vector search (pgvectorscale) catches meaning
// ("insurance" finds "policy"). The two lists are merged with reciprocal rank fusion.
// Search knows nothing about who is asking; FGA filters the result afterwards.
import { sql } from "./db";
import { embed, toVector } from "./embed";

export type Hit = { id: string; title: string; body: string; score: number; bm25_rank: number | null; vec_rank: number | null };

export async function searchNotes(vaultId: string, query: string, limit = 20): Promise<Hit[]> {
  const vec = toVector(await embed(query, "query"));
  const pool = limit * 2;
  return sql<Hit[]>`
    with bm as (
      select id, row_number() over (order by score) as rnk
      from (select id, search_text <@> to_bm25query(${query}, 'notes_bm25_idx') as score
            from notes where vault_id = ${vaultId}
            order by search_text <@> to_bm25query(${query}, 'notes_bm25_idx')
            limit ${pool}) b
      where score < 0
    ),
    vec as (
      select id, row_number() over (order by dist) as rnk
      from (select id, embedding <=> ${vec}::vector as dist
            from notes where vault_id = ${vaultId} and embedding is not null
            order by embedding <=> ${vec}::vector
            limit ${pool}) v
    ),
    fused as (
      select coalesce(bm.id, vec.id) as id,
             coalesce(1.0 / (60 + bm.rnk), 0) + coalesce(1.0 / (60 + vec.rnk), 0) as score,
             bm.rnk as bm25_rank, vec.rnk as vec_rank
      from bm full outer join vec on bm.id = vec.id
    )
    select n.id, n.title, n.body, f.score::float8 as score, f.bm25_rank::int, f.vec_rank::int
    from fused f join notes n on n.id = f.id
    order by f.score desc
    limit ${limit}`;
}
