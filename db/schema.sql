-- Still Here schema on Tiger Data (Postgres). Apply with: bun run db:schema
-- Safe to run again: every statement is IF NOT EXISTS / OR REPLACE.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale;    -- DiskANN index
CREATE EXTENSION IF NOT EXISTS pg_textsearch;  -- BM25 ranking

-- One vault per owner. The public demo runs on its own vault so it never touches the real one.
CREATE TABLE IF NOT EXISTS vaults (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,                -- 'anish', 'demo'
  owner_name  text NOT NULL,
  is_demo     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The owner and the people the owner trusts. Trusted people approve the release (CIBA)
-- and receive letters and notes. auth0_sub is filled the first time they sign in.
CREATE TABLE IF NOT EXISTS people (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id    uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('owner', 'trusted')),
  name        text NOT NULL,
  relation    text NOT NULL DEFAULT '',            -- 'sister', 'friend'
  email       text NOT NULL,
  auth0_sub   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vault_id, email)
);
CREATE UNIQUE INDEX IF NOT EXISTS people_sub_idx ON people (vault_id, auth0_sub) WHERE auth0_sub IS NOT NULL;

-- The switch itself. One row per vault.
-- alive -> missed -> confirming -> released. A check-in from the owner goes back to alive
-- from any state except released.
CREATE TABLE IF NOT EXISTS switch (
  vault_id          uuid PRIMARY KEY REFERENCES vaults(id) ON DELETE CASCADE,
  state             text NOT NULL DEFAULT 'alive' CHECK (state IN ('alive', 'missed', 'confirming', 'released')),
  every_seconds     integer NOT NULL DEFAULT 604800,  -- one check-in a week; demo uses seconds
  miss_limit        integer NOT NULL DEFAULT 3,       -- misses before the last-chance ping
  grace_seconds     integer NOT NULL DEFAULT 172800,  -- time to answer the last-chance ping
  last_answer_at    timestamptz NOT NULL DEFAULT now(),
  last_ping_at      timestamptz,
  missed_count      integer NOT NULL DEFAULT 0,
  last_chance_at    timestamptz,                      -- when the last-chance ping went out
  round             integer NOT NULL DEFAULT 0,       -- bumps every time confirming starts
  released_at       timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Every "Are you still here?" ping and its answer.
CREATE TABLE IF NOT EXISTS checkins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id     uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  kind         text NOT NULL DEFAULT 'regular' CHECK (kind IN ('regular', 'last_chance')),
  sent_at      timestamptz NOT NULL DEFAULT now(),
  answered_at  timestamptz,
  line         text,                                -- optional free-text line, goes to memory
  channel      text NOT NULL DEFAULT 'ntfy'
);
CREATE INDEX IF NOT EXISTS checkins_vault_idx ON checkins (vault_id, sent_at DESC);

-- One CIBA request per trusted person per confirming round.
CREATE TABLE IF NOT EXISTS approvals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id     uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  person_id    uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  round        integer NOT NULL,
  auth_req_id  text,                                -- null in demo mode (simulated approval)
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'cancelled')),
  sent_at      timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  decided_at   timestamptz,
  UNIQUE (vault_id, person_id, round)
);

-- Letters the owner wrote. Who can read one is decided by Auth0 FGA, not by this table.
CREATE TABLE IF NOT EXISTS letters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id      uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  recipient_id  uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  title         text NOT NULL,
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- The owner's notes: the facts family members can ask about after release.
-- shared_with records the owner's choice; FGA tuples are written from it and are what
-- every read is checked against.
CREATE TABLE IF NOT EXISTS notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id     uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  title        text NOT NULL,
  body         text NOT NULL,
  shared_with  uuid[] NOT NULL DEFAULT '{}',        -- people.id list
  search_text  text GENERATED ALWAYS AS (title || E'\n' || body) STORED,
  embedding    vector(384),                         -- BAAI/bge-small-en-v1.5
  source       text NOT NULL DEFAULT 'owner',       -- owner | checkin | memory
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_vault_idx ON notes (vault_id);
-- Hybrid search: BM25 for exact words (policy numbers, bank names), DiskANN for meaning.
CREATE INDEX IF NOT EXISTS notes_bm25_idx ON notes USING bm25 (search_text) WITH (text_config = 'english');
CREATE INDEX IF NOT EXISTS notes_embedding_idx ON notes USING diskann (embedding vector_cosine_ops);

-- Documents the handbook job reads while the owner is alive (policies, statements,
-- subscription emails). Pasted or uploaded as text.
CREATE TABLE IF NOT EXISTS documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id    uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  kind        text NOT NULL,                        -- policy | statement | subscription | other
  title       text NOT NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The "what my family needs to know" handbook. One row per run, so runs can be compared.
CREATE TABLE IF NOT EXISTS handbooks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id     uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  model        text NOT NULL,
  sections     jsonb NOT NULL,                      -- [{audience, title, items: [{text, sources}]}]
  dropped      jsonb NOT NULL DEFAULT '[]',         -- items code removed (bad or missing sources)
  docx         bytea,
  usage_id     uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Every model call: what job, which model, tokens and what it cost.
CREATE TABLE IF NOT EXISTS usage (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id          uuid REFERENCES vaults(id) ON DELETE SET NULL,
  job               text NOT NULL,                  -- draft | answer | handbook | eval
  provider          text NOT NULL,                  -- groq | ultramarine | local
  model             text NOT NULL,
  input_tokens      integer NOT NULL DEFAULT 0,
  cached_tokens     integer NOT NULL DEFAULT 0,
  output_tokens     integer NOT NULL DEFAULT 0,
  reasoning_tokens  integer NOT NULL DEFAULT 0,
  cost_usd          numeric(12, 8) NOT NULL DEFAULT 0, -- list price; Groq free tier is billed $0
  latency_ms        integer NOT NULL DEFAULT 0,
  ok                boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_job_idx ON usage (job, created_at DESC);

-- Questions family members asked after release, and what came back.
CREATE TABLE IF NOT EXISTS questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id     uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  person_id    uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  question     text NOT NULL,
  outcome      text NOT NULL CHECK (outcome IN ('answered', 'no_note', 'refused')),
  answer       text NOT NULL,
  cited        uuid[] NOT NULL DEFAULT '{}',
  candidates   integer NOT NULL DEFAULT 0,          -- notes search found
  allowed      integer NOT NULL DEFAULT 0,          -- of those, notes FGA let through
  usage_id     uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Accounts to close after release (Browserbase jobs).
CREATE TABLE IF NOT EXISTS closures (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id     uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  site         text NOT NULL,
  url          text NOT NULL,
  instruction  text NOT NULL,
  status       text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'running', 'done', 'failed')),
  steps        jsonb NOT NULL DEFAULT '[]',         -- [{action, screenshot_url, at}]
  session_id   text,
  browser_ms   integer,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Append-only audit log. Every step of the switch writes here; nothing may change it later.
CREATE TABLE IF NOT EXISTS audit_log (
  id        bigserial PRIMARY KEY,
  vault_id  uuid REFERENCES vaults(id) ON DELETE CASCADE,
  at        timestamptz NOT NULL DEFAULT now(),
  actor     text NOT NULL,                          -- system | owner | person:<id> | model
  action    text NOT NULL,
  detail    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS audit_vault_idx ON audit_log (vault_id, at DESC);

CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  -- Deleting a whole vault (the demo reset) is the one allowed way rows go away.
  IF TG_OP = 'DELETE' AND current_setting('still_here.vault_reset', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_change ON audit_log;
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
