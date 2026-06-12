-- Migrate results cron from Vercel daily (06:30 UTC) to pg_cron every 15 min.
-- Vercel cron stays as a 07:00 UTC safety-net fallback (see vercel.json).
--
-- Uses the existing private.invoke_cron_route() helper from
-- 20260528000100_schedule_cron_jobs.sql.

-- Idempotent: remove existing job if re-running
DO $$
BEGIN
  PERFORM cron.unschedule('wc-results');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'wc-results',
  '*/15 * * * *',
  $cron$SELECT private.invoke_cron_route('/api/results/cron');$cron$
);
