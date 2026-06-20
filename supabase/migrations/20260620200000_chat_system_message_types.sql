-- Expand chat_messages to support system messages with distinct types and nullable user_id.
--
-- Previously:
--   - message_type CHECK only allowed 'user' | 'system'
--   - user_id was NOT NULL
--   - Result-confirmed inserts used message_type='system_result' and user_id=NULL, both silently failing
--   - Join trigger used message_type='system' — need 'system_join' for filtering
--
-- After this migration:
--   - message_type allows: 'user', 'system', 'system_join', 'system_result'
--   - user_id is nullable (NULL for bot/system messages with no sender)
--   - Join trigger updated to use 'system_join' for proper filtering
--   - Mod promotion trigger updated similarly

-- 1. Expand message_type CHECK constraint
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type IN ('user', 'system', 'system_join', 'system_result'));

-- 2. Make user_id nullable for system messages
ALTER TABLE public.chat_messages
  ALTER COLUMN user_id DROP NOT NULL;

-- 3. RLS: system messages with null user_id need to be readable.
-- The existing SELECT policy checks cm.user_id = auth.uid() on competition_members,
-- not chat_messages.user_id, so null user_id on chat_messages is fine for reads.
-- The INSERT policy checks auth.uid() = user_id, which blocks null inserts via
-- anon key (correct — only service-role should insert system messages).

-- 4. Update join trigger to use 'system_join' message_type
CREATE OR REPLACE FUNCTION public.chat_on_member_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_display_name text;
  v_chat_enabled boolean;
BEGIN
  SELECT chat_enabled INTO v_chat_enabled
  FROM public.competitions
  WHERE id = NEW.competition_id;

  IF NOT v_chat_enabled THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_display_name
  FROM public.users
  WHERE id = NEW.user_id;

  IF coalesce(v_display_name, '') = '' THEN
    v_display_name := 'Someone';
  END IF;

  INSERT INTO public.chat_messages (competition_id, user_id, content, message_type)
  VALUES (
    NEW.competition_id,
    NEW.user_id,
    v_display_name || ' joined the competition',
    'system_join'
  );

  RETURN NEW;
END;
$$;

-- 5. Update mod promotion trigger to use 'system' (unchanged — kept as 'system')
-- No change needed, promotion messages should remain visible in dashboard chat card.
