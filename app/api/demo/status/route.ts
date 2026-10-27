// The demo page polls this. Each poll also ticks the demo switch, so a "week" passes in seconds.
import { demoVault } from "@/lib/demo";
import { json } from "@/lib/http";
import { vaultStatus } from "@/lib/status";
import { freshDemoTick } from "@/lib/demo-fresh";

export const dynamic = "force-dynamic";

export async function GET() {
  const v = await demoVault();
  await freshDemoTick(v);
  return json(await vaultStatus(v.id));
}
