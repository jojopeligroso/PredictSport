-- FE-A2: Add stage_finalisation_hold to sporting_stages
-- When true, stage finalisation is paused (e.g. waiting for format elimination to run).
-- Future blueprints default to false; WC2026 stages set to true.

ALTER TABLE public.sporting_stages
  ADD COLUMN stage_finalisation_hold boolean NOT NULL DEFAULT false;

-- Set all 9 WC2026 stages to hold=true
UPDATE public.sporting_stages
  SET stage_finalisation_hold = true
  WHERE tournament_id = 'a0000000-0000-0000-0000-000000000026';
