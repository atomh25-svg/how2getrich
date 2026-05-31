-- how2getrich plans. Stores the user's "tell me about yourself" input
-- and the generated 7-day plan, keyed by an anonymous session_id the
-- client generates (no auth — anyone can hit /).
--
-- Lookup pattern: client passes session_id; server returns the row's
-- input + plan_json if it exists, otherwise generates fresh, persists,
-- and returns. Lets the plan survive page reloads + cross-device if
-- the user copies their /todo URL.
CREATE TABLE h2gr_plans (
  session_id    TEXT PRIMARY KEY,
  input         TEXT NOT NULL,
  plan_json     TEXT NOT NULL,
  generated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX h2gr_plans_generated_at ON h2gr_plans (generated_at);
