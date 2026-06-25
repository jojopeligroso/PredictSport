-- Security audit remediation: CRITICAL + HIGH findings
-- C1: users UPDATE policy allows is_super_admin self-promotion
-- C2: competition_members INSERT policy allows role injection
-- C4: chat_messages INSERT policy allows fake system messages
-- H1: batch_score_predictions granted to authenticated (should be admin-only)
-- H2: claim_invite_use missing SET search_path and REVOKE FROM PUBLIC
-- H6: invite_tokens SELECT USING(true) — full dump by anyone
-- H9: 3 SECURITY DEFINER functions missing SET search_path

-- ============================================================
-- C1: Lock is_super_admin on users UPDATE
-- The existing policy "Users can update own profile" allows
-- any authenticated user to PATCH is_super_admin = true.
-- Fix: add WITH CHECK that prevents changing is_super_admin.
-- ============================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_super_admin IS NOT DISTINCT FROM (
      SELECT u.is_super_admin FROM public.users u WHERE u.id = auth.uid()
    )
  );

-- ============================================================
-- C2: Restrict competition_members INSERT to role='participant'
-- The existing policy allows any user to self-insert with any
-- role (admin, co_admin, mod). Fix: force role = 'participant'.
-- Admin self-inserts during competition creation now use the
-- service client, bypassing RLS.
-- ============================================================
DROP POLICY IF EXISTS "Users can join competitions" ON public.competition_members;
CREATE POLICY "Users can join competitions"
  ON public.competition_members FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'participant');

-- ============================================================
-- C4: Restrict chat_messages INSERT to message_type='user'
-- The existing policy allows any member to insert system_*
-- messages, spoofing tag reveals, results, etc.
-- Fix: force message_type = 'user'. System messages are only
-- inserted by SECURITY DEFINER triggers or service-role client.
-- ============================================================
DROP POLICY IF EXISTS "Members can send chat messages" ON public.chat_messages;
CREATE POLICY "Members can send chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND message_type = 'user'
    AND EXISTS (
      SELECT 1 FROM public.competition_members cm
      WHERE cm.competition_id = chat_messages.competition_id
        AND cm.user_id = auth.uid()
        AND (cm.chat_muted_until IS NULL OR cm.chat_muted_until < now())
    )
  );

-- ============================================================
-- H1: Revoke batch_score_predictions from authenticated
-- This RPC lets any authenticated user update prediction scores.
-- It should only be callable by the service role (admin routes).
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.batch_score_predictions(jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.batch_score_predictions(jsonb) FROM public;

-- ============================================================
-- H2: Fix claim_invite_use — add SET search_path, REVOKE FROM PUBLIC
-- This SECURITY DEFINER function has no search_path, making it
-- vulnerable to search_path hijacking.
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_invite_use(p_invite_id uuid)
RETURNS public.invite_tokens
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.invite_tokens
  SET use_count = use_count + 1
  WHERE id = p_invite_id
    AND (max_uses IS NULL OR use_count < max_uses)
  RETURNING *;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_invite_use(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_invite_use(uuid) TO authenticated;

-- ============================================================
-- H6: invite_tokens SELECT USING(true)
-- Kept as-is: restricting to members would break the join flow
-- where non-members look up tokens. The data (UUIDs + token
-- strings) is not sensitive enough to warrant the complexity
-- of routing all lookups through the service client. Revisit
-- when the app moves beyond friend-group scale.
-- ============================================================

-- ============================================================
-- H9: Add SET search_path to SECURITY DEFINER trigger functions
-- cleanup_dormant_accounts, chat_on_mod_promotion, chat_on_member_join
-- ============================================================

-- H9a: cleanup_dormant_accounts
CREATE OR REPLACE FUNCTION public.cleanup_dormant_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  dormant_id uuid;
  deleted_count integer := 0;
BEGIN
  FOR dormant_id IN
    SELECT au.id
    FROM auth.users au
    LEFT JOIN public.predictions p ON p.user_id = au.id
    LEFT JOIN public.competition_members cm ON cm.user_id = au.id
      AND cm.competition_id NOT IN (
        SELECT c.id FROM public.competitions c WHERE c.created_by = au.id AND c.type = 'personal'
      )
    WHERE au.created_at < now() - interval '10 days'
      AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at <= au.created_at + interval '1 minute')
      AND p.id IS NULL
      AND cm.id IS NULL
  LOOP
    DELETE FROM public.push_subscriptions WHERE user_id = dormant_id;
    DELETE FROM public.classification_memberships WHERE user_id = dormant_id;
    DELETE FROM public.competition_members WHERE user_id = dormant_id;
    DELETE FROM public.event_prediction_types WHERE event_id IN (
      SELECT id FROM public.events WHERE competition_id IN (
        SELECT id FROM public.competitions WHERE created_by = dormant_id AND type = 'personal'
      )
    );
    DELETE FROM public.events WHERE competition_id IN (
      SELECT id FROM public.competitions WHERE created_by = dormant_id AND type = 'personal'
    );
    DELETE FROM public.rounds WHERE competition_id IN (
      SELECT id FROM public.competitions WHERE created_by = dormant_id AND type = 'personal'
    );
    DELETE FROM public.competitions WHERE created_by = dormant_id AND type = 'personal';
    DELETE FROM public.users WHERE id = dormant_id;
    DELETE FROM auth.users WHERE id = dormant_id;
    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN deleted_count;
END;
$$;

-- H9b: chat_on_mod_promotion
CREATE OR REPLACE FUNCTION public.chat_on_mod_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_display_name text;
  v_chat_enabled boolean;
BEGIN
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

-- H9c: chat_on_member_join
CREATE OR REPLACE FUNCTION public.chat_on_member_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
