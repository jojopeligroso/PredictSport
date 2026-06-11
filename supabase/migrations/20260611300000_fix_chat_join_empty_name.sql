-- Fix: chat_on_member_join trigger treats empty string display_name as valid,
-- producing " joined the competition" messages with no name.
-- New check: coalesce(v_display_name, '') = '' catches both null AND empty string.

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

  if coalesce(v_display_name, '') = '' then
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
