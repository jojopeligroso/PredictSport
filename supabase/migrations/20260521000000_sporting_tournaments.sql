-- Sporting Tournaments & Stages
-- Real-world tournaments that prediction games can be built around.
-- Reusable across any sport — not World Cup-specific.

-- ============================================================
-- sporting_tournaments — real-world tournament being predicted
-- ============================================================

CREATE TABLE public.sporting_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  sport text NOT NULL,
  template_key text UNIQUE,
  config jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'completed', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sporting_tournaments IS
  'Real-world sporting tournament (e.g. FIFA World Cup 2026). Prediction games reference this.';
COMMENT ON COLUMN public.sporting_tournaments.template_key IS
  'Unique key for bracket/seed templates (e.g. fifa_world_cup_2026).';
COMMENT ON COLUMN public.sporting_tournaments.config IS
  'Tournament-level settings: team count, format rules, etc.';

-- ============================================================
-- sporting_stages — phases of a real tournament
-- ============================================================

CREATE TABLE public.sporting_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.sporting_tournaments(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  stage_order int NOT NULL,
  stage_type text NOT NULL CHECK (stage_type IN ('group', 'knockout')),
  config jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'finalised')),
  finalised_at timestamptz,
  finalised_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, slug)
);

COMMENT ON TABLE public.sporting_stages IS
  'Phase of a sporting tournament (e.g. Group Matchday 1, Round of 32, Final).';
COMMENT ON COLUMN public.sporting_stages.stage_order IS
  'Ordering within tournament. Lower = earlier.';
COMMENT ON COLUMN public.sporting_stages.stage_type IS
  'group = round-robin phase, knockout = elimination phase.';

CREATE INDEX idx_sporting_stages_tournament ON public.sporting_stages(tournament_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.sporting_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sporting_stages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read tournaments and stages
CREATE POLICY "Authenticated users can view tournaments"
  ON public.sporting_tournaments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view stages"
  ON public.sporting_stages FOR SELECT
  TO authenticated
  USING (true);

-- Super admins can manage tournaments
CREATE POLICY "Super admins can insert tournaments"
  ON public.sporting_tournaments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins can update tournaments"
  ON public.sporting_tournaments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Super admins can manage stages
CREATE POLICY "Super admins can insert stages"
  ON public.sporting_stages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins can update stages"
  ON public.sporting_stages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
  );
