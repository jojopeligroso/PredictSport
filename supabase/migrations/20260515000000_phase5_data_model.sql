-- Phase 5.1b: Add provider_league to events table
-- Stores the ESPN league path used when the event was created (e.g. "cricket/8044").
-- Result-fetching crons use this instead of the sport-level default so non-default
-- leagues (Big Bash, Six Nations, etc.) resolve correctly.
--
-- Nullable: existing events fall back to the provider's SPORT_PATHS default.

alter table events
  add column if not exists provider_league text;

-- Phase 5.1c: Add result_provider to personal_predictions
-- Records which API provider returned the final result (e.g. "espn", "api-football").
-- Purely for auditing and provider health monitoring.

alter table personal_predictions
  add column if not exists result_provider text;
