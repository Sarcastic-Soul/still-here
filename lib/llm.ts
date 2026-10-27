// Every model call goes through here: one OpenAI-compatible client, one entry per job.
// Swapping the model that answers the family is a change to this table, not to the code
// that calls it. Each call is written to the usage table with tokens and list-price cost.
import { sql } from "./db";
import { maybe, need } from "./env";

type Provider = "groq" | "ultramarine" | "local";

type ModelEntry = {
  provider: Provider;
  model: string;
  // USD per million tokens. Groq free tier bills $0; these are its list prices, so the
  // post can say what a run would cost on a paid account.
  price: { input: number; cachedInput: number; output: number };
};

export const MODELS = {
  "gpt-oss-20b": { provider: "groq", model: "openai/gpt-oss-20b", price: { input: 0.075, cachedInput: 0.0375, output: 0.3 } },
  "gpt-oss-120b": { provider: "groq", model: "openai/gpt-oss-120b", price: { input: 0.15, cachedInput: 0.075, output: 0.6 } },
  "qwen3.8-27b": { provider: "groq", model: "qwen/qwen3.8-27b", price: { input: 0.29, cachedInput: 0.29, output: 0.59 } },
  "ultramarine-1-flash": { provider: "ultramarine", model: "ultramarine-1-flash", price: { input: 0.15, cachedInput: 0.03, output: 0.5 } },
  // Local llama.cpp / Ollama server, for the release running with the Wi-Fi off
  local: { provider: "local", model: maybe("LOCAL_MODEL") ?? "qwen3:4b", price: { input: 0, cachedInput: 0, output: 0 } },
} satisfies Record<string, ModelEntry>;

export type ModelKey = keyof typeof MODELS;
export type Job = "draft" | "answer" | "handbook" | "eval";

// Default model per job. The family-facing answer always runs on an open-weight model.
export const JOB_MODEL: Record<Job, ModelKey> = {
  draft: "gpt-oss-120b",
  answer: (maybe("ANSWER_MODEL") as ModelKey) ?? "gpt-oss-120b",
  handbook: (maybe("HANDBOOK_MODEL") as ModelKey) ?? "gpt-oss-120b",
  eval: "gpt-oss-120b",
};

function endpoint(provider: Provider) {
  if (provider === "groq") return { base: "https://api.groq.com/openai/v1", key: need("GROQ_API_KEY") };
  if (provider === "ultramarine") return { base: need("ULTRAMARINE_BASE_URL"), key: need("PAPERINSTRUMENTS_API_KEY") };
  return { base: maybe("LOCAL_BASE_URL") ?? "http://localhost:11434/v1", key: "local" };
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatResult = {
  text: string;
  usageId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
};

export async function chat(opts: {
  job: Job;
  vaultId?: string | null;
  model?: ModelKey;
  messages: ChatMessage[];
  maxTokens: number; // always capped: the Ultramarine credit is $5
  json?: boolean;
  temperature?: number;
}): Promise<ChatResult> {
  const key = opts.model ?? JOB_MODEL[opts.job];
  const entry: ModelEntry = MODELS[key];
  const { base, key: apiKey } = endpoint(entry.provider);
  const body: Record<string, unknown> = {
    model: entry.model,
    messages: opts.messages,
    max_completion_tokens: opts.maxTokens,
    temperature: opts.temperature ?? 0.2,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  if (entry.provider === "groq" && entry.model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";

  const started = Date.now();
  let res: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status !== 429 && res.status < 500) break;
    // Groq free tier rate limits: wait as told, then try again
    const wait = Number(res.headers.get("retry-after") ?? 0) * 1000 || 2000 * (attempt + 1);
    await new Promise((r) => setTimeout(r, Math.min(wait, 20000)));
  }
  const latencyMs = Date.now() - started;
  const json = (await res!.json().catch(() => ({}))) as any;
  const u = json.usage ?? {};
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  const input = u.prompt_tokens ?? 0;
  const output = u.completion_tokens ?? 0;
  const reasoning = u.completion_tokens_details?.reasoning_tokens ?? 0;
  const cost = ((input - cached) * entry.price.input + cached * entry.price.cachedInput + output * entry.price.output) / 1e6;
  const ok = res!.ok && typeof json.choices?.[0]?.message?.content === "string";

  const [row] = await sql`
    insert into usage (vault_id, job, provider, model, input_tokens, cached_tokens, output_tokens, reasoning_tokens, cost_usd, latency_ms, ok)
    values (${opts.vaultId ?? null}, ${opts.job}, ${entry.provider}, ${key}, ${input}, ${cached}, ${output}, ${reasoning}, ${cost}, ${latencyMs}, ${ok})
    returning id`;

  if (!ok) throw new Error(`${key} call failed (${res!.status}): ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  return { text: json.choices[0].message.content, usageId: row.id, inputTokens: input, outputTokens: output, costUsd: cost, latencyMs };
}

// Models sometimes wrap JSON in a code fence even in JSON mode
export function parseJson<T>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(trimmed) as T;
}
