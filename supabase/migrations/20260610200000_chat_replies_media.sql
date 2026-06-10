-- Chat Replies & Media: inline replies, image/GIF uploads, storage bucket

-- 1. Add reply_to_id for inline replies
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to
  ON public.chat_messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- 2. Add media columns
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'gif'));

-- 3. Relax content constraint: allow empty content when media is attached
-- Drop existing check and re-add with media awareness
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_content_check;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_content_check
  CHECK (
    char_length(content) <= 2000
    AND (char_length(content) >= 1 OR media_url IS NOT NULL)
  );

-- 4. Create storage bucket for chat media (public read, authenticated upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  5242880, -- 5MB
  '{image/jpeg,image/png,image/gif,image/webp}'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage RLS: authenticated users can upload to their own subfolder
-- Path format: competitionId/userId/timestamp.ext
CREATE POLICY "Users can upload chat media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Anyone can view chat media (bucket is public)
CREATE POLICY "Public read chat media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chat-media');

-- Users can delete their own chat media
CREATE POLICY "Users can delete own chat media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
