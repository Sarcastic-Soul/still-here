// Backboard memory over plain fetch. Only the memory endpoints are used: the free credit
// covers Memory and RAG, not chat, so the open model does the thinking and Backboard keeps
// one assistant per vault holding the owner's current facts.
import { need } from "./env";

const BASE = "https://app.backboard.io/api";

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}, timeoutMs = 10000): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { "X-API-Key": need("BACKBOARD_API_KEY"), "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Backboard ${init.method ?? "GET"} ${path} returned ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export type Memory = { id: string; content: string; score?: number | null; metadata?: Record<string, unknown>; updated_at?: string | null };

export async function createAssistant(name: string): Promise<string> {
  const r = await call<{ assistant_id?: string; id?: string }>("/assistants", { method: "POST", body: { name } });
  const id = r.assistant_id ?? r.id;
  if (!id) throw new Error("Backboard did not return an assistant id");
  return String(id);
}

export const deleteAssistant = (assistantId: string) => call(`/assistants/${assistantId}`, { method: "DELETE" });

export async function listMemories(assistantId: string): Promise<Memory[]> {
  const r = await call<{ memories?: Memory[] }>(`/assistants/${assistantId}/memories?page_size=100`);
  return r.memories ?? [];
}

// Results come back with a relevance score, not in order, so the caller gets them sorted
export async function searchMemories(assistantId: string, query: string, limit = 5): Promise<Memory[]> {
  const r = await call<{ memories?: Memory[] }>(`/assistants/${assistantId}/memories/search`, { method: "POST", body: { query, limit } });
  return (r.memories ?? []).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export async function addMemory(assistantId: string, content: string, metadata: Record<string, unknown> = {}) {
  const r = await call<{ memory_id?: string; id?: string }>(`/assistants/${assistantId}/memories`, { method: "POST", body: { content, metadata } });
  return String(r.memory_id ?? r.id);
}

export const updateMemory = (assistantId: string, memoryId: string, content: string) =>
  call(`/assistants/${assistantId}/memories/${memoryId}`, { method: "PUT", body: { content } });
