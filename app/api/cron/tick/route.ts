// Daily Vercel cron: moves every real vault's switch forward. The demo vault ticks from its page.
import { sql } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { tick } from "@/lib/switch";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET) return fail("no", 401);
  const vaults = await sql`select id, slug from vaults where not is_demo`;
  const out: Record<string, string> = {};
  for (const v of vaults) {
    try {
      out[v.slug] = await tick(v.id);
    } catch (e) {
      out[v.slug] = `error: ${String(e).slice(0, 200)}`;
    }
  }
  return json(out);
}
