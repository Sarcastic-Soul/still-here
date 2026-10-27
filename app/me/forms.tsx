"use client";
// Forms on the vault page. Each one posts to a server action and shows its result inline.
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { HandWaving, LockKey, Note, PaperPlaneRight, Trash } from "@phosphor-icons/react";
import type { AskResult } from "@/lib/ask";
import * as A from "./actions";

type Action = (s: A.Result, f: FormData) => Promise<A.Result>;

function Submit({ children, primary = true }: { children: React.ReactNode; primary?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={`btn ${primary ? "primary" : ""}`} disabled={pending}>{pending ? "Working…" : children}</button>;
}

function Msg({ state }: { state: A.Result }) {
  if (state?.error) return <p className="err" role="alert">{state.error}</p>;
  return <p className="note-msg" aria-live="polite">{state?.ok ?? ""}</p>;
}

function useForm(action: Action) {
  return useActionState(action, null);
}

export function CreateVaultForm({ suggestedName }: { suggestedName: string }) {
  const [state, act] = useForm(A.createVaultAction);
  return (
    <form className="form" action={act}>
      <label>Your name, as your family says it<input className="field" name="name" defaultValue={suggestedName} required maxLength={60} /></label>
      {[0, 1, 2].map((i) => (
        <div className="three" key={i}>
          <label>{i < 2 ? `Trusted person ${i === 0 ? "one" : "two"}` : "A third (optional)"}<input className="field" name={`t${i}_name`} placeholder="Name" required={i < 2} maxLength={60} /></label>
          <label>They are your<input className="field" name={`t${i}_relation`} placeholder={i === 0 ? "sister" : "friend"} maxLength={40} /></label>
          <label>Their email<input className="field" name={`t${i}_email`} type="email" placeholder="they sign in with this" required={i < 2} /></label>
        </div>
      ))}
      <Msg state={state} />
      <div><Submit>Create my vault</Submit></div>
    </form>
  );
}

export function CheckInForm({ disabled }: { disabled: boolean }) {
  const [state, act] = useForm(A.checkInAction);
  return (
    <form action={act}>
      <SubmitYes disabled={disabled} />
      <input className="line" name="line" maxLength={500} placeholder="Anything changed? (moved my FD to SBI)" aria-label="Optional line about what changed" />
      <Msg state={state} />
    </form>
  );
}

function SubmitYes({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button className="yes" disabled={disabled || pending}><HandWaving size={20} weight="fill" />I&apos;m still here</button>;
}

export function TestPush() {
  const [state, act] = useForm(A.testPushAction);
  return (
    <form action={act}>
      <Submit primary={false}>Send a test push</Submit>
      <Msg state={state} />
    </form>
  );
}

export function NoteForm({ people }: { people: { id: string; name: string }[] }) {
  const [state, act] = useForm(A.addNoteAction);
  return (
    <form className="form" action={act} key={state?.ok}>
      <label>Title<input className="field" name="title" required maxLength={120} placeholder="LIC life insurance policy" /></label>
      <label>What they need to know<textarea className="field" name="body" required maxLength={4000} placeholder="Policy number, where the paper is, who the nominee is, how to claim." /></label>
      <fieldset className="checks">
        <legend className="sr">Who can ask about this note</legend>
        {people.map((p) => <label key={p.id}><input type="checkbox" name="shared" value={p.id} />{p.name} can ask about this</label>)}
      </fieldset>
      <Msg state={state} />
      <div><Submit><Note size={18} />Save note</Submit></div>
    </form>
  );
}

export function LetterForm({ people }: { people: { id: string; name: string }[] }) {
  const [state, act] = useForm(A.addLetterAction);
  return (
    <form className="form" action={act} key={state?.ok}>
      <label>For<select className="field" name="to" required>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>The letter<textarea className="field" name="body" required maxLength={8000} rows={8} /></label>
      <Msg state={state} />
      <div><Submit><LockKey size={18} />Seal it</Submit></div>
    </form>
  );
}

export function DocumentForm() {
  const [state, act] = useForm(A.addDocumentAction);
  return (
    <form className="form" action={act} key={state?.ok}>
      <div className="two">
        <label>Title<input className="field" name="title" required maxLength={160} placeholder="Star Health renewal notice" /></label>
        <label>Kind
          <select className="field" name="kind" defaultValue="policy">
            <option value="policy">Policy</option><option value="statement">Statement</option>
            <option value="subscription">Subscription</option><option value="other">Other</option>
          </select>
        </label>
      </div>
      <label>Paste the text<textarea className="field" name="body" required maxLength={6000} /></label>
      <Msg state={state} />
      <div><Submit primary={false}>Add document</Submit></div>
    </form>
  );
}

export function HandbookButton() {
  const [state, act] = useForm(A.handbookAction);
  return (
    <form action={act}>
      <Submit>Write the handbook</Submit>
      <Msg state={state} />
    </form>
  );
}

export function DeleteButton({ action, id, label }: { action: "note" | "letter" | "document"; id: string; label: string }) {
  const fn = { note: A.deleteNoteAction, letter: A.deleteLetterAction, document: A.deleteDocumentAction }[action];
  const [, act] = useForm(fn);
  return (
    <form action={act} className="inline">
      <input type="hidden" name="id" value={id} />
      <button className="link-btn" aria-label={`Delete ${label}`}><Trash size={16} /></button>
    </form>
  );
}

// A trusted person asks the owner's notes after release
export function AskBox({ vaultId, name }: { vaultId: string; name: string }) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const [res, setRes] = useState<AskResult | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setErr(""); setRes(null); setAsked(q);
    const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vaultId, question: q }) });
    const out = await r.json().catch(() => ({}));
    if (r.ok) { setRes(out); setQ(""); } else setErr(out.error ?? "Something went wrong.");
    setBusy(false);
  }

  return (
    <div className="qa" style={{ padding: 0 }}>
      <form className="ask" onSubmit={ask}>
        <label htmlFor="ask-me">Ask {name}&apos;s notes</label>
        <div className="ask-row">
          <input id="ask-me" value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder="Where is the insurance policy?" />
          <button disabled={busy || !q.trim()} aria-label="Ask"><PaperPlaneRight size={18} /></button>
        </div>
      </form>
      <div className="result" aria-live="polite" style={{ marginTop: 22 }}>
        {asked && <p className="q">You asked: {asked}</p>}
        {busy && <p className="a dim">Reading the notes you are allowed to read…</p>}
        {err && <p className="a dim">{err}</p>}
        {res && (
          <>
            <p className={`a ${res.outcome !== "answered" ? "dim" : ""}`}>{res.answer}</p>
            {res.citations.map((c) => <span key={c.id} className="src"><Note size={15} />{c.title}</span>)}
            <p className="gate"><LockKey size={16} />Search found {res.candidates} notes. FGA let {res.allowed} through for you. The model saw only those.</p>
          </>
        )}
      </div>
    </div>
  );
}
