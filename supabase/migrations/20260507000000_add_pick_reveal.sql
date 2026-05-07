-- Add admin-controllable pick reveal time to events.
-- Admins can set pick_reveal_at to delay when other users' picks become visible.
-- If NULL, the existing behaviour is preserved: picks reveal at lock_time.

-- 1. Add column to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS pick_reveal_at timestamptz;

-- 2. Drop the old "reveal at lock_time" policy for others' predictions
DROP POLICY IF EXISTS "Users can see others predictions after lock" ON public.predictions;

-- 3. Re-create with three-condition reveal logic:
--    a) result_confirmed = true (event is fully resulted)
--    b) pick_reveal_at IS NOT NULL AND now() >= pick_reveal_at (admin set a reveal time)
--    c) pick_reveal_at IS NULL AND now() >= lock_time (default: reveal at lock time)
CREATE POLICY "Users can see others predictions after lock"
  ON public.predictions FOR SELECT
  USING (
    event_id IN (
      SELECT e.id
      FROM public.events e
      WHERE public.is_competition_member(e.competition_id)
        AND (
          e.result_confirmed = true
          OR (e.pick_reveal_at IS NOT NULL AND now() >= e.pick_reveal_at)
          OR (e.pick_reveal_at IS NULL     AND now() >= e.lock_time)
        )
    )
  );
