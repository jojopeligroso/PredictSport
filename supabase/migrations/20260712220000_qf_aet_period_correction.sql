-- QF AET Period Data Correction
--
-- ESPN provider returned garbage period data (all zeros) for two QF AET
-- matches due to a displayValue vs value field mismatch in linescore parsing
-- (fixed in code commit 2e7cb35). This migration codifies the ad-hoc data
-- correction applied 2026-07-12 for auditability and restore replay.
--
-- Affected events:
--   b0c4d275-10c9-4bec-9008-0b0c9262fa86  Norway vs England (FT 1-1, AET 1-2)
--   7ddb2211-5ca8-4dad-ba30-a61800d2ae02  Argentina vs Switzerland (FT 1-1, AET 3-1)
--
-- Verified FT scores via ESPN summary endpoint key events:
--   Norway vs England:       Schjelderup 36', Bellingham 45'+2' (FT 1-1), Bellingham 93' (ET)
--   Argentina vs Switzerland: Mac Allister 10', Ndoye 67' (FT 1-1), Alvarez 112', Lautaro 120'+1' (ET)
--
-- Migration is idempotent: event UPDATEs use jsonb_set (safe to re-run),
-- prediction UPDATEs use WHERE is_correct = false (no-op if already corrected).

-- 1. Correct period data for Norway vs England
UPDATE events
SET result_data = jsonb_set(
  result_data::jsonb,
  '{score,periods}',
  '{"full_time": {"home": 1, "away": 1}, "extra_time": {"home": 0, "away": 1}}'::jsonb
)
WHERE id = 'b0c4d275-10c9-4bec-9008-0b0c9262fa86';

-- 2. Correct period data for Argentina vs Switzerland
UPDATE events
SET result_data = jsonb_set(
  result_data::jsonb,
  '{score,periods}',
  '{"full_time": {"home": 1, "away": 1}, "extra_time": {"home": 2, "away": 0}}'::jsonb
)
WHERE id = '7ddb2211-5ca8-4dad-ba30-a61800d2ae02';

-- 3. Rescore exact_score predictions for Norway vs England
--    FT was 1-1; predictions with home=1, away=1 should be correct (3 pts)
--    WHERE is_correct = false ensures idempotency
UPDATE predictions
SET is_correct = true, points_awarded = 3
WHERE event_id = 'b0c4d275-10c9-4bec-9008-0b0c9262fa86'
  AND prediction_type = 'exact_score'
  AND (prediction_data->>'home')::int = 1
  AND (prediction_data->>'away')::int = 1
  AND is_correct = false;

-- 4. Rescore exact_score predictions for Argentina vs Switzerland
--    FT was 1-1; same pattern (no rows matched in practice — nobody predicted 1-1)
UPDATE predictions
SET is_correct = true, points_awarded = 3
WHERE event_id = '7ddb2211-5ca8-4dad-ba30-a61800d2ae02'
  AND prediction_type = 'exact_score'
  AND (prediction_data->>'home')::int = 1
  AND (prediction_data->>'away')::int = 1
  AND is_correct = false;
