-- Hide KO Bracket and Last 32 tabs until admin activates them.
-- These classifications exist but should remain draft until knockout stages begin.

UPDATE public.classifications
SET status = 'draft', updated_at = now()
WHERE classification_key IN ('knockout_bracket', 'r32_pick')
  AND status != 'draft';
