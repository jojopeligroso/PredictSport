# ADR 0004: Immutable standing snapshots

**Status:** Accepted
**Date:** 2026-05-20

## Context

Leaderboard standings can be computed live from prediction scores, but live recalculation is fragile: schema changes, scoring rule corrections, or data migrations can alter historical results. The tournament format requires authoritative standings at each finalisation point for archive display, audit trails, and dispute resolution.

## Decision

`classification_standings_snapshots` are immutable denormalised JSON records written after Prediction Window or Sporting Stage finalisation within a competition instance. They store the authoritative leaderboard state for one Classification at one finalisation point. Each instance produces its own snapshots independently, even when multiple instances share the same tournament blueprint and fixture results.

Snapshot types: `window`, `stage`, `final`, `correction`. Generation methods: `manual`, `automatic`, `correction`.

Each snapshot includes a `standings_data` JSONB array with rank, user_id, display_name, points, status, tie-break values, movement, elimination status, and metadata per Entrant.

## Rationale

- Immutable snapshots guarantee that historical standings survive schema evolution, scoring corrections, and code changes.
- Archive mode reads snapshots directly, removing Supabase dependency for static exports.
- Correction workflows create new `correction` snapshots rather than mutating old ones, preserving a full audit trail.
- Live recalculation remains available for validation and debugging but is never the authoritative record.

## Consequences

- Every finalisation event must write at least one snapshot per affected Classification.
- Correction workflows must create replacement snapshots and reference the previous snapshot for audit.
- Snapshots may grow large for competitions with many Entrants; the JSON is denormalised by design.
