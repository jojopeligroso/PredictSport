-- Format Prediction Groups
-- Mini-leaderboard groups within the Format Classification.
-- Entrants are allocated into groups of ~4 for stage-local competition.

-- ============================================================
-- format_prediction_groups — mini-leaderboard groups
-- ============================================================

CREATE TABLE public.format_prediction_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id uuid NOT NULL REFERENCES public.classifications(id) ON DELETE CASCADE,
  competition_id uuid NOT NULL REFERENCES public.competitions(id),
  group_name text NOT NULL,
  group_number int NOT NULL,
  target_size int NOT NULL DEFAULT 4,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classification_id, group_number)
);

COMMENT ON TABLE public.format_prediction_groups IS
  'Prediction groups within Format Classification. Each group is a mini-leaderboard of ~4 entrants competing stage-by-stage.';

CREATE INDEX idx_format_groups_class ON public.format_prediction_groups(classification_id);

-- ============================================================
-- format_group_memberships — entrant assignment to groups
-- ============================================================

CREATE TABLE public.format_group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.format_prediction_groups(id) ON DELETE CASCADE,
  classification_id uuid NOT NULL REFERENCES public.classifications(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  seed_position int,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'qualified_top', 'qualified_third', 'eliminated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

COMMENT ON TABLE public.format_group_memberships IS
  'Assigns entrants to prediction groups. Status tracks progression through Format Classification stages.';
COMMENT ON COLUMN public.format_group_memberships.seed_position IS
  'Position within group after random draw. Nullable until draw is performed.';

CREATE INDEX idx_format_group_members_group ON public.format_group_memberships(group_id);
CREATE INDEX idx_format_group_members_class ON public.format_group_memberships(classification_id);
CREATE INDEX idx_format_group_members_user ON public.format_group_memberships(user_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.format_prediction_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.format_group_memberships ENABLE ROW LEVEL SECURITY;

-- Competition members can view groups and memberships
CREATE POLICY "Competition members can view format groups"
  ON public.format_prediction_groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competition_members
      WHERE competition_id = format_prediction_groups.competition_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Competition members can view format group memberships"
  ON public.format_group_memberships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classification_memberships
      WHERE classification_id = format_group_memberships.classification_id
        AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins and competition admins can manage groups
CREATE POLICY "Super admins can manage format groups"
  ON public.format_prediction_groups FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins can manage format group memberships"
  ON public.format_group_memberships FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Competition admins can manage groups before first window locks
CREATE POLICY "Competition admins can insert format groups"
  ON public.format_prediction_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competition_members
      WHERE competition_id = format_prediction_groups.competition_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'co_admin')
    )
  );

CREATE POLICY "Competition admins can insert format group memberships"
  ON public.format_group_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classifications c
      JOIN public.competition_members cm ON cm.competition_id = c.competition_id
      WHERE c.id = format_group_memberships.classification_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'co_admin')
    )
  );
