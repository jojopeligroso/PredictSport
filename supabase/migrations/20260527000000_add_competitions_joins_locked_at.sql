-- Add joins_locked_at to competitions.
--
-- ADR 0014: WC landing picks-first redesign.
-- SPEC.md §16.10 (updated): the parent WC prediction game remains joinable
-- until 72h after the first MD1 kickoff. This timestamp captures when the
-- soft join window closed for a given competition.
--
-- NULL = joins still open (default).
-- non-NULL timestamptz = joins closed at this instant.
--
-- Flipped by the daily /api/results/cron job once now() >= the WC constant
-- (WC_JOINS_CLOSE_AT in src/lib/wc/join-cutoff.ts). Super Admin can override
-- directly for early/late cutoff handling without a deploy.

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS joins_locked_at timestamptz NULL;

COMMENT ON COLUMN public.competitions.joins_locked_at IS
  'Soft join cutoff timestamp. NULL = joins open. Set by the daily results cron when the WC_JOINS_CLOSE_AT instant has passed. See ADR 0014 + SPEC.md §16.10.';
