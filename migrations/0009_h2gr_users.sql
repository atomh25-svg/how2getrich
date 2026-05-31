-- Authenticated users (email-only via magic link).
--
-- A row exists once someone has paid at least once. The email is
-- the primary key — magic-link login looks up by email, and the
-- httpOnly auth cookie carries the email so subsequent requests
-- can look up tier here.
--
-- tier semantics:
--   NULL / missing → free (Month 1 only)
--   'basic'        → $9.99/mo, monthly continuation
--   'premium'      → $19.99/mo, monthly continuation + richer detail
--
-- current_period_end is unix seconds; if NULL or in the past AND
-- stripe_subscription_id reports cancel, we treat tier as expired.
CREATE TABLE h2gr_users (
  email                   TEXT PRIMARY KEY,
  tier                    TEXT,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  current_period_end      INTEGER,
  created_at              INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at              INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX h2gr_users_stripe_customer_id ON h2gr_users (stripe_customer_id);
CREATE INDEX h2gr_users_stripe_subscription_id ON h2gr_users (stripe_subscription_id);

-- Link table: when an anonymous session_id pays + claims an email,
-- we record the mapping so the user's Month 1 free plan stays
-- associated with their authed account on later visits.
CREATE TABLE h2gr_session_email (
  session_id  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  linked_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX h2gr_session_email_email ON h2gr_session_email (email);
