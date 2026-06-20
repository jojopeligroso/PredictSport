-- Add confidence_level to predictions and update RPCs to accept it.
--
-- confidence_level: 1–5 scale for how confident a user is in their prediction.
--   1 = Hopeful, 2 = Leaning, 3 = Confident, 4 = Very Confident, 5 = Dead Cert
-- Nullable — existing predictions keep NULL, new predictions default to NULL.
-- Stored on the 'winner' prediction row for match events.

ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS confidence_level smallint
  CHECK (confidence_level >= 1 AND confidence_level <= 5);

-- ── Replace safe_upsert_prediction with confidence_level support ──────
-- Must DROP first: adding a parameter changes the function signature,
-- so CREATE OR REPLACE would create an overload rather than replacing.
DROP FUNCTION IF EXISTS safe_upsert_prediction(uuid, uuid, text, uuid, jsonb, timestamptz, text, text);

CREATE OR REPLACE FUNCTION safe_upsert_prediction(
  p_ept_id uuid,
  p_user_id uuid,
  p_type text,
  p_event_id uuid,
  p_data jsonb,
  p_expected_updated_at timestamptz DEFAULT NULL,
  p_note_text text DEFAULT NULL,
  p_note_visibility text DEFAULT NULL,
  p_confidence_level smallint DEFAULT NULL
) RETURNS SETOF predictions AS $$
  INSERT INTO predictions (
    event_prediction_type_id,
    user_id,
    prediction_type,
    event_id,
    prediction_data,
    note_text,
    note_visibility,
    confidence_level,
    updated_at
  )
  VALUES (
    p_ept_id,
    p_user_id,
    p_type,
    p_event_id,
    p_data,
    p_note_text,
    p_note_visibility,
    p_confidence_level,
    now()
  )
  ON CONFLICT (event_prediction_type_id, user_id) DO UPDATE SET
    prediction_data = EXCLUDED.prediction_data,
    note_text = COALESCE(EXCLUDED.note_text, predictions.note_text),
    note_visibility = COALESCE(EXCLUDED.note_visibility, predictions.note_visibility),
    confidence_level = COALESCE(EXCLUDED.confidence_level, predictions.confidence_level),
    updated_at = now()
  WHERE p_expected_updated_at IS NULL
     OR predictions.updated_at <= p_expected_updated_at
  RETURNING *;
$$ LANGUAGE sql SECURITY INVOKER;

COMMENT ON FUNCTION safe_upsert_prediction IS
  'Safe prediction upsert with timestamp-based CAS guard and optional confidence level. '
  'SECURITY INVOKER preserves RLS enforcement.';

-- ── Replace upsert_match_prediction with confidence_level support ─────
DROP FUNCTION IF EXISTS upsert_match_prediction(uuid, uuid, uuid, uuid, jsonb, text, text, int, int);

CREATE OR REPLACE FUNCTION upsert_match_prediction(
  p_event_id      uuid,
  p_user_id       uuid,
  p_winner_ept_id uuid,
  p_score_ept_id  uuid DEFAULT NULL,
  p_winner_options jsonb DEFAULT '[]',
  p_operation     text DEFAULT 'set_winner',
  p_winner_value  text DEFAULT NULL,
  p_home_score    int DEFAULT NULL,
  p_away_score    int DEFAULT NULL,
  p_confidence_level smallint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_implied       text;
  v_existing_score jsonb;
  v_winner_row    jsonb;
  v_score_row     jsonb;
  v_corrected     boolean := false;
BEGIN

  -- ── Serialisation: lock existing rows for this (user, event) ──
  PERFORM 1 FROM predictions
    WHERE event_prediction_type_id = p_winner_ept_id
      AND user_id = p_user_id
    FOR UPDATE;

  IF p_score_ept_id IS NOT NULL THEN
    PERFORM 1 FROM predictions
      WHERE event_prediction_type_id = p_score_ept_id
        AND user_id = p_user_id
      FOR UPDATE;
  END IF;

  -- ── Operation dispatch ────────────────────────────────────────

  IF p_operation = 'set_winner' THEN
    -- Score is source of truth: if a score already exists, derive
    -- winner from it rather than trusting the user's tap.
    IF p_score_ept_id IS NOT NULL THEN
      SELECT prediction_data INTO v_existing_score
        FROM predictions
        WHERE event_prediction_type_id = p_score_ept_id
          AND user_id = p_user_id;

      IF v_existing_score IS NOT NULL
         AND v_existing_score->>'home' IS NOT NULL
         AND v_existing_score->>'away' IS NOT NULL
      THEN
        v_implied := derive_winner_from_score(
          (v_existing_score->>'home')::int,
          (v_existing_score->>'away')::int,
          p_winner_options
        );
        IF v_implied IS NOT NULL AND v_implied IS DISTINCT FROM p_winner_value THEN
          p_winner_value := v_implied;
          v_corrected := true;
        END IF;
      END IF;
    END IF;

    -- Upsert winner row with confidence.
    -- set_winner uses p_confidence_level directly (not COALESCE) so the
    -- client can both set AND clear confidence in a single call.
    INSERT INTO predictions (
      event_prediction_type_id, user_id, prediction_type,
      event_id, prediction_data, confidence_level, updated_at
    ) VALUES (
      p_winner_ept_id, p_user_id, 'winner',
      p_event_id, jsonb_build_object('value', p_winner_value),
      p_confidence_level, now()
    )
    ON CONFLICT (event_prediction_type_id, user_id) DO UPDATE SET
      prediction_data = jsonb_build_object('value', p_winner_value),
      confidence_level = p_confidence_level,
      updated_at = now()
    RETURNING row_to_json(predictions.*) INTO v_winner_row;

    IF v_winner_row IS NULL THEN
      -- RLS blocked the write (lock_time passed, competition inactive, etc.)
      RETURN jsonb_build_object('blocked', true);
    END IF;

    RETURN jsonb_build_object(
      'winner', v_winner_row,
      'corrected', v_corrected,
      'server_winner', p_winner_value
    );

  ELSIF p_operation = 'set_score' THEN
    IF p_score_ept_id IS NULL THEN
      RAISE EXCEPTION 'set_score requires p_score_ept_id';
    END IF;

    -- Upsert score row (no confidence on score rows)
    INSERT INTO predictions (
      event_prediction_type_id, user_id, prediction_type,
      event_id, prediction_data, updated_at
    ) VALUES (
      p_score_ept_id, p_user_id, 'exact_score',
      p_event_id,
      jsonb_build_object('home', p_home_score, 'away', p_away_score),
      now()
    )
    ON CONFLICT (event_prediction_type_id, user_id) DO UPDATE SET
      prediction_data = jsonb_build_object('home', p_home_score, 'away', p_away_score),
      updated_at = now()
    RETURNING row_to_json(predictions.*) INTO v_score_row;

    IF v_score_row IS NULL THEN
      RETURN jsonb_build_object('blocked', true);
    END IF;

    -- Derive and upsert winner atomically.
    -- set_score uses COALESCE to preserve existing confidence — the user
    -- didn't touch confidence when entering a score.
    v_implied := derive_winner_from_score(
      p_home_score, p_away_score, p_winner_options
    );

    IF v_implied IS NOT NULL THEN
      INSERT INTO predictions (
        event_prediction_type_id, user_id, prediction_type,
        event_id, prediction_data, confidence_level, updated_at
      ) VALUES (
        p_winner_ept_id, p_user_id, 'winner',
        p_event_id, jsonb_build_object('value', v_implied),
        p_confidence_level, now()
      )
      ON CONFLICT (event_prediction_type_id, user_id) DO UPDATE SET
        prediction_data = jsonb_build_object('value', v_implied),
        confidence_level = COALESCE(p_confidence_level, predictions.confidence_level),
        updated_at = now()
      RETURNING row_to_json(predictions.*) INTO v_winner_row;
    END IF;

    RETURN jsonb_build_object(
      'score', v_score_row,
      'winner', v_winner_row,
      'server_winner', v_implied
    );

  ELSIF p_operation = 'reset' THEN
    -- Delete both predictions atomically
    DELETE FROM predictions
      WHERE event_id = p_event_id
        AND user_id = p_user_id
        AND event_prediction_type_id IN (p_winner_ept_id, COALESCE(p_score_ept_id, p_winner_ept_id));
    -- COALESCE: if no score EPT, the IN clause just has winner_ept_id twice (no-op duplicate)

    RETURN jsonb_build_object('reset', true);

  ELSE
    RAISE EXCEPTION 'Invalid operation: %. Expected set_winner, set_score, or reset.', p_operation;
  END IF;

END;
$$;

COMMENT ON FUNCTION upsert_match_prediction IS
  'Atomic prediction write for match events (winner + optional exact_score). '
  'Serialises concurrent requests via FOR UPDATE. Score is always source of truth. '
  'Accepts optional p_confidence_level (1-5) stored on winner rows. '
  'set_winner applies confidence directly; set_score preserves existing via COALESCE. '
  'SECURITY INVOKER preserves all RLS enforcement.';
