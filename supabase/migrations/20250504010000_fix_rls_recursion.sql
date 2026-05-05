-- Fix infinite recursion in competition_members SELECT policy.
-- The old policy checked "competition_id IN (SELECT competition_id FROM competition_members WHERE user_id = auth.uid())"
-- which self-references competition_members, causing infinite recursion.

-- Create a security definer function that bypasses RLS to check membership
create or replace function public.is_competition_member(comp_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.competition_members
    where competition_id = comp_id
    and user_id = auth.uid()
  );
$$;

create or replace function public.is_competition_admin(comp_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.competition_members
    where competition_id = comp_id
    and user_id = auth.uid()
    and role = 'admin'
  );
$$;

-- Drop and recreate competition_members SELECT policy
drop policy "Members can see competition members" on public.competition_members;
create policy "Members can see competition members"
  on public.competition_members for select
  using (public.is_competition_member(competition_id));

-- Fix competitions SELECT policy to use the function
drop policy "Members can read their competitions" on public.competitions;
create policy "Members can read their competitions"
  on public.competitions for select
  using (
    visibility = 'public'
    or public.is_competition_member(id)
  );

-- Fix competitions UPDATE/DELETE policies
drop policy "Admins can update competitions" on public.competitions;
create policy "Admins can update competitions"
  on public.competitions for update
  using (public.is_competition_admin(id));

drop policy "Admins can delete competitions" on public.competitions;
create policy "Admins can delete competitions"
  on public.competitions for delete
  using (public.is_competition_admin(id));

-- Fix competition_members UPDATE/DELETE policies
drop policy "Admins can update members" on public.competition_members;
create policy "Admins can update members"
  on public.competition_members for update
  using (public.is_competition_admin(competition_id));

drop policy "Admins can remove members" on public.competition_members;
create policy "Admins can remove members"
  on public.competition_members for delete
  using (public.is_competition_admin(competition_id));

-- Fix events policies that reference competition_members
drop policy if exists "Members can see events" on public.events;
create policy "Members can see events"
  on public.events for select
  using (public.is_competition_member(competition_id));

drop policy if exists "Admins can create events" on public.events;
create policy "Admins can create events"
  on public.events for insert
  with check (public.is_competition_admin(competition_id));

drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events"
  on public.events for update
  using (public.is_competition_admin(competition_id));

-- Fix nominations policies
drop policy if exists "Members can see nominations" on public.event_nominations;
create policy "Members can see nominations"
  on public.event_nominations for select
  using (public.is_competition_member(competition_id));

drop policy if exists "Members can nominate events" on public.event_nominations;
create policy "Members can nominate events"
  on public.event_nominations for insert
  with check (public.is_competition_member(competition_id) and auth.uid() = nominated_by);

drop policy if exists "Admins can update nominations" on public.event_nominations;
create policy "Admins can update nominations"
  on public.event_nominations for update
  using (public.is_competition_admin(competition_id));

-- Fix tiebreaker policies
drop policy if exists "Members can see tiebreakers" on public.tiebreakers;
create policy "Members can see tiebreakers"
  on public.tiebreakers for select
  using (public.is_competition_member(competition_id));

drop policy if exists "Admins can create tiebreakers" on public.tiebreakers;
create policy "Admins can create tiebreakers"
  on public.tiebreakers for insert
  with check (public.is_competition_admin(competition_id));

-- Fix invite token policies
drop policy if exists "Anyone can read invite tokens" on public.invite_tokens;
create policy "Anyone can read invite tokens"
  on public.invite_tokens for select
  using (true);

drop policy if exists "Admins can create invite tokens" on public.invite_tokens;
create policy "Admins can create invite tokens"
  on public.invite_tokens for insert
  with check (public.is_competition_admin(competition_id));
