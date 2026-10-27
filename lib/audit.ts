import type postgres from "postgres";
import { sql } from "./db";

// Append-only. A trigger on audit_log rejects any UPDATE or DELETE.
export async function audit(vaultId: string | null, actor: string, action: string, detail: Record<string, unknown> = {}, db: postgres.Sql | postgres.TransactionSql = sql) {
  await db`insert into audit_log (vault_id, actor, action, detail) values (${vaultId}, ${actor}, ${action}, ${sql.json(detail as never)})`;
}
