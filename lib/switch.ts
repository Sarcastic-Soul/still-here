// The dead man's switch. Plain code, no model: it alone decides when anything is released.
//
//   alive ──(miss_limit pings unanswered)──> missed ──(last-chance ping unanswered)──> confirming
//   confirming ──(every trusted person approves on their phone)──> released
//   A check-in from the owner, or one "deny" from a trusted person, goes back to alive.
import type postgres from "postgres";
import { audit } from "./audit";
import { checkApproval, startApproval } from "./ciba";
import { sql } from "./db";
import { markReleased, unmarkReleased } from "./fga";
import { appUrl, push } from "./ntfy";
import { checkinToken } from "./token";
import { getPeople, getVaultById, type SwitchRow, type Vault } from "./vault";

type Tx = postgres.TransactionSql;

const secondsSince = (d: Date | null, now: Date) => (d ? (now.getTime() - d.getTime()) / 1000 : Infinity);

export function describeSilence(seconds: number, demo: boolean) {
  if (demo) return `${Math.round(seconds)} seconds`;
  const days = Math.round(seconds / 86400);
  return days >= 14 ? `${Math.round(days / 7)} weeks` : `${days} days`;
}

async function sendPing(tx: Tx, vault: Vault, kind: "regular" | "last_chance") {
  const [row] = await tx`insert into checkins (vault_id, kind) values (${vault.id}, ${kind}) returning id`;
  const token = checkinToken(vault.id, row.id);
  const link = appUrl(`/still-here/${token}`);
  // The public demo vault never pushes to the owner's phone
  const sent = vault.is_demo
    ? false
    : await push({
        title: kind === "last_chance" ? "Last chance: are you still here?" : "Are you still here?",
        message:
          kind === "last_chance"
            ? "You have missed several check-ins. If you don't answer, Still Here will ask your trusted people to confirm."
            : "Tap to say you're still here. Add a line if something changed.",
        click: link,
        actions: [
          { label: "I'm still here", url: appUrl(`/api/checkin?token=${token}`), method: "POST" },
          { label: "Add a line", url: link },
        ],
        priority: kind === "last_chance" ? 5 : 4,
      });
  await audit(vault.id, "system", kind === "last_chance" ? "last_chance_sent" : "ping_sent", { checkin_id: row.id, pushed: sent }, tx);
  return row.id as string;
}

// Starts (or restarts, after a push expired) the CIBA request for one trusted person.
async function askPerson(tx: Tx, vault: Vault, s: SwitchRow, person: { id: string; name: string; auth0_sub: string | null }, now: Date) {
  const silence = describeSilence(secondsSince(s.last_answer_at, now), vault.is_demo);
  if (vault.is_demo || !person.auth0_sub) {
    // Demo: the page shows Approve / Deny buttons for each trusted person instead of a phone push.
    // Real vault without a linked Auth0 account: nobody can be asked yet, so it waits.
    await tx`
      insert into approvals (vault_id, person_id, round, status, sent_at)
      values (${vault.id}, ${person.id}, ${s.round}, 'pending', ${now})
      on conflict (vault_id, person_id, round) do update set status = 'pending', auth_req_id = null, sent_at = ${now}`;
    await audit(vault.id, "system", vault.is_demo ? "approval_requested_demo" : "approval_blocked_no_account", { person_id: person.id, round: s.round }, tx);
    return;
  }
  const req = await startApproval(person.auth0_sub, `${vault.owner_name} silent ${silence}. Approve only if he has died`);
  const expires = new Date(now.getTime() + req.expiresIn * 1000);
  await tx`
    insert into approvals (vault_id, person_id, round, auth_req_id, status, sent_at, expires_at)
    values (${vault.id}, ${person.id}, ${s.round}, ${req.authReqId}, 'pending', ${now}, ${expires})
    on conflict (vault_id, person_id, round)
    do update set auth_req_id = ${req.authReqId}, status = 'pending', sent_at = ${now}, expires_at = ${expires}`;
  await audit(vault.id, "system", "approval_requested", { person_id: person.id, round: s.round, channel: "auth0_ciba_guardian" }, tx);
}

async function release(tx: Tx, vault: Vault, now: Date) {
  await tx`update switch set state = 'released', released_at = ${now}, updated_at = ${now} where vault_id = ${vault.id}`;
  // From here on FGA lets each person read what was shared with them, and nothing else.
  await markReleased(vault.id);
  await audit(vault.id, "system", "released", {}, tx);
}

async function cancelToAlive(tx: Tx, vaultId: string, now: Date, reason: string, actor: string) {
  await tx`
    update switch set state = 'alive', missed_count = 0, last_answer_at = ${now}, last_ping_at = null,
      last_chance_at = null, updated_at = ${now}
    where vault_id = ${vaultId}`;
  await tx`update approvals set status = 'cancelled', decided_at = ${now} where vault_id = ${vaultId} and status = 'pending'`;
  await audit(vaultId, actor, "back_to_alive", { reason }, tx);
}

// Moves the switch forward if it is time. Safe to call as often as you like (cron, page poll).
export async function tick(vaultId: string, now = new Date()) {
  const vault = await getVaultById(vaultId);
  if (!vault) throw new Error(`no vault ${vaultId}`);
  return sql.begin(async (tx) => {
    const [s] = await tx<SwitchRow[]>`select * from switch where vault_id = ${vaultId} for update`;
    if (s.state === "alive") {
      const since = secondsSince(s.last_ping_at ?? s.last_answer_at, now);
      if (since < s.every_seconds) return s.state;
      // The previous ping went out and was never answered: that is one miss
      const missed = s.last_ping_at && s.last_ping_at > s.last_answer_at ? s.missed_count + 1 : s.missed_count;
      if (missed >= s.miss_limit) {
        await sendPing(tx, vault, "last_chance");
        await tx`update switch set state = 'missed', missed_count = ${missed}, last_chance_at = ${now}, last_ping_at = ${now}, updated_at = ${now} where vault_id = ${vaultId}`;
        await audit(vaultId, "system", "state_missed", { missed }, tx);
        return "missed";
      }
      await sendPing(tx, vault, "regular");
      await tx`update switch set missed_count = ${missed}, last_ping_at = ${now}, updated_at = ${now} where vault_id = ${vaultId}`;
      return "alive";
    }

    if (s.state === "missed") {
      if (secondsSince(s.last_chance_at, now) < s.grace_seconds) return s.state;
      const round = s.round + 1;
      await tx`update switch set state = 'confirming', round = ${round}, updated_at = ${now} where vault_id = ${vaultId}`;
      await audit(vaultId, "system", "state_confirming", { round }, tx);
      const trusted = (await getPeople(vaultId)).filter((p) => p.role === "trusted");
      for (const p of trusted) await askPerson(tx, vault, { ...s, round }, p, now);
      return "confirming";
    }

    if (s.state === "confirming") {
      const rows = await tx<{ id: string; person_id: string; auth_req_id: string | null; status: string; expires_at: Date | null }[]>`
        select id, person_id, auth_req_id, status, expires_at from approvals where vault_id = ${vaultId} and round = ${s.round}`;
      const trusted = (await getPeople(vaultId)).filter((p) => p.role === "trusted");
      for (const r of rows) {
        if (r.status !== "pending" || !r.auth_req_id) continue;
        const state = await checkApproval(r.auth_req_id);
        if (state === "pending") continue;
        if (state === "expired") {
          // A Guardian push lives 5 minutes; nobody answered, so ask again on a later tick
          await tx`update approvals set status = 'expired', decided_at = ${now} where id = ${r.id}`;
          await audit(vaultId, "system", "approval_expired", { person_id: r.person_id, round: s.round }, tx);
          continue;
        }
        r.status = state;
        await tx`update approvals set status = ${state}, decided_at = ${now} where id = ${r.id}`;
        await audit(vaultId, `person:${r.person_id}`, state === "approved" ? "approval_approved" : "approval_denied", { round: s.round }, tx);
      }
      if (rows.some((r) => r.status === "denied")) {
        await cancelToAlive(tx, vaultId, now, "a trusted person said no", "system");
        return "alive";
      }
      const approved = new Set(rows.filter((r) => r.status === "approved").map((r) => r.person_id));
      if (trusted.length > 0 && trusted.every((p) => approved.has(p.id))) {
        await release(tx, vault, now);
        return "released";
      }
      // Re-ask anyone whose push expired, at most once per resend window
      const resendAfter = vault.is_demo ? 0 : 6 * 3600;
      for (const r of rows) {
        const p = trusted.find((t) => t.id === r.person_id);
        if (p && r.status === "expired" && secondsSince(r.expires_at, now) >= resendAfter) await askPerson(tx, vault, s, p, now);
      }
      return "confirming";
    }
    return s.state;
  });
}

// The owner answered. Works from any state except released.
export async function checkIn(vaultId: string, opts: { checkinId?: string; line?: string; channel?: string } = {}, now = new Date()) {
  return sql.begin(async (tx) => {
    const [s] = await tx<SwitchRow[]>`select * from switch where vault_id = ${vaultId} for update`;
    if (s.state === "released") return { ok: false as const, state: s.state };
    const line = opts.line?.trim().slice(0, 500) || null;
    if (opts.checkinId) {
      await tx`update checkins set answered_at = ${now}, line = ${line} where id = ${opts.checkinId} and vault_id = ${vaultId} and answered_at is null`;
    } else {
      await tx`insert into checkins (vault_id, answered_at, line, channel) values (${vaultId}, ${now}, ${line}, ${opts.channel ?? "web"})`;
    }
    // Answering also closes any other open pings
    await tx`update checkins set answered_at = ${now} where vault_id = ${vaultId} and answered_at is null`;
    const was = s.state;
    await tx`
      update switch set state = 'alive', missed_count = 0, last_answer_at = ${now}, last_ping_at = null,
        last_chance_at = null, updated_at = ${now}
      where vault_id = ${vaultId}`;
    if (was === "confirming") {
      await tx`update approvals set status = 'cancelled', decided_at = ${now} where vault_id = ${vaultId} and status = 'pending'`;
    }
    await audit(vaultId, "owner", "checked_in", { was, line: line ? true : false }, tx);
    return { ok: true as const, state: "alive" as const, was, line };
  });
}

// Demo vault only: the page plays the trusted people, since visitors can't get a Guardian push.
export async function demoDecide(vaultId: string, personId: string, decision: "approved" | "denied", now = new Date()) {
  const vault = await getVaultById(vaultId);
  if (!vault?.is_demo) throw new Error("demo decisions only work on the demo vault");
  await sql.begin(async (tx) => {
    const [s] = await tx<SwitchRow[]>`select * from switch where vault_id = ${vaultId} for update`;
    if (s.state !== "confirming") return;
    await tx`update approvals set status = ${decision}, decided_at = ${now} where vault_id = ${vaultId} and person_id = ${personId} and round = ${s.round} and status = 'pending'`;
    await audit(vaultId, `person:${personId}`, decision === "approved" ? "approval_approved" : "approval_denied", { round: s.round, demo: true }, tx);
  });
  return tick(vaultId, now);
}

// Demo vault only: back to a fresh alive state, release undone.
export async function demoReset(vaultId: string, now = new Date()) {
  const vault = await getVaultById(vaultId);
  if (!vault?.is_demo) throw new Error("reset only works on the demo vault");
  await sql.begin(async (tx) => {
    await cancelToAlive(tx, vaultId, now, "demo reset", "visitor");
    await tx`update switch set released_at = null where vault_id = ${vaultId}`;
    await tx`delete from checkins where vault_id = ${vaultId}`;
  });
  await unmarkReleased(vaultId);
}
