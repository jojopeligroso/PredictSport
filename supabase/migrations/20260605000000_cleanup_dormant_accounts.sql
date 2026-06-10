-- Automatically delete accounts that signed up but never returned
-- Criteria: 10+ days old, never signed in after creation, no predictions, no group competition memberships

CREATE OR REPLACE FUNCTION cleanup_dormant_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  dormant_id uuid;
  deleted_count integer := 0;
BEGIN
  FOR dormant_id IN
    SELECT au.id
    FROM auth.users au
    LEFT JOIN predictions p ON p.user_id = au.id
    LEFT JOIN competition_members cm ON cm.user_id = au.id
      AND cm.competition_id NOT IN (
        SELECT c.id FROM competitions c WHERE c.created_by = au.id AND c.type = 'personal'
      )
    WHERE au.created_at < now() - interval '10 days'
      AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at <= au.created_at + interval '1 minute')
      AND p.id IS NULL
      AND cm.id IS NULL
  LOOP
    DELETE FROM push_subscriptions WHERE user_id = dormant_id;
    DELETE FROM classification_memberships WHERE user_id = dormant_id;
    DELETE FROM competition_members WHERE user_id = dormant_id;
    DELETE FROM event_prediction_types WHERE event_id IN (
      SELECT id FROM events WHERE competition_id IN (
        SELECT id FROM competitions WHERE created_by = dormant_id AND type = 'personal'
      )
    );
    DELETE FROM events WHERE competition_id IN (
      SELECT id FROM competitions WHERE created_by = dormant_id AND type = 'personal'
    );
    DELETE FROM rounds WHERE competition_id IN (
      SELECT id FROM competitions WHERE created_by = dormant_id AND type = 'personal'
    );
    DELETE FROM competitions WHERE created_by = dormant_id AND type = 'personal';
    DELETE FROM public.users WHERE id = dormant_id;
    DELETE FROM auth.users WHERE id = dormant_id;
    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN deleted_count;
END;
$$;

-- Run daily at 3 AM UTC
SELECT cron.schedule('cleanup-dormant-accounts', '0 3 * * *', 'SELECT cleanup_dormant_accounts()');
