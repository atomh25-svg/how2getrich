-- Per-day expanded breakdowns for the how2getrich 7-day plan.
-- Keyed by (session_id, day_number); generated on first click into
-- a day from /todo and cached forever so re-visiting that day is
-- instant and free.
--
-- detail_json shape:
--   { "headline": string, "why": string, "steps": string[],
--     "example": string, "if_stuck": string }
CREATE TABLE h2gr_day_details (
  session_id    TEXT NOT NULL,
  day_number    INTEGER NOT NULL,
  detail_json   TEXT NOT NULL,
  generated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (session_id, day_number)
);
