-- Add provider_league to personal_predictions so result-fetching uses
-- the correct ESPN league path (e.g. "cricket/8044" for Big Bash, not
-- the sport default "cricket/8048" which is IPL-only).
--
-- Nullable: existing rows without a stored league fall back to the
-- provider's default SPORT_PATHS entry (backwards-compatible).

alter table personal_predictions
  add column if not exists provider_league text;
