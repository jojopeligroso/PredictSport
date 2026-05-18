-- A4: Add favourite_team to users
-- Nullable JSONB column storing {sport, team_name, provider_id}.
-- Opt-in only — set during onboarding or profile settings.

ALTER TABLE public.users
  ADD COLUMN favourite_team jsonb;

COMMENT ON COLUMN public.users.favourite_team IS
  'Optional favourite team. Shape: {sport: string, team_name: string, provider_id: string | null}. Used by personal predictions dashboard.';
