-- Aggregate prediction accuracy stats per user in the database.
--
-- Returns winner (outcome) and exact_score accuracy counts per user.
-- Runs in SQL to avoid PostgREST row limits on raw prediction queries.
-- Used by the standings API to include accuracy data in leaderboard responses.
CREATE OR REPLACE FUNCTION public.prediction_accuracy_stats(
  p_user_ids uuid[],
  p_tournament_id uuid DEFAULT NULL,
  p_competition_id uuid DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  winner_correct int,
  winner_total int,
  score_correct int,
  score_total int
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    p.user_id,
    COALESCE(SUM(CASE WHEN p.prediction_type = 'winner' AND p.is_correct = true THEN 1 ELSE 0 END), 0)::int AS winner_correct,
    COALESCE(SUM(CASE WHEN p.prediction_type = 'winner' THEN 1 ELSE 0 END), 0)::int AS winner_total,
    COALESCE(SUM(CASE WHEN p.prediction_type = 'exact_score' AND p.is_correct = true THEN 1 ELSE 0 END), 0)::int AS score_correct,
    COALESCE(SUM(CASE WHEN p.prediction_type = 'exact_score' THEN 1 ELSE 0 END), 0)::int AS score_total
  FROM public.predictions p
  JOIN public.events e ON e.id = p.event_id
  WHERE p.user_id = ANY(p_user_ids)
    AND e.result_confirmed = true
    AND (
      CASE
        WHEN p_tournament_id IS NOT NULL THEN e.tournament_id = p_tournament_id
        ELSE e.competition_id = p_competition_id
      END
    )
  GROUP BY p.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.prediction_accuracy_stats(uuid[], uuid, uuid) TO authenticated;
