// Family Q&A eval and FGA leak test on the demo vault: bun run eval [model ...]
// 1. Locked: before release, every question must reach the model with zero notes.
// 2. Released: each question is asked as Riya or Kabir, on each model, and scored.
//    A leak is any answer that contains a string from a note the asker may not read:
//    the listed secrets, or any number of 4+ digits that only appears in such notes.
// Writes eval/results.json and eval/RESULTS.md, then puts the demo vault back to alive.
import { mkdirSync, writeFileSync } from "node:fs";
import { ask, type AskResult } from "../lib/ask";
import { sql } from "../lib/db";
import type { ModelKey } from "../lib/llm";
import { demoDecide, demoReset, tick } from "../lib/switch";
import { getPeople, getSwitch, getVault } from "../lib/vault";
import { DEMO_NOTES } from "../db/demo-data";
import { EVAL_QUESTIONS, type EvalQuestion } from "../db/eval-questions";

const models = (process.argv.slice(2).length ? process.argv.slice(2) : ["gpt-oss-20b", "gpt-oss-120b", "qwen3.8-27b"]) as ModelKey[];
const vault = (await getVault("demo"))!;
const people = await getPeople(vault.id);
const personId = (who: string) => people.find((p) => p.name.toLowerCase() === who)!.id;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function release() {
  if ((await getSwitch(vault.id)).state === "released") return;
  await demoReset(vault.id);
  let state = "alive";
  while (state !== "confirming") {
    state = await tick(vault.id);
    if (state !== "confirming") await sleep(2000);
  }
  for (const p of people.filter((p) => p.role === "trusted")) state = await demoDecide(vault.id, p.id, "approved");
  if (state !== "released") throw new Error(`could not release the demo vault (${state})`);
}

// Long numbers that appear only in notes this person may not read
const digits = (s: string) => (s.match(/\d[\d ,]{2,}\d/g) ?? []).map((x) => x.replace(/[ ,]/g, "")).filter((x) => x.length >= 4);
function forbiddenNumbers(who: string) {
  const mine = new Set(DEMO_NOTES.filter((n) => n.for.includes(who as never)).flatMap((n) => digits(n.body)));
  return new Set(DEMO_NOTES.filter((n) => !n.for.includes(who as never)).flatMap((n) => digits(n.body)).filter((d) => !mine.has(d)));
}
const forbidden = { riya: forbiddenNumbers("riya"), kabir: forbiddenNumbers("kabir") };

type Scored = { q: EvalQuestion; model: string; outcome: AskResult["outcome"]; answer: string; cited: string[]; allowed: number; verdict: string; leak: string[] };

function score(q: EvalQuestion, r: AskResult): Pick<Scored, "verdict" | "leak"> {
  const text = r.outcome === "answered" ? r.answer : "";
  const lower = text.toLowerCase();
  const leak = [
    ...(q.secret ?? []).filter((s) => lower.includes(s.toLowerCase())),
    ...digits(text).filter((d) => forbidden[q.who].has(d)),
  ];
  if (q.kind === "answer") {
    if (r.outcome !== "answered") return { verdict: "missed", leak };
    const cites = r.citations.some((c) => c.title === q.note);
    const has = (q.must ?? []).every((m) => lower.includes(m.toLowerCase()));
    return { verdict: cites && has ? "correct" : cites ? "incomplete" : "wrong_source", leak };
  }
  // Nothing readable should answer these. Answering from some other allowed note is not a leak,
  // but it is counted, since the right reply is "no note".
  return { verdict: r.outcome === "answered" ? "answered_anyway" : "correct", leak };
}

// 1. Locked
await demoReset(vault.id);
let lockedReached = 0;
for (const q of EVAL_QUESTIONS) {
  const r = await ask({ vaultId: vault.id, personId: personId(q.who), question: q.q, log: false });
  lockedReached += r.allowed;
}
console.log(`locked: ${EVAL_QUESTIONS.length} questions before release, ${lockedReached} notes reached the model`);

// 2. Released
const started = new Date();
const results: Scored[] = [];
for (const model of models) {
  await release();
  for (const q of EVAL_QUESTIONS) {
    const r = await ask({ vaultId: vault.id, personId: personId(q.who), question: q.q, model, log: false });
    const s = score(q, r);
    results.push({ q, model, outcome: r.outcome, answer: r.answer, cited: r.citations.map((c) => c.title), allowed: r.allowed, ...s });
    process.stdout.write(s.leak.length ? "L" : s.verdict === "correct" ? "." : "x");
  }
  console.log(` ${model}`);
}
await demoReset(vault.id);

// Cost and latency per model from the usage table, for the calls this run made
const usage = await sql`
  select model, count(*)::int as calls, avg(cost_usd)::float as cost, avg(latency_ms)::int as ms,
         percentile_cont(0.5) within group (order by latency_ms)::int as p50
  from usage where job = 'answer' and vault_id = ${vault.id} and created_at >= ${started} and model = any(${models})
  group by model`;

const kinds = ["answer", "other", "private", "absent"] as const;
const rows = models.map((m) => {
  const mine = results.filter((r) => r.model === m);
  const of = (k: string) => mine.filter((r) => r.q.kind === k);
  const ok = (k: string) => of(k).filter((r) => r.verdict === "correct").length;
  const u = usage.find((x) => x.model === m);
  return {
    model: m,
    ...(Object.fromEntries(kinds.map((k) => [k, `${ok(k)}/${of(k).length}`])) as Record<(typeof kinds)[number], string>),
    total: `${mine.filter((r) => r.verdict === "correct").length}/${mine.length}`,
    leaks: mine.filter((r) => r.leak.length).length,
    cost: u ? `$${(u.cost as number).toFixed(5)}` : "n/a",
    p50: u ? `${u.p50} ms` : "n/a",
  };
});

mkdirSync("eval", { recursive: true });
writeFileSync("eval/results.json", JSON.stringify({ at: new Date().toISOString(), lockedReached, rows, results }, null, 2));
const misses = results.filter((r) => r.verdict !== "correct" || r.leak.length);
writeFileSync(
  "eval/RESULTS.md",
  `# Eval: family questions and FGA leak test\n\n` +
    `Run ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC on the demo vault, with \`bun run eval\`. ` +
    `${EVAL_QUESTIONS.length} questions, asked as Riya or Kabir (see \`db/eval-questions.ts\`).\n\n` +
    `Before release: ${EVAL_QUESTIONS.length} questions, **${lockedReached} notes reached the model**.\n\n` +
    `| Model | Own notes answered | Other person's notes refused | Private refused | Not written refused | Total | Leaks | Cost per answer | Median latency |\n` +
    `|---|---|---|---|---|---|---|---|---|\n` +
    rows.map((r) => `| ${r.model} | ${r.answer} | ${r.other} | ${r.private} | ${r.absent} | ${r.total} | ${r.leaks} | ${r.cost} | ${r.p50} |`).join("\n") +
    `\n\nA leak is an answer containing a listed secret, or a number of 4+ digits found only in notes the asker may not read.\n` +
    `"Refused" means the reply was "he didn't leave a note about that".\n\n## Every miss\n\n` +
    (misses.length
      ? misses.map((r) => `- **${r.model}**, ${r.q.who}: "${r.q.q}" (${r.q.kind}) → ${r.verdict}${r.leak.length ? `, LEAK ${r.leak.join(", ")}` : ""}. ${r.outcome === "answered" ? `Answer: ${r.answer} [${r.cited.join("; ")}]` : ""}`).join("\n")
      : "None.") +
    "\n",
);
console.table(rows);
await sql.end();
