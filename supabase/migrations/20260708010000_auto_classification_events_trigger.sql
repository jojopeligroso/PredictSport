-- Auto-populate classification_events when events get a round_id.
-- Ensures format standings update live as results come in.
-- Finalisation becomes just locking the view, not creating the mapping.

-- 1. Unique constraint for idempotent trigger inserts
ALTER TABLE public.classification_events
  ADD CONSTRAINT uq_classification_events_class_event
  UNIQUE (classification_id, event_id);

-- 2. Trigger function
CREATE OR REPLACE FUNCTION public.auto_create_classification_events()
RETURNS trigger AS $$
DECLARE
  v_stage_id uuid;
  v_tournament_id uuid;
BEGIN
  IF NEW.round_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.sporting_stage_id
  INTO v_stage_id
  FROM public.rounds r
  WHERE r.id = NEW.round_id;

  IF v_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ss.tournament_id INTO v_tournament_id
  FROM public.sporting_stages ss
  WHERE ss.id = v_stage_id;

  INSERT INTO public.classification_events
    (classification_id, competition_id, event_id, sporting_stage_id,
     counts_for_scoring, counts_for_elimination, metadata)
  SELECT
    cl.id,
    cl.competition_id,
    NEW.id,
    v_stage_id,
    true,
    true,
    '{}'::jsonb
  FROM public.classifications cl
  JOIN public.competitions comp ON comp.id = cl.competition_id
  WHERE comp.tournament_id = v_tournament_id
    AND cl.classification_type = 'format_elimination'
    AND cl.status IN ('active', 'draft')
  ON CONFLICT (classification_id, event_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.auto_create_classification_events() FROM PUBLIC;

-- 3. Trigger on events table
CREATE TRIGGER trg_auto_classification_events
  AFTER INSERT OR UPDATE OF round_id ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_classification_events();
