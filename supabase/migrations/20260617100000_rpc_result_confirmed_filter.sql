-- Defensive fix: add result_confirmed filter to sum_prediction_points RPC.
--
-- The existing filter `p.points_awarded IS NOT NULL` is always true because the
-- column is `NOT NULL DEFAULT 0`. If any future code path accidentally sets
-- points_awarded before the event is confirmed, those phantom points would be
-- summed into leaderboard totals. Adding `e.result_confirmed = true` ensures
-- only confirmed-event predictions contribute to scores.
--
-- Fix 2 (scope by competition_id) was investigated and intentionally NOT applied:
-- events are shared across competition instances (all 72 WC events belong to the
-- first competition's competition_id). Filtering by p_competition_id would return
-- 0 rows for the second instance. The callers already scope by passing only that
-- competition's member user_ids, so cross-instance bleed cannot occur.
CREATE OR REPLACE FUNCTION public.sum_prediction_points(
  p_user_ids uuid[],
  p_tournament_id uuid DEFAULT NULL,
  p_competition_id uuid DEFAULT NULL
)
RETURNS TABLE (user_id uuid, total_points int)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p.user_id, COALESCE(SUM(p.points_awarded), 0)::int AS total_points
  FROM public.predictions p
  JOIN public.events e ON e.id = p.event_id
  WHERE p.user_id = ANY(p_user_ids)
    AND p.points_awarded IS NOT NULL
    AND e.result_confirmed = true
    AND (
      CASE
        WHEN p_tournament_id IS NOT NULL THEN e.tournament_id = p_tournament_id
        ELSE e.competition_id = p_competition_id
      END
    )
  GROUP BY p.user_id;
$$;
