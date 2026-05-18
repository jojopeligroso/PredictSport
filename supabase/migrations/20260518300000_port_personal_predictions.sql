-- A2: Port personal_predictions rows into the unified competition model
--
-- Runs AFTER 20260518200000_schema_normalisation.sql which adds
-- event_prediction_type_id (NOT NULL) to predictions.
--
-- For each personal_predictions row, creates:
--   1. An events row in the user's personal competition
--   2. An event_prediction_types row for 'winner' (always)
--   3. An event_prediction_types row for 'exact_score' (if score_prediction exists)
--   4. A predictions row for 'winner' (with event_prediction_type_id FK)
--   5. A predictions row for 'exact_score' (with event_prediction_type_id FK)
--
-- Legacy columns not in migrations (added via Supabase Studio):
--   result_value text, is_correct boolean — exist in production.

-- ============================================================
-- 1. Create events from personal_predictions
-- ============================================================
-- One event per personal_predictions row. The join on competitions
-- (type='personal', created_by=user_id) links each pick to the
-- correct personal competition.

INSERT INTO public.events (
  competition_id,
  event_name,
  sport,
  start_time,
  lock_time,
  external_event_id,
  provider_league,
  result_data,
  result_confirmed,
  status
)
SELECT
  c.id,
  pp.event_name,
  pp.sport,
  pp.start_time,
  pp.start_time,  -- personal predictions lock at event start
  pp.external_event_id,
  pp.provider_league,
  CASE
    WHEN pp.result_value IS NOT NULL
    THEN jsonb_build_object('winner', pp.result_value)
    ELSE NULL
  END,
  (pp.result_value IS NOT NULL),
  CASE
    WHEN pp.result_value IS NOT NULL THEN 'resulted'
    WHEN pp.start_time < now() THEN 'locked'
    ELSE 'upcoming'
  END
FROM personal_predictions pp
JOIN public.competitions c
  ON c.created_by = pp.user_id AND c.type = 'personal';

-- ============================================================
-- 2. Create event_prediction_types: winner (for every migrated event)
-- ============================================================

INSERT INTO public.event_prediction_types (
  event_id, prediction_type, points, partial_points, config
)
SELECT
  e.id,
  'winner',
  0,
  0,
  CASE
    WHEN jsonb_typeof(pp.participants) = 'array'
         AND jsonb_array_length(pp.participants) = 2
    THEN jsonb_build_object(
      'options',
      jsonb_build_array(
        pp.participants->>0,
        pp.participants->>1
      )
    )
    ELSE NULL
  END
FROM public.events e
JOIN public.competitions c
  ON e.competition_id = c.id AND c.type = 'personal'
JOIN personal_predictions pp
  ON pp.external_event_id = e.external_event_id
  AND pp.user_id = c.created_by;

-- ============================================================
-- 3. Create event_prediction_types: exact_score (where applicable)
-- ============================================================

INSERT INTO public.event_prediction_types (
  event_id, prediction_type, points, partial_points, config
)
SELECT
  e.id,
  'exact_score',
  0,
  0,
  NULL
FROM public.events e
JOIN public.competitions c
  ON e.competition_id = c.id AND c.type = 'personal'
JOIN personal_predictions pp
  ON pp.external_event_id = e.external_event_id
  AND pp.user_id = c.created_by
WHERE pp.score_prediction IS NOT NULL;

-- ============================================================
-- 4. Create predictions: winner (with event_prediction_type_id FK)
-- ============================================================
-- Joins back to the EPT rows created in step 2 to resolve the FK.

INSERT INTO public.predictions (
  event_prediction_type_id,
  event_id,
  user_id,
  prediction_type,
  prediction_data,
  is_correct,
  points_awarded,
  submitted_at,
  updated_at
)
SELECT
  ept.id,
  e.id,
  pp.user_id,
  'winner',
  jsonb_build_object('value', pp.prediction_value),
  pp.is_correct,
  0,
  pp.created_at,
  pp.updated_at
FROM public.events e
JOIN public.competitions c
  ON e.competition_id = c.id AND c.type = 'personal'
JOIN personal_predictions pp
  ON pp.external_event_id = e.external_event_id
  AND pp.user_id = c.created_by
JOIN public.event_prediction_types ept
  ON ept.event_id = e.id AND ept.prediction_type = 'winner';

-- ============================================================
-- 5. Create predictions: exact_score (with event_prediction_type_id FK)
-- ============================================================
-- Joins back to the EPT rows created in step 3 to resolve the FK.

INSERT INTO public.predictions (
  event_prediction_type_id,
  event_id,
  user_id,
  prediction_type,
  prediction_data,
  is_correct,
  points_awarded,
  submitted_at,
  updated_at
)
SELECT
  ept.id,
  e.id,
  pp.user_id,
  'exact_score',
  pp.score_prediction,
  pp.score_correct,
  0,
  pp.created_at,
  pp.updated_at
FROM public.events e
JOIN public.competitions c
  ON e.competition_id = c.id AND c.type = 'personal'
JOIN personal_predictions pp
  ON pp.external_event_id = e.external_event_id
  AND pp.user_id = c.created_by
JOIN public.event_prediction_types ept
  ON ept.event_id = e.id AND ept.prediction_type = 'exact_score'
WHERE pp.score_prediction IS NOT NULL;
