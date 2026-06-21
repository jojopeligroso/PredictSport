# ADR 0020: Reputation Tag Architecture — Postgres RPC, Preview Window, Density Control

**Status:** Accepted
**Date:** 2026-06-21

## Context

The platform needs a reputation/tag system that assigns data-driven labels to competition members based on prediction behaviour (behavioural tags) and specific in-game moments (event-driven tags). The spec (REPUTATION_COPY_SPEC.md) defines 25+ tags across two categories, a rejection mechanic, admin suppression, and density controls.

Three architectural questions needed resolution:

1. **Where does tag computation run?** Options: Next.js API route with JS aggregation, Supabase Edge Function, or Postgres RPC.
2. **How do admins get oversight?** Options: real-time approval (admin must approve each tag), preview window (admin has N hours to suppress), or no oversight (system auto-publishes).
3. **How is tag density controlled?** Options: hard cap (top N only), guideline with threshold tightening, or no cap.

## Decision

### Computation: Postgres RPC

Tag metrics (contrarian_pct, avg_total_goals, repeat_score_count, prediction_changes, majority_pct, engagement_rate, submission_timing, accuracy) are pure SQL aggregations over the predictions table. A Postgres RPC:

- Runs atomically after result confirmation
- Avoids the 1,000-row PostgREST truncation problem
- Keeps aggregation close to the data (no round-trip)
- Returns a bounded result set (one row per member)

The API route (`/api/admin/confirm-result`) calls the RPC after scoring.

### Storage: `member_tags` table

New table: `member_tags(id, competition_id, user_id, round_id, tag_name, tag_variant, tag_category, stats JSONB, status, assigned_at, published_at, rejected_at, suppressed_by)`.

- `status`: `pending` → `active` → `rejected` | `suppressed` | `expired`
- `tag_category`: `behavioural` | `event_driven` | `engagement_pressure`
- `stats`: the specific metrics that earned the tag (for Data Fact Card rendering)
- History preserved — all past tags queryable per member

### Preview Window: 6–8 hours

Tags are computed and stored as `pending`. Admin receives a notification. After the preview window expires (configurable, default 6 hours), pending tags auto-publish (`status` → `active`) and chat announcements fire. Admin can suppress during the window.

Event-driven tags (Nailed It, Giant Killer, etc.) bypass the preview window — they fire immediately on result confirmation because they're moment-specific and time-sensitive.

### Density: Guideline + Hard Cap

- Target density: 20–40% of members tagged
- Hard cap: 50% (never exceeded)
- Method: compute all qualifying tags, rank by priority tier (Maverick > Anorak > individual behavioural > Dead Centre), then by z-score deviation within tier. Award until density target is met. If still above 50% after tightening, truncate at 50%.
- Vision: 100+ tags in catalogue, 12–15 active per competition at any time

### Rejection: Phase 1 safe copy only

Phase 1 ships only non-offensive tag names and copy. No edgier variants. Rejection is a social declaration ("I don't want this tag") that fires a chat message — it does NOT hide the data or prevent future tags. Engagement pressure tags (Ghost, NPT) have no rejection mechanic.

Phase 2 introduces edgier variants with human review gate.

## Consequences

- RPC must be maintained alongside the scoring engine — both touch prediction data
- Preview window adds 6-hour latency to tag visibility (acceptable for behavioural; event-driven tags bypass)
- Admin notification system is a new surface (can piggyback on existing push notification infra)
- Density control requires the RPC to return all qualifying candidates, not just winners — the API route handles truncation
