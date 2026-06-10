-- Competition Chat: chat_messages table, chat_enabled toggle, join system message trigger

-- 1. Add chat_enabled to competitions (default true)
alter table public.competitions
  add column if not exists chat_enabled boolean not null default true;

-- 2. Create chat_messages table
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  message_type text not null default 'user' check (message_type in ('user', 'system')),
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by text check (deleted_by in ('user', 'admin'))
);

-- Indexes
create index idx_chat_messages_competition_created
  on public.chat_messages (competition_id, created_at desc);

create index idx_chat_messages_user
  on public.chat_messages (user_id);

-- 3. RLS policies
alter table public.chat_messages enable row level security;

-- Members can read messages in their competitions
create policy "Members can read chat messages"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.competition_members cm
      where cm.competition_id = chat_messages.competition_id
        and cm.user_id = auth.uid()
    )
  );

-- Members can insert messages into their competitions
create policy "Members can send chat messages"
  on public.chat_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.competition_members cm
      where cm.competition_id = chat_messages.competition_id
        and cm.user_id = auth.uid()
    )
  );

-- Users can update their own messages (for edits and self-deletes)
create policy "Users can update own chat messages"
  on public.chat_messages for update
  using (auth.uid() = user_id);

-- Admins can update any message in their competitions (for admin deletes)
create policy "Admins can update chat messages"
  on public.chat_messages for update
  using (
    exists (
      select 1 from public.competition_members cm
      where cm.competition_id = chat_messages.competition_id
        and cm.user_id = auth.uid()
        and cm.role in ('admin', 'co_admin')
    )
  );

-- Hard delete: only the message author within 10s, or admin
create policy "Authors can hard-delete recent messages"
  on public.chat_messages for delete
  using (
    auth.uid() = user_id
    and created_at > now() - interval '10 seconds'
  );

create policy "Admins can hard-delete chat messages"
  on public.chat_messages for delete
  using (
    exists (
      select 1 from public.competition_members cm
      where cm.competition_id = chat_messages.competition_id
        and cm.user_id = auth.uid()
        and cm.role in ('admin', 'co_admin')
    )
  );

-- 4. Enable Realtime for chat_messages
alter publication supabase_realtime add table public.chat_messages;

-- 5. System message trigger on member join
create or replace function public.chat_on_member_join()
returns trigger
language plpgsql
security definer
as $$
declare
  v_display_name text;
  v_chat_enabled boolean;
begin
  -- Check if chat is enabled for this competition
  select chat_enabled into v_chat_enabled
  from public.competitions
  where id = NEW.competition_id;

  if not v_chat_enabled then
    return NEW;
  end if;

  -- Get the joining user's display name
  select display_name into v_display_name
  from public.users
  where id = NEW.user_id;

  if v_display_name is null then
    v_display_name := 'Someone';
  end if;

  -- Insert system message
  insert into public.chat_messages (competition_id, user_id, content, message_type)
  values (
    NEW.competition_id,
    NEW.user_id,
    v_display_name || ' joined the competition',
    'system'
  );

  return NEW;
end;
$$;

create trigger trg_chat_on_member_join
  after insert on public.competition_members
  for each row
  execute function public.chat_on_member_join();
