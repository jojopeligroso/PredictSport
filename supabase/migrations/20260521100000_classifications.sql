-- Classifications & Memberships
-- A classification is a scoring/survival path within a prediction game.
-- E.g. Overall leaderboard, Format elimination, Full Bracket survivor.

-- ============================================================
-- classifications — scoring path within a competition
-- ============================================================

CREATE TABLE public.classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  classification_key text NOT NULL,
  classification_type text NOT NULL
    CHECK (classification_type IN ('leaderboard', 'format_elimination', 'bracket_survivor')),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'finalised', 'archived')),
  scoring_strategy jsonb NOT NULL DEFAULT '{}',
  elimination_strategy jsonb,
  config jsonb NOT NULL DEFAULT '{}',
  source_template_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, classification_key)
);

COMMENT ON TABLE public.classifications IS
  'Scoring/survival path within a prediction game. A competition can have multiple concurrent classifications.';
COMMENT ON COLUMN public.classifications.classification_key IS
  'Unique key within competition: overall, format, full_bracket, knockout_bracket.';
COMMENT ON COLUMN public.classifications.scoring_strategy IS
  'Immutable snapshot of scoring rules at competition creation time.';
COMMENT ON COLUMN public.classifications.elimination_strategy IS
  'Only for format_elimination/bracket_survivor types. Defines elimination curve or survival rules.';
COMMENT ON COLUMN public.classifications.config IS
  'Immutable template config snapshot. Later template changes do not affect existing competitions.';

CREATE INDEX idx_classifications_competition ON public.classifications(competition_id);

-- ============================================================
-- classification_memberships — per-entrant per-classification
-- ============================================================

CREATE TABLE public.classification_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id uuid NOT NULL REFERENCES public.classifications(id) ON DELETE CASCADE,
  competition_id uuid NOT NULL REFERENCES public.competitions(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'eliminated', 'dead', 'winner', 'withdrawn')),
  entered_at timestamptz NOT NULL DEFAULT now(),
  eliminated_at timestamptz,
  eliminated_window_id uuid,
  eliminated_stage_id uuid REFERENCES public.sporting_stages(id),
  elimination_reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classification_id, user_id)
);

COMMENT ON TABLE public.classification_memberships IS
  'Tracks each entrant''s status within each classification. Active until eliminated, dead, or winner.';
COMMENT ON COLUMN public.classification_memberships.eliminated_window_id IS
  'The prediction window (round) where elimination occurred. FK added after rounds extension.';

CREATE INDEX idx_classification_memberships_class ON public.classification_memberships(classification_id);
CREATE INDEX idx_classification_memberships_user ON public.classification_memberships(user_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_memberships ENABLE ROW LEVEL SECURITY;

-- Competition members can view classifications
CREATE POLICY "Competition members can view classifications"
  ON public.classifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competition_members
      WHERE competition_id = classifications.competition_id
        AND user_id = auth.uid()
    )
  );

-- Super admins can manage classifications
CREATE POLICY "Super admins can insert classifications"
  ON public.classifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins can update classifications"
  ON public.classifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Competition members can view all memberships in their competition
CREATE POLICY "Competition members can view classification memberships"
  ON public.classification_memberships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competition_members
      WHERE competition_id = classification_memberships.competition_id
        AND user_id = auth.uid()
    )
  );

-- Super admins can manage memberships
CREATE POLICY "Super admins can insert classification memberships"
  ON public.classification_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins can update classification memberships"
  ON public.classification_memberships FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Users can insert their own memberships (joining a classification)
CREATE POLICY "Users can join classifications"
  ON public.classification_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.competition_members
      WHERE competition_id = classification_memberships.competition_id
        AND user_id = auth.uid()
    )
  );
