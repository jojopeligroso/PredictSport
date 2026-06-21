-- Tag computation RPCs for the reputation tag system.
--
-- compute_behavioural_tag_metrics: returns one row per competition member with
--   all metrics needed for behavioural tag assignment for a given round.
--
-- compute_event_tag_metrics: returns qualifying rows for event-driven tags
--   after a single event is confirmed.
--
-- Both RPCs are SECURITY DEFINER (service-role only) and return bounded result
-- sets (one row per member or per qualifying member).

-- ============================================================
-- 1. compute_behavioural_tag_metrics
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_behavioural_tag_metrics(
  p_competition_id uuid,
  p_round_id uuid
)
RETURNS TABLE (
  user_id              uuid,
  total_predictions    bigint,
  total_fixtures       bigint,
  engagement_rate      numeric,
  contrarian_pct       numeric,
  majority_pct         numeric,
  avg_total_goals      numeric,
  draws_predicted      bigint,
  repeat_score_count   bigint,
  most_repeated_score  text,
  unique_scores_used   bigint,
  blowout_count        bigint,
  prediction_changes   bigint,
  avg_submission_offset_seconds numeric,
  accuracy             numeric,
  contrarian_accuracy  numeric,
  correct_streak       bigint,
  incorrect_streak     bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
WITH
-- All predictions for this competition (up to and including the given round)
-- We scope to the round's events and all prior rounds' events.
round_events AS (
  SELECT e.id AS event_id, e.lock_time, e.start_time, e.result_confirmed, e.round_id
  FROM public.events e
  JOIN public.rounds r ON r.id = e.round_id
  WHERE e.competition_id = p_competition_id
    AND r.round_number <= (
      SELECT round_number FROM public.rounds WHERE id = p_round_id
    )
),

-- Only events in the specific round (for round-scoped metrics like engagement)
this_round_events AS (
  SELECT re.event_id
  FROM round_events re
  WHERE re.round_id = p_round_id
),

-- All predictions for round-scoped events
base AS (
  SELECT
    p.id              AS pred_id,
    p.user_id,
    p.event_id,
    p.prediction_type,
    p.prediction_data,
    p.is_correct,
    p.points_awarded,
    p.submitted_at::timestamptz AS submitted_at,
    p.updated_at::timestamptz   AS updated_at,
    re.lock_time,
    re.start_time,
    re.result_confirmed
  FROM public.predictions p
  JOIN round_events re ON re.event_id = p.event_id
),

-- Predictions scoped only to THIS round (for engagement rate)
this_round_preds AS (
  SELECT p.user_id, COUNT(DISTINCT p.event_id)::bigint AS events_predicted
  FROM public.predictions p
  WHERE p.event_id IN (SELECT event_id FROM this_round_events)
  GROUP BY p.user_id
),

-- Total events in this round
this_round_event_count AS (
  SELECT COUNT(*)::bigint AS cnt FROM this_round_events
),

-- All members of the competition
members AS (
  SELECT cm.user_id
  FROM public.competition_members cm
  WHERE cm.competition_id = p_competition_id
),

-- Total events across all rounds up to this one
all_event_count AS (
  SELECT COUNT(*)::bigint AS cnt FROM round_events
),

-- Basic aggregate counts per user (cumulative through this round)
basic_counts AS (
  SELECT
    b.user_id,
    COUNT(*)::bigint AS total_predictions,
    SUM(CASE WHEN b.updated_at > b.submitted_at + interval '60 seconds' THEN 1 ELSE 0 END)::bigint AS prediction_changes
  FROM base b
  GROUP BY b.user_id
),

-- Accuracy: only on resolved predictions
accuracy_counts AS (
  SELECT
    b.user_id,
    SUM(CASE WHEN b.is_correct = true THEN 1 ELSE 0 END)::bigint AS correct_count,
    SUM(CASE WHEN b.is_correct IS NOT NULL THEN 1 ELSE 0 END)::bigint AS scored_count
  FROM base b
  WHERE b.result_confirmed = true
  GROUP BY b.user_id
),

-- Draw predictions
draw_counts AS (
  SELECT
    b.user_id,
    SUM(
      CASE
        WHEN b.prediction_type = 'winner'
             AND COALESCE(b.prediction_data->>'value', b.prediction_data->>'selection') = 'Draw'
          THEN 1
        WHEN b.prediction_type = 'exact_score'
             AND jsonb_typeof(b.prediction_data->'home') = 'number'
             AND jsonb_typeof(b.prediction_data->'away') = 'number'
             AND (b.prediction_data->>'home')::int = (b.prediction_data->>'away')::int
          THEN 1
        ELSE 0
      END
    )::bigint AS draws_predicted
  FROM base b
  GROUP BY b.user_id
),

-- Exact score metrics
score_metrics AS (
  SELECT
    b.user_id,
    ROUND(AVG((b.prediction_data->>'home')::int + (b.prediction_data->>'away')::int), 2)
      AS avg_total_goals,
    SUM(CASE WHEN ABS((b.prediction_data->>'home')::int - (b.prediction_data->>'away')::int) >= 3
             THEN 1 ELSE 0 END)::bigint
      AS blowout_count,
    COUNT(DISTINCT (b.prediction_data->>'home') || '-' || (b.prediction_data->>'away'))::bigint
      AS unique_scores_used
  FROM base b
  WHERE b.prediction_type = 'exact_score'
    AND jsonb_typeof(b.prediction_data->'home') = 'number'
    AND jsonb_typeof(b.prediction_data->'away') = 'number'
  GROUP BY b.user_id
),

-- Most repeated exact score per user
score_mode AS (
  SELECT DISTINCT ON (sub.user_id)
    sub.user_id,
    sub.score_key AS most_repeated_score,
    sub.cnt       AS repeat_score_count
  FROM (
    SELECT
      b.user_id,
      (b.prediction_data->>'home') || '-' || (b.prediction_data->>'away') AS score_key,
      COUNT(*)::bigint AS cnt
    FROM base b
    WHERE b.prediction_type = 'exact_score'
      AND jsonb_typeof(b.prediction_data->'home') = 'number'
      AND jsonb_typeof(b.prediction_data->'away') = 'number'
    GROUP BY b.user_id, score_key
    ORDER BY b.user_id, cnt DESC, score_key
  ) sub
),

-- Winner prediction values for majority/minority analysis (resolved events only)
winner_values AS (
  SELECT
    b.user_id,
    b.event_id,
    COALESCE(b.prediction_data->>'value', b.prediction_data->>'selection') AS winner_pick,
    b.is_correct
  FROM base b
  WHERE b.prediction_type = 'winner'
    AND b.is_correct IS NOT NULL
),

-- Per-event majority pick
event_majority AS (
  SELECT DISTINCT ON (sub.event_id)
    sub.event_id,
    sub.winner_pick AS majority_pick
  FROM (
    SELECT wv.event_id, wv.winner_pick, COUNT(*) AS cnt
    FROM winner_values wv
    GROUP BY wv.event_id, wv.winner_pick
    ORDER BY wv.event_id, cnt DESC
  ) sub
),

-- Per-user majority vs minority pick counts
user_majority AS (
  SELECT
    wv.user_id,
    SUM(CASE WHEN wv.winner_pick = em.majority_pick THEN 1 ELSE 0 END)::bigint AS majority_picks,
    SUM(CASE WHEN wv.winner_pick != em.majority_pick THEN 1 ELSE 0 END)::bigint AS minority_picks
  FROM winner_values wv
  JOIN event_majority em ON em.event_id = wv.event_id
  GROUP BY wv.user_id
),

-- Contrarian accuracy: accuracy on minority-pick predictions only
contrarian_accuracy_calc AS (
  SELECT
    wv.user_id,
    SUM(CASE WHEN wv.is_correct = true THEN 1 ELSE 0 END)::bigint AS contrarian_correct,
    COUNT(*)::bigint AS contrarian_total
  FROM winner_values wv
  JOIN event_majority em ON em.event_id = wv.event_id
  WHERE wv.winner_pick != em.majority_pick
  GROUP BY wv.user_id
),

-- Submission timing (seconds before lock)
timing_stats AS (
  SELECT
    b.user_id,
    ROUND(AVG(EXTRACT(EPOCH FROM (b.lock_time - b.submitted_at))), 1) AS avg_offset_seconds
  FROM base b
  WHERE b.submitted_at IS NOT NULL
    AND b.lock_time IS NOT NULL
    AND b.lock_time > b.submitted_at
  GROUP BY b.user_id
),

-- Streak computation: gaps-and-islands on resolved predictions
ordered_preds AS (
  SELECT
    b.user_id,
    b.is_correct,
    ROW_NUMBER() OVER (PARTITION BY b.user_id ORDER BY b.start_time, b.prediction_type) AS rn,
    ROW_NUMBER() OVER (PARTITION BY b.user_id ORDER BY b.start_time DESC, b.prediction_type DESC) AS rn_desc
  FROM base b
  WHERE b.is_correct IS NOT NULL
),
streak_islands AS (
  SELECT
    op.user_id,
    op.is_correct,
    op.rn - ROW_NUMBER() OVER (PARTITION BY op.user_id, op.is_correct ORDER BY op.rn) AS island
  FROM ordered_preds op
),
-- Current correct streak (consecutive correct from most recent backwards)
current_correct_streak AS (
  SELECT
    op.user_id,
    COUNT(*)::bigint AS streak
  FROM ordered_preds op
  WHERE op.is_correct = true
    AND NOT EXISTS (
      SELECT 1 FROM ordered_preds op2
      WHERE op2.user_id = op.user_id
        AND op2.is_correct = false
        AND op2.rn_desc < op.rn_desc
    )
  GROUP BY op.user_id
),
-- Current incorrect streak (consecutive incorrect from most recent backwards)
current_incorrect_streak AS (
  SELECT
    op.user_id,
    COUNT(*)::bigint AS streak
  FROM ordered_preds op
  WHERE op.is_correct = false
    AND NOT EXISTS (
      SELECT 1 FROM ordered_preds op2
      WHERE op2.user_id = op.user_id
        AND op2.is_correct = true
        AND op2.rn_desc < op.rn_desc
    )
  GROUP BY op.user_id
)

-- Final assembly
SELECT
  m.user_id,
  COALESCE(bc.total_predictions, 0)::bigint,
  aec.cnt,
  -- Engagement rate: events predicted in this round / events in this round
  CASE WHEN trec.cnt > 0
    THEN ROUND(COALESCE(trp.events_predicted, 0)::numeric / trec.cnt * 100, 1)
    ELSE 0
  END,
  -- Contrarian %
  CASE WHEN COALESCE(umaj.minority_picks, 0) + COALESCE(umaj.majority_picks, 0) > 0
    THEN ROUND(
      COALESCE(umaj.minority_picks, 0)::numeric
      / (COALESCE(umaj.minority_picks, 0) + COALESCE(umaj.majority_picks, 0)) * 100, 1)
    ELSE 0
  END,
  -- Majority %
  CASE WHEN COALESCE(umaj.minority_picks, 0) + COALESCE(umaj.majority_picks, 0) > 0
    THEN ROUND(
      COALESCE(umaj.majority_picks, 0)::numeric
      / (COALESCE(umaj.minority_picks, 0) + COALESCE(umaj.majority_picks, 0)) * 100, 1)
    ELSE 0
  END,
  ROUND(COALESCE(sm.avg_total_goals, 0), 2),
  COALESCE(dc.draws_predicted, 0)::bigint,
  COALESCE(smode.repeat_score_count, 0)::bigint,
  COALESCE(smode.most_repeated_score, ''),
  COALESCE(sm.unique_scores_used, 0)::bigint,
  COALESCE(sm.blowout_count, 0)::bigint,
  COALESCE(bc.prediction_changes, 0)::bigint,
  COALESCE(ts.avg_offset_seconds, 0),
  -- Accuracy: correct / scored
  CASE WHEN COALESCE(ac.scored_count, 0) > 0
    THEN ROUND(ac.correct_count::numeric / ac.scored_count * 100, 1)
    ELSE 0
  END,
  -- Contrarian accuracy
  CASE WHEN COALESCE(cac.contrarian_total, 0) > 0
    THEN ROUND(cac.contrarian_correct::numeric / cac.contrarian_total * 100, 1)
    ELSE 0
  END,
  COALESCE(ccs.streak, 0)::bigint,
  COALESCE(cis.streak, 0)::bigint
FROM members m
CROSS JOIN all_event_count aec
CROSS JOIN this_round_event_count trec
LEFT JOIN basic_counts bc          ON bc.user_id = m.user_id
LEFT JOIN this_round_preds trp     ON trp.user_id = m.user_id
LEFT JOIN accuracy_counts ac       ON ac.user_id = m.user_id
LEFT JOIN draw_counts dc           ON dc.user_id = m.user_id
LEFT JOIN score_metrics sm         ON sm.user_id = m.user_id
LEFT JOIN score_mode smode         ON smode.user_id = m.user_id
LEFT JOIN user_majority umaj       ON umaj.user_id = m.user_id
LEFT JOIN contrarian_accuracy_calc cac ON cac.user_id = m.user_id
LEFT JOIN timing_stats ts          ON ts.user_id = m.user_id
LEFT JOIN current_correct_streak ccs ON ccs.user_id = m.user_id
LEFT JOIN current_incorrect_streak cis ON cis.user_id = m.user_id;
$$;

COMMENT ON FUNCTION public.compute_behavioural_tag_metrics IS
  'Returns one row per competition member with all metrics needed for behavioural tag assignment. '
  'Scoped to predictions through the given round (cumulative). '
  'Engagement rate is scoped to the specific round. '
  'Result set bounded by member count (max ~100). '
  'SECURITY DEFINER — call from service-role only.';


-- ============================================================
-- 2. compute_event_tag_metrics
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_event_tag_metrics(
  p_competition_id uuid,
  p_event_id uuid
)
RETURNS TABLE (
  user_id              uuid,
  tag_type             text,
  prediction_type      text,
  prediction_data      jsonb,
  is_correct           boolean,
  points_awarded       integer,
  submission_seconds_before_lock numeric,
  pct_with_same_pick   numeric,
  is_first_exact_score boolean,
  display_name         text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
WITH
-- The target event
target_event AS (
  SELECT e.id, e.lock_time, e.result_data, e.result_confirmed, e.competition_id
  FROM public.events e
  WHERE e.id = p_event_id
    AND e.competition_id = p_competition_id
    AND e.result_confirmed = true
),

-- All predictions for this event
event_preds AS (
  SELECT
    p.user_id,
    p.prediction_type,
    p.prediction_data,
    p.is_correct,
    p.points_awarded,
    p.submitted_at,
    te.lock_time
  FROM public.predictions p
  CROSS JOIN target_event te
  WHERE p.event_id = p_event_id
),

-- Winner predictions with their pick value
winner_picks AS (
  SELECT
    ep.user_id,
    COALESCE(ep.prediction_data->>'value', ep.prediction_data->>'selection') AS pick
  FROM event_preds ep
  WHERE ep.prediction_type = 'winner'
),

-- Total winner predictions for this event
winner_total AS (
  SELECT COUNT(*)::numeric AS cnt FROM winner_picks
),

-- Count per pick value
pick_counts AS (
  SELECT wp.pick, COUNT(*)::numeric AS cnt
  FROM winner_picks wp
  GROUP BY wp.pick
),

-- Members who got exact score correct
exact_correct AS (
  SELECT
    ep.user_id,
    ep.prediction_data,
    ep.points_awarded,
    ep.submitted_at,
    ep.lock_time
  FROM event_preds ep
  WHERE ep.prediction_type = 'exact_score'
    AND ep.is_correct = true
),

-- Check if user has ANY previous exact score correct in this competition
-- (to determine "first exact score" tag)
prior_exact_scores AS (
  SELECT DISTINCT p.user_id
  FROM public.predictions p
  JOIN public.events e ON e.id = p.event_id
  WHERE e.competition_id = p_competition_id
    AND p.prediction_type = 'exact_score'
    AND p.is_correct = true
    AND p.event_id != p_event_id
),

-- Upset detection: winner picked by < 25% of group
upset_picks AS (
  SELECT
    wp.user_id,
    wp.pick,
    pc.cnt AS pick_count,
    wt.cnt AS total_count,
    ROUND(pc.cnt / NULLIF(wt.cnt, 0) * 100, 1) AS pct
  FROM winner_picks wp
  JOIN pick_counts pc ON pc.pick = wp.pick
  CROSS JOIN winner_total wt
  JOIN event_preds ep ON ep.user_id = wp.user_id AND ep.prediction_type = 'winner'
  WHERE ep.is_correct = true
    AND pc.cnt / NULLIF(wt.cnt, 0) * 100 < 25
),

-- Assemble exact score results
exact_results AS (
  SELECT
    ec.user_id,
    'exact_score_hit'::text AS tag_type,
    'exact_score'::text AS pred_type,
    ec.prediction_data,
    true AS is_correct,
    ec.points_awarded,
    ROUND(EXTRACT(EPOCH FROM (ec.lock_time - ec.submitted_at)), 0) AS seconds_before,
    NULL::numeric AS pct_same,
    (NOT EXISTS (SELECT 1 FROM prior_exact_scores pes WHERE pes.user_id = ec.user_id)) AS is_first
  FROM exact_correct ec
),

-- Assemble upset results
upset_results AS (
  SELECT
    up.user_id,
    'upset_call'::text AS tag_type,
    'winner'::text AS pred_type,
    NULL::jsonb AS prediction_data,
    true AS is_correct,
    NULL::integer AS points_awarded,
    NULL::numeric AS seconds_before,
    up.pct AS pct_same,
    false AS is_first
  FROM upset_picks up
),

-- Submission timing for all event predictions (for "last-minute" / "early bird" tags)
timing_results AS (
  SELECT
    ep.user_id,
    'submission_timing'::text AS tag_type,
    ep.prediction_type AS pred_type,
    ep.prediction_data,
    ep.is_correct,
    ep.points_awarded,
    ROUND(EXTRACT(EPOCH FROM (ep.lock_time - ep.submitted_at)), 0) AS seconds_before,
    NULL::numeric AS pct_same,
    false AS is_first
  FROM event_preds ep
  WHERE ep.submitted_at IS NOT NULL
    AND ep.lock_time IS NOT NULL
    AND ep.lock_time > ep.submitted_at
    -- Only flag extreme timing: within 5 min of lock OR more than 24h before
    AND (
      EXTRACT(EPOCH FROM (ep.lock_time - ep.submitted_at)) < 300
      OR EXTRACT(EPOCH FROM (ep.lock_time - ep.submitted_at)) > 86400
    )
),

-- Union all tag candidates
all_results AS (
  SELECT * FROM exact_results
  UNION ALL
  SELECT * FROM upset_results
  UNION ALL
  SELECT * FROM timing_results
)

SELECT
  ar.user_id,
  ar.tag_type,
  ar.pred_type,
  ar.prediction_data,
  ar.is_correct,
  ar.points_awarded,
  ar.seconds_before,
  ar.pct_same,
  ar.is_first,
  u.display_name
FROM all_results ar
JOIN public.users u ON u.id = ar.user_id;
$$;

COMMENT ON FUNCTION public.compute_event_tag_metrics IS
  'For a confirmed event, returns rows for members qualifying for event-driven tags: '
  'exact score hits, upset calls (<25% group picked same winner), and extreme submission timing. '
  'Result set bounded by qualifying members (typically 0-5 rows). '
  'SECURITY DEFINER — call from service-role only.';

-- Grant execute to authenticated (RPCs called via service-role, but grant avoids issues)
GRANT EXECUTE ON FUNCTION public.compute_behavioural_tag_metrics(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_event_tag_metrics(uuid, uuid) TO authenticated;
