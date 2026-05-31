-- Set when the user clicks "Start Day 1" from their Blueprint. Until
-- this is set, /app/dashboard redirects back to the Blueprint so the
-- user has to make the explicit "I'm starting now" choice that anchors
-- Day 1 in real time.
ALTER TABLE subscriptions ADD COLUMN launch_started_at INTEGER;
