import { demoVault } from "@/lib/demo";
import { json } from "@/lib/http";
import { demoReset } from "@/lib/switch";

export async function POST() {
  const v = await demoVault();
  await demoReset(v.id);
  return json({ state: "alive" });
}
