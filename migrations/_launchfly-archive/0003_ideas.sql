-- Store the user's raw survey answers so we can re-generate ideas later
-- (e.g. if the AI prompt improves) and so the generator has input to
-- personalize on.
ALTER TABLE subscriptions ADD COLUMN founder_dna_answers TEXT; -- JSON: { "0": "...", "1": "...", ... }

-- Which idea the user has committed to. Until this is set, the Dashboard
-- and Blueprint redirect to /app/ideas so the user picks one.
ALTER TABLE subscriptions ADD COLUMN selected_idea_id TEXT;

-- Generated business ideas — one row per (user, idea). Multiple
-- generations for the same user accumulate; the Ideas page renders
-- the most-recent batch.
CREATE TABLE IF NOT EXISTS generated_ideas (
  id              TEXT PRIMARY KEY,
  clerk_user_id   TEXT NOT NULL,
  name            TEXT NOT NULL,
  concept         TEXT NOT NULL,
  audience        TEXT NOT NULL,
  fit             INTEGER NOT NULL,
  difficulty      TEXT NOT NULL,
  speed           TEXT NOT NULL,
  first_step      TEXT NOT NULL,
  batch_id        TEXT NOT NULL,
  generated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_generated_ideas_user
  ON generated_ideas(clerk_user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_ideas_batch
  ON generated_ideas(batch_id);
