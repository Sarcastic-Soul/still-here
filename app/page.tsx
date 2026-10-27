// The landing page is the demo: a public vault whose week lasts a few seconds.
import { HandHeart, SignIn } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Marigold, trailPoints } from "@/components/art";
import { End, Top } from "@/components/chrome";
import { Petals, Reveal } from "@/components/motion";
import { demoVault } from "@/lib/demo";
import { landingStats } from "@/lib/stats";
import { vaultStatus } from "@/lib/status";
import { freshDemoTick } from "@/lib/demo-fresh";
import { Afterwards, CheckinCard, DemoProvider, HeroPulse, PathHome } from "./demo";

export const dynamic = "force-dynamic";

const usd = (n: number) => `$${n < 0.001 ? n.toFixed(5) : n.toFixed(4)}`;

export default async function Home() {
  const v = await demoVault();
  await freshDemoTick(v);
  const [status, stats] = await Promise.all([vaultStatus(v.id), landingStats(v.id)]);

  return (
    <>
      <Petals />
      <Reveal />
      <Top />
      <DemoProvider initial={status} serverNow={Date.now()}>
        <main className="wrap">
          <section className="hero">
            <div className="hero-grid">
              <h1 className="ask-line" aria-label="Are you still here?">
                <span className="w" style={{ animationDelay: ".1s" }}>Are</span>{" "}
                <span className="w" style={{ animationDelay: ".25s" }}>you</span>{" "}
                <i className="w still" style={{ animationDelay: ".45s" }}>still</i><br />
                <span className="w" style={{ animationDelay: ".7s" }}>here?</span>
              </h1>
              <div className="bloom"><Marigold seed={7} /></div>
            </div>
            <HeroPulse />
            <div className="hero-row">
              <p>
                I wrote a program that <b>only runs after I die</b>. It asks me this every week. If I stop answering, and two people I trust
                both confirm it on their phones, it gives each of them what I left for them. Nothing more.
              </p>
              <CheckinCard />
            </div>
          </section>

          <section className="path-wrap reveal" id="how" aria-labelledby="how-title">
            <div className="path-head">
              <h2 id="how-title">The path home</h2>
              <p>
                Marigold petals mark the way home for the dead on Día de los Muertos. Here they mark how far the switch has gone. This is
                the live demo vault: stop answering and watch it walk.
              </p>
            </div>
            <PathHome trail={trailPoints()} />
          </section>

          <Afterwards />

          <section className="numbers reveal" aria-label="Real numbers from this vault">
            <div>
              <b>{stats.privateNotes ? `${stats.notes - stats.privateNotes} of ${stats.notes}` : stats.notes}</b>
              <span>notes in this vault are shared with someone. The rest stay private for good: FGA keeps them from every question.</span>
            </div>
            <div>
              <b>{stats.handbook ? usd(stats.handbook.cost) : "n/a"}</b>
              <span>
                {stats.handbook
                  ? `to write the family handbook on Ultramarine. ${stats.handbook.items} lines, each citing a real document${stats.handbook.dropped ? `; ${stats.handbook.dropped} without a source were dropped` : ""}.`
                  : "The family handbook has not been written yet."}
              </span>
            </div>
            <div>
              <b>{stats.answerCost !== null ? usd(stats.answerCost) : "2 of 2"}</b>
              <span>{stats.answerCost !== null ? "per family question on gpt-oss-120b, on average. Logged for every call." : "phone approvals needed. One no cancels it."}</span>
            </div>
          </section>

          <section className="make reveal" aria-labelledby="make-title">
            <h2 id="make-title">Leave something behind</h2>
            <div>
              <p>
                Sign in, name the <b>two people you trust</b>, and write down what they will need: where the papers are, what to cancel, who
                to call. Write each of them a letter.
              </p>
              <p>
                Every week a push asks if you are still here. You answer with one tap. If you stop, they each get an <b>Auth0 Guardian</b> push,
                and nothing opens until both say yes.
              </p>
              <div className="btns">
                <Link className="btn primary" href="/me"><SignIn size={20} />Start your vault</Link>
                <Link className="btn" href="/me"><HandHeart size={20} />I was named as a trusted person</Link>
              </div>
            </div>
          </section>

          <End />
        </main>
      </DemoProvider>
    </>
  );
}
