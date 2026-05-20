-- Extend existing tables for tournament support
-- Adds columns to competitions and rounds. Existing rows unaffected (all nullable).

-- ============================================================
-- competitions — tournament linkage + product mode + entry gate
-- ============================================================

ALTER TABLE public.competitions
  ADD COLUMN tournament_id uuid REFERENCES public.sporting_tournaments(id),
  ADD COLUMN product_mode text
    CHECK (product_mode IN ('predictsport_full', 'world_cup_2026_shell', 'world_cup_2026_archive')),
  ADD COLUMN entry_closes_at timestamptz,
  ADD COLUMN entry_close_trigger text;

COMMENT ON COLUMN public.competitions.tournament_id IS
  'Links competition to a real-world sporting tournament. Null for non-tournament competitions.';
COMMENT ON COLUMN public.competitions.product_mode IS
  'Controls which product shell serves this competition. Null = standard PredictSport.';
COMMENT ON COLUMN public.competitions.entry_closes_at IS
  'Hard deadline for new entrants. Null = no deadline.';
COMMENT ON COLUMN public.competitions.entry_close_trigger IS
  'Event-based entry close trigger (e.g. window_1_finalised). Evaluated at join time.';

-- ============================================================
-- rounds — sporting stage linkage + window ordering + auto-lock
-- ============================================================

ALTER TABLE public.rounds
  ADD COLUMN sporting_stage_id uuid REFERENCES public.sporting_stages(id),
  ADD COLUMN prediction_window_number int,
  ADD COLUMN auto_lock_offset_minutes int DEFAULT 1;

COMMENT ON COLUMN public.rounds.sporting_stage_id IS
  'Links prediction window to a sporting stage. Multiple windows can map to one stage.';
COMMENT ON COLUMN public.rounds.prediction_window_number IS
  'Ordering within a stage. E.g. Group Matchday 1 = window 1, GM2 = window 2.';
COMMENT ON COLUMN public.rounds.auto_lock_offset_minutes IS
  'Minutes before first event in window to auto-lock. Default 1.';

-- Add FK for classification_memberships.eliminated_window_id → rounds
-- (Deferred from 20260521100000 since rounds extension happens here)
ALTER TABLE public.classification_memberships
  ADD CONSTRAINT fk_eliminated_window
  FOREIGN KEY (eliminated_window_id) REFERENCES public.rounds(id);
