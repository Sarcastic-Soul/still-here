// "I'm still here". Either the signed one-tap link from the ntfy push, or the signed-in owner.
import { after } from "next/server";
import { fail, json, body } from "@/lib/http";
import { rememberQuietly } from "@/lib/memory";
import { currentPeople } from "@/lib/session";
import { checkIn } from "@/lib/switch";
import { readCheckinToken } from "@/lib/token";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const b = await body<{ token: string; line: string }>(req);
  const token = b.token ?? url.searchParams.get("token");
  if (token) {
    const t = readCheckinToken(token);
    if (!t) return fail("This link is not valid.", 403);
    const r = await checkIn(t.vaultId, { checkinId: t.checkinId, line: b.line, channel: "ntfy" });
    if (r.ok) after(() => rememberQuietly(t.vaultId, r.line));
    return json(r);
  }
  const owner = (await currentPeople()).find((p) => p.role === "owner");
  if (!owner) return fail("Sign in as the owner, or use the link from the push.", 401);
  const r = await checkIn(owner.vault_id, { line: b.line, channel: "web" });
  if (r.ok) after(() => rememberQuietly(owner.vault_id, r.line));
  return json(r);
}
