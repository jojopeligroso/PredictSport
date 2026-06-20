-- Compute reputation tag statistics for a competition.
-- Returns one row per competition member with all metrics needed for tag assignment.
CREATE OR REPLACE FUNCTION compute_reputation_stats(p_competition_id UUID)
RETURNS TABLE (
  user_id           UUID,
  total_predictions BIGINT,
  events_available  BIGINT,
  engagement_rate   NUMERIC,
  winner_correct    BIGINT,
  winner_total      BIGINT,
  exact_correct     BIGINT,
  exact_total       BIGINT,
  draws_predicted   BIGINT,
  total_goals_predicted BIGINT,
  avg_goal_diff     NUMERIC,
  avg_total_goals   NUMERIC,
  max_goal_diff     BIGINT,
  blowouts_predicted BIGINT,
  minority_picks    BIGINT,
  majority_picks    BIGINT,
  contrarian_pct    NUMERIC,
  most_repeated_score TEXT,
  repeat_score_count BIGINT,
  unique_scores_used BIGINT,
  prediction_changes BIGINT,
  avg_submission_lead_time_mins NUMERIC,
  earliest_submission_lead_hrs  NUMERIC,
  latest_submission_lead_mins   NUMERIC,
  public_notes_count BIGINT,
  current_streak    BIGINT,
  best_streak       BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
WITH
-- All predictions for this competition joined with event metadata
base AS (
  SELECT
    p.id              AS pred_id,
    p.user_id,
    p.event_id,
    p.prediction_type,
    p.prediction_data,
    p.is_correct,
    p.is_partial,
    p.points_awarded,
    p.note_text,
    p.note_visibility,
    p.submitted_at::timestamptz AS submitted_at,
    p.updated_at::timestamptz   AS updated_at,
    e.start_time,
    e.lock_time
  FROM predictions p
  JOIN events e ON e.id = p.event_id
  WHERE e.competition_id = p_competition_id
),

-- Total distinct events in the competition
event_count AS (
  SELECT COUNT(DISTINCT id)::bigint AS cnt
  FROM events
  WHERE competition_id = p_competition_id
),

-- All members of the competition (ensures rows even for users with 0 predictions)
members AS (
  SELECT cm.user_id
  FROM competition_members cm
  WHERE cm.competition_id = p_competition_id
),

-- Basic aggregate counts per user
basic_counts AS (
  SELECT
    b.user_id,
    COUNT(*)::bigint AS total_predictions,
    SUM(CASE WHEN b.prediction_type = 'winner'      AND b.is_correct = true        THEN 1 ELSE 0 END)::bigint AS winner_correct,
    SUM(CASE WHEN b.prediction_type = 'winner'      AND b.is_correct IS NOT NULL   THEN 1 ELSE 0 END)::bigint AS winner_total,
    SUM(CASE WHEN b.prediction_type = 'exact_score'  AND b.is_correct = true        THEN 1 ELSE 0 END)::bigint AS exact_correct,
    SUM(CASE WHEN b.prediction_type = 'exact_score'  AND b.is_correct IS NOT NULL   THEN 1 ELSE 0 END)::bigint AS exact_total,
    SUM(CASE WHEN b.updated_at > b.submitted_at + interval '60 seconds'             THEN 1 ELSE 0 END)::bigint AS prediction_changes,
    SUM(CASE WHEN b.note_text IS NOT NULL AND b.note_visibility = 'public'           THEN 1 ELSE 0 END)::bigint AS public_notes_count
  FROM base b
  GROUP BY b.user_id
),

-- Draw predictions: winner='Draw' OR exact_score where home=away
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

-- Exact score metrics (goal totals, diffs, blowouts, unique scores)
score_metrics AS (
  SELECT
    b.user_id,
    SUM((b.prediction_data->>'home')::int + (b.prediction_data->>'away')::int)::bigint
      AS total_goals,
    ROUND(AVG(ABS((b.prediction_data->>'home')::int - (b.prediction_data->>'away')::int)), 2)
      AS avg_goal_diff,
    ROUND(AVG((b.prediction_data->>'home')::int + (b.prediction_data->>'away')::int), 2)
      AS avg_total_goals,
    MAX(ABS((b.prediction_data->>'home')::int - (b.prediction_data->>'away')::int))::bigint
      AS max_goal_diff,
    SUM(CASE WHEN ABS((b.prediction_data->>'home')::int - (b.prediction_data->>'away')::int) >= 3
             THEN 1 ELSE 0 END)::bigint
      AS blowouts_predicted,
    COUNT(DISTINCT (b.prediction_data->>'home') || '-' || (b.prediction_data->>'away'))::bigint
      AS unique_scores_used
  FROM base b
  WHERE b.prediction_type = 'exact_score'
    AND jsonb_typeof(b.prediction_data->'home') = 'number'
    AND jsonb_typeof(b.prediction_data->'away') = 'number'
  GROUP BY b.user_id
),

-- Most repeated exact score per user (MODE)
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

-- Winner prediction values for majority/minority analysis
winner_values AS (
  SELECT
    b.user_id,
    b.event_id,
    COALESCE(b.prediction_data->>'selection', b.prediction_data->>'value') AS winner_pick
  FROM base b
  WHERE b.prediction_type = 'winner'
    AND b.is_correct IS NOT NULL  -- only resolved events
),

-- Per-event majority pick (most common winner prediction)
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

-- Submission lead time stats
timing_stats AS (
  SELECT
    b.user_id,
    ROUND(AVG(EXTRACT(EPOCH FROM (b.lock_time - b.submitted_at)) / 60.0), 1)  AS avg_lead_mins,
    ROUND(MAX(EXTRACT(EPOCH FROM (b.lock_time - b.submitted_at)) / 3600.0), 1) AS earliest_lead_hrs,
    ROUND(MIN(EXTRACT(EPOCH FROM (b.lock_time - b.submitted_at)) / 60.0), 1)  AS latest_lead_mins
  FROM base b
  WHERE b.submitted_at IS NOT NULL
    AND b.lock_time IS NOT NULL
    AND b.lock_time > b.submitted_at  -- exclude predictions submitted after lock (shouldn't exist but be safe)
  GROUP BY b.user_id
),

-- Streak computation: gaps-and-islands approach
-- Step 1: order all resolved predictions by event time
ordered_preds AS (
  SELECT
    b.user_id,
    b.is_correct,
    ROW_NUMBER() OVER (PARTITION BY b.user_id ORDER BY b.start_time, b.prediction_type) AS rn,
    ROW_NUMBER() OVER (PARTITION BY b.user_id ORDER BY b.start_time DESC, b.prediction_type DESC) AS rn_desc
  FROM base b
  WHERE b.is_correct IS NOT NULL
),
-- Step 2: island grouping for best streak
streak_islands AS (
  SELECT
    op.user_id,
    op.is_correct,
    op.rn - ROW_NUMBER() OVER (PARTITION BY op.user_id, op.is_correct ORDER BY op.rn) AS island
  FROM ordered_preds op
),
best_streaks AS (
  SELECT
    si.user_id,
    MAX(streak_len)::bigint AS best_streak
  FROM (
    SELECT si2.user_id, COUNT(*) AS streak_len
    FROM streak_islands si2
    WHERE si2.is_correct = true
    GROUP BY si2.user_id, si2.island
  ) si
  GROUP BY si.user_id
),
-- Step 3: current streak (consecutive correct from most recent backwards; 0 if latest is wrong)
current_streak_calc AS (
  SELECT
    op.user_id,
    COUNT(*)::bigint AS current_streak
  FROM ordered_preds op
  WHERE op.is_correct = true
    AND NOT EXISTS (
      SELECT 1 FROM ordered_preds op2
      WHERE op2.user_id = op.user_id
        AND op2.is_correct = false
        AND op2.rn_desc < op.rn_desc  -- op2 is more recent than op
    )
  GROUP BY op.user_id
)

-- Assemble final output
SELECT
  m.user_id,
  COALESCE(bc.total_predictions, 0)::bigint,
  ec.cnt,
  CASE WHEN ec.cnt > 0
    THEN ROUND(COALESCE(bc.total_predictions, 0)::numeric / ec.cnt * 100, 1)
    ELSE 0
  END,
  COALESCE(bc.winner_correct, 0)::bigint,
  COALESCE(bc.winner_total, 0)::bigint,
  COALESCE(bc.exact_correct, 0)::bigint,
  COALESCE(bc.exact_total, 0)::bigint,
  COALESCE(dc.draws_predicted, 0)::bigint,
  COALESCE(sm.total_goals, 0)::bigint,
  ROUND(COALESCE(sm.avg_goal_diff, 0), 2),
  ROUND(COALESCE(sm.avg_total_goals, 0), 2),
  COALESCE(sm.max_goal_diff, 0)::bigint,
  COALESCE(sm.blowouts_predicted, 0)::bigint,
  COALESCE(umaj.minority_picks, 0)::bigint,
  COALESCE(umaj.majority_picks, 0)::bigint,
  CASE WHEN COALESCE(umaj.minority_picks, 0) + COALESCE(umaj.majority_picks, 0) > 0
    THEN ROUND(
      COALESCE(umaj.minority_picks, 0)::numeric
      / (COALESCE(umaj.minority_picks, 0) + COALESCE(umaj.majority_picks, 0)) * 100, 1)
    ELSE 0
  END,
  COALESCE(smode.most_repeated_score, ''),
  COALESCE(smode.repeat_score_count, 0)::bigint,
  COALESCE(sm.unique_scores_used, 0)::bigint,
  COALESCE(bc.prediction_changes, 0)::bigint,
  COALESCE(ts.avg_lead_mins, 0),
  COALESCE(ts.earliest_lead_hrs, 0),
  COALESCE(ts.latest_lead_mins, 0),
  COALESCE(bc.public_notes_count, 0)::bigint,
  COALESCE(csc.current_streak, 0)::bigint,
  COALESCE(bs.best_streak, 0)::bigint
FROM members m
CROSS JOIN event_count ec
LEFT JOIN basic_counts bc       ON bc.user_id = m.user_id
LEFT JOIN draw_counts dc        ON dc.user_id = m.user_id
LEFT JOIN score_metrics sm      ON sm.user_id = m.user_id
LEFT JOIN score_mode smode      ON smode.user_id = m.user_id
LEFT JOIN user_majority umaj    ON umaj.user_id = m.user_id
LEFT JOIN timing_stats ts       ON ts.user_id = m.user_id
LEFT JOIN best_streaks bs       ON bs.user_id = m.user_id
LEFT JOIN current_streak_calc csc ON csc.user_id = m.user_id;
$$;
