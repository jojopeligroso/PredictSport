-- Atomic outright prediction update with history-length CAS guard.
-- Pre-tournament: replaces history entirely (changes are free).
-- Post-tournament: appends to change_history only if the history length
-- matches p_expected_history_length — prevents two concurrent changes from
-- both reading length=1, both appending, both writing length=2 (losing one entry).
CREATE OR REPLACE FUNCTION safe_update_outright(
  p_prediction_id uuid,
  p_new_pick text,
  p_expected_history_length int,
  p_tournament_started boolean
) RETURNS SETOF predictions AS $$
  UPDATE predictions SET
    prediction_data = CASE
      WHEN p_tournament_started THEN
        jsonb_build_object(
          'value', p_new_pick,
          'change_history',
          COALESCE(prediction_data->'change_history', '[]'::jsonb) ||
            jsonb_build_object('pick', p_new_pick, 'changed_at', to_jsonb(now()))
        )
      ELSE
        jsonb_build_object(
          'value', p_new_pick,
          'change_history',
          jsonb_build_array(jsonb_build_object('pick', p_new_pick, 'changed_at', to_jsonb(now())))
        )
    END,
    updated_at = now()
  WHERE id = p_prediction_id
    AND (
      NOT p_tournament_started
      OR jsonb_array_length(COALESCE(prediction_data->'change_history', '[]'::jsonb)) = p_expected_history_length
    )
  RETURNING *;
$$ LANGUAGE sql SECURITY INVOKER;
