-- competition_standings: a best-effort cache of per-competition standings.
--
-- NOT a source of truth. /leaderboard remains the authoritative live
-- recompute. The All-Competitions Dashboard reads this cache for speed;
-- a missing or stale row triggers a read-through recompute that is
-- written back. See docs/DESIGN-F1-ALL-COMPETITIONS-DASHBOARD.md §3.3
-- and docs/adr/0010-cached-non-authoritative-standings.md.
--
-- Writes are server-side only. There is intentionally NO client
-- INSERT/UPDATE/DELETE policy — recomputeStandings() runs on the server
-- and the cache must never be writable by participants.

create table public.competition_standings (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  rank           integer not null,
  total_points   integer not null,
  correct_count  integer not null,
  resolved_count integer not null,
  member_count   integer not null,            -- denormalised: "X of {member_count}"
  computed_at    timestamptz not null default now(),  -- freshness marker
  primary key (competition_id, user_id)
);

comment on table public.competition_standings is
  'Best-effort cache of per-competition standings for the All-Competitions Dashboard. Non-authoritative — /leaderboard remains source of truth. See ADR-0010.';
comment on column public.competition_standings.computed_at is
  'When this row was last recomputed. A row is stale when computed_at predates the competition''s most recent result confirmation; see standings-cache.ts.';

-- The dashboard reads "my standing across all my competitions" — keyed by user.
create index competition_standings_user_id_idx
  on public.competition_standings (user_id);

-- RLS: same visibility as the live leaderboard. A user may read a row if it
-- is their own, OR if they are a member of that competition (so per-card
-- rank lines for fellow members resolve). No write policy: server-only.
alter table public.competition_standings enable row level security;

create policy "Members can read competition standings"
  on public.competition_standings for select
  using (
    user_id = auth.uid()
    or competition_id in (
      select cm.competition_id
      from public.competition_members cm
      where cm.user_id = auth.uid()
    )
  );
