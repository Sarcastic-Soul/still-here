import { demoPerson, demoVault } from "@/lib/demo";
import { fail, json } from "@/lib/http";
import { lettersFor } from "@/lib/letters";

export async function GET(req: Request) {
  const v = await demoVault();
  const p = await demoPerson(v.id, new URL(req.url).searchParams.get("person"));
  if (!p) return fail("Pick who you are.");
  return json({ letters: await lettersFor(v.id, p.id) });
}
