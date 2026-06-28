-- Stage-scoped point aggregation RPCs for Format classification.
--
-- The Format classification resets points per sporting stage. The existing
-- sum_prediction_points and prediction_accuracy_stats RPCs sum across ALL
-- stages (tournament-wide), which is correct for Overall but wrong for Format.
--
-- These RPCs join predictions → events → rounds → sporting_stage_id to filter
-- points to a single stage. Used by the standings and my-group routes when the
-- classification_type is 'format_elimination'.

-- 1. Stage-scoped points (mirrors sum_prediction_points)
CREATE OR REPLACE FUNCTION public.sum_stage_points(
  p_user_ids uuid[],
  p_sporting_stage_id uuid,
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
  JOIN public.rounds r ON r.id = e.round_id
  WHERE p.user_id = ANY(p_user_ids)
    AND p.points_awarded IS NOT NULL
    AND r.sporting_stage_id = p_sporting_stage_id
    AND (
      CASE
        WHEN p_tournament_id IS NOT NULL THEN e.tournament_id = p_tournament_id
        ELSE e.competition_id = p_competition_id
      END
    )
  GROUP BY p.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.sum_stage_points(uuid[], uuid, uuid, uuid) TO authenticated;

-- 2. Stage-scoped accuracy stats (mirrors prediction_accuracy_stats)
CREATE OR REPLACE FUNCTION public.stage_accuracy_stats(
  p_user_ids uuid[],
  p_sporting_stage_id uuid,
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
  JOIN public.rounds r ON r.id = e.round_id
  WHERE p.user_id = ANY(p_user_ids)
    AND e.result_confirmed = true
    AND r.sporting_stage_id = p_sporting_stage_id
    AND (
      CASE
        WHEN p_tournament_id IS NOT NULL THEN e.tournament_id = p_tournament_id
        ELSE e.competition_id = p_competition_id
      END
    )
  GROUP BY p.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.stage_accuracy_stats(uuid[], uuid, uuid, uuid) TO authenticated;
