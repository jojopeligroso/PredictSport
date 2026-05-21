-- Add hidden_at column to competitions for time-gated visibility
-- Used by the WC2026 hide-card cron to remove the promo card after August 2026
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

COMMENT ON COLUMN public.competitions.hidden_at IS
  'When set, hides this competition from promotional cards on the dashboard. Set by cron, cleared manually to re-show.';
