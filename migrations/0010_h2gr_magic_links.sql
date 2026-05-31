-- Magic-link tokens. Created either by:
--   1. The Stripe webhook after checkout.session.completed (first-time
--      login), or
--   2. The /auth/signin page when an existing paid user requests a
--      new link to recover access.
--
-- The token itself is the random opaque value emailed to the user;
-- it's NOT an HMAC, it's a high-entropy lookup key. We store it
-- hashed so a DB leak doesn't grant access.
--
-- expires_at: 15 minutes after creation.
-- used_at: set when consumed; one-time use only.
CREATE TABLE h2gr_magic_links (
  token_hash    TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  used_at       INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX h2gr_magic_links_email ON h2gr_magic_links (email);
CREATE INDEX h2gr_magic_links_expires_at ON h2gr_magic_links (expires_at);
