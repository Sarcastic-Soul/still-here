// Where the weekly push lands: "Are you still here?" with one button. The link is signed, so no sign-in.
import { End, Top } from "@/components/chrome";
import { sql } from "@/lib/db";
import { readCheckinToken } from "@/lib/token";
import { getSwitch, getVaultById } from "@/lib/vault";
import { Answer } from "./answer";

export const dynamic = "force-dynamic";

export default async function StillHere({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = readCheckinToken(token);
  const vault = t ? await getVaultById(t.vaultId) : null;
  const [ping] = vault ? await sql`select kind, sent_at, answered_at from checkins where id = ${t!.checkinId} and vault_id = ${vault.id}` : [];
  const state = vault ? (await getSwitch(vault.id)).state : null;

  return (
    <>
      <Top short />
      <main className="wrap">
        <section className="checkin-page">
          {!vault || !ping ? (
            <>
              <h1 className="ask-line">This link is not valid.</h1>
              <p className="lede" style={{ marginTop: 20, color: "var(--soft)" }}>Open the latest push, or sign in to answer from your vault page.</p>
            </>
          ) : (
            <>
              <h1 className="ask-line">
                {ping.kind === "last_chance" ? "Last chance. " : ""}Are you <i>still</i> here, {vault.owner_name}?
              </h1>
              <Answer token={token} released={state === "released"} answered={!!ping.answered_at} />
            </>
          )}
        </section>
        <End />
      </main>
    </>
  );
}
