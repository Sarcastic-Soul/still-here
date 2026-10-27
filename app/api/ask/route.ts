import { ask } from "@/lib/ask";
import { body, fail, json } from "@/lib/http";
import { currentPeople } from "@/lib/session";
import { getSwitch } from "@/lib/vault";

export async function POST(req: Request) {
  const b = await body<{ question: string; vaultId: string }>(req);
  if (!b.question?.trim()) return fail("Ask a question.");
  const people = await currentPeople();
  const me = people.find((p) => p.vault_id === b.vaultId) ?? people[0];
  if (!me) return fail("You are not part of any vault.", 403);
  const s = await getSwitch(me.vault_id);
  if (me.role !== "owner" && s.state !== "released") return fail("Nothing has been released.", 403);
  return json(await ask({ vaultId: me.vault_id, personId: me.id, question: b.question }));
}
