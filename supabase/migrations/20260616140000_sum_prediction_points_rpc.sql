-- Aggregate scored prediction points per user in the database.
--
-- The tournament-standings routes previously fetched every scored prediction
-- row and summed them in JavaScript. With 50 users and 2500+ scored rows that
-- query exceeded PostgREST's `max-rows` cap (default 1000), so only a subset of
-- rows came back and many users summed to zero on the leaderboard. A larger
-- client `.limit()` cannot exceed `max-rows`, so it could not fix this.
--
-- This RPC does the SUM/GROUP BY in SQL and returns one row per user (~50 rows),
-- which can never hit the row cap. SECURITY INVOKER keeps the existing RLS
-- behaviour: a caller only sums predictions they are allowed to read (scored
-- events are result_confirmed, hence revealed, hence visible).
--
-- Pass p_tournament_id to score across every instance that shares a fixture
-- catalogue (tournament path); pass only p_competition_id for a single instance.
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
    AND (
      CASE
        WHEN p_tournament_id IS NOT NULL THEN e.tournament_id = p_tournament_id
        ELSE e.competition_id = p_competition_id
      END
    )
  GROUP BY p.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.sum_prediction_points(uuid[], uuid, uuid) TO authenticated;
