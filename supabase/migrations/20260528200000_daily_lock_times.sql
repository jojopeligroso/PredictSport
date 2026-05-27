-- Migrate event lock_times from per-event (start_time - 30min) to daily
-- (earliest kickoff on same UTC day - 10min).
--
-- The rule: all events on the same UTC calendar day share one lock_time,
-- computed as min(start_time) for that day minus 10 minutes.
-- This allows the frontend to show one countdown per day and the backend
-- (RLS + API) to enforce the same daily lock for all events on that day.

UPDATE events e
SET lock_time = daily.daily_lock
FROM (
  SELECT
    e2.id,
    (MIN(e2.start_time) OVER (
      PARTITION BY e2.round_id, (e2.start_time AT TIME ZONE 'UTC')::date
    )) - INTERVAL '10 minutes' AS daily_lock
  FROM events e2
  WHERE e2.competition_id IN (
    SELECT id FROM competitions WHERE product_mode = 'world_cup_2026_shell'
  )
  AND e2.status NOT IN ('cancelled', 'postponed')
) daily
WHERE e.id = daily.id
AND e.lock_time IS DISTINCT FROM daily.daily_lock;
