-- Migration: add sporting_events pool table
-- A pool of real-world sporting events that competition creators can browse
-- and pick from when building prediction rounds.

CREATE TABLE IF NOT EXISTS sporting_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  sport text NOT NULL,
  start_time timestamptz NOT NULL,
  participants text[] NOT NULL DEFAULT '{}',
  competition_name text,           -- real-world competition, e.g. "Leinster SHC 2026"
  external_event_id text,          -- "manual:slug" for manually added; real provider ID when linked
  source text NOT NULL DEFAULT 'manual',  -- 'manual' | provider name
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fixture browser queries (sport + date range)
CREATE INDEX IF NOT EXISTS sporting_events_sport_start
  ON sporting_events (sport, start_time);

-- Index for external_event_id lookups (idempotency checks)
CREATE INDEX IF NOT EXISTS sporting_events_external_id
  ON sporting_events (external_event_id)
  WHERE external_event_id IS NOT NULL;

-- RLS: enable and lock down writes to service_role only
ALTER TABLE sporting_events ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or authenticated) can read events
CREATE POLICY "sporting_events_public_read"
  ON sporting_events
  FOR SELECT
  USING (true);

-- No app-layer insert/update/delete policies.
-- Data ingestion scripts use the service_role key which bypasses RLS entirely.
