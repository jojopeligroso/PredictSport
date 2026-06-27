-- Make the entrant cap a property of the tournament BLUEPRINT, customised per
-- blueprint and chosen at creation. Competition instances inherit it
-- (see auto-provision.ts / create-world-cup-competition.ts).
--
-- Storage: sporting_tournaments.config.max_entrants_per_instance
--   * a positive integer  -> hard cap; instances auto-provision the next one
--                            when full (enforced atomically by the
--                            competition_members cap trigger).
--   * null                -> deliberately UNLIMITED (one uncapped instance).
--
-- The key is REQUIRED on every blueprint: a CHECK constraint forces the creator
-- to make an explicit choice (a number, or null for unlimited). config.min_entrants
-- is optional.
--
-- NOTE: this is the cap on human PREDICTORS per instance — distinct from the
-- sporting structure already in config (e.g. team_count = number of football
-- teams), which happens to also be 48 for the World Cup.

-- 1. Backfill the existing WC blueprint: 48 entrants per instance, min 8.
UPDATE public.sporting_tournaments
SET config = config || jsonb_build_object(
  'max_entrants_per_instance', 48,
  'min_entrants', 8
)
WHERE id = 'a0000000-0000-0000-0000-000000000026'
  AND NOT (config ? 'max_entrants_per_instance');

-- 2. Require every blueprint to choose a cap at creation. The key must be
--    present; its value may be a number (capped) or null (explicitly unlimited).
--    NOT VALID skips scanning existing rows (safe because step 1 backfilled the
--    only existing row), so the migration won't fail if other blueprints are
--    added before this runs.
ALTER TABLE public.sporting_tournaments
  ADD CONSTRAINT sporting_tournaments_entrant_cap_chosen
  CHECK (config ? 'max_entrants_per_instance') NOT VALID;
