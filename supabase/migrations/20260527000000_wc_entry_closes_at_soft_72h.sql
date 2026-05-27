-- Seed competitions.entry_closes_at for the WC competition (ADR 0014).
--
-- SPEC.md §16.10: parent WC prediction game remains joinable until 72h after
-- the first MD1 kickoff. The cutoff is **declarative** — set the existing
-- entry_closes_at column on the WC competition row to the soft cutoff instant.
--
-- entry_closes_at was added by migration 20260521600000_extend_existing_tables.
-- /api/tournament/enroll already enforces it server-side; /wc/join reads it
-- before creating new memberships.
--
-- WC_FIRST_KICKOFF_UTC = 2026-06-11T19:00:00Z (Mexico v South Africa, Mexico City)
-- WC_JOINS_CLOSE_AT    = 2026-06-14T19:00:00Z (first kickoff + 72h)
--
-- Idempotent: only updates the WC competition; only sets entry_closes_at when
-- the row's current value is NULL or earlier than our target. Super Admin can
-- still set an earlier cutoff via direct UPDATE if needed.

UPDATE public.competitions
SET entry_closes_at = '2026-06-14T19:00:00Z'
WHERE product_mode = 'world_cup_2026_shell'
  AND (entry_closes_at IS NULL OR entry_closes_at < '2026-06-14T19:00:00Z');
