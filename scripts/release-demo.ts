// Runs the demo vault through the whole switch: pings go unanswered, the last chance passes,
// both trusted people approve (simulated in demo mode), and the vault is released.
import { sql } from "../lib/db";
import { demoDecide, demoReset, tick } from "../lib/switch";
import { getPeople, getSwitch, getVault } from "../lib/vault";

const vault = (await getVault("demo"))!;
await demoReset(vault.id);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const started = Date.now();
let state = "alive";
while (state !== "confirming") {
  state = await tick(vault.id);
  const s = await getSwitch(vault.id);
  console.log(`${((Date.now() - started) / 1000).toFixed(0)}s  ${state}  missed=${s.missed_count}`);
  await sleep(2000);
}
for (const p of (await getPeople(vault.id)).filter((p) => p.role === "trusted")) {
  state = await demoDecide(vault.id, p.id, "approved");
  console.log(`${p.name} approved -> ${state}`);
}
const log = await sql`select action, actor from audit_log where vault_id = ${vault.id} and at > now() - interval '5 minutes' order by id`;
console.log(log.map((l) => l.action).join(" > "));
await sql.end();
