-- One blueprint per (user, idea). Generated on demand when the user
-- visits /app/blueprint after picking an idea. Cached so re-visits
-- don't burn a fresh Claude call each time.
CREATE TABLE IF NOT EXISTS blueprints (
  clerk_user_id  TEXT NOT NULL,
  idea_id        TEXT NOT NULL,
  payload_json   TEXT NOT NULL,
  generated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (clerk_user_id, idea_id)
);
