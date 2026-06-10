-- Phase 2A: Multi-instance support — schema additions
-- See ADR 0017 §8. Additive only — no existing queries affected.

-- 1. Add instance_type to competitions
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS instance_type text
    DEFAULT 'full'
    CHECK (instance_type IN ('full', 'knockout_only'));

COMMENT ON COLUMN public.competitions.instance_type IS
  'Stage scope for tournament instances. full = all stages. knockout_only = R32 onwards.';

-- 2. Add instance_number to competitions
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS instance_number int DEFAULT 1;

COMMENT ON COLUMN public.competitions.instance_number IS
  'Sequential numbering within a tournament blueprint. First instance = 1.';

-- 3. Backfill existing WC competition
UPDATE public.competitions
SET instance_type = 'full', instance_number = 1
WHERE product_mode = 'world_cup_2026_shell';

-- 4. Create is_tournament_member helper (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_tournament_member(t_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.competition_members cm
    JOIN public.competitions c ON c.id = cm.competition_id
    WHERE c.tournament_id = t_id
    AND cm.user_id = auth.uid()
  );
$$;

-- 5. Modify consistency trigger to skip tournament-owned events
CREATE OR REPLACE FUNCTION public.check_event_competition_consistency()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Skip check for tournament-owned events (shared across instances)
  IF NEW.tournament_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.round_id IS NOT NULL THEN
    IF (SELECT competition_id FROM public.rounds WHERE id = NEW.round_id) <> NEW.competition_id THEN
      RAISE EXCEPTION
        'events.competition_id (%) must match rounds.competition_id when round_id is set (round %)',
        NEW.competition_id, NEW.round_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
