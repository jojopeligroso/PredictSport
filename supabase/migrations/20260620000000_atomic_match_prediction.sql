-- Atomic match prediction RPC: eliminates the winner/score race condition.
--
-- Problem: winner and exact_score are separate rows. Two independent HTTP
-- requests (tap → winner POST, blur → score POST) can interleave, producing
-- contradictory data. The previous fix (re-derivation in route.ts) was
-- application-level reconciliation with a TOCTOU window.
--
-- Solution: one PL/pgSQL function that handles all three operations
-- (set_winner, set_score, reset) inside a single transaction with
-- row-level locking. Score is always source of truth — when both exist,
-- winner is derived from score, never from the user's tap.
--
-- SECURITY INVOKER preserves RLS enforcement (lock_time, membership, etc.).
-- Existing safe_upsert_prediction stays for non-match types (top_n, etc.).

-- ============================================================
-- 0. DELETE policy for predictions (missing — needed for reset)
-- ============================================================
-- Users can delete their own predictions before lock_time.
-- Without this, the reset operation would be blocked by RLS.
CREATE POLICY "Users can delete own predictions before lock"
  ON public.predictions FOR DELETE
  USING (
    user_id = auth.uid()
    AND event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.lock_time > now()
        AND e.status = 'upcoming'
    )
  );

-- ============================================================
-- 1. Pure derivation helper — maps score to winner label
-- ============================================================
-- Standard sports only (soccer, rugby, etc.). GAA uses goals*3+points
-- so needs a different path; for now the WC surface is all standard.
-- If GAA exact_score is ever needed, extend with a p_sport parameter.
--
-- p_options: JSON array of winner labels, e.g. '["Mexico","Draw","Jamaica"]'
--   index 0 = home wins, last index = away wins, middle = draw.
--   For knockout (2 options, no draw): returns NULL on tied score.
CREATE OR REPLACE FUNCTION derive_winner_from_score(
  p_home int,
  p_away int,
  p_options jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT CASE
    WHEN p_home > p_away THEN p_options->>0
    WHEN p_home < p_away THEN p_options->>(jsonb_array_length(p_options) - 1)
    WHEN jsonb_array_length(p_options) >= 3 THEN 'Draw'
    ELSE NULL  -- Knockout: no draw option, tied score = no derivation
  END;
$$;

COMMENT ON FUNCTION derive_winner_from_score IS
  'Pure function: derives winner label from numeric score and options array. '
  'Returns NULL when score is tied and no draw option exists (knockout).';

-- ============================================================
-- 2. Atomic match prediction RPC
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_match_prediction(
  p_event_id     uuid,
  p_user_id      uuid,
  p_winner_ept_id uuid,           -- EPT id for the winner prediction type
  p_score_ept_id  uuid DEFAULT NULL,  -- EPT id for exact_score (NULL if not configured)
  p_winner_options jsonb DEFAULT '[]', -- e.g. '["Mexico","Draw","Jamaica"]'
  p_operation    text DEFAULT 'set_winner',  -- 'set_winner' | 'set_score' | 'reset'
  p_winner_value text DEFAULT NULL,   -- for set_winner: the tapped option
  p_home_score   int DEFAULT NULL,    -- for set_score
  p_away_score   int DEFAULT NULL     -- for set_score
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

  -- ── Serialisation: lock any existing rows for this (user, event) ──
  -- SELECT ... FOR UPDATE serialises concurrent requests targeting the
  -- same user+event pair. The lock is held for the duration of this
  -- transaction only (milliseconds). Other users/events are unaffected.
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

  -- ── Operation dispatch ────────────────────────────────────────────

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

    -- Upsert winner row
    INSERT INTO predictions (
      event_prediction_type_id, user_id, prediction_type,
      event_id, prediction_data, updated_at
    ) VALUES (
      p_winner_ept_id, p_user_id, 'winner',
      p_event_id, jsonb_build_object('value', p_winner_value), now()
    )
    ON CONFLICT (event_prediction_type_id, user_id) DO UPDATE SET
      prediction_data = jsonb_build_object('value', p_winner_value),
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

    -- Upsert score row
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

    -- Derive and upsert winner atomically
    v_implied := derive_winner_from_score(
      p_home_score, p_away_score, p_winner_options
    );

    IF v_implied IS NOT NULL THEN
      INSERT INTO predictions (
        event_prediction_type_id, user_id, prediction_type,
        event_id, prediction_data, updated_at
      ) VALUES (
        p_winner_ept_id, p_user_id, 'winner',
        p_event_id, jsonb_build_object('value', v_implied), now()
      )
      ON CONFLICT (event_prediction_type_id, user_id) DO UPDATE SET
        prediction_data = jsonb_build_object('value', v_implied),
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
  'Serialises concurrent requests via FOR UPDATE. Score is always source of truth: '
  'set_winner re-derives from existing score; set_score atomically writes both rows. '
  'SECURITY INVOKER preserves all RLS enforcement.';
