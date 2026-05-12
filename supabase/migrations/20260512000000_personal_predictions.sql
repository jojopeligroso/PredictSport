-- Personal predictions: predictions made outside any competition
-- Keyed by (user_id, external_event_id) — one prediction per user per fixture

create table personal_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_event_id text not null,
  event_name text not null,
  sport text not null,
  competition_name text,
  participants jsonb not null default '[]'::jsonb,
  start_time timestamptz not null,
  prediction_value text not null,  -- "home", "away", "draw", or participant name for races
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_predictions_user_event_unique unique (user_id, external_event_id)
);

alter table personal_predictions enable row level security;

-- Users can only see and manage their own predictions
create policy "Users manage own personal predictions"
  on personal_predictions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
