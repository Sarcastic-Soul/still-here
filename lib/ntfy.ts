// "Are you still here?" goes out as an ntfy.sh push with a one-tap answer button.
import { maybe, need } from "./env";

export async function push(opts: { title: string; message: string; click?: string; actions?: { label: string; url: string; method?: "POST" }[]; priority?: 3 | 4 | 5 }) {
  const topic = maybe("NTFY_TOPIC");
  if (!topic) return false;
  const res = await fetch(`https://ntfy.sh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      title: opts.title,
      message: opts.message,
      priority: opts.priority ?? 4,
      click: opts.click,
      // A POST action answers straight from the notification; a plain one opens the page
      actions: opts.actions?.map((a) =>
        a.method ? { action: "http", label: a.label, url: a.url, method: a.method, clear: true } : { action: "view", label: a.label, url: a.url, clear: true },
      ),
    }),
  });
  return res.ok;
}

export const appUrl = (path: string) => `${need("APP_BASE_URL").replace(/\/$/, "")}${path}`;
