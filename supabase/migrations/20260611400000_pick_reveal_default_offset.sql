-- Change pick_reveal_at default from lock_time to lock_time + 5 minutes.
-- When pick_reveal_at IS NULL (no admin override), rival predictions become
-- visible 5 minutes after lock — roughly 5 minutes before kickoff.
--
-- This is a single-source-of-truth approach: we do NOT backfill pick_reveal_at
-- on every event row. Instead, the default is computed from lock_time at query
-- time. The explicit pick_reveal_at column is reserved for admin overrides only.
-- Zero synced copies, zero drift risk.

DROP POLICY IF EXISTS "Users can see others predictions after lock" ON public.predictions;

CREATE POLICY "Users can see others predictions after reveal"
  ON public.predictions FOR SELECT
  USING (
    event_id IN (
      SELECT e.id
      FROM public.events e
      WHERE (
          public.is_competition_member(e.competition_id)
          OR (e.tournament_id IS NOT NULL AND public.is_tournament_member(e.tournament_id))
        )
        AND (
          e.result_confirmed = true
          OR (e.pick_reveal_at IS NOT NULL AND now() >= e.pick_reveal_at)
          OR (e.pick_reveal_at IS NULL AND now() >= e.lock_time + interval '5 minutes')
        )
    )
  );
