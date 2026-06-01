-- Display Name Cooldown
-- Tracks when a user last set their display_name so the app can enforce
-- a cooldown period between renames.
--
-- Backfill: any user with a non-empty display_name is treated as having
-- set it at account creation time. Users with '' have not yet set a name
-- (onboarding modal pending) and are left NULL.

ALTER TABLE public.users
  ADD COLUMN display_name_updated_at timestamptz;

UPDATE public.users
SET display_name_updated_at = created_at
WHERE display_name IS NOT NULL
  AND display_name <> '';
