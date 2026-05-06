-- Drop the deprecated prediction_types JSONB column from events.
-- All prediction type data now lives in event_prediction_types rows.

alter table public.events drop column prediction_types;
