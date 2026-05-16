-- Replace the plain index on external_event_id with a unique constraint
-- so that upsert ON CONFLICT works correctly in the cricket seeder.

DROP INDEX IF EXISTS sporting_events_external_id;

ALTER TABLE sporting_events
  ADD CONSTRAINT sporting_events_external_event_id_unique
  UNIQUE (external_event_id);
