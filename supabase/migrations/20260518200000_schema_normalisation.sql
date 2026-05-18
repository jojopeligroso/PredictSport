-- Schema Normalisation: BCNF audit fixes
-- Issue 1: predictions lacks FK to event_prediction_types
--           Replace text (event_id, prediction_type) pair with event_prediction_type_id FK.
--           predictions has 0 rows so no backfill needed.
-- Issue 2: events.competition_id transitive dependency via round_id
--           Keep column as useful denorm; add trigger to enforce consistency.
-- Issue 3: events.prediction_types JSONB — already dropped in 20250505200000. No action.
-- Issue 4: events has no sporting_event_id FK to sporting_events pool.

-- ============================================================
-- Issue 1: Add event_prediction_type_id FK to predictions
-- ============================================================

-- Add the FK column. NOT NULL is safe — predictions is empty.
ALTER TABLE public.predictions
  ADD COLUMN event_prediction_type_id uuid NOT NULL
    REFERENCES public.event_prediction_types(id) ON DELETE RESTRICT;

-- New unique constraint: one prediction per (EPT, user).
-- The EPT id already encodes (event_id, prediction_type) so this is strictly stronger.
ALTER TABLE public.predictions
  DROP CONSTRAINT predictions_event_id_user_id_prediction_type_key,
  ADD CONSTRAINT predictions_ept_user_unique UNIQUE (event_prediction_type_id, user_id);

-- Index for FK lookups
CREATE INDEX idx_predictions_ept ON public.predictions(event_prediction_type_id);

comment on column public.predictions.event_prediction_type_id is
  'FK to the configured prediction type for this event. Encodes both event_id and prediction_type; use for joins to get points/config.';

comment on column public.predictions.event_id is
  'Retained for RLS policy efficiency and direct event lookups. Must stay consistent with event_prediction_type_id.event_id.';

comment on column public.predictions.prediction_type is
  'Retained as a convenience denorm for display without JOIN. Must stay consistent with event_prediction_type_id.prediction_type.';

-- ============================================================
-- Issue 2: Enforce events.competition_id consistency with round
-- ============================================================

-- When round_id is set, competition_id must match rounds.competition_id.
-- This prevents silent denormalisation drift.

CREATE OR REPLACE FUNCTION public.check_event_competition_consistency()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
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

CREATE TRIGGER enforce_event_competition_consistency
  BEFORE INSERT OR UPDATE OF competition_id, round_id ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.check_event_competition_consistency();

-- Validate existing rows to confirm no drift exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.rounds r ON r.id = e.round_id
    WHERE e.competition_id <> r.competition_id
  ) THEN
    RAISE EXCEPTION 'Existing events data has competition_id/round_id mismatch — fix before applying this migration';
  END IF;
END;
$$;

-- ============================================================
-- Issue 4: Add sporting_event_id FK to events
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN sporting_event_id uuid
    REFERENCES public.sporting_events(id) ON DELETE SET NULL;

CREATE INDEX idx_events_sporting_event ON public.events(sporting_event_id)
  WHERE sporting_event_id IS NOT NULL;

comment on column public.events.sporting_event_id is
  'Optional FK to the sporting_events pool. Set when the event was created from the fixture browser. NULL for manually entered events.';
