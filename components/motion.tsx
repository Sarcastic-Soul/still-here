"use client";
// The moving parts: the heartbeat trace, drifting petals and the altar candle.
import { useEffect, useRef } from "react";
import type { SwitchState } from "@/lib/vault";

const reduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Heartbeat: alive beats, missed slows, confirming fades, released is flat */
const BEAT: Record<SwitchState, { amp: number; gap: number; op: number }> = {
  alive: { amp: 1, gap: 150, op: 1 },
  missed: { amp: 0.55, gap: 260, op: 0.8 },
  confirming: { amp: 0.22, gap: 380, op: 0.55 },
  released: { amp: 0, gap: 1000, op: 0.35 },
};

function beatPath(amp: number, gap: number, phase: number) {
  const base = 55;
  let d = `M0,${base}`;
  for (let x = -gap + (phase % gap); x < 1000; x += gap) {
    const pts = [[x + 10, base], [x + 18, base - 6 * amp], [x + 24, base], [x + 30, base + 10 * amp], [x + 36, base - 46 * amp], [x + 42, base + 22 * amp], [x + 48, base], [x + 62, base - 9 * amp], [x + 74, base]];
    for (const [px, py] of pts) if (px >= 0 && px <= 1000) d += ` L${px.toFixed(1)},${py.toFixed(1)}`;
  }
  return d + ` L1000,${base}`;
}

export function Pulse({ state }: { state: SwitchState }) {
  const trace = useRef<SVGPathElement>(null);
  const target = useRef(BEAT[state]);
  target.current = BEAT[state];

  useEffect(() => {
    let amp = target.current.amp, gap = target.current.gap, shift = 0, raf = 0;
    const still = reduced();
    const frame = () => {
      const m = target.current;
      amp += (m.amp - amp) * 0.05;
      gap += (m.gap - gap) * 0.05;
      shift += 1.4;
      trace.current?.setAttribute("d", beatPath(still ? m.amp : amp, still ? m.gap : gap, still ? 0 : shift));
      if (trace.current) trace.current.style.opacity = String(m.op);
      if (!still) raf = requestAnimationFrame(frame);
    };
    frame();
    // With reduced motion the trace is redrawn only when the state changes
    const id = still ? setInterval(frame, 500) : 0;
    return () => { cancelAnimationFrame(raf); clearInterval(id); };
  }, []);

  return (
    <svg viewBox="0 0 1000 90" preserveAspectRatio="none">
      <line className="ghost" x1="0" y1="55" x2="1000" y2="55" />
      <path className="trace" ref={trace} d={beatPath(BEAT[state].amp, BEAT[state].gap, 0)} />
    </svg>
  );
}

/* Petals drifting down the page. window "petal-burst" events throw a handful from a point. */
export function burst(el: Element | null) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent("petal-burst", { detail: { x: r.left + r.width / 2, y: r.top + r.height / 2 } }));
}

export function Petals() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reduced()) return;
    const cv = canvas.current!, cx = cv.getContext("2d")!;
    const COLORS = ["#eaa33a", "#c47a1c", "#f6c76e"];
    type P = { x: number; y: number; r: number; a: number; va: number; vx: number; vy: number; c: string; life: number; burst: boolean; sway: number };
    let W = 0, H = 0, raf = 0;
    const s = devicePixelRatio;
    const size = () => { W = cv.width = innerWidth * s; H = cv.height = innerHeight * s; };
    size();
    const spawn = (x?: number, y?: number, burst = false): P => ({
      x: x ?? Math.random() * W, y: y ?? -20, r: (3 + Math.random() * 4) * s, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.04,
      vx: burst ? (Math.random() - 0.5) * 9 * s : (Math.random() - 0.3) * 0.4 * s, vy: burst ? (-Math.random() * 8 - 2) * s : (0.3 + Math.random() * 0.5) * s,
      c: COLORS[(Math.random() * 3) | 0], life: burst ? 1 : 0.5, burst, sway: Math.random() * 6.28,
    });
    let petals: P[] = Array.from({ length: 26 }, () => ({ ...spawn(), y: Math.random() * H }));
    const draw = () => {
      cx.clearRect(0, 0, W, H);
      for (const p of petals) {
        p.sway += 0.02; p.x += p.vx + Math.sin(p.sway) * 0.3 * s; p.y += p.vy; p.a += p.va;
        if (p.burst) { p.vy += 0.18 * s; p.vx *= 0.985; p.life -= 0.006; }
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.globalAlpha = Math.max(0, p.life) * 0.9;
        cx.fillStyle = p.c; cx.beginPath(); cx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, 6.28); cx.fill(); cx.restore();
      }
      petals = petals.filter((p) => p.life > 0 && p.y < H + 40);
      while (petals.filter((p) => !p.burst).length < 26) petals.push(spawn());
      raf = requestAnimationFrame(draw);
    };
    draw();
    const onBurst = (e: Event) => {
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail;
      for (let i = 0; i < 60; i++) petals.push(spawn(x * s, y * s, true));
    };
    addEventListener("resize", size);
    addEventListener("petal-burst", onBurst);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", size); removeEventListener("petal-burst", onBurst); };
  }, []);
  return <canvas id="petals" ref={canvas} aria-hidden="true" />;
}

/* The altar candle: unlit while he answers, lit once the vault is released */
export function Candle({ lit }: { lit: boolean }) {
  const flame = useRef<SVGPathElement>(null);
  useEffect(() => {
    if (!lit || reduced()) return;
    let t = 0;
    const flick = () => {
      const s = 0.92 + Math.random() * 0.16, r = (Math.random() - 0.5) * 6;
      flame.current?.setAttribute("transform", `rotate(${r.toFixed(1)} 0 -50) scale(${(s * 0.97).toFixed(3)} ${s.toFixed(3)})`);
      t = window.setTimeout(flick, 70 + Math.random() * 90);
    };
    flick();
    return () => clearTimeout(t);
  }, [lit]);
  return (
    <svg viewBox="-30 -110 60 210" aria-hidden="true">
      <defs>
        <radialGradient id="glow">
          <stop offset="0" stopColor="#f6c76e" stopOpacity={0.55} />
          <stop offset="1" stopColor="#f6c76e" stopOpacity={0} />
        </radialGradient>
      </defs>
      {lit && <circle cx={0} cy={-62} r={48} fill="url(#glow)" />}
      <rect x={-16} y={-40} width={32} height={130} rx={3} fill="#e9dcc6" />
      <path d="M-16,-40 Q-10,-30 -12,-14 Q-9,-8 -8,-40 Z" fill="#d9cab1" />
      <line x1={0} y1={-40} x2={0} y2={-50} stroke="#2b221c" strokeWidth={2} />
      <rect x={-28} y={88} width={56} height={8} rx={2} fill="#3a3029" />
      {lit && (
        <>
          <path ref={flame} d="M0,-50 C-9,-60 -7,-74 0,-92 C7,-74 9,-60 0,-50 Z" fill="#eaa33a" style={{ transformOrigin: "0 -50px" }} />
          <path d="M0,-52 C-4,-58 -3,-66 0,-74 C3,-66 4,-58 0,-52 Z" fill="#fbe3a8" />
        </>
      )}
    </svg>
  );
}

/* Sections rise in once as they scroll into view; content is visible without script */
export function Reveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll(".reveal");
    nodes.forEach((n) => n.classList.add("pending"));
    const io = new IntersectionObserver(
      (es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.remove("pending"); io.unobserve(x.target); } }),
      { threshold: 0.12 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return null;
}
