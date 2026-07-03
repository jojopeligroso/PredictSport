-- Live score ingestion cron: poll /api/results/live every minute while any
-- event is inside its live window.
--
-- The route writes in-progress scores to events.result_data.live for the
-- provisional live leaderboard. It never confirms results and never writes
-- predictions.points_awarded — confirmed scoring stays with wc-results
-- (every 15 min → /api/results/cron).
--
-- The SQL guard keeps the job a no-op (zero HTTP calls, zero Vercel
-- invocations) outside match windows. 4 hours covers soccer's live window
-- (3h) with buffer; other sports fall back to the 15-min provisional cadence
-- if they exceed it.
--
-- invoke_cron_route passes an explicit timeout_milliseconds := 30000
-- (see 20260613120000_fix_pgnet_timeout.sql) — never rely on the 5s default.

-- Remove any previous version of the job
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT j.jobid INTO existing_job_id FROM cron.job j WHERE j.jobname = 'wc-live-scores';
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'wc-live-scores',
  '* * * * *',
  $cmd$
  SELECT private.invoke_cron_route('/api/results/live')
  WHERE EXISTS (
    SELECT 1
      FROM public.events e
     WHERE e.result_confirmed = false
       AND (e.status IS NULL OR e.status NOT IN ('cancelled', 'postponed'))
       AND e.start_time <= now()
       AND e.start_time > now() - interval '4 hours'
  );
  $cmd$
);
