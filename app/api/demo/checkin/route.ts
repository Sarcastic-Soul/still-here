import { demoVault } from "@/lib/demo";
import { body, json } from "@/lib/http";
import { checkIn } from "@/lib/switch";

export async function POST(req: Request) {
  const v = await demoVault();
  const b = await body<{ line: string }>(req);
  return json(await checkIn(v.id, { line: b.line, channel: "demo" }));
}
