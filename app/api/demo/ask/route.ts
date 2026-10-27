import { ask } from "@/lib/ask";
import { demoPerson, demoQuestionsLastHour, demoVault } from "@/lib/demo";
import { body, fail, json } from "@/lib/http";
import { getSwitch } from "@/lib/vault";

export async function POST(req: Request) {
  const v = await demoVault();
  const b = await body<{ personId: string; question: string }>(req);
  const p = await demoPerson(v.id, b.personId);
  if (!p) return fail("Pick who you are.");
  if (!b.question?.trim()) return fail("Ask a question.");
  if ((await getSwitch(v.id)).state !== "released" && p.role !== "owner") return fail("Nothing has been released yet.", 403);
  if ((await demoQuestionsLastHour(v.id)) > 150) return fail("The demo is busy. Try again in a bit.", 429);
  return json(await ask({ vaultId: v.id, personId: p.id, question: b.question }));
}
