-- WC2026 group events: add "Draw" to winner prediction-type options.
--
-- U1 seeded the 72 group-stage `winner` event_prediction_types with
-- config.options = [home, away] only. The unified-prediction design (U2)
-- requires a 3-way W/D/L pick: soccer group matches can draw, and the Draw
-- outcome is load-bearing for the Overall and Format classifications (and for
-- Bracket group-stage tiebreakers). This migration rewrites config.options to
-- [home, "Draw", away] so the windowed pick UI reads the Draw option straight
-- from config.
--
-- Idempotent: only touches rows whose options array has no "Draw" yet, so a
-- re-run is a no-op. Targets only the World Cup competition's group winner epts.

UPDATE event_prediction_types ept
SET config = jsonb_set(
  ept.config,
  '{options}',
  jsonb_build_array(
    ept.config -> 'options' -> 0,
    '"Draw"'::jsonb,
    ept.config -> 'options' -> 1
  )
)
FROM events e
JOIN rounds r ON r.id = e.round_id
JOIN competitions c ON c.id = r.competition_id
WHERE ept.event_id = e.id
  AND c.tournament_id = 'a0000000-0000-0000-0000-000000000026'
  AND ept.prediction_type = 'winner'
  AND ept.config -> 'options' IS NOT NULL
  AND jsonb_array_length(ept.config -> 'options') = 2
  AND NOT (ept.config -> 'options' @> '"Draw"'::jsonb);
