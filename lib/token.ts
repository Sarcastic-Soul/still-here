// Signed one-tap check-in links, so answering from a phone needs no sign-in.
import { createHmac, timingSafeEqual } from "node:crypto";
import { need } from "./env";

const sign = (payload: string) => createHmac("sha256", need("CHECKIN_SECRET")).update(payload).digest("base64url");

export function checkinToken(vaultId: string, checkinId: string) {
  const payload = `${vaultId}.${checkinId}`;
  return `${payload}.${sign(payload)}`;
}

export function readCheckinToken(token: string): { vaultId: string; checkinId: string } | null {
  const [vaultId, checkinId, mac] = token.split(".");
  if (!vaultId || !checkinId || !mac) return null;
  const expected = Buffer.from(sign(`${vaultId}.${checkinId}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { vaultId, checkinId };
}
