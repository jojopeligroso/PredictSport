-- Add entrant cap columns to competitions
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS max_entrants int,
  ADD COLUMN IF NOT EXISTS min_entrants int;

COMMENT ON COLUMN public.competitions.max_entrants IS
  'Hard cap on competition membership. Null = unlimited.';
COMMENT ON COLUMN public.competitions.min_entrants IS
  'Minimum entrants needed for the competition to proceed. Null = no minimum.';

-- Set WC competition defaults
UPDATE public.competitions
SET max_entrants = 48, min_entrants = 8
WHERE product_mode = 'world_cup_2026_shell';
