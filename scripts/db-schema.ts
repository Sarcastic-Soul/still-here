// Applies db/schema.sql to the Tiger service in DATABASE_URL.
import { sql } from "../lib/db";

await sql.file("db/schema.sql");
const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
console.log("tables:", tables.map((t) => t.table_name).join(", "));
await sql.end();
