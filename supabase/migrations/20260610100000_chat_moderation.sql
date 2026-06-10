-- Chat Moderation: mod role, mute, tiered deletes, mod promotion system message

-- 1. Add 'mod' to competition_members.role
ALTER TABLE public.competition_members
  DROP CONSTRAINT IF EXISTS competition_members_role_check;
ALTER TABLE public.competition_members
  ADD CONSTRAINT competition_members_role_check
  CHECK (role IN ('admin', 'co_admin', 'mod', 'participant'));

-- 2. Add chat_muted_until to competition_members
ALTER TABLE public.competition_members
  ADD COLUMN IF NOT EXISTS chat_muted_until timestamptz;

-- 3. Update deleted_by constraint on chat_messages to include 'mod'
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_deleted_by_check;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_deleted_by_check
  CHECK (deleted_by IN ('user', 'mod', 'admin'));

-- 4. Update hard-delete grace window from 10s to 20s
DROP POLICY IF EXISTS "Authors can hard-delete recent messages" ON public.chat_messages;
CREATE POLICY "Authors can hard-delete recent messages"
  ON public.chat_messages FOR DELETE
  USING (
    auth.uid() = user_id
    AND created_at > now() - interval '20 seconds'
  );

-- 5. Remove admin hard-delete policy (admins now always soft-delete via UPDATE)
DROP POLICY IF EXISTS "Admins can hard-delete chat messages" ON public.chat_messages;

-- 6. Update INSERT policy to enforce mute
DROP POLICY IF EXISTS "Members can send chat messages" ON public.chat_messages;
CREATE POLICY "Members can send chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.competition_members cm
      WHERE cm.competition_id = chat_messages.competition_id
        AND cm.user_id = auth.uid()
        AND (cm.chat_muted_until IS NULL OR cm.chat_muted_until < now())
    )
  );

-- 7. Add mod-level UPDATE policy for soft-deletes
-- Mods can update (soft-delete) messages from participants only
CREATE POLICY "Mods can update lower-role chat messages"
  ON public.chat_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.competition_members cm_mod
      WHERE cm_mod.competition_id = chat_messages.competition_id
        AND cm_mod.user_id = auth.uid()
        AND cm_mod.role = 'mod'
    )
    AND EXISTS (
      SELECT 1 FROM public.competition_members cm_target
      WHERE cm_target.competition_id = chat_messages.competition_id
        AND cm_target.user_id = chat_messages.user_id
        AND cm_target.role = 'participant'
    )
  );

-- 8. System message trigger for mod promotion
CREATE OR REPLACE FUNCTION public.chat_on_mod_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_display_name text;
  v_chat_enabled boolean;
BEGIN
  -- Only fire when role changes TO 'mod'
  IF NEW.role = 'mod' AND (OLD.role IS DISTINCT FROM 'mod') THEN
    SELECT chat_enabled INTO v_chat_enabled
    FROM public.competitions WHERE id = NEW.competition_id;

    IF NOT v_chat_enabled THEN RETURN NEW; END IF;

    SELECT display_name INTO v_display_name
    FROM public.users WHERE id = NEW.user_id;

    INSERT INTO public.chat_messages (competition_id, user_id, content, message_type)
    VALUES (
      NEW.competition_id,
      NEW.user_id,
      COALESCE(v_display_name, 'Someone') || ' is now a moderator',
      'system'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_on_mod_promotion
  AFTER UPDATE OF role ON public.competition_members
  FOR EACH ROW
  EXECUTE FUNCTION public.chat_on_mod_promotion();
