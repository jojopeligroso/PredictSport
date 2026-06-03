-- Allow any authenticated user to read all user profiles.
-- The original policy restricted SELECT to auth.uid() = id (own profile only),
-- which caused all other participants to show as "Unknown" in competition views.
create policy "Authenticated users can read all profiles"
  on public.users for select
  to authenticated
  using (true);
