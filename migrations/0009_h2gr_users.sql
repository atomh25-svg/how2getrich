-- Authenticated users (Clerk-backed).
--
-- A row exists once someone has paid at least once. Keyed by Clerk's
-- user_id (not email) so a row survives a user changing their primary
-- email in Clerk. Email is denormalized in here for Stripe receipts /
-- customer_email pre-fill on resubscribe.
--
-- tier semantics:
--   NULL / missing → free (Month 1 only)
--   'basic'        → $9.99/mo, monthly continuation
--   'premium'      → $19.99/mo, monthly continuation + richer detail
--
-- current_period_end is unix seconds. We treat tier as expired when
-- it's in the past (entitlement.ts normalizes this).
CREATE TABLE h2gr_users (
  clerk_user_id           TEXT PRIMARY KEY,
  email                   TEXT NOT NULL,
  tier                    TEXT,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  current_period_end      INTEGER,
  created_at              INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at              INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX h2gr_users_email                  ON h2gr_users (email);
CREATE INDEX h2gr_users_stripe_customer_id     ON h2gr_users (stripe_customer_id);
CREATE INDEX h2gr_users_stripe_subscription_id ON h2gr_users (stripe_subscription_id);

-- Link table: when an anonymous session_id signs in (and optionally
-- pays), we record the session→user mapping so the user's free Month 1
-- plan stays associated with their Clerk account on later visits.
CREATE TABLE h2gr_session_user (
  session_id      TEXT PRIMARY KEY,
  clerk_user_id   TEXT NOT NULL,
  linked_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX h2gr_session_user_clerk_user_id ON h2gr_session_user (clerk_user_id);
