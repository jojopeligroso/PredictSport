-- Push notification subscriptions (Web Push API)
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null,
  keys_p256dh text not null,
  keys_auth text not null,
  is_pwa boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

-- RLS: users can only manage their own subscriptions
alter table push_subscriptions enable row level security;

create policy "Users can view own subscriptions"
  on push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert own subscriptions"
  on push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own subscriptions"
  on push_subscriptions for delete
  using (auth.uid() = user_id);

-- Index for efficient lookup when sending notifications
create index idx_push_subscriptions_user_id on push_subscriptions(user_id);
