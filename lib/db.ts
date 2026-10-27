import postgres from "postgres";
import { need } from "./env";

declare global {
  var stillHereSql: postgres.Sql | undefined;
}

// One pool per process. Next dev reloads modules, so keep it on globalThis.
export const sql: postgres.Sql =
  globalThis.stillHereSql ??
  (globalThis.stillHereSql = postgres(need("DATABASE_URL"), { max: 5, idle_timeout: 20, prepare: false, onnotice: () => {} }));
