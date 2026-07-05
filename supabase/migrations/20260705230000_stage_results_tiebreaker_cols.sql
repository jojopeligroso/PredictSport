-- Add tiebreaker columns to stage_results for cumulative overall tiebreaking.
-- These capture exact-score hits and outcome hits at each stage snapshot,
-- enabling the knockout elimination comparator to read cumulative stats
-- from the immutable stage_results table.

ALTER TABLE stage_results ADD COLUMN IF NOT EXISTS exact_hits integer NOT NULL DEFAULT 0;
ALTER TABLE stage_results ADD COLUMN IF NOT EXISTS outcome_hits integer NOT NULL DEFAULT 0;
