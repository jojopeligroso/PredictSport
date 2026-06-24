-- Move competitions.entry_closes_at for the WC game to the Round of 32 start.
--
-- Supersedes the soft 72h-after-MD1 cutoff (20260527000000). Product decision:
-- joins stay open through the entire group stage and close when the knockouts
-- begin, since a new entrant has nothing to predict once R32 starts.
--
-- WC_R32_START_UTC = 2026-06-28T20:00:00Z (earliest R32 kickoff, match 73,
-- Los Angeles — see scripts/wc2026-knockout-fixtures.ts).
--
-- Applies to every WC shell instance, including auto-provisioned overflow
-- instances that were previously left open indefinitely (entry_closes_at NULL),
-- so the close rule is uniform across instances. The guard only ever moves the
-- cutoff later, never earlier, so a Super Admin's manually-set later cutoff is
-- preserved.

UPDATE public.competitions
SET entry_closes_at = '2026-06-28T20:00:00Z'
WHERE product_mode = 'world_cup_2026_shell'
  AND (entry_closes_at IS NULL OR entry_closes_at < '2026-06-28T20:00:00Z');
