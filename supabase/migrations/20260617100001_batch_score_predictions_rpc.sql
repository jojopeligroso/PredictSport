-- Batch-update prediction scores in a single transaction.
-- If any row fails to update, the entire batch rolls back so no event is left
-- with partially scored predictions.
CREATE OR REPLACE FUNCTION public.batch_score_predictions(
  p_scores jsonb
)
RETURNS TABLE (scored int, errors int)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_scored int := 0;
  v_item jsonb;
  v_now timestamptz := now();
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_scores)
  LOOP
    UPDATE public.predictions
    SET
      is_correct = (v_item->>'is_correct')::boolean,
      is_partial = (v_item->>'is_partial')::boolean,
      points_awarded = (v_item->>'points_awarded')::int,
      updated_at = v_now
    WHERE id = (v_item->>'id')::uuid;

    v_scored := v_scored + 1;
  END LOOP;

  RETURN QUERY SELECT v_scored, 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.batch_score_predictions(jsonb) TO authenticated;
