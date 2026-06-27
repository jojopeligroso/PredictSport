-- FE-A3: Add 'finalisation' to member_tags tag_category CHECK constraint
-- This enables tags computed during format elimination finalisation.

-- Drop the existing CHECK constraint and recreate with the new value.
-- The constraint was created inline in the CREATE TABLE statement, so
-- PostgreSQL auto-named it. We find and drop it by name.
ALTER TABLE public.member_tags
  DROP CONSTRAINT member_tags_tag_category_check;

ALTER TABLE public.member_tags
  ADD CONSTRAINT member_tags_tag_category_check
  CHECK (tag_category IN ('behavioural', 'event_driven', 'engagement_pressure', 'finalisation'));
