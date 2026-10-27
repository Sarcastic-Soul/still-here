"use client";
import { useRef, useState } from "react";
import { HandWaving } from "@phosphor-icons/react";
import { Petals, burst } from "@/components/motion";

export function Answer({ token, released, answered }: { token: string; released: boolean; answered: boolean }) {
  const [line, setLine] = useState("");
  const [msg, setMsg] = useState(released ? "Too late: this vault has been released." : answered ? "You already answered this one. Answering again does no harm." : "");
  const [busy, setBusy] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  async function answer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, line }) });
    const out = await r.json().catch(() => ({}));
    if (r.ok && out.ok) {
      burst(btn.current);
      setMsg(out.was === "alive" ? "Thank you. See you next week." : "Thank you. Everything is back to normal, and nobody was told.");
      setLine("");
    } else setMsg(out.error ?? (out.state === "released" ? "Too late: this vault has been released." : "Something went wrong. Try again."));
    setBusy(false);
  }

  return (
    <>
      <Petals />
      <form className="answer" onSubmit={answer}>
        <button className="yes" ref={btn} disabled={busy || released}><HandWaving size={20} weight="fill" />I&apos;m still here</button>
        <input className="line" value={line} onChange={(e) => setLine(e.target.value)} maxLength={500} placeholder="Anything changed? (moved my FD to SBI)" aria-label="Optional line about what changed" />
        <p className="thanks" aria-live="polite">{msg}</p>
      </form>
    </>
  );
}
