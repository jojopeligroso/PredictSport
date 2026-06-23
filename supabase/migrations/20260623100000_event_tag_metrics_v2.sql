-- ============================================================
-- Rewrite compute_event_tag_metrics: per-member summary
-- ============================================================
-- The original RPC returned candidate rows (multiple per user)
-- with fields like tag_type/prediction_type. The TypeScript
-- assignment engine expects one row per member with boolean
-- flags (winner_correct, exact_correct, streaks, positions).
-- This rewrite aligns the RPC with the engine.
-- ============================================================

-- Must DROP first because return type changed (Postgres disallows in-place)
DROP FUNCTION IF EXISTS public.compute_event_tag_metrics(uuid, uuid);

CREATE OR REPLACE FUNCTION public.compute_event_tag_metrics(
  p_competition_id uuid,
  p_event_id uuid
)
RETURNS TABLE (
  user_id                        uuid,
  display_name                   text,
  predicted                      boolean,
  winner_correct                 boolean,
  exact_correct                  boolean,
  total_points_this_event        integer,
  was_minority                   boolean,
  pct_with_same_pick             numeric,
  current_correct_streak         integer,
  current_wrong_streak           integer,
  position_before                integer,
  position_after                 integer,
  is_first_confirmed_event       boolean,
  is_last_confirmed_event        boolean,
  exact_score_count_total        integer,
  winner_prediction_data         jsonb,
  exact_score_prediction_data    jsonb,
  submission_seconds_before_lock numeric,
  is_first_exact_score           boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
WITH
-- ── Target event ────────────────────────────────────────────
target_event AS (
  SELECT e.id, e.lock_time
  FROM public.events e
  WHERE e.id = p_event_id
    AND e.competition_id = p_competition_id
    AND e.result_confirmed = true
),

-- ── All confirmed events ordered ────────────────────────────
all_confirmed AS (
  SELECT
    e.id,
    e.lock_time,
    ROW_NUMBER() OVER (ORDER BY e.lock_time ASC, e.id ASC) AS pos,
    COUNT(*) OVER () AS total
  FROM public.events e
  WHERE e.competition_id = p_competition_id
    AND e.result_confirmed = true
),

target_pos AS (
  SELECT pos, total FROM all_confirmed WHERE id = p_event_id
),

-- ── Competition members ─────────────────────────────────────
members AS (
  SELECT cm.user_id, u.display_name
  FROM public.competition_members cm
  JOIN public.users u ON u.id = cm.user_id
  WHERE cm.competition_id = p_competition_id
),

-- ── Predictions on the target event ─────────────────────────
event_preds AS (
  SELECT
    p.user_id,
    p.prediction_type,
    p.prediction_data,
    p.is_correct,
    p.points_awarded,
    p.submitted_at
  FROM public.predictions p
  WHERE p.event_id = p_event_id
),

-- Members who predicted (any type)
predictors AS (
  SELECT DISTINCT user_id FROM event_preds
),

-- ── Winner predictions + pick distribution ──────────────────
winner_preds AS (
  SELECT
    ep.user_id,
    ep.is_correct AS w_correct,
    ep.prediction_data,
    COALESCE(
      ep.prediction_data->>'value',
      ep.prediction_data->>'selection'
    ) AS pick_value
  FROM event_preds ep
  WHERE ep.prediction_type = 'winner'
),

winner_total AS (
  SELECT COUNT(*)::numeric AS cnt FROM winner_preds
),

pick_counts AS (
  SELECT pick_value, COUNT(*)::numeric AS cnt
  FROM winner_preds
  GROUP BY pick_value
),

winner_enriched AS (
  SELECT
    wp.user_id,
    wp.w_correct,
    wp.prediction_data,
    ROUND(pc.cnt / NULLIF(wt.cnt, 0) * 100, 1) AS pct_same,
    (pc.cnt / NULLIF(wt.cnt, 0) * 100 < 25) AS is_minority
  FROM winner_preds wp
  JOIN pick_counts pc ON pc.pick_value = wp.pick_value
  CROSS JOIN winner_total wt
),

-- ── Exact score predictions ─────────────────────────────────
exact_preds AS (
  SELECT
    ep.user_id,
    ep.is_correct AS e_correct,
    ep.prediction_data
  FROM event_preds ep
  WHERE ep.prediction_type = 'exact_score'
),

-- ── Points per member for this event ────────────────────────
event_points AS (
  SELECT user_id, COALESCE(SUM(points_awarded), 0)::integer AS pts
  FROM event_preds
  GROUP BY user_id
),

-- ── Earliest submission per member ──────────────────────────
event_submission AS (
  SELECT
    ep.user_id,
    MIN(EXTRACT(EPOCH FROM (te.lock_time - ep.submitted_at))) AS secs
  FROM event_preds ep
  CROSS JOIN target_event te
  WHERE ep.submitted_at IS NOT NULL
    AND te.lock_time IS NOT NULL
    AND te.lock_time > ep.submitted_at
  GROUP BY ep.user_id
),

-- ── Prior exact score count (before this event) ─────────────
prior_exact AS (
  SELECT p.user_id, COUNT(*)::integer AS cnt
  FROM public.predictions p
  JOIN public.events e ON e.id = p.event_id
  WHERE e.competition_id = p_competition_id
    AND p.prediction_type = 'exact_score'
    AND p.is_correct = true
    AND e.id != p_event_id
    AND e.result_confirmed = true
  GROUP BY p.user_id
),

-- ── Correct prediction streak ending at this event ──────────
-- Look at winner predictions on confirmed events up to current,
-- in reverse chronological order. Count consecutive correct.
ordered_winner AS (
  SELECT
    p.user_id,
    p.is_correct,
    ROW_NUMBER() OVER (
      PARTITION BY p.user_id
      ORDER BY ace.pos DESC
    ) AS rev
  FROM public.predictions p
  JOIN all_confirmed ace ON ace.id = p.event_id
  CROSS JOIN target_pos tp
  WHERE p.prediction_type = 'winner'
    AND ace.pos <= tp.pos
),

streak_correct AS (
  SELECT
    user_id,
    COALESCE(
      MIN(CASE WHEN is_correct = false THEN rev END) - 1,
      MAX(rev)
    )::integer AS streak
  FROM ordered_winner
  GROUP BY user_id
),

streak_wrong AS (
  SELECT
    user_id,
    COALESCE(
      MIN(CASE WHEN is_correct = true THEN rev END) - 1,
      MAX(rev)
    )::integer AS streak
  FROM ordered_winner
  GROUP BY user_id
),

-- ── Leaderboard position before this event ──────────────────
pts_before AS (
  SELECT
    m.user_id,
    COALESCE(sub.total, 0) AS total
  FROM members m
  LEFT JOIN (
    SELECT p.user_id, SUM(p.points_awarded) AS total
    FROM public.predictions p
    JOIN public.events e ON e.id = p.event_id
    WHERE e.competition_id = p_competition_id
      AND e.result_confirmed = true
      AND e.id != p_event_id
    GROUP BY p.user_id
  ) sub ON sub.user_id = m.user_id
),

rank_before AS (
  SELECT user_id, RANK() OVER (ORDER BY total DESC)::integer AS position
  FROM pts_before
),

-- ── Leaderboard position after this event ───────────────────
pts_after AS (
  SELECT
    m.user_id,
    COALESCE(sub.total, 0) AS total
  FROM members m
  LEFT JOIN (
    SELECT p.user_id, SUM(p.points_awarded) AS total
    FROM public.predictions p
    JOIN public.events e ON e.id = p.event_id
    WHERE e.competition_id = p_competition_id
      AND e.result_confirmed = true
    GROUP BY p.user_id
  ) sub ON sub.user_id = m.user_id
),

rank_after AS (
  SELECT user_id, RANK() OVER (ORDER BY total DESC)::integer AS position
  FROM pts_after
)

-- ── Final assembly: one row per predictor ───────────────────
SELECT
  pr.user_id,
  m.display_name,
  true                                          AS predicted,
  COALESCE(we.w_correct, false)                 AS winner_correct,
  COALESCE(ep.e_correct, false)                 AS exact_correct,
  COALESCE(evp.pts, 0)                          AS total_points_this_event,
  COALESCE(we.is_minority, false)               AS was_minority,
  COALESCE(we.pct_same, 0)                      AS pct_with_same_pick,
  COALESCE(sc.streak, 0)                        AS current_correct_streak,
  COALESCE(sw.streak, 0)                        AS current_wrong_streak,
  COALESCE(rb.position, 0)                      AS position_before,
  COALESCE(ra.position, 0)                      AS position_after,
  COALESCE(tp.pos = 1, false)                   AS is_first_confirmed_event,
  COALESCE(tp.pos = tp.total, false)            AS is_last_confirmed_event,
  (COALESCE(pe.cnt, 0)
   + CASE WHEN COALESCE(ep.e_correct, false) THEN 1 ELSE 0 END
  )::integer                                    AS exact_score_count_total,
  we.prediction_data                            AS winner_prediction_data,
  ep.prediction_data                            AS exact_score_prediction_data,
  COALESCE(es.secs, 0)                          AS submission_seconds_before_lock,
  (COALESCE(pe.cnt, 0) = 0
   AND COALESCE(ep.e_correct, false))           AS is_first_exact_score
FROM predictors pr
JOIN members m          ON m.user_id  = pr.user_id
CROSS JOIN target_pos tp
LEFT JOIN winner_enriched we ON we.user_id = pr.user_id
LEFT JOIN exact_preds ep     ON ep.user_id = pr.user_id
LEFT JOIN event_points evp   ON evp.user_id = pr.user_id
LEFT JOIN event_submission es ON es.user_id = pr.user_id
LEFT JOIN prior_exact pe     ON pe.user_id = pr.user_id
LEFT JOIN streak_correct sc  ON sc.user_id = pr.user_id
LEFT JOIN streak_wrong sw    ON sw.user_id = pr.user_id
LEFT JOIN rank_before rb     ON rb.user_id = pr.user_id
LEFT JOIN rank_after ra      ON ra.user_id = pr.user_id;
$$;

COMMENT ON FUNCTION public.compute_event_tag_metrics IS
  'Per-member summary for event-driven tag assignment. Returns one row per '
  'member who predicted the given event, with winner/exact correctness, '
  'streaks, leaderboard position delta, and timing. '
  'SECURITY DEFINER — service-role only (no GRANT to authenticated).';
