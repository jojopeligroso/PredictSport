-- Fix engagement_rate: use COUNT(DISTINCT event_id) instead of COUNT(*)
-- COUNT(*) double-counted events with multiple prediction types (winner + exact_score),
-- producing engagement rates above 100% (e.g. Brian at 147%).
-- See compute_reputation_stats — basic_counts now has events_predicted column.

-- Migration applied via MCP apply_migration (same SQL as the CREATE OR REPLACE above).
-- This file exists for local migration history only.
