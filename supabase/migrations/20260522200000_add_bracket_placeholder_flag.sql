-- G4: Add bracket placeholder flag to events
-- Bracket placeholder events have TBA participants by design (e.g. "Winner of Match A vs Winner of Match B").
-- The TBA check is bypassed for these events.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_bracket_placeholder boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.is_bracket_placeholder IS 'True for bracket events with TBA participants by design. TBA validation is bypassed for these events.';
