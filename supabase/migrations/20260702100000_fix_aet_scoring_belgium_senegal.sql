-- Fix Belgium vs Senegal AET scoring (2026-07-02)
--
-- Match went to extra time (TheSportsDB strStatus: "AET"). The system stored
-- the AET aggregate (3-2) as the FT score, causing winner predictions to be
-- scored against the wrong result. FT was definitionally a draw.
--
-- See: docs/investigations/2026-07-02-aet-scoring-bug.md

BEGIN;

-- 1. Flag the event as AET by adding periods.extra_time to result_data
UPDATE events
SET result_data = jsonb_set(
  result_data,
  '{score,periods}',
  '{"extra_time": {"home": 3, "away": 2}}'::jsonb
)
WHERE id = 'cac7175d-8709-4c90-b92b-beff6c023273';

-- 2. Winner predictions: FT was a draw
--    "Draw" pickers → correct (2 pts)
UPDATE predictions
SET is_correct = true,
    points_awarded = 2,
    updated_at = now()
WHERE event_id = 'cac7175d-8709-4c90-b92b-beff6c023273'
  AND prediction_type = 'winner'
  AND prediction_data->>'value' = 'Draw';

--    "Belgium" / "Senegal" pickers → wrong (0 pts)
UPDATE predictions
SET is_correct = false,
    points_awarded = 0,
    updated_at = now()
WHERE event_id = 'cac7175d-8709-4c90-b92b-beff6c023273'
  AND prediction_type = 'winner'
  AND prediction_data->>'value' != 'Draw';

-- 3. Exact score: void draw-score predictions (FT score unknown from TSDB)
--    Non-draw predictions remain is_correct=false (FT was a draw, so wrong)
UPDATE predictions
SET is_correct = null,
    points_awarded = 0,
    updated_at = now()
WHERE event_id = 'cac7175d-8709-4c90-b92b-beff6c023273'
  AND prediction_type = 'exact_score'
  AND (prediction_data->>'home')::int = (prediction_data->>'away')::int;

-- 4. H2H predictions: no change (Belgium correctly advanced)

COMMIT;
