// Runs the handbook job for a vault and saves the .docx: bun run handbook <vault slug> [model]
import { mkdirSync, writeFileSync } from "node:fs";
import { sql } from "../lib/db";
import { runHandbook } from "../lib/handbook";
import type { ModelKey } from "../lib/llm";
import { getVault } from "../lib/vault";

const [slug = "demo", model = "ultramarine-1-flash"] = process.argv.slice(2);
const vault = await getVault(slug);
if (!vault) throw new Error(`no vault ${slug}`);
const out = await runHandbook({ vaultId: vault.id, model: model as ModelKey });
mkdirSync("out", { recursive: true });
const file = `out/handbook-${slug}-${model}.docx`;
writeFileSync(file, out.docx);
const u = out.usage;
console.log(`${model}: ${out.sections.length} sections, ${out.sections.reduce((n, s) => n + s.items.length, 0)} items kept, ${out.dropped.length} dropped`);
console.log(`tokens in ${u.inputTokens}, out ${u.outputTokens}, cost $${u.costUsd.toFixed(6)}, ${(u.latencyMs / 1000).toFixed(1)}s`);
console.log(`saved ${file}`);
for (const s of out.sections) console.log(`\n[${s.audience}] ${s.title}\n` + s.items.map((i) => `  - ${i.text}`).join("\n"));
if (out.dropped.length) console.log("\ndropped:", JSON.stringify(out.dropped, null, 1));
await sql.end();
