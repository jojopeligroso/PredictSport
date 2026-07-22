-- System B — winter-league ("ligas invernales") baseball scoring.
--
-- System B scores each game on up to three stacked calls:
--   winner  (+4, the gate) · margin confidence-window (+6/+4/+3/+2 by width)
--   · exact score (×2 whole-game multiplier). See src/lib/ligas/system-b.ts.
--
-- A winter event opts into System B by carrying `scoring_system: "system_b"`
-- on its winner EPT config. The scorer (confirm-result + autoResolveEvent) then
-- routes those events through src/lib/ligas/score-event.ts, which scores the
-- three prediction rows JOINTLY (generic per-row scoring cannot express the
-- winner gate or the exact multiplier).
--
-- This migration:
--   1. Records System B as the scoring_rules default on the 5 winter instances.
--   2. Adds a reusable seeder, seed_system_b_event_epts(), that attaches the
--      winner / margin / exact_score EPTs to an event when fixtures are created.
--   3. Applies that seeder to any existing NON-resulted winter events (a no-op
--      pre-season) so the picks surface renders the full three-call flow.
--
-- Historical resulted backfill events are intentionally left untouched — their
-- standings are demo spread scored under the old simple system and must not be
-- retroactively re-scored.

-- Winter tournament blueprint ids (seed migrations 20260716*).
--   201 LMP · 202 LVBP · 203 LIDOM · 204 LBPRC · 209 SdC

-- ── 1. System B scoring config on the open winter instances ────────────────
UPDATE public.competitions
SET scoring_rules = jsonb_build_object(
  'system', 'system_b',
  'winner', 4,
  'margin_bonus_by_width', jsonb_build_object('1', 6, '2', 4, '3', 3, '4', 2),
  'exact_multiplier', 2,
  'max_game_points', 20
)
WHERE tournament_id IN (
  'a0000000-0000-0000-0000-000000000201',
  'a0000000-0000-0000-0000-000000000202',
  'a0000000-0000-0000-0000-000000000203',
  'a0000000-0000-0000-0000-000000000204',
  'a0000000-0000-0000-0000-000000000209'
);

-- ── 2. Reusable EPT seeder for a System B baseball game ─────────────────────
-- p_options MUST be exactly two team names (baseball is a no-draw sport — never
-- seed a "Draw" option; see CLAUDE.md "Baseball winner configs").
CREATE OR REPLACE FUNCTION public.seed_system_b_event_epts(
  p_event_id uuid,
  p_options  text[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_opts jsonb;
BEGIN
  IF array_length(p_options, 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'seed_system_b_event_epts: expected exactly 2 options (no-draw baseball), got %', p_options;
  END IF;

  v_opts := to_jsonb(p_options);

  -- Winner — the gate (+4), marked for System B routing.
  INSERT INTO public.event_prediction_types (event_id, prediction_type, points, partial_points, config)
  VALUES (
    p_event_id, 'winner', 4, 0,
    jsonb_build_object('options', v_opts, 'scoring_system', 'system_b')
  )
  ON CONFLICT (event_id, prediction_type) DO UPDATE
  SET points = 4,
      config = COALESCE(public.event_prediction_types.config, '{}'::jsonb)
               || jsonb_build_object('options', v_opts, 'scoring_system', 'system_b');

  -- Margin — confidence window over buckets {0,1,2,3,4,5+}. Points are computed
  -- from the window width by the scorer, so the static points column is unused.
  INSERT INTO public.event_prediction_types (event_id, prediction_type, points, partial_points, config)
  VALUES (
    p_event_id, 'margin', 0, 0,
    jsonb_build_object(
      'mode', 'confidence_window',
      'options', v_opts,
      'buckets', jsonb_build_array('0', '1', '2', '3', '4', '5+'),
      'bonus_by_width', jsonb_build_object('1', 6, '2', 4, '3', 3, '4', 2),
      'measured_at', 'after_nine'
    )
  )
  ON CONFLICT (event_id, prediction_type) DO UPDATE
  SET config = COALESCE(public.event_prediction_types.config, '{}'::jsonb)
               || public.event_prediction_types.config
               || jsonb_build_object(
                    'mode', 'confidence_window',
                    'options', v_opts,
                    'buckets', jsonb_build_array('0', '1', '2', '3', '4', '5+'),
                    'bonus_by_width', jsonb_build_object('1', 6, '2', 4, '3', 3, '4', 2),
                    'measured_at', 'after_nine'
                  );

  -- Exact score — the ×2 multiplier.
  INSERT INTO public.event_prediction_types (event_id, prediction_type, points, partial_points, config)
  VALUES (
    p_event_id, 'exact_score', 0, 0,
    jsonb_build_object('options', v_opts, 'multiplier', 2)
  )
  ON CONFLICT (event_id, prediction_type) DO UPDATE
  SET config = COALESCE(public.event_prediction_types.config, '{}'::jsonb)
               || jsonb_build_object('options', v_opts, 'multiplier', 2);
END;
$$;

REVOKE ALL ON FUNCTION public.seed_system_b_event_epts(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_system_b_event_epts(uuid, text[]) TO service_role;

COMMENT ON FUNCTION public.seed_system_b_event_epts(uuid, text[]) IS
  'Attach System B winner/margin/exact_score EPTs to a winter-league baseball event. p_options must be exactly two team names (no-draw). Idempotent.';

-- ── 3. Seed EPTs for existing non-resulted winter events (no-op pre-season) ──
DO $$
DECLARE
  rec record;
  v_opts text[];
BEGIN
  FOR rec IN
    SELECT e.id AS event_id, e.event_name,
           (ept.config ->> 'options') AS opt_json
    FROM public.events e
    LEFT JOIN public.event_prediction_types ept
      ON ept.event_id = e.id AND ept.prediction_type = 'winner'
    WHERE e.tournament_id IN (
      'a0000000-0000-0000-0000-000000000201',
      'a0000000-0000-0000-0000-000000000202',
      'a0000000-0000-0000-0000-000000000203',
      'a0000000-0000-0000-0000-000000000204',
      'a0000000-0000-0000-0000-000000000209'
    )
    AND e.status NOT IN ('resulted', 'cancelled')
  LOOP
    -- Prefer existing winner options; else split "A vs B" from the event name.
    IF rec.opt_json IS NOT NULL THEN
      SELECT array_agg(value) INTO v_opts
      FROM jsonb_array_elements_text(rec.opt_json::jsonb) AS value;
    ELSE
      v_opts := regexp_split_to_array(rec.event_name, '\s+vs\.?\s+');
    END IF;

    v_opts := array_remove(v_opts, 'Draw');

    IF array_length(v_opts, 1) = 2 THEN
      PERFORM public.seed_system_b_event_epts(rec.event_id, v_opts);
    END IF;
  END LOOP;
END $$;
