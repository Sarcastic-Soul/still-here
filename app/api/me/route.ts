// Who is signed in, which vaults they belong to, and each vault's state.
import { json } from "@/lib/http";
import { currentPeople } from "@/lib/session";
import { vaultStatus } from "@/lib/status";

export async function GET() {
  const people = await currentPeople();
  const vaults = await Promise.all(
    people.map(async (p) => {
      const status = await vaultStatus(p.vault_id);
      // Trusted people see the state only; the owner sees the whole timeline
      return { person: { id: p.id, role: p.role, name: p.name }, state: status.state, status: p.role === "owner" ? status : undefined };
    }),
  );
  return json({ vaults });
}
