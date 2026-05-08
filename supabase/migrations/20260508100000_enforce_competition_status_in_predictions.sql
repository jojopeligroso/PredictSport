-- Tighten prediction RLS policies to enforce competition-level controls.
--
-- Previously, INSERT and UPDATE policies only checked event.lock_time.
-- Now they also require:
--   - competition.status = 'active'
--   - UPDATE additionally requires competition.allow_prediction_updates = true
--
-- This prevents:
--   - Predictions on draft or completed competitions
--   - Changing predictions in "sheet" competitions (allow_prediction_updates = false)

-- Replace INSERT policy
drop policy if exists "Users can submit predictions before lock" on public.predictions;
create policy "Users can submit predictions before lock"
  on public.predictions for insert
  with check (
    user_id = auth.uid()
    and event_id in (
      select e.id from public.events e
      join public.competition_members cm on cm.competition_id = e.competition_id
      join public.competitions c on c.id = e.competition_id
      where cm.user_id = auth.uid()
      and e.lock_time > now()
      and c.status = 'active'
    )
  );

-- Replace UPDATE policy
drop policy if exists "Users can update predictions before lock" on public.predictions;
create policy "Users can update predictions before lock"
  on public.predictions for update
  using (
    user_id = auth.uid()
    and event_id in (
      select e.id from public.events e
      join public.competitions c on c.id = e.competition_id
      where e.lock_time > now()
      and c.status = 'active'
      and c.allow_prediction_updates = true
    )
  );
