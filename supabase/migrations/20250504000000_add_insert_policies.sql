-- Add missing INSERT/UPDATE/DELETE policies

-- Any authenticated user can create a competition
create policy "Authenticated users can create competitions"
  on public.competitions for insert
  with check (auth.uid() = created_by);

-- Competition admins can update their competitions
create policy "Admins can update competitions"
  on public.competitions for update
  using (
    id in (
      select competition_id from public.competition_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Competition admins can delete their competitions
create policy "Admins can delete competitions"
  on public.competitions for delete
  using (
    id in (
      select competition_id from public.competition_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Users can insert themselves as members (for joining via invite)
-- Also allows competition creator to add themselves as admin
create policy "Users can join competitions"
  on public.competition_members for insert
  with check (auth.uid() = user_id);

-- Admins can update members (promote/demote)
create policy "Admins can update members"
  on public.competition_members for update
  using (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Admins can remove members
create policy "Admins can remove members"
  on public.competition_members for delete
  using (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Admins can insert events
create policy "Admins can create events"
  on public.events for insert
  with check (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Admins can update events
create policy "Admins can update events"
  on public.events for update
  using (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Admins can manage tiebreakers
create policy "Admins can create tiebreakers"
  on public.tiebreakers for insert
  with check (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Admins can manage invite tokens
create policy "Admins can create invite tokens"
  on public.invite_tokens for insert
  with check (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Admins can manage nominations (update status)
create policy "Admins can update nominations"
  on public.event_nominations for update
  using (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid() and role = 'admin'
    )
  );
