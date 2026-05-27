-- Enable pg_cron + pg_net so we can schedule sub-daily HTTP calls to Vercel
-- routes that the Hobby plan's 2-cron daily cap can't host.
--
-- See docs/adr/0015-cron-architecture.md (forthcoming) and the route audit at
-- src/app/api/*/cron/route.ts for the four jobs being moved off "ghost cron"
-- comments and onto a real schedule.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- pg_cron defaults its jobs database to `postgres`; Supabase exposes the
-- cron.schedule API in the `cron` schema. pg_net lives in `net`.
-- We add a `private` schema for our wrapper function so it's clear the
-- helper isn't part of the public API surface.
CREATE SCHEMA IF NOT EXISTS private;

-- Grant execution rights only to the postgres role (pg_cron runs as the
-- database owner, which is postgres on Supabase). We deliberately do NOT
-- grant anything to anon or authenticated.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
