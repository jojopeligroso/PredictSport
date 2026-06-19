-- Automated prediction contradiction detection.
--
-- Creates an RPC that finds all users whose winner prediction disagrees
-- with the winner implied by their exact_score prediction. This catches
-- race condition victims (stale winner POST overwriting auto-derived value)
-- before scoring runs.
--
-- Also schedules a daily pg_cron job at 06:00 UTC that calls the
-- /api/admin/cron/detect-contradictions route via pg_net.

-- 1. Create the detection RPC (runs in-database, no HTTP needed for direct calls)
CREATE OR REPLACE FUNCTION public.detect_prediction_contradictions()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  event_id uuid,
  event_name text,
  result_confirmed boolean,
  home_score int,
  away_score int,
  implied_winner text,
  stored_winner text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH score_preds AS (
    SELECT
      p.user_id,
      p.event_id,
      (p.prediction_data->>'home')::int AS home_score,
      (p.prediction_data->>'away')::int AS away_score
    FROM public.predictions p
    WHERE p.prediction_type = 'exact_score'
      AND p.prediction_data->>'home' IS NOT NULL
      AND p.prediction_data->>'away' IS NOT NULL
  ),
  winner_preds AS (
    SELECT
      p.user_id,
      p.event_id,
      p.prediction_data->>'value' AS winner_value,
      ept.config->'options' AS options
    FROM public.predictions p
    JOIN public.event_prediction_types ept
      ON p.event_prediction_type_id = ept.id
    WHERE p.prediction_type = 'winner'
      AND p.prediction_data->>'value' IS NOT NULL
  ),
  joined AS (
    SELECT
      s.user_id,
      s.event_id,
      s.home_score,
      s.away_score,
      w.winner_value,
      CASE
        WHEN s.home_score > s.away_score THEN w.options->>0
        WHEN s.home_score < s.away_score THEN w.options->>(jsonb_array_length(w.options) - 1)
        ELSE 'Draw'
      END AS implied_winner
    FROM score_preds s
    JOIN winner_preds w
      ON s.user_id = w.user_id
      AND s.event_id = w.event_id
  )
  SELECT
    j.user_id,
    u.display_name,
    j.event_id,
    e.event_name,
    e.result_confirmed,
    j.home_score,
    j.away_score,
    j.implied_winner,
    j.winner_value AS stored_winner
  FROM joined j
  JOIN public.users u ON j.user_id = u.id
  JOIN public.events e ON j.event_id = e.id
  WHERE j.implied_winner != j.winner_value;
$$;

REVOKE ALL ON FUNCTION public.detect_prediction_contradictions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_prediction_contradictions() TO service_role;

-- 2. Schedule daily cron job at 06:00 UTC
SELECT cron.schedule(
  'detect-contradictions',
  '0 6 * * *',
  $$SELECT private.invoke_cron_route('/api/admin/cron/detect-contradictions')$$
);
