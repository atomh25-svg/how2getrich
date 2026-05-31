-- Multi-month support. Month 1 is free for everyone; Month 2+ requires
-- a paid tier. Each month is a fresh 4-week (28-day) plan that builds
-- on whatever the user did in prior months.
--
-- Rebuilt as new tables because SQLite can't alter PRIMARY KEY in
-- place and the old (session_id) PK collides with the new
-- (session_id, month) PK. Existing rows are migrated as month=1.

-- Plans, now keyed by (session_id, month).
CREATE TABLE h2gr_plans_v2 (
  session_id    TEXT NOT NULL,
  month         INTEGER NOT NULL DEFAULT 1,
  input         TEXT NOT NULL,
  plan_json     TEXT NOT NULL,
  generated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (session_id, month)
);

INSERT INTO h2gr_plans_v2 (session_id, month, input, plan_json, generated_at)
  SELECT session_id, 1, input, plan_json, generated_at FROM h2gr_plans;

DROP TABLE h2gr_plans;
ALTER TABLE h2gr_plans_v2 RENAME TO h2gr_plans;
CREATE INDEX h2gr_plans_generated_at ON h2gr_plans (generated_at);

-- Day details, keyed by (session_id, month, day_number). Day numbers
-- restart at 1 inside each month (so Month 2 has Days 1-7 not Days 8-14).
CREATE TABLE h2gr_day_details_v2 (
  session_id    TEXT NOT NULL,
  month         INTEGER NOT NULL DEFAULT 1,
  day_number    INTEGER NOT NULL,
  detail_json   TEXT NOT NULL,
  tier          TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'basic' | 'premium' — so we can invalidate / re-gen at higher tier
  generated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (session_id, month, day_number)
);

INSERT INTO h2gr_day_details_v2 (session_id, month, day_number, detail_json, tier, generated_at)
  SELECT session_id, 1, day_number, detail_json, 'free', generated_at FROM h2gr_day_details;

DROP TABLE h2gr_day_details;
ALTER TABLE h2gr_day_details_v2 RENAME TO h2gr_day_details;
