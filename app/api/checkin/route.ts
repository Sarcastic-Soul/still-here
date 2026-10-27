// "I'm still here". Either the signed one-tap link from the ntfy push, or the signed-in owner.
import { fail, json, body } from "@/lib/http";
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
    return json(await checkIn(t.vaultId, { checkinId: t.checkinId, line: b.line, channel: "ntfy" }));
  }
  const owner = (await currentPeople()).find((p) => p.role === "owner");
  if (!owner) return fail("Sign in as the owner, or use the link from the push.", 401);
  return json(await checkIn(owner.vault_id, { line: b.line, channel: "web" }));
}
