import { demoPerson, demoVault } from "@/lib/demo";
import { body, fail, json } from "@/lib/http";
import { demoDecide } from "@/lib/switch";

export async function POST(req: Request) {
  const v = await demoVault();
  const b = await body<{ personId: string; decision: string }>(req);
  const p = await demoPerson(v.id, b.personId);
  if (!p || p.role !== "trusted") return fail("Pick a trusted person.");
  if (b.decision !== "approved" && b.decision !== "denied") return fail("approved or denied");
  return json({ state: await demoDecide(v.id, p.id, b.decision) });
}
