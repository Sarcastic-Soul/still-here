// The demo page polls this. Each poll also ticks the demo switch, so a "week" passes in seconds.
import { demoVault } from "@/lib/demo";
import { json } from "@/lib/http";
import { vaultStatus } from "@/lib/status";
import { tick } from "@/lib/switch";

export const dynamic = "force-dynamic";

export async function GET() {
  const v = await demoVault();
  await tick(v.id);
  return json(await vaultStatus(v.id));
}
