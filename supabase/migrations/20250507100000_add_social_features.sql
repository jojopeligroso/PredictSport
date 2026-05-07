-- Social features: pick notes, emoji reactions, callout labels

-- 1. Pick notes (attached to predictions)
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS note_text text;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS note_visibility text DEFAULT 'public';
ALTER TABLE predictions ADD CONSTRAINT predictions_note_visibility_check
  CHECK (note_visibility IN ('public', 'private'));

-- 2. Callout labels per competition member
ALTER TABLE competition_members ADD COLUMN IF NOT EXISTS callout_label text;

-- 3. Emoji reactions on predictions
CREATE TABLE IF NOT EXISTS prediction_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (prediction_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE prediction_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for prediction_reactions
-- Members of the competition can read reactions on predictions in their competition
CREATE POLICY "Members can read reactions" ON prediction_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM predictions p
      JOIN events e ON e.id = p.event_id
      WHERE p.id = prediction_reactions.prediction_id
      AND public.is_competition_member(e.competition_id)
    )
  );

-- Authenticated users can add reactions to predictions in their competitions
CREATE POLICY "Members can add reactions" ON prediction_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM predictions p
      JOIN events e ON e.id = p.event_id
      WHERE p.id = prediction_reactions.prediction_id
      AND public.is_competition_member(e.competition_id)
    )
  );

-- Users can delete their own reactions
CREATE POLICY "Users can delete own reactions" ON prediction_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Index for fast lookup by prediction
CREATE INDEX IF NOT EXISTS idx_prediction_reactions_prediction_id
  ON prediction_reactions(prediction_id);
