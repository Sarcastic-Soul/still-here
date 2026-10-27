import { fail, json } from "@/lib/http";
import { lettersFor } from "@/lib/letters";
import { currentPeople } from "@/lib/session";

export async function GET() {
  const me = (await currentPeople())[0];
  if (!me) return fail("You are not part of any vault.", 403);
  // FGA returns nothing before release (except to the owner, who wrote them)
  return json({ letters: await lettersFor(me.vault_id, me.id) });
}
