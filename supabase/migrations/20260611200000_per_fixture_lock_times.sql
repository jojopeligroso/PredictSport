-- Per-fixture locking: each fixture locks 10 minutes before its own kickoff.
-- Replaces the previous batch-per-day pattern where all fixtures on a day
-- shared the earliest game's lock_time.
--
-- Effect:
--   - Predictions accepted until 10 min before each individual kickoff
--   - Other entrants' picks revealed at the same moment (pick_reveal_at = NULL)
--   - Late joiners can predict any fixture that hasn't started yet
--   - RLS enforces this: no cron dependency for correctness

UPDATE events
SET lock_time = start_time - interval '10 minutes'
WHERE tournament_id = 'a0000000-0000-0000-0000-000000000026';
