-- Schedule the four "ghost cron" routes via pg_cron + pg_net.
--
-- Pattern: pg_cron schedules SQL inside the database; the SQL invokes a
-- helper `private.invoke_cron_route(path)` which reads CRON_SECRET from
-- Supabase Vault and makes an async pg_net HTTP GET to the Vercel route.
-- The route on Vercel runs unchanged.
--
-- Trade-off: pg_net is fire-and-forget. cron.job_run_details shows the
-- HTTP request was queued, not whether the route returned 2xx. Query
-- net._http_response to verify success.
--
-- Routes scheduled here:
--   /api/tournament/cron/lock-windows         every 5 min
--   /api/tournament/cron/auto-finalise        every 5 min
--   /api/notifications/cron                   hourly
--   /api/notifications/missing-results        daily 10:00 UTC
--
-- /api/results/cron stays on Vercel (one daily slot still free + no
-- behaviour change).

-- 1. Stash CRON_SECRET in Vault. The actual secret value is set after
--    the migration via UPDATE so it's not committed to git. This row
--    creates the slot with a placeholder; the helper raises if it's
--    still placeholder when called.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_secret') THEN
    PERFORM vault.create_secret(
      'placeholder-replace-via-update',
      'cron_secret',
      'Bearer token sent in Authorization header to Vercel cron routes. Rotate via UPDATE vault.secrets.'
    );
  END IF;
END $$;

-- 2. Helper: build the Authorization header from Vault and dispatch the
--    HTTP request. SECURITY DEFINER so non-postgres callers (none today)
--    can't read Vault directly.
CREATE OR REPLACE FUNCTION private.invoke_cron_route(route_path text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  secret text;
  request_id bigint;
  base_url text := 'https://predictsport-rust.vercel.app';
BEGIN
  SELECT decrypted_secret INTO secret
    FROM vault.decrypted_secrets
   WHERE name = 'cron_secret'
   LIMIT 1;

  IF secret IS NULL OR secret = 'placeholder-replace-via-update' THEN
    RAISE EXCEPTION 'cron_secret in vault.secrets is missing or still placeholder';
  END IF;

  SELECT net.http_get(
    url := base_url || route_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret)
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION private.invoke_cron_route(text) FROM PUBLIC;

-- 3. Schedules. Unschedule by name first so a re-run is idempotent.
--    cron.unschedule(text) errors if the job doesn't exist, so we guard.
DO $$
DECLARE
  existing_job_id bigint;
  jobs text[] := ARRAY[
    'wc-lock-windows',
    'wc-auto-finalise',
    'wc-notifications-hourly',
    'wc-missing-results-daily'
  ];
  job_name text;
BEGIN
  FOREACH job_name IN ARRAY jobs LOOP
    SELECT j.jobid INTO existing_job_id FROM cron.job j WHERE j.jobname = job_name;
    IF existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job_id);
    END IF;
  END LOOP;
END $$;

SELECT cron.schedule(
  'wc-lock-windows',
  '*/5 * * * *',
  $cron$SELECT private.invoke_cron_route('/api/tournament/cron/lock-windows');$cron$
);

SELECT cron.schedule(
  'wc-auto-finalise',
  '*/5 * * * *',
  $cron$SELECT private.invoke_cron_route('/api/tournament/cron/auto-finalise');$cron$
);

SELECT cron.schedule(
  'wc-notifications-hourly',
  '0 * * * *',
  $cron$SELECT private.invoke_cron_route('/api/notifications/cron');$cron$
);

SELECT cron.schedule(
  'wc-missing-results-daily',
  '0 10 * * *',
  $cron$SELECT private.invoke_cron_route('/api/notifications/missing-results');$cron$
);
