-- Reputation Tags: member_tags table for storing computed tags per competition member.
-- Tags are computed by service-role RPCs and assigned as pending, then promoted to active.
-- Only service-role can write; members can read tags for their competition.

CREATE TABLE public.member_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.rounds(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  tag_name text NOT NULL,
  tag_variant text,
  tag_category text NOT NULL CHECK (tag_category IN ('behavioural', 'event_driven', 'engagement_pressure')),
  stats jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'suppressed', 'expired')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,
  suppressed_by uuid REFERENCES public.users(id),
  suppressed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(competition_id, user_id, round_id, tag_name)
);

-- Indexes
CREATE INDEX idx_member_tags_competition_status ON public.member_tags(competition_id, status);
CREATE INDEX idx_member_tags_user ON public.member_tags(user_id, competition_id);
CREATE INDEX idx_member_tags_round ON public.member_tags(round_id) WHERE round_id IS NOT NULL;

-- RLS
ALTER TABLE public.member_tags ENABLE ROW LEVEL SECURITY;

-- Members can read tags for their competition
CREATE POLICY "Members can view competition tags"
  ON public.member_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.competition_members cm
      WHERE cm.competition_id = member_tags.competition_id
      AND cm.user_id = auth.uid()
    )
  );

-- Only service-role can insert/update/delete (no anon-key writes)
-- No INSERT/UPDATE/DELETE policies for anon — service-role bypasses RLS
