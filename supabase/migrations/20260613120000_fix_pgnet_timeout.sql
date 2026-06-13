-- Fix pg_net timeout for cron routes.
--
-- net.http_get defaults to 5000ms. The results cron processes multiple
-- events sequentially (provider API calls + scoring) and consistently
-- exceeds 5s, causing every pg_cron invocation to time out silently.
-- pg_cron reports "succeeded" (it queued the request) but the response
-- is never received and the Vercel function may be cancelled mid-execution.
--
-- Fix: raise timeout to 30s. Also remove the duplicate wc-auto-results
-- job (every 30 min) since wc-results (every 15 min) hits the same endpoint.

-- 1. Update the helper function with explicit timeout
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
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 30000
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION private.invoke_cron_route(text) FROM PUBLIC;

-- 2. Remove duplicate wc-auto-results (30 min) — wc-results (15 min) covers it
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT j.jobid INTO existing_job_id FROM cron.job j WHERE j.jobname = 'wc-auto-results';
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;
