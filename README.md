# Still Here

A dead man's switch with an open model inside. Every week it asks one question:
"Are you still here?" If I stop answering, it asks two people I trust to confirm,
and only then gives each of them what I left for them.

**Live:** https://still-here-gules.vercel.app. The landing page runs a real demo vault where a
week lasts six seconds. Stop answering and watch the switch walk to release, approve as both
trusted people, then read the letters and ask the notes.

Built for the Hacktoberfest 2026 Open-Source AI Challenge, Week 4: Ghost in the Machine.

## How it decides

The model never decides whether I am dead. Code and people do.

1. **Alive.** A push every week through [ntfy](https://ntfy.sh), with a signed one-tap link.
   Answering resets the clock. I can add a line ("moved my FD to SBI").
2. **Missed.** After 3 silent weeks, one last chance.
3. **Confirming.** Each trusted person gets an Auth0 Guardian push through CIBA:
   "Approve only if you know he has died." Every one of them must say yes. One no, or one
   answer from me, cancels it.
4. **Released.** Code writes one tuple to Auth0 FGA, `vault:<id>#released@user:*`. From then on,
   each person can read the letter written for them and ask questions of the notes shared with
   them, and nothing else.

Every step is written to an append-only audit log.

## What each piece does

| Piece | Job |
|---|---|
| **gpt-oss-120b** (open weights, on Groq) | Answers the family's questions, only from the notes FGA lets through. Code checks every citation; anything else becomes "he didn't leave a note about that". The model can be swapped for a local one (`local` in `lib/llm.ts`), so the release can run on a laptop with the Wi-Fi off. |
| **gpt-oss-20b** | Reads each check-in line and decides whether it is a new fact, replaces an old one, or is not a fact. |
| **Auth0** | Sign-in, CIBA push approval from the trusted people, and FGA for who can read what. The model in `fga/model.fga` makes a note readable only by `owner or (reader and released from vault)`. |
| **Tiger Data** (Postgres) | Vaults, the switch, check-ins, approvals, audit log, and hybrid search over notes: BM25 (pg_textsearch) plus vectors (pgvector + DiskANN), merged with reciprocal rank fusion. |
| **Backboard** | Memory of the owner's current facts from check-in lines. A line that changes a fact updates it in place, so the handbook reads where things are now. |
| **Ultramarine** (`ultramarine-1-flash`) | Writes the family handbook (.docx) from my policies, statements and check-in facts while I am alive. Code keeps only lines that cite a real source. Cost per run is logged. |
| **bge-small-en-v1.5** | Embeddings, run on the CPU inside the app with transformers.js. No embedding API. |
| **Entire** | The Claude Code sessions that built this repo are captured with the Entire CLI. |

Every model call goes into a `usage` table with tokens, latency and list-price cost.

## Numbers

From `bun run eval` (42 questions as Riya or Kabir, three open models) and the demo seed.
Full table and every miss: [`eval/RESULTS.md`](eval/RESULTS.md).

**Before release:** all 42 questions asked, **0 notes reached the model**. FGA returned nothing,
so there was nothing to leak.

**After release:**

| Model | Own notes answered | Other person's notes refused | Private refused | Not written refused | Total | Leaks | Cost per answer | Median latency |
|---|---|---|---|---|---|---|---|---|
| gpt-oss-20b | 24/24 | 9/11 | 2/2 | 5/5 | 40/42 | 0 | $0.00006 | 530 ms |
| gpt-oss-120b | 23/24 | 9/11 | 2/2 | 5/5 | 39/42 | 0 | $0.00012 | 566 ms |
| qwen3.8-27b | 24/24 | 9/11 | 2/2 | 4/5 | 39/42 | 0 | $0.00017 | 188 ms |

No model leaked anything across 126 answers. The two "other" misses are the same for all three
models, and they are not leaks: Riya asked about the laptop and the subscriptions, which live in
Kabir's notes, but her own notes also touch them (the Work note says the company laptop goes back,
the HDFC card note mentions the Spotify auto-debit). The models answered from what she may read.
gpt-oss-120b once answered "Do I owe him money?" from the wrong side, and qwen3.8-27b said "the
notes don't say" about a PPF account instead of the plain refusal.

The smallest model did as well as the largest here, for half the price. The app still uses
gpt-oss-120b for answers by default; it is one line in `lib/llm.ts` to change.

**Backboard memory:** the demo's 12 check-in lines were played through `remember()`. The model
picked the expected action for all 12: 3 lines replaced an old fact, the rest were new facts or
nothing to file.

**Handbook:** one Ultramarine run over the demo notes and check-in facts cost $0.0039 and kept
19 lines, with 0 dropped for a bad citation. Check-in facts won over older statements (Netflix
moved to UPI, FD papers now in locker 214).

## Run it

Needs [bun](https://bun.sh), a Postgres with pgvector, vectorscale and pg_textsearch (a free
Tiger Data service has them), an Auth0 tenant with a Regular Web App (CIBA grant on, Guardian
push), an Auth0 FGA store (or OpenFGA in docker), and a Groq key.

Secrets live in `../.env`, one folder above the repo, so they never sit inside it. Names:
`DATABASE_URL`, `GROQ_API_KEY`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`,
`AUTH0_SECRET`, `APP_BASE_URL`, `CHECKIN_SECRET`, `CRON_SECRET`, `FGA_API_URL`, `FGA_STORE_ID`,
`FGA_MODEL_ID`, `FGA_CLIENT_ID`, `FGA_CLIENT_SECRET`, `FGA_API_TOKEN_ISSUER`,
`FGA_API_AUDIENCE`, and optionally `BACKBOARD_API_KEY`, `PAPERINSTRUMENTS_API_KEY`,
`ULTRAMARINE_BASE_URL`, `NTFY_TOPIC`.

```sh
bun install
bun run db:schema        # tables and indexes
bun run fga:setup        # uploads the FGA model, writes FGA_MODEL_ID
bun run seed             # the demo vault, with its check-in history played through Backboard
bun run dev
```

Other scripts:

```sh
bun run ask demo Kabir "What should I do with his laptop?"
bun run handbook demo    # writes the handbook with Ultramarine and saves the .docx
bun run release:demo     # walks the demo vault all the way to released
bun run eval             # the eval and leak test below
```

On Vercel, a daily cron calls `/api/cron/tick` to move real vaults forward. The demo vault ticks
from its own page.

## Layout

- `lib/switch.ts`: the state machine (alive, missed, confirming, released) and CIBA.
- `lib/ask.ts`, `lib/search.ts`, `lib/fga.ts`: hybrid search, then FGA, then the model.
- `lib/memory.ts`, `lib/backboard.ts`: check-in lines into Backboard memory.
- `lib/handbook.ts`: the Ultramarine handbook.
- `app/page.tsx`, `app/demo.tsx`: the landing page and live demo.
- `app/me`: the signed-in pages for owners and trusted people.
- `db/demo-data.ts`: the demo vault. Riya and Kabir are made up; the notes are shaped like mine.

## License

MIT
