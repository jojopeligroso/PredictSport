-- Phase 2B: RLS policies — tournament-aware OR branches
-- Adds tournament_id path so members of ANY instance can see shared fixtures.
-- Existing competition_id path remains intact — zero impact on current users.

-- ============================================================
-- events SELECT: add tournament member path
-- ============================================================
DROP POLICY IF EXISTS "Members can see events" ON public.events;
CREATE POLICY "Members can see events"
  ON public.events FOR SELECT
  USING (
    public.is_competition_member(competition_id)
    OR (tournament_id IS NOT NULL AND public.is_tournament_member(tournament_id))
  );

-- ============================================================
-- rounds SELECT: add tournament member path
-- ============================================================
DROP POLICY IF EXISTS "Members can see rounds" ON public.rounds;
CREATE POLICY "Members can see rounds"
  ON public.rounds FOR SELECT
  USING (
    competition_id IN (
      SELECT competition_id FROM public.competition_members
      WHERE user_id = auth.uid()
    )
    OR (tournament_id IS NOT NULL AND public.is_tournament_member(tournament_id))
  );

-- ============================================================
-- event_prediction_types SELECT: add tournament member path
-- ============================================================
DROP POLICY IF EXISTS "Members can see event prediction types" ON public.event_prediction_types;
CREATE POLICY "Members can see event prediction types"
  ON public.event_prediction_types FOR SELECT
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      JOIN public.competition_members cm ON cm.competition_id = e.competition_id
      WHERE cm.user_id = auth.uid()
    )
    OR event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.tournament_id IS NOT NULL
      AND public.is_tournament_member(e.tournament_id)
    )
  );

-- ============================================================
-- predictions INSERT: allow tournament members to predict shared fixtures
-- ============================================================
DROP POLICY IF EXISTS "Users can submit predictions before lock" ON public.predictions;
CREATE POLICY "Users can submit predictions before lock"
  ON public.predictions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.lock_time > now()
      AND (
        -- Original path: member of competition that owns the event
        EXISTS (
          SELECT 1 FROM public.competition_members cm
          JOIN public.competitions c ON c.id = cm.competition_id
          WHERE cm.competition_id = e.competition_id
          AND cm.user_id = auth.uid()
          AND c.status = 'active'
        )
        -- Tournament path: member of ANY active instance sharing this blueprint
        OR (e.tournament_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.competition_members cm
          JOIN public.competitions c ON c.id = cm.competition_id
          WHERE c.tournament_id = e.tournament_id
          AND cm.user_id = auth.uid()
          AND c.status = 'active'
        ))
      )
    )
  );

-- ============================================================
-- predictions UPDATE: allow tournament members to update before lock
-- ============================================================
DROP POLICY IF EXISTS "Users can update predictions before lock" ON public.predictions;
CREATE POLICY "Users can update predictions before lock"
  ON public.predictions FOR UPDATE
  USING (
    user_id = auth.uid()
    AND event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.lock_time > now()
      AND (
        EXISTS (
          SELECT 1 FROM public.competitions c
          WHERE c.id = e.competition_id
          AND c.status = 'active'
          AND c.allow_prediction_updates = true
        )
        OR (e.tournament_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.competition_members cm
          JOIN public.competitions c ON c.id = cm.competition_id
          WHERE c.tournament_id = e.tournament_id
          AND cm.user_id = auth.uid()
          AND c.status = 'active'
          AND c.allow_prediction_updates = true
        ))
      )
    )
  );

-- ============================================================
-- predictions SELECT (others): add tournament member path
-- ============================================================
DROP POLICY IF EXISTS "Users can see others predictions after lock" ON public.predictions;
CREATE POLICY "Users can see others predictions after lock"
  ON public.predictions FOR SELECT
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE (
        public.is_competition_member(e.competition_id)
        OR (e.tournament_id IS NOT NULL AND public.is_tournament_member(e.tournament_id))
      )
      AND (
        e.result_confirmed = true
        OR (e.pick_reveal_at IS NOT NULL AND now() >= e.pick_reveal_at)
        OR (e.pick_reveal_at IS NULL AND now() >= e.lock_time)
      )
    )
  );

-- ============================================================
-- Public competition policies remain UNCHANGED
-- (they reference first instance which has visibility='public')
-- ============================================================

-- ============================================================
-- Write policies on events/rounds remain UNCHANGED
-- (only super admin creates/updates tournament fixtures via service-role)
-- ============================================================
