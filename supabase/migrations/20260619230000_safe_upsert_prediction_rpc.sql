-- Safe prediction upsert with timestamp-based CAS guard.
-- When p_expected_updated_at is NULL (first write or client has no prior state),
-- the upsert always succeeds (backwards-compatible with existing clients).
-- When non-NULL, the update only succeeds if the row hasn't been modified since
-- the client last read it — preventing silent overwrites from out-of-order POSTs.
--
-- SECURITY INVOKER preserves RLS enforcement (lock_time, membership, competition status).
CREATE OR REPLACE FUNCTION safe_upsert_prediction(
  p_ept_id uuid,
  p_user_id uuid,
  p_type text,
  p_event_id uuid,
  p_data jsonb,
  p_expected_updated_at timestamptz DEFAULT NULL,
  p_note_text text DEFAULT NULL,
  p_note_visibility text DEFAULT NULL
) RETURNS SETOF predictions AS $$
  INSERT INTO predictions (
    event_prediction_type_id,
    user_id,
    prediction_type,
    event_id,
    prediction_data,
    note_text,
    note_visibility,
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
    now()
  )
  ON CONFLICT (event_prediction_type_id, user_id) DO UPDATE SET
    prediction_data = EXCLUDED.prediction_data,
    note_text = COALESCE(EXCLUDED.note_text, predictions.note_text),
    note_visibility = COALESCE(EXCLUDED.note_visibility, predictions.note_visibility),
    updated_at = now()
  WHERE p_expected_updated_at IS NULL
     OR predictions.updated_at <= p_expected_updated_at
  RETURNING *;
$$ LANGUAGE sql SECURITY INVOKER;
