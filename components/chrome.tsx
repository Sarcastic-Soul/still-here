// The top of every page (papel picado and the nav) and the closing footer.
import { GithubLogo, SignIn } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Marigold, Picado } from "./art";

export const SOURCE = "https://github.com/Sarcastic-Soul/still-here";

export function Top({ short = false, action }: { short?: boolean; action?: React.ReactNode }) {
  return (
    <>
      <div className={`picado ${short ? "short" : ""}`} aria-hidden="true"><Picado /></div>
      <div className="wrap">
        <nav className="top" aria-label="Main">
          <Link className="name" href="/"><Marigold seed={11} r={46} layers={4} />Still Here</Link>
          <span className="links">
            <Link href="/#how">How it decides</Link>
            <Link href="/#after">Afterwards</Link>
            <a href={SOURCE}>Source</a>
            {action ?? <Link className="act" href="/me"><SignIn size={18} />Your vault</Link>}
          </span>
        </nav>
      </div>
    </>
  );
}

export function End() {
  return (
    <footer className="end">
      <div>
        <p className="big">Still Here</p>
        <p>The model that answers is open-weight (gpt-oss-120b). It can run on any host, or on a laptop with the Wi-Fi off.</p>
      </div>
      <p><a href={SOURCE}><GithubLogo size={16} /> Source on GitHub</a> · Hacktoberfest 2026, week 4</p>
    </footer>
  );
}
