-- Atomic invite claim: increments use_count only if under max_uses.
-- Returns the updated row on success, nothing on failure (invite exhausted).
CREATE OR REPLACE FUNCTION claim_invite_use(p_invite_id uuid)
RETURNS invite_tokens AS $$
  UPDATE invite_tokens
  SET use_count = use_count + 1
  WHERE id = p_invite_id
    AND (max_uses IS NULL OR use_count < max_uses)
  RETURNING *;
$$ LANGUAGE sql SECURITY DEFINER;
