-- Track whether each user has finished the Founder DNA survey so we can
-- gate Dashboard / Ideas / Blueprint on it. One subscription per user, so
-- a column on subscriptions is enough.
ALTER TABLE subscriptions ADD COLUMN founder_dna_completed_at INTEGER;
