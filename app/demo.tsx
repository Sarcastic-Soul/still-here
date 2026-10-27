"use client";
// The live demo vault. Everything here talks to the real switch, CIBA stand-in, FGA and model
// through /api/demo/*. A "week" lasts a few seconds so a visitor can watch the whole path.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ArrowCounterClockwise, BellRinging, Check, DeviceMobile, EnvelopeSimple, EnvelopeSimpleOpen, HandWaving,
  LockKey, LockSimple, Note, PaperPlaneRight, X,
} from "@phosphor-icons/react";
import type { VaultStatus } from "@/lib/status";
import type { AskResult } from "@/lib/ask";
import type { SwitchState } from "@/lib/vault";
import { Marigold, PRESSED } from "@/components/art";
import { Candle, Pulse, burst } from "@/components/motion";

type Ctx = { status: VaultStatus; refresh: () => Promise<void>; now: number };
const DemoCtx = createContext<Ctx | null>(null);
const useDemo = () => useContext(DemoCtx)!;

const post = async (url: string, data: unknown) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error ?? "Something went wrong. Try again.");
  return out;
};

export function DemoProvider({ initial, serverNow, children }: { initial: VaultStatus; serverNow: number; children: React.ReactNode }) {
  const [status, setStatus] = useState(initial);
  // Starts at the server's clock so the first render matches the HTML
  const [now, setNow] = useState(serverNow);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/demo/status", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } finally {
      inFlight.current = false;
      setNow(Date.now());
    }
  }, []);
  useEffect(() => {
    // Each poll also moves the demo switch forward, so only poll while someone is looking
    const id = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 1500);
    return () => clearInterval(id);
  }, [refresh]);
  return <DemoCtx.Provider value={{ status, refresh, now }}>{children}</DemoCtx.Provider>;
}

const owner = (s: VaultStatus) => s.people.find((p) => p.role === "owner")!;
const trusted = (s: VaultStatus) => s.people.filter((p) => p.role === "trusted");
const secs = (from: string | Date | null, now: number) => (from ? Math.max(0, Math.round((now - new Date(from).getTime()) / 1000)) : 0);
// "40 seconds", "3 minutes", "2 hours", "5 days"
const span = (n: number) => {
  const [v, u] = n < 90 ? [n, "second"] : n < 5400 ? [n / 60, "minute"] : n < 129600 ? [n / 3600, "hour"] : [n / 86400, "day"];
  const r = Math.round(v);
  return `${r} ${u}${r === 1 ? "" : "s"}`;
};
const both = (s: VaultStatus) => trusted(s).map((p) => p.name).join(" and ");

function pulseLabel(s: VaultStatus, now: number) {
  const sw = s.switch;
  if (s.state === "alive") return `Alive. Last answer ${span(secs(sw.last_answer_at, now))} ago`;
  if (s.state === "missed") return `Missed ${sw.miss_limit} in a row. Last chance sent`;
  if (s.state === "confirming") return `Confirming. Waiting on ${both(s)}`;
  return `Released ${span(secs(sw.released_at, now))} ago`;
}

export function HeroPulse() {
  const { status, now } = useDemo();
  return (
    <div className="pulse" aria-hidden="true">
      <span className="pulse-label"><span className={`dot ${status.state}`} />{pulseLabel(status, now)}</span>
      <Pulse state={status.state} />
    </div>
  );
}

export function CheckinCard() {
  const { status, refresh } = useDemo();
  const [line, setLine] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const released = status.state === "released";

  async function answer() {
    setBusy(true);
    try {
      const r = await post("/api/demo/checkin", { line });
      if (!r.ok) setMsg("Too late. The vault is already released. Reset the demo to start again.");
      else {
        burst(btn.current);
        setMsg(r.was === "confirming" ? "Answered. Riya and Kabir's requests were cancelled." : "Answered. The clock starts again.");
        setLine("");
      }
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="answer" aria-label="The weekly check-in" onSubmit={(e) => { e.preventDefault(); answer(); }}>
      <small><BellRinging size={16} />Demo vault. A week here lasts {status.switch.every_seconds} seconds.</small>
      <button className="yes" ref={btn} disabled={busy || released}><HandWaving size={20} weight="fill" />I&apos;m still here</button>
      <input className="line" value={line} onChange={(e) => setLine(e.target.value)} maxLength={200} placeholder="Anything changed? (moved my FD to SBI)" aria-label="Optional line about what changed" />
      <p className="thanks" aria-live="polite">{released && !msg ? "Released. Nobody can answer for him now." : msg}</p>
    </form>
  );
}

const STEPS: { state: SwitchState; title: string; text: (s: VaultStatus) => string }[] = [
  { state: "alive", title: "Alive", text: () => "A push every week. One tap answers it. Nothing else happens." },
  { state: "missed", title: "Missed", text: (s) => `${s.switch.miss_limit} silent weeks, then one last chance.` },
  { state: "confirming", title: "Confirming", text: (s) => `${both(s)} each get an Auth0 Guardian push. One "no" stops it.` },
  { state: "released", title: "Released", text: () => "Auth0 FGA opens what is theirs, and only that." },
];
const ORDER: SwitchState[] = ["alive", "missed", "confirming", "released"];

export function PathHome({ trail }: { trail: { t: number; x: string; y: string; rx: string; ry: string; rot: string }[] }) {
  const { status } = useDemo();
  const at = ORDER.indexOf(status.state);
  const upto = at / 3 + 0.02;
  return (
    <>
      <div className="trail" aria-hidden="true">
        <svg viewBox="0 0 1000 60" preserveAspectRatio="none">
          {trail.map((p, i) => (
            <ellipse key={i} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} transform={p.rot} style={{ transitionDelay: `${i * 12}ms` }}
              fill={p.t <= upto ? (p.t > upto - 0.1 ? "#f6c76e" : "#eaa33a") : "#3a3029"} />
          ))}
        </svg>
      </div>
      <ol className="path">
        {STEPS.map((s, i) => (
          <li key={s.state} className={`step ${i === at ? "lit" : i < at ? "past" : ""}`} aria-current={i === at ? "step" : undefined}>
            <h3>{s.title}</h3>
            <p>{s.text(status)}</p>
          </li>
        ))}
      </ol>
      <LivePanel />
    </>
  );
}

function clockText(s: VaultStatus, now: number) {
  const sw = s.switch;
  if (s.state === "alive") {
    const next = Math.max(0, sw.every_seconds - secs(sw.last_ping_at ?? sw.last_answer_at, now));
    return sw.missed_count ? `${sw.missed_count} unanswered. Next ping in ${next} s.` : `Next ping in ${next} s. Answer it, or don't.`;
  }
  if (s.state === "missed") return `Last chance. ${Math.max(0, sw.grace_seconds - secs(sw.last_chance_at, now))} s before ${both(s)} are asked.`;
  if (s.state === "confirming") return `Waiting for ${both(s)}. Both must say yes.`;
  return "Released. Scroll down to see what each of them got.";
}

function LivePanel() {
  const { status, now, refresh } = useDemo();
  const [busy, setBusy] = useState("");
  const sw = status.switch;
  const misses = status.state === "alive" ? sw.missed_count : status.state === "missed" || status.state === "confirming" || status.state === "released" ? sw.miss_limit : 0;
  const silence = secs(sw.last_answer_at, now);

  async function decide(personId: string, decision: "approved" | "denied") {
    setBusy(personId);
    try { await post("/api/demo/decide", { personId, decision }); await refresh(); } finally { setBusy(""); }
  }
  async function reset() {
    setBusy("reset");
    try { await post("/api/demo/reset", {}); await refresh(); } finally { setBusy(""); }
  }

  return (
    <div className="live">
      <div className="clock">
        <h4>The switch</h4>
        <div className="misses" aria-label={`${misses} of ${sw.miss_limit} check-ins missed`}>
          {Array.from({ length: sw.miss_limit }, (_, i) => <span key={i} className={i < misses ? "on" : ""} />)}
        </div>
        <p>{clockText(status, now)}</p>
        <button className="ghost-btn" onClick={reset} disabled={busy === "reset"}><ArrowCounterClockwise size={16} />Reset the demo</button>
      </div>

      <div className="phones">
        {trusted(status).map((p) => {
          const a = status.approvals.find((x) => x.person_id === p.id);
          const ringing = status.state === "confirming" && a?.status === "pending";
          return (
            <div key={p.id} className={`phone ${ringing ? "ringing" : ""}`}>
              <h4><DeviceMobile size={18} />{p.name}&apos;s phone</h4>
              {ringing ? (
                <>
                  <p className="push">{owner(status).name} silent {span(silence)}. Approve only if he has died</p>
                  <div className="decide">
                    <button onClick={() => decide(p.id, "approved")} disabled={!!busy}><Check size={16} />Approve</button>
                    <button onClick={() => decide(p.id, "denied")} disabled={!!busy}><X size={16} />Deny</button>
                  </div>
                </>
              ) : (
                <p className="quiet">{a?.status === "approved" ? "Said yes." : a?.status === "denied" ? "Said no." : "No request. Nothing to do."}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="log">
        <h4>Audit log</h4>
        <ul>
          {status.audit.slice(0, 7).map((e) => (
            <li key={e.id}><span>{span(secs(e.at, now)).replace(/ (\w)\w*$/, " $1")} ago</span>{auditLine(status, e)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function auditLine(s: VaultStatus, e: VaultStatus["audit"][number]) {
  const d = (e.detail ?? {}) as Record<string, unknown>;
  const name = (id: unknown) => s.people.find((p) => p.id === id)?.name ?? "Someone";
  const actor = String(e.actor).startsWith("person:") ? name(String(e.actor).slice(7)) : "";
  const o = owner(s).name;
  switch (e.action) {
    case "ping_sent": return `Asked ${o}: are you still here?`;
    case "last_chance_sent": return `Sent ${o} a last chance.`;
    case "state_missed": return `${d.missed} check-ins missed in a row.`;
    case "state_confirming": return `Asked ${both(s)} to confirm.`;
    case "approval_requested_demo":
    case "approval_requested": return `${name(d.person_id)} got a push to confirm.`;
    case "approval_blocked_no_account": return `${name(d.person_id)} has not signed in yet.`;
    case "approval_approved": return `${actor} said yes.`;
    case "approval_denied": return `${actor} said no.`;
    case "approval_expired": return `${name(d.person_id)}'s push expired.`;
    case "released": return "Released. FGA opened each person's notes.";
    case "back_to_alive": return `Back to alive: ${d.reason}.`;
    case "checked_in": return `${o} answered: still here.`;
    case "asked": return `${actor || "Someone"} asked a question.`;
    case "vault_created": return "Vault created.";
    case "memory_added": return "Backboard filed a new fact.";
    case "memory_replaced": return "Backboard replaced an old fact.";
    default: return String(e.action).replaceAll("_", " ");
  }
}

// Picked to show all three outcomes: an answer, a note that belongs to someone else, a private note
const SUGGESTED: Record<string, string[]> = {
  riya: ["Where is the LIC policy?", "What do I do about his health insurance?", "What did he write in his diary?"],
  kabir: ["What should I do with his laptop?", "Who is the nominee on his SIPs?", "What did he write in his diary?"],
};

export function Afterwards({ suggested = SUGGESTED }: { suggested?: Record<string, string[]> }) {
  const { status } = useDemo();
  const people = trusted(status);
  const [who, setWho] = useState(people[0]?.id ?? "");
  const person = people.find((p) => p.id === who) ?? people[0];
  const released = status.state === "released";
  const [letters, setLetters] = useState<{ id: string; title: string; body: string }[]>([]);

  useEffect(() => {
    if (!released || !person) { setLetters([]); return; }
    fetch(`/api/demo/letters?person=${person.id}`).then((r) => r.json()).then((d) => setLetters(d.letters ?? []));
  }, [released, person?.id]);

  if (!person) return null;
  const letter = letters[0];

  return (
    <section className="after reveal" id="after" aria-labelledby="after-title">
      <div className="after-head">
        <h2 id="after-title">Afterwards</h2>
        <div className="who" role="tablist" aria-label="See it as">
          {people.map((p) => (
            <button key={p.id} role="tab" aria-selected={p.id === person.id} className={p.id === person.id ? "on" : ""} onClick={() => setWho(p.id)}>
              {p.name}, his {p.relation}
            </button>
          ))}
        </div>
      </div>
      <div className={`ofrenda ${released ? "released" : ""}`}>
        <div className="altar">
          <Candle lit={released} />
          <small>{released ? "Lit when they both said yes" : "Unlit while he answers"}</small>
        </div>
        <div className={`letter ${released && letter ? "open" : ""}`}>
          <div className="to">
            {released ? <EnvelopeSimpleOpen size={16} /> : <EnvelopeSimple size={16} />}
            For {person.name} · {released ? "opened after both said yes" : "sealed"}
          </div>
          {released && letter ? (
            letter.body.split(/\n\n+/).map((para, i) => <p key={i} className="ink" style={{ animationDelay: `${i * 0.6}s` }}>{para}</p>)
          ) : (
            <div className="sealed">
              <div className="seal-lines" aria-hidden="true"><i /><i /><i /><i /><i /></div>
              <p className="seal-text"><LockSimple size={16} />Sealed. Opens only after {both(status)} both say yes on their phones.</p>
              <a className="peek" href="#how">Stop answering and watch it happen</a>
            </div>
          )}
          <Marigold seed={23} colors={PRESSED} layers={5} className="pressed" />
        </div>
        <Ask key={person.id} person={person} released={released} suggested={suggested[person.name.toLowerCase()] ?? []} />
      </div>
    </section>
  );
}

function Ask({ person, released, suggested }: { person: { id: string; name: string }; released: boolean; suggested: string[] }) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const [res, setRes] = useState<AskResult | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    if (!question.trim()) return;
    setBusy(true); setErr(""); setRes(null); setAsked(question);
    try {
      setRes(await post("/api/demo/ask", { personId: person.id, question }));
      setQ("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!released)
    return (
      <div className="qa">
        <p className="q">{person.name} tries to ask: {suggested[0]?.toLowerCase()}</p>
        <p className="a dim">Nothing has been released yet.</p>
        <p className="gate"><LockKey size={16} />Search can find his notes. Until release FGA lets {person.name} read none of them, so the model never sees them.</p>
      </div>
    );

  return (
    <div className="qa">
      <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <label htmlFor="ask-q">Ask as {person.name}</label>
        <div className="ask-row">
          <input id="ask-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder="Where is the LIC policy?" />
          <button disabled={busy || !q.trim()} aria-label="Ask"><PaperPlaneRight size={18} /></button>
        </div>
      </form>
      <div className="chips">
        {suggested.map((s) => <button key={s} onClick={() => ask(s)} disabled={busy}>{s}</button>)}
      </div>
      <div className="result" aria-live="polite">
        {asked && <p className="q">{person.name} asks: {asked}</p>}
        {busy && <p className="a dim">Reading the notes {person.name} is allowed to read…</p>}
        {err && <p className="a dim">{err}</p>}
        {res && (
          <>
            <p className={`a ${res.outcome !== "answered" ? "dim" : ""}`}>{res.answer}</p>
            {res.citations.map((c) => <span key={c.id} className="src"><Note size={15} />{c.title}</span>)}
            <p className="gate"><LockKey size={16} />Search found {res.candidates} notes. FGA let {res.allowed} through for {person.name}. The model saw only those.</p>
          </>
        )}
      </div>
    </div>
  );
}
