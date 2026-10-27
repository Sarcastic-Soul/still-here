// The signed-in page. The owner manages the vault; a trusted person waits, and after release
// reads their letter and asks the notes they were given.
import { DownloadSimple, EnvelopeSimpleOpen, SignOut } from "@phosphor-icons/react/dist/ssr";
import { End, Top } from "@/components/chrome";
import { auth0 } from "@/lib/auth0";
import { sql } from "@/lib/db";
import { lettersFor } from "@/lib/letters";
import { currentFacts, memoryCounts } from "@/lib/memory";
import { currentPeople } from "@/lib/session";
import { vaultStatus } from "@/lib/status";
import { getVaultById, type Person } from "@/lib/vault";
import { AskBox, CheckInForm, CreateVaultForm, DeleteButton, DocumentForm, HandbookButton, LetterForm, NoteForm, TestPush } from "./forms";

export const dynamic = "force-dynamic";

const when = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "never";
const days = (s: number) => (s % 86400 === 0 ? `${s / 86400} day${s === 86400 ? "" : "s"}` : `${Math.round(s / 3600)} hours`);

export default async function Me() {
  const session = await auth0.getSession();
  const people = await currentPeople();
  const signOut = (
    <a className="act" href="/auth/logout"><SignOut size={18} />Sign out</a>
  );

  return (
    <>
      <Top short action={signOut} />
      <main className="wrap page">
        {people.length === 0 ? (
          <NoVault name={session?.user.name ?? ""} email={session?.user.email ?? ""} />
        ) : (
          await Promise.all(people.map((p) => (p.role === "owner" ? <Owner key={p.id} me={p} /> : <Trusted key={p.id} me={p} />)))
        )}
        <End />
      </main>
    </>
  );
}

function NoVault({ name, email }: { name: string; email: string }) {
  return (
    <>
      <h1>Start your vault</h1>
      <p className="lede">
        Signed in as {email}. If someone named you as a trusted person, they must use this same email. Otherwise, start your own vault below.
      </p>
      <section className="panel">
        <h2>Who you trust</h2>
        <p className="sub">
          Two people, at least. When you stop answering, each gets an Auth0 Guardian push on their phone, and nothing opens until every one of them
          says yes. They need to sign in here once, with the email you give, so the push can reach them.
        </p>
        <CreateVaultForm suggestedName={name.includes("@") ? "" : name.split(" ")[0]} />
      </section>
    </>
  );
}

async function Owner({ me }: { me: Person }) {
  const [vault, status, notes, letters, documents, handbooks, facts, counts] = await Promise.all([
    getVaultById(me.vault_id),
    vaultStatus(me.vault_id),
    sql`select id, title, body, shared_with from notes where vault_id = ${me.vault_id} order by created_at desc`,
    sql`select id, recipient_id, body, created_at from letters where vault_id = ${me.vault_id} order by created_at`,
    sql`select id, kind, title from documents where vault_id = ${me.vault_id} order by created_at`,
    sql`
      select h.id, h.sections, jsonb_array_length(h.dropped) as dropped, h.created_at, u.cost_usd::float as cost, u.model
      from handbooks h left join usage u on u.id = h.usage_id where h.vault_id = ${me.vault_id} order by h.created_at desc limit 1`,
    currentFacts(me.vault_id).catch(() => []),
    memoryCounts(me.vault_id),
  ]);
  const sw = status.switch;
  const trusted = status.people.filter((p) => p.role === "trusted");
  const name = (id: string) => trusted.find((p) => p.id === id)?.name ?? "someone";
  const nextPing = new Date(new Date(sw.last_ping_at ?? sw.last_answer_at).getTime() + sw.every_seconds * 1000);
  const handbook = handbooks[0];
  const appUrl = process.env.APP_BASE_URL ?? "";

  return (
    <>
      <h1>Your vault, {me.name}</h1>
      <p className="lede">Nothing here is visible to anyone while you keep answering. The switch below decides when that changes, not a model.</p>

      <div className="state-row">
        <div>
          <p className="state-big">{status.state}</p>
          <dl className="facts">
            <dt>Last answer</dt><dd>{when(sw.last_answer_at)}</dd>
            {status.state === "alive" && (<><dt>Next question</dt><dd>{when(nextPing)}</dd></>)}
            <dt>Missed in a row</dt><dd>{sw.missed_count} of {sw.miss_limit}</dd>
            <dt>Rules</dt><dd>One question every {days(sw.every_seconds)}. After {sw.miss_limit} misses, a last chance and {days(sw.grace_seconds)} to answer.</dd>
          </dl>
        </div>
        <div>
          <CheckInForm disabled={status.state === "released"} />
        </div>
      </div>

      <section className="panel">
        <h2>What Backboard remembers</h2>
        <p className="sub">
          The line you write when you answer goes to Backboard memory. An open model decides whether it is a new fact or replaces an old one, so the
          handbook reads where things are now, not where they were. {counts.added} added, {counts.replaced} replaced so far.
        </p>
        {facts.length ? (
          <ul className="list">
            {facts.map((m) => <li key={m.id}><div><p style={{ margin: 0 }}>{m.content}</p></div></li>)}
          </ul>
        ) : (
          <p className="sub">Nothing yet. Next time you answer, add a line like &ldquo;moved my FD to SBI&rdquo;.</p>
        )}
      </section>

      <section className="panel">
        <h2>Your phone</h2>
        <p className="sub">
          The weekly question arrives through ntfy, a free push app with no account. Install it (Android or iPhone), tap +, and subscribe to this topic.
          Keep the name private: anyone with it can read your pushes.
        </p>
        <p style={{ fontSize: 20, marginBottom: 14, wordBreak: "break-all" }}>{vault?.ntfy_topic}</p>
        <TestPush />
      </section>

      <section className="panel">
        <h2>The people you trust</h2>
        <p className="sub">
          Each must sign in once at {appUrl}/me with the email below, and keep Auth0 Guardian on their phone. Until they do, nobody can ask them, and the
          vault waits.
        </p>
        <ul className="list">
          {status.people.filter((p) => p.role === "trusted").map((p) => (
            <li key={p.id}>
              <div><b>{p.name}</b> <small>· {p.relation || "trusted"}</small></div>
              <span className="tag">{p.linked ? "Signed in, can be asked" : "Has not signed in yet"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Notes</h2>
        <p className="sub">
          The facts they will need. After release each person can ask questions, and the model answers only from the notes you shared with them. Auth0 FGA
          checks every note before the model sees it.
        </p>
        <NoteForm people={trusted} />
        {notes.length > 0 && (
          <ul className="list" style={{ marginTop: 14 }}>
            {notes.map((n) => (
              <li key={n.id}>
                <div><b>{n.title}</b><p>{n.body.length > 220 ? `${n.body.slice(0, 220)}…` : n.body}</p></div>
                <div style={{ textAlign: "right" }}>
                  <span className="tag">{n.shared_with.length ? `For ${n.shared_with.map(name).join(", ")}` : "Shared with no one"}</span>
                  <br /><DeleteButton action="note" id={n.id} label={n.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Letters</h2>
        <p className="sub">Each letter opens for one person, and only after release. Nobody, the model included, reads it before then.</p>
        <LetterForm people={trusted} />
        {letters.length > 0 && (
          <ul className="list" style={{ marginTop: 14 }}>
            {letters.map((l) => (
              <li key={l.id}>
                <div><b>For {name(l.recipient_id)}</b><p>{l.body.length > 160 ? `${l.body.slice(0, 160)}…` : l.body}</p></div>
                <DeleteButton action="letter" id={l.id} label={`letter for ${name(l.recipient_id)}`} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>The handbook</h2>
        <p className="sub">
          Paste the text of policies, statements and renewal emails. Ultramarine drafts what each person needs to do, and code keeps only lines that cite
          one of these documents. You get a Word file to print and keep with your papers.
        </p>
        <DocumentForm />
        {documents.length > 0 && (
          <ul className="list" style={{ margin: "14px 0 20px" }}>
            {documents.map((d) => (
              <li key={d.id}>
                <div><b>{d.title}</b> <small>· {d.kind}</small></div>
                <DeleteButton action="document" id={d.id} label={d.title} />
              </li>
            ))}
          </ul>
        )}
        <HandbookButton />
        {handbook && (
          <p className="sub" style={{ marginTop: 14 }}>
            Last written {when(handbook.created_at)}: {(handbook.sections as { items: unknown[] }[]).reduce((n, s) => n + s.items.length, 0)} lines,{" "}
            {handbook.dropped} dropped, ${Number(handbook.cost ?? 0).toFixed(4)} on {handbook.model}.{" "}
            <a href="/api/handbook"><DownloadSimple size={16} /> Download the .docx</a>
          </p>
        )}
      </section>
    </>
  );
}

async function Trusted({ me }: { me: Person }) {
  const [vault, status] = await Promise.all([getVaultById(me.vault_id), vaultStatus(me.vault_id)]);
  const owner = vault?.owner_name ?? "They";
  const released = status.state === "released";
  const letters = released ? await lettersFor(me.vault_id, me.id) : [];
  const asking = status.state === "confirming" && status.approvals.some((a) => a.person_id === me.id && a.status === "pending");

  return (
    <>
      <h1>{released ? `What ${owner} left you` : `${owner} trusts you`}</h1>
      {!released && (
        <p className="lede">
          {asking
            ? `${owner} has stopped answering. Auth0 Guardian has sent a push to your phone. Approve it only if you know ${owner} has died. If you are not sure, deny it: one no stops everything.`
            : `Nothing is open, and nothing will be while ${owner} keeps answering. If ${owner} stops, you will get an Auth0 Guardian push asking you to confirm. Keep Guardian on your phone.`}
        </p>
      )}
      {released && (
        <>
          <p className="lede">Everyone {owner} named said yes. These are the things {owner} chose to leave for you, and nothing else.</p>
          {letters.map((l) => (
            <div key={l.id} className="letter open" style={{ marginTop: 34, minHeight: 0 }}>
              <div className="to"><EnvelopeSimpleOpen size={16} />{l.title}</div>
              {l.body.split(/\n\n+/).map((p, i) => <p key={i} className="ink" style={{ animationDelay: `${i * 0.6}s` }}>{p}</p>)}
            </div>
          ))}
          <section className="panel">
            <h2>Ask</h2>
            <p className="sub">The model answers only from the notes {owner} shared with you, and says so when there is no note.</p>
            <AskBox vaultId={me.vault_id} name={owner} />
          </section>
        </>
      )}
    </>
  );
}
