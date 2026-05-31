-- Subscriptions table: one row per Stripe subscription. Webhook upserts
-- by stripe_subscription_id. clerk_user_id is filled in once we wire
-- auth (Pass 2B). status is the raw Stripe value: active, trialing,
-- past_due, canceled, unpaid, incomplete, incomplete_expired.

CREATE TABLE IF NOT EXISTS subscriptions (
  stripe_subscription_id     TEXT PRIMARY KEY,
  stripe_customer_id         TEXT NOT NULL,
  clerk_user_id              TEXT,
  status                     TEXT NOT NULL,
  price_id                   TEXT,
  current_period_end         INTEGER,
  cancel_at_period_end       INTEGER NOT NULL DEFAULT 0,
  email                      TEXT,
  created_at                 INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at                 INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer
  ON subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_clerk_user
  ON subscriptions(clerk_user_id);

-- Receipts table: log every checkout.session.completed and
-- invoice.payment_succeeded so we have an audit trail even before the
-- subscriptions row catches up.

CREATE TABLE IF NOT EXISTS checkout_events (
  event_id        TEXT PRIMARY KEY,
  event_type      TEXT NOT NULL,
  session_id      TEXT,
  customer_id     TEXT,
  subscription_id TEXT,
  email           TEXT,
  amount_total    INTEGER,
  payload_json    TEXT NOT NULL,
  received_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_checkout_events_customer
  ON checkout_events(customer_id);
