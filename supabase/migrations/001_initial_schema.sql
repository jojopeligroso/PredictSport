-- PredictSport initial schema
-- Run this in the Supabase SQL editor to create all tables

-- Users (extends Supabase auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text not null default '',
  avatar_url text,
  is_super_admin boolean not null default false,
  notification_prefs jsonb default '{}',
  created_at timestamptz not null default now()
);

-- Competitions
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text not null check (type in ('fixed', 'open')),
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  scoring_rules jsonb not null default '{}',
  lock_default_minutes integer not null default 5,
  allow_nominations boolean not null default true,
  created_by uuid not null references public.users(id),
  invite_code text unique not null default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

-- Competition members
create table public.competition_members (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'participant' check (role in ('admin', 'co_admin', 'participant')),
  joined_at timestamptz not null default now(),
  unique (competition_id, user_id)
);

-- Events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  event_name text not null,
  sport text not null,
  start_time timestamptz not null,
  lock_time timestamptz not null,
  prediction_types jsonb not null default '[]',
  result_data jsonb,
  result_confirmed boolean not null default false,
  result_confirmed_by uuid references public.users(id),
  status text not null default 'upcoming' check (status in ('upcoming', 'locked', 'resulted', 'postponed', 'cancelled')),
  nominated_by uuid references public.users(id),
  external_event_id text,
  created_at timestamptz not null default now()
);

-- Predictions
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  prediction_type text not null check (prediction_type in ('winner', 'top_n', 'head_to_head', 'margin', 'over_under', 'handicap')),
  prediction_data jsonb not null default '{}',
  is_correct boolean,
  is_partial boolean not null default false,
  points_awarded integer not null default 0,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id, prediction_type)
);

-- Tiebreakers
create table public.tiebreakers (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  question_text text not null,
  correct_value integer
);

-- Tiebreaker answers
create table public.tiebreaker_answers (
  id uuid primary key default gen_random_uuid(),
  tiebreaker_id uuid not null references public.tiebreakers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  value integer not null,
  submitted_at timestamptz not null default now(),
  unique (tiebreaker_id, user_id)
);

-- Event nominations
create table public.event_nominations (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  nominated_by uuid not null references public.users(id),
  event_name text not null,
  sport text not null,
  proposed_date date not null,
  proposed_prediction_type text check (proposed_prediction_type in ('winner', 'top_n', 'head_to_head', 'margin', 'over_under', 'handicap')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- Invite tokens
create table public.invite_tokens (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  created_by uuid not null references public.users(id),
  expires_at timestamptz,
  max_uses integer,
  use_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_competition_members_user on public.competition_members(user_id);
create index idx_competition_members_comp on public.competition_members(competition_id);
create index idx_events_competition on public.events(competition_id);
create index idx_events_status on public.events(status);
create index idx_predictions_event on public.predictions(event_id);
create index idx_predictions_user on public.predictions(user_id);
create index idx_nominations_competition on public.event_nominations(competition_id);
create index idx_nominations_status on public.event_nominations(status);

-- RLS policies
alter table public.users enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_members enable row level security;
alter table public.events enable row level security;
alter table public.predictions enable row level security;
alter table public.tiebreakers enable row level security;
alter table public.tiebreaker_answers enable row level security;
alter table public.event_nominations enable row level security;
alter table public.invite_tokens enable row level security;

-- Users: can read own profile, update own profile
create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- Competitions: members can read their competitions, public ones are visible to all
create policy "Members can read their competitions"
  on public.competitions for select
  using (
    visibility = 'public'
    or id in (
      select competition_id from public.competition_members
      where user_id = auth.uid()
    )
  );

-- Competition members: members can see other members in their competitions
create policy "Members can see competition members"
  on public.competition_members for select
  using (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid()
    )
  );

-- Events: members can see events in their competitions
create policy "Members can see events"
  on public.events for select
  using (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid()
    )
  );

-- Predictions: own predictions always visible; others visible only after lock
create policy "Users can read own predictions"
  on public.predictions for select
  using (user_id = auth.uid());

create policy "Users can see others predictions after lock"
  on public.predictions for select
  using (
    event_id in (
      select e.id from public.events e
      join public.competition_members cm on cm.competition_id = e.competition_id
      where cm.user_id = auth.uid()
      and e.lock_time <= now()
    )
  );

-- Predictions: users can insert/update their own before lock
create policy "Users can submit predictions before lock"
  on public.predictions for insert
  with check (
    user_id = auth.uid()
    and event_id in (
      select e.id from public.events e
      join public.competition_members cm on cm.competition_id = e.competition_id
      where cm.user_id = auth.uid()
      and e.lock_time > now()
    )
  );

create policy "Users can update predictions before lock"
  on public.predictions for update
  using (
    user_id = auth.uid()
    and event_id in (
      select e.id from public.events e
      where e.lock_time > now()
    )
  );

-- Tiebreakers: members can read
create policy "Members can see tiebreakers"
  on public.tiebreakers for select
  using (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid()
    )
  );

-- Tiebreaker answers: own always visible, others after all events resulted
create policy "Users can read own tiebreaker answers"
  on public.tiebreaker_answers for select
  using (user_id = auth.uid());

create policy "Users can submit tiebreaker answers"
  on public.tiebreaker_answers for insert
  with check (user_id = auth.uid());

-- Event nominations: members can see and create nominations
create policy "Members can see nominations"
  on public.event_nominations for select
  using (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid()
    )
  );

create policy "Members can nominate events"
  on public.event_nominations for insert
  with check (
    nominated_by = auth.uid()
    and competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid()
    )
  );

-- Invite tokens: admins can manage, anyone can read (to join)
create policy "Anyone can read invite tokens"
  on public.invite_tokens for select
  using (true);

-- Function: auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- Trigger: create profile on auth signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
