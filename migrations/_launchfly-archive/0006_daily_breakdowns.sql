-- Per-day breakdowns for each (user, idea, day). Generated on first
-- view of that day in the dashboard, cached forever (or until the
-- blueprint is regenerated, in which case we wipe the rows for that
-- idea via the application code). Payload is the JSON shape:
-- {summary, outcome, substeps:[{action, tool?}], stuck_hint}.
CREATE TABLE daily_breakdowns (
  clerk_user_id TEXT NOT NULL,
  idea_id       TEXT NOT NULL,
  day_number    INTEGER NOT NULL,
  payload_json  TEXT NOT NULL,
  generated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (clerk_user_id, idea_id, day_number)
);
