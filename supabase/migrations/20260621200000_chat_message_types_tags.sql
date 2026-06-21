-- Expand chat_messages to support tag-related system message types and add metadata column.
--
-- New message types:
--   system_tag_reveal   — a tag is revealed to the group
--   system_tag_change   — a tag status changes (e.g. suppressed)
--   system_tag_reject   — a tag is rejected by admin
--   system_round_summary — end-of-round tag summary
--
-- metadata column: structured JSONB payload for tag stats, references, etc.

-- 1. Expand message_type CHECK to include tag-related types
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type IN (
    'user', 'system', 'system_join', 'system_result', 'system_reckons',
    'system_tag_reveal', 'system_tag_change', 'system_tag_reject', 'system_round_summary'
  ));

-- 2. Allow NULL user_id for new system message types
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_user_id_required;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_user_id_required
  CHECK (
    user_id IS NOT NULL
    OR message_type IN (
      'system_result',
      'system_tag_reveal', 'system_tag_change', 'system_tag_reject', 'system_round_summary'
    )
  );

-- 3. Add metadata column for structured data (tag stats, etc.)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;
