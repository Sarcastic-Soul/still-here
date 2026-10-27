// Generated art: marigolds (cempasúchil) and papel picado, drawn from a seeded random so every
// visit, and the server and the browser, draw the same thing.

const rng = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const f = (n: number) => n.toFixed(1);

function petalPath(len: number, wid: number) {
  // A ruffled petal: narrow at the base, a wide frilled tip
  const tip: string[] = [];
  for (let i = 0; i <= 5; i++) {
    const x = -wid + 2 * wid * (i / 5);
    const y = -len - (i % 2 ? wid * 0.28 : 0) + Math.abs(x) * 0.25;
    tip.push(`${f(x)},${f(y)}`);
  }
  return `M0,0 C${f(-wid * 0.5)},${f(-len * 0.3)} ${f(-wid * 1.1)},${f(-len * 0.6)} ${tip[0]} L${tip.join(" L")} C${f(wid * 1.1)},${f(-len * 0.6)} ${f(wid * 0.5)},${f(-len * 0.3)} 0,0 Z`;
}

const BRIGHT = ["#c47a1c", "#d98d27", "#eaa33a", "#efb24d", "#f3bf5f", "#f6c76e", "#f8d38a"];
export const PRESSED = ["#c9a370", "#d4b07d", "#dfbe8f", "#e6c99c", "#ecd4ab"];

export function Marigold({ seed = 7, r = 100, layers = 7, colors = BRIGHT, className }: { seed?: number; r?: number; layers?: number; colors?: string[]; className?: string }) {
  const rnd = rng(seed);
  const petals: { d: string; fill: string; rot: string }[] = [];
  for (let L = 0; L < layers; L++) {
    const k = 1 - L / layers;
    const n = Math.round(13 + L * 2);
    const len = r * (0.35 + 0.62 * k);
    const wid = r * (0.16 + 0.07 * k);
    const off = rnd() * 360;
    for (let i = 0; i < n; i++) {
      const a = off + (360 / n) * i + (rnd() - 0.5) * 10;
      petals.push({ d: petalPath(len * (0.9 + rnd() * 0.18), wid * (0.85 + rnd() * 0.3)), fill: colors[L % colors.length], rot: `rotate(${f(a)})` });
    }
  }
  const box = r * 1.1;
  return (
    <svg viewBox={`${-box} ${-box} ${box * 2} ${box * 2}`} className={className} aria-hidden="true">
      {petals.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill} stroke="#1a1512" strokeOpacity={0.35} strokeWidth={0.8} transform={p.rot} />
      ))}
      <circle r={r * 0.11} fill="#a5611a" />
    </svg>
  );
}

// Papel picado: cut-paper flags on a string. Each flag is a rect with holes cut by a mask.
export function Picado() {
  const W = 1440, n = 14, fw = W / n, h = 92;
  const rnd = rng(3);
  const flags = Array.from({ length: n }, (_, i) => {
    const x = i * fw + 6, w = fw - 12;
    const sag = 6 + 16 * Math.sin((Math.PI * (i + 0.5)) / n);
    const cx = w / 2, cy = h * 0.5, kind = i % 3;
    const cuts: React.ReactNode[] = [];
    for (let s = 0; s < 8; s++) cuts.push(<circle key={`s${s}`} cx={f((w / 8) * (s + 0.5))} cy={h} r={f(w / 16)} />);
    for (let s = 0; s < 7; s++) cuts.push(<circle key={`d${s}`} cx={f((w / 7) * (s + 0.5))} cy={9} r={1.8} />);
    if (kind === 0)
      for (let p = 0; p < 8; p++) {
        const a = (p * Math.PI) / 4, ex = cx + Math.cos(a) * 13, ey = cy + Math.sin(a) * 13;
        cuts.push(<ellipse key={`f${p}`} cx={f(ex)} cy={f(ey)} rx={7} ry={4} transform={`rotate(${p * 45} ${f(ex)} ${f(ey)})`} />);
      }
    if (kind === 1) for (let p = 0; p < 4; p++) cuts.push(<path key={`k${p}`} d={`M${f(cx)},${f(cy - 24 + p * 14)} l7,7 l-7,7 l-7,-7 Z`} />);
    if (kind === 2) {
      cuts.push(<circle key="sun" cx={f(cx)} cy={f(cy)} r={9} />);
      for (let p = 0; p < 12; p++) {
        const a = (p * Math.PI) / 6;
        const pt = (b: number, d: number) => `${f(cx + Math.cos(b) * d)},${f(cy + Math.sin(b) * d)}`;
        cuts.push(<path key={`r${p}`} d={`M${pt(a, 14)} L${pt(a + 0.14, 25)} L${pt(a - 0.14, 25)} Z`} />);
      }
    }
    for (let s = 0; s < 6; s++) cuts.push(<circle key={`c${s}`} cx={f(10 + rnd() * (w - 20))} cy={f(18 + rnd() * (h - 40))} r={f(1.5 + rnd() * 2)} />);
    const fill = i % 4 === 1 ? "#eaa33a" : i % 4 === 3 ? "#c47a1c" : "#e9dcc6";
    return { i, x, w, sag, cuts, fill, opacity: i % 2 ? 0.9 : 0.82 };
  });
  return (
    <svg viewBox={`0 0 ${W} 118`} preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <defs>
        {flags.map((g) => (
          <mask key={g.i} id={`picado-${g.i}`}>
            <rect width={g.w} height={h} fill="#fff" />
            <g fill="#000">{g.cuts}</g>
          </mask>
        ))}
      </defs>
      <path d={`M0,6 Q${W / 2},22 ${W},6`} stroke="#5b4c3f" strokeWidth={1.2} fill="none" />
      {flags.map((g) => (
        // The outer group places the flag; the inner one sways (a CSS transform would replace the placement)
        <g key={g.i} transform={`translate(${f(g.x)},${f(g.sag)})`}>
          <g className="flag" style={{ animationDelay: `${(-g.i * 0.45).toFixed(2)}s` }}>
            <rect width={g.w} height={h} fill={g.fill} mask={`url(#picado-${g.i})`} opacity={g.opacity} />
          </g>
        </g>
      ))}
    </svg>
  );
}

// Points for the petal trail under "The path home"
export function trailPoints() {
  const rnd = rng(31);
  return Array.from({ length: 70 }, (_, i) => {
    const t = i / 69, x = t * 1000, y = 30 + Math.sin(t * Math.PI * 3) * 12 + (rnd() - 0.5) * 14;
    return { t, x: f(x), y: f(y), rx: f(4 + rnd() * 3), ry: f(2 + rnd() * 1.4), rot: `rotate(${(rnd() * 180).toFixed(0)} ${f(x)} ${f(y)})` };
  });
}
