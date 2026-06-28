-- Backfill H2H predictions from winner predictions for knockout matches.
-- Scope: all events with a head_to_head EPT in the WC2026 tournament blueprint.
--
-- Rule: if winner != 'Draw', H2H = winner (auto-derived).
-- Source of truth: score-derived winner when exact_score exists, else explicit winner.

-- 3a. INSERT missing H2H predictions
INSERT INTO predictions (
  event_prediction_type_id, user_id, prediction_type,
  event_id, prediction_data, submitted_at, updated_at
)
SELECT
  h2h_ept.id,
  wp.user_id,
  'head_to_head',
  wp.event_id,
  jsonb_build_object('selection', COALESCE(
    -- Prefer score-derived winner when exact_score exists
    (SELECT derive_winner_from_score(
       (sp.prediction_data->>'home')::int,
       (sp.prediction_data->>'away')::int,
       w_ept.config->'options'
     )
     FROM predictions sp
     WHERE sp.event_id = wp.event_id
       AND sp.user_id = wp.user_id
       AND sp.prediction_type = 'exact_score'
    ),
    -- Fallback: explicit winner value
    wp.prediction_data->>'value'
  )),
  wp.submitted_at,
  now()
FROM predictions wp
JOIN event_prediction_types h2h_ept
  ON h2h_ept.event_id = wp.event_id
  AND h2h_ept.prediction_type = 'head_to_head'
JOIN event_prediction_types w_ept
  ON w_ept.event_id = wp.event_id
  AND w_ept.prediction_type = 'winner'
JOIN events e ON e.id = wp.event_id
WHERE wp.prediction_type = 'winner'
  AND wp.prediction_data->>'value' IS NOT NULL
  AND wp.prediction_data->>'value' != 'Draw'
  AND e.tournament_id = 'a0000000-0000-0000-0000-000000000026'
  AND NOT EXISTS (
    SELECT 1 FROM predictions h2h
    WHERE h2h.event_id = wp.event_id
      AND h2h.user_id = wp.user_id
      AND h2h.prediction_type = 'head_to_head'
  )
ON CONFLICT (event_prediction_type_id, user_id) DO NOTHING;

-- 3b. UPDATE contradictory H2H predictions
-- Where winner != Draw but H2H selection differs from the score-derived winner
UPDATE predictions h2h
SET
  prediction_data = jsonb_build_object('selection', COALESCE(
    (SELECT derive_winner_from_score(
       (sp.prediction_data->>'home')::int,
       (sp.prediction_data->>'away')::int,
       w_ept.config->'options'
     )
     FROM predictions sp
     WHERE sp.event_id = h2h.event_id
       AND sp.user_id = h2h.user_id
       AND sp.prediction_type = 'exact_score'
    ),
    wp.prediction_data->>'value'
  )),
  updated_at = now()
FROM predictions wp
JOIN event_prediction_types h2h_ept
  ON h2h_ept.event_id = wp.event_id
  AND h2h_ept.prediction_type = 'head_to_head'
JOIN event_prediction_types w_ept
  ON w_ept.event_id = wp.event_id
  AND w_ept.prediction_type = 'winner'
JOIN events e ON e.id = wp.event_id
WHERE h2h.event_id = wp.event_id
  AND h2h.user_id = wp.user_id
  AND h2h.prediction_type = 'head_to_head'
  AND h2h.event_prediction_type_id = h2h_ept.id
  AND wp.prediction_type = 'winner'
  AND wp.prediction_data->>'value' IS NOT NULL
  AND wp.prediction_data->>'value' != 'Draw'
  AND e.tournament_id = 'a0000000-0000-0000-0000-000000000026'
  AND h2h.prediction_data->>'selection' IS DISTINCT FROM COALESCE(
    (SELECT derive_winner_from_score(
       (sp2.prediction_data->>'home')::int,
       (sp2.prediction_data->>'away')::int,
       w_ept.config->'options'
     )
     FROM predictions sp2
     WHERE sp2.event_id = h2h.event_id
       AND sp2.user_id = h2h.user_id
       AND sp2.prediction_type = 'exact_score'
    ),
    wp.prediction_data->>'value'
  );
