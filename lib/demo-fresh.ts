import { getSwitch } from "./vault";
import { demoReset, tick } from "./switch";
import type { Vault } from "./vault";

// A released demo stays released for ten minutes, then starts over for the next visitor.
const KEEP_RELEASED_MS = 10 * 60 * 1000;

export async function freshDemoTick(vault: Vault) {
  const state = await tick(vault.id, new Date(), vault);
  if (state !== "released") return;
  const s = await getSwitch(vault.id);
  if (s.released_at && Date.now() - s.released_at.getTime() > KEEP_RELEASED_MS) await demoReset(vault.id);
}
