-- FE-A1: Add status column to format_prediction_groups
-- Groups can be 'active' (normal) or 'archived' (post-elimination lifecycle).
-- All existing groups default to 'active'.

ALTER TABLE public.format_prediction_groups
  ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'archived'));

-- Index for filtering active groups efficiently
CREATE INDEX idx_format_prediction_groups_status
  ON public.format_prediction_groups(classification_id, status);
