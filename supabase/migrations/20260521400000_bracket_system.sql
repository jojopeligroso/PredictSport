-- Bracket System
-- Reusable bracket templates and per-user bracket prediction submissions.

-- ============================================================
-- bracket_templates — reusable bracket shapes
-- ============================================================

CREATE TABLE public.bracket_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  name text NOT NULL,
  sport text NOT NULL,
  bracket_type text NOT NULL
    CHECK (bracket_type IN ('single_elimination', 'double_elimination', 'group_plus_knockout')),
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bracket_templates IS
  'Reusable bracket shape definitions. Config contains groups, knockout slots, advancement rules, best-third allocation matrix.';
COMMENT ON COLUMN public.bracket_templates.config IS
  'Full bracket structure: groups[], knockoutRounds[], bestThirdConfig?, thirdPlacePlayoff.';

-- ============================================================
-- bracket_prediction_submissions — user bracket picks
-- ============================================================

CREATE TABLE public.bracket_prediction_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id),
  classification_id uuid NOT NULL REFERENCES public.classifications(id),
  bracket_template_id uuid NOT NULL REFERENCES public.bracket_templates(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  version_number int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'locked', 'superseded')),
  bracket_data jsonb NOT NULL,
  submitted_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bracket_prediction_submissions IS
  'User bracket predictions. bracket_data contains groupRankings, bestThirdPicks, knockoutPicks, champion, thirdPlace.';
COMMENT ON COLUMN public.bracket_prediction_submissions.version_number IS
  'Incremented on each re-submission before lock. Only latest non-superseded version is active.';

CREATE INDEX idx_bracket_subs_competition ON public.bracket_prediction_submissions(competition_id);
CREATE INDEX idx_bracket_subs_classification ON public.bracket_prediction_submissions(classification_id);
CREATE INDEX idx_bracket_subs_user ON public.bracket_prediction_submissions(user_id);
CREATE INDEX idx_bracket_subs_status ON public.bracket_prediction_submissions(status);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.bracket_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracket_prediction_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view templates
CREATE POLICY "Authenticated users can view bracket templates"
  ON public.bracket_templates FOR SELECT
  TO authenticated
  USING (true);

-- Super admins can manage templates
CREATE POLICY "Super admins can manage bracket templates"
  ON public.bracket_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Users can view and manage their own bracket submissions (before lock)
CREATE POLICY "Users can view own bracket submissions"
  ON public.bracket_prediction_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own bracket submissions"
  ON public.bracket_prediction_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.competition_members
      WHERE competition_id = bracket_prediction_submissions.competition_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own draft bracket submissions"
  ON public.bracket_prediction_submissions FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status IN ('draft', 'submitted')
  );

-- Competition members can view locked submissions (after reveal time)
CREATE POLICY "Competition members can view locked bracket submissions"
  ON public.bracket_prediction_submissions FOR SELECT
  TO authenticated
  USING (
    status = 'locked'
    AND EXISTS (
      SELECT 1 FROM public.competition_members
      WHERE competition_id = bracket_prediction_submissions.competition_id
        AND user_id = auth.uid()
    )
  );

-- Super admins can manage all submissions
CREATE POLICY "Super admins can manage bracket submissions"
  ON public.bracket_prediction_submissions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );
