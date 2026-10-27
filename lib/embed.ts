// Turns text into a 384-number vector with BAAI/bge-small-en-v1.5, an open embedding model
// that runs on the CPU in this process. No embedding API to pay for or lose.
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

let extractor: Promise<FeatureExtractionPipeline> | null = null;

function load() {
  extractor ??= pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", { dtype: "q8" }) as Promise<FeatureExtractionPipeline>;
  return extractor;
}

// bge wants this prefix on short queries (not on the passages being searched)
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

export async function embed(text: string, kind: "query" | "passage" = "passage"): Promise<number[]> {
  const ex = await load();
  const out = await ex(kind === "query" ? QUERY_PREFIX + text : text, { pooling: "cls", normalize: true });
  return Array.from(out.data as Float32Array);
}

export const toVector = (v: number[]) => `[${v.join(",")}]`;
