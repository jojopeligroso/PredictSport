-- Add rounds, event_prediction_types, and related competition/event changes.
-- Normalises prediction type config out of events.prediction_types JSONB
-- into proper rows, and introduces rounds as a grouping entity.

-- ============================================================
-- 1. New columns on competitions
-- ============================================================

alter table public.competitions
  add column min_rounds_required integer,
  add column allow_prediction_updates boolean not null default true;

comment on column public.competitions.min_rounds_required is
  'Minimum rounds a participant must play. NULL = all rounds required.';
comment on column public.competitions.allow_prediction_updates is
  'Whether participants can update predictions before lock_time.';

-- ============================================================
-- 2. Rounds table
-- ============================================================

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  name text not null,
  round_number integer not null,
  deadline timestamptz,
  status text not null default 'draft' check (status in ('draft', 'open', 'locked', 'scored')),
  created_at timestamptz not null default now(),
  unique (competition_id, round_number)
);

create index idx_rounds_competition on public.rounds(competition_id);

comment on column public.rounds.round_number is
  'Display ordering. Unique per competition, shown as a simple number to users.';

-- ============================================================
-- 3. Add round_id FK to events
-- ============================================================

alter table public.events
  add column round_id uuid references public.rounds(id) on delete set null;

create index idx_events_round on public.events(round_id);

-- ============================================================
-- 4. Event prediction types table
-- ============================================================

create table public.event_prediction_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  prediction_type text not null check (prediction_type in ('winner', 'top_n', 'head_to_head', 'margin', 'over_under', 'handicap')),
  points integer not null default 10,
  partial_points integer not null default 0,
  config jsonb,
  unique (event_id, prediction_type)
);

create index idx_event_prediction_types_event on public.event_prediction_types(event_id);

comment on column public.event_prediction_types.points is
  'Points awarded for a correct prediction of this type.';
comment on column public.event_prediction_types.partial_points is
  'Points awarded for partial credit (e.g., correct team wrong margin).';
comment on column public.event_prediction_types.config is
  'Type-specific config, e.g., {"n": 5} for top_n, {"line": 2.5, "stat": "total_goals"} for over_under.';

-- ============================================================
-- 5. RLS policies for rounds
-- ============================================================

alter table public.rounds enable row level security;

create policy "Members can see rounds"
  on public.rounds for select
  using (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid()
    )
  );

create policy "Admins can insert rounds"
  on public.rounds for insert
  with check (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid()
      and role in ('admin', 'co_admin')
    )
  );

create policy "Admins can update rounds"
  on public.rounds for update
  using (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid()
      and role in ('admin', 'co_admin')
    )
  );

create policy "Admins can delete rounds"
  on public.rounds for delete
  using (
    competition_id in (
      select competition_id from public.competition_members
      where user_id = auth.uid()
      and role in ('admin', 'co_admin')
    )
  );

-- ============================================================
-- 6. RLS policies for event_prediction_types
-- ============================================================

alter table public.event_prediction_types enable row level security;

create policy "Members can see event prediction types"
  on public.event_prediction_types for select
  using (
    event_id in (
      select e.id from public.events e
      join public.competition_members cm on cm.competition_id = e.competition_id
      where cm.user_id = auth.uid()
    )
  );

create policy "Admins can insert event prediction types"
  on public.event_prediction_types for insert
  with check (
    event_id in (
      select e.id from public.events e
      join public.competition_members cm on cm.competition_id = e.competition_id
      where cm.user_id = auth.uid()
      and cm.role in ('admin', 'co_admin')
    )
  );

create policy "Admins can update event prediction types"
  on public.event_prediction_types for update
  using (
    event_id in (
      select e.id from public.events e
      join public.competition_members cm on cm.competition_id = e.competition_id
      where cm.user_id = auth.uid()
      and cm.role in ('admin', 'co_admin')
    )
  );

create policy "Admins can delete event prediction types"
  on public.event_prediction_types for delete
  using (
    event_id in (
      select e.id from public.events e
      join public.competition_members cm on cm.competition_id = e.competition_id
      where cm.user_id = auth.uid()
      and cm.role in ('admin', 'co_admin')
    )
  );

-- ============================================================
-- 7. Migrate existing prediction_types JSONB to rows
-- ============================================================

-- The existing events.prediction_types is either:
--   {"types": ["winner", "margin"]}   (current format)
--   or []                              (empty default)
--
-- Migrate to event_prediction_types rows using competition-level
-- scoring_rules defaults, falling back to sensible defaults.

insert into public.event_prediction_types (event_id, prediction_type, points, partial_points)
select
  e.id,
  pt.value::text,
  coalesce(
    (c.scoring_rules -> 'points' ->> pt.value::text)::integer,
    case pt.value::text
      when 'winner' then 10
      when 'top_n' then 5
      when 'head_to_head' then 5
      when 'margin' then 10
      when 'over_under' then 5
      when 'handicap' then 5
      else 10
    end
  ),
  coalesce(
    (c.scoring_rules -> 'partial_points' ->> pt.value::text)::integer,
    case pt.value::text
      when 'margin' then 5
      when 'top_n' then 3
      else 0
    end
  )
from public.events e
join public.competitions c on c.id = e.competition_id
cross join lateral jsonb_array_elements_text(
  case jsonb_typeof(e.prediction_types -> 'types')
    when 'array' then e.prediction_types -> 'types'
    else '[]'::jsonb
  end
) as pt(value)
on conflict (event_id, prediction_type) do nothing;
