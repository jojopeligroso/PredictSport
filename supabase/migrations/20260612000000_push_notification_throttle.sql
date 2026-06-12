-- Migration: push_notification_throttle
--
-- Supports push notification throttling logic:
--   - Daily cap of 10 notifications per user
--   - Quiet hours enforcement using per-user IANA timezone
--   - Per-event deduplication via tag and event_id
--
-- Only the service role writes to push_notification_log.
-- Regular users can read their own rows for debugging/transparency.

-- ------------------------------------------------------------
-- 1. Timezone column on users
-- ------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT NULL;

COMMENT ON COLUMN users.timezone IS
  'IANA timezone string (e.g. Europe/Dublin, America/New_York). '
  'Used for quiet hours enforcement in push notification throttling.';

-- ------------------------------------------------------------
-- 2. Push notification log table
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS push_notification_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   TEXT        NOT NULL,  -- e.g. 'prediction_reminders', 'result_notifications'
  event_id   UUID        REFERENCES events(id) ON DELETE SET NULL,  -- nullable; used for per-event dedup
  tag        TEXT,                  -- matches the Web Push notification tag for client-side dedup
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE push_notification_log IS
  'Audit log of every push notification dispatched. '
  'Used to enforce daily caps, quiet hours, and per-event deduplication. '
  'Written exclusively by the service role.';

COMMENT ON COLUMN push_notification_log.category IS
  'Logical notification category, e.g. prediction_reminders or result_notifications.';

COMMENT ON COLUMN push_notification_log.event_id IS
  'References the event this notification relates to. NULL for non-event notifications. '
  'Used with category to prevent duplicate notifications for the same event.';

COMMENT ON COLUMN push_notification_log.tag IS
  'Web Push notification tag. Matches the tag sent in the push payload for browser-level dedup.';

-- ------------------------------------------------------------
-- 3. Indexes
-- ------------------------------------------------------------

-- Daily cap queries: count rows per user within a UTC day window
CREATE INDEX IF NOT EXISTS idx_push_log_user_day
  ON push_notification_log (user_id, sent_at);

-- Per-event dedup: check if a notification for this user+event+category was already sent
CREATE INDEX IF NOT EXISTS idx_push_log_dedup
  ON push_notification_log (user_id, event_id, category)
  WHERE event_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4. Row-level security
-- ------------------------------------------------------------

ALTER TABLE push_notification_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification history.
-- Service role bypasses RLS entirely, so no explicit service role policy is needed.
CREATE POLICY "users_select_own_push_log"
  ON push_notification_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT / UPDATE / DELETE policies for authenticated users.
-- All writes come from server-side functions using the service role key.
