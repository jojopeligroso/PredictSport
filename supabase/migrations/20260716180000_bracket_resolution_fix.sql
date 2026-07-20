-- Bracket resolution fix: France vs Spain winner null → bracket stall
--
-- Root cause: ESPN provider returned winner: null for France 0-2 Spain.
-- advanceKnockoutWinners() silently skipped on null winner.
-- Both Final-stage events stuck with "TBD" names and placeholder configs.
-- 10 predictions stored "TBD" as selection (both UI buttons were identical).
--
-- Snapshot: ~/Work/snapshots/ps_snapshot_2026-07-16.sql

-- 3a) Patch France vs Spain result_data.winner
-- Score: France 0 - Spain 2. Scoring engine already awarded Spain pickers correctly.
UPDATE events
SET result_data = jsonb_set(result_data, '{winner}', '"Spain"')
WHERE id = '3db85a7f-7f7c-4695-a471-96accfc307aa';

-- 3b) Resolve bracket event names + clear placeholder flag
-- Advancement map: sf_m1 winner (Spain) → final home, sf_m1 loser (France) → 3rd place home
-- sf_m2 already advanced: Argentina → final away, England → 3rd place away

-- 3rd place: TBD vs England → France vs England
UPDATE events
SET event_name = 'France vs England', is_bracket_placeholder = false
WHERE id = 'd3fc56b3-334c-4244-b765-b02fe5abc7c4';

-- Final: TBD vs Argentina → Spain vs Argentina
UPDATE events
SET event_name = 'Spain vs Argentina', is_bracket_placeholder = false
WHERE id = 'bf248e7a-922b-4e9d-afcc-a2889cb14611';

-- Update event_prediction_types configs with correct team names

-- 3rd place h2h
UPDATE event_prediction_types
SET config = '{"allow_draw": false, "label": "Who goes through?", "options": ["France", "England"]}'::jsonb
WHERE id = 'cd9ba891-df35-4914-a141-adee3a73d181';

-- 3rd place winner
UPDATE event_prediction_types
SET config = '{"options": ["France", "Draw", "England"]}'::jsonb
WHERE id = 'e63f05cc-1e8b-4548-84ee-1956a1579395';

-- Final h2h
UPDATE event_prediction_types
SET config = '{"allow_draw": false, "label": "Who goes through?", "options": ["Spain", "Argentina"]}'::jsonb
WHERE id = 'a3970036-4772-4d42-831b-43a4aaa0b538';

-- Final winner
UPDATE event_prediction_types
SET config = '{"options": ["Spain", "Draw", "Argentina"]}'::jsonb
WHERE id = '539ebf27-c9da-4bc8-ba96-d3cd01ea26db';

-- 3c) Remap TBD predictions to correct team names
-- TBD maps deterministically: Final TBD = Spain (winner sf_m1), 3rd place TBD = France (loser sf_m1)
-- Exact-score predictions (positional home/away numbers) are unaffected.

-- Final: TBD → Spain (winner predictions)
UPDATE predictions
SET prediction_data = jsonb_set(prediction_data, '{value}', '"Spain"')
WHERE event_id = 'bf248e7a-922b-4e9d-afcc-a2889cb14611'
  AND prediction_data->>'value' = 'TBD';

-- Final: TBD → Spain (h2h predictions)
UPDATE predictions
SET prediction_data = jsonb_set(prediction_data, '{selection}', '"Spain"')
WHERE event_id = 'bf248e7a-922b-4e9d-afcc-a2889cb14611'
  AND prediction_data->>'selection' = 'TBD';

-- 3rd place: TBD → France (winner predictions)
UPDATE predictions
SET prediction_data = jsonb_set(prediction_data, '{value}', '"France"')
WHERE event_id = 'd3fc56b3-334c-4244-b765-b02fe5abc7c4'
  AND prediction_data->>'value' = 'TBD';

-- 3rd place: TBD → France (h2h predictions)
UPDATE predictions
SET prediction_data = jsonb_set(prediction_data, '{selection}', '"France"')
WHERE event_id = 'd3fc56b3-334c-4244-b765-b02fe5abc7c4'
  AND prediction_data->>'selection' = 'TBD';
