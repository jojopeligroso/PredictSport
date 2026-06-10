-- Phase 1: Tag fixtures and rounds with tournament blueprint ownership.
-- Additive only. No existing queries, RLS, or app code affected.
-- See ADR 0017 §8.

-- 1. Add tournament_id to events (nullable — non-tournament events remain NULL)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS tournament_id uuid
    REFERENCES public.sporting_tournaments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_tournament
  ON public.events(tournament_id) WHERE tournament_id IS NOT NULL;

COMMENT ON COLUMN public.events.tournament_id IS
  'Blueprint ownership. When set, this fixture belongs to the shared catalogue and is visible to all instances of the blueprint. NULL = legacy per-competition event.';

-- 2. Add tournament_id to rounds (nullable — non-tournament rounds remain NULL)
ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS tournament_id uuid
    REFERENCES public.sporting_tournaments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rounds_tournament
  ON public.rounds(tournament_id) WHERE tournament_id IS NOT NULL;

COMMENT ON COLUMN public.rounds.tournament_id IS
  'Blueprint ownership. When set, this prediction window is shared across all instances of the blueprint. NULL = legacy per-competition round.';

-- 3. Tag existing WC fixtures and rounds
UPDATE public.events
SET tournament_id = 'a0000000-0000-0000-0000-000000000026'
WHERE competition_id = (
  SELECT id FROM public.competitions
  WHERE tournament_id = 'a0000000-0000-0000-0000-000000000026'
  LIMIT 1
);

UPDATE public.rounds
SET tournament_id = 'a0000000-0000-0000-0000-000000000026'
WHERE competition_id = (
  SELECT id FROM public.competitions
  WHERE tournament_id = 'a0000000-0000-0000-0000-000000000026'
  LIMIT 1
);
