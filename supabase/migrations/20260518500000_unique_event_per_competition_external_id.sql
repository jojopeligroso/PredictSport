-- B2: Unique constraint on (competition_id, external_event_id)
-- Prevents duplicate events for the same fixture within a competition.
-- Required for idempotent personal event creation API.
-- Partial index: only applies where external_event_id IS NOT NULL
-- (manual events have null external_event_id).

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_competition_external_event
  ON public.events (competition_id, external_event_id)
  WHERE external_event_id IS NOT NULL;
