# ADR 0007: Prediction Window maps to Round in Phase 1

**Status:** Accepted
**Date:** 2026-05-20

## Context

The tournament format introduces the concept of a Prediction Window -- a lockable batch of Fixtures that Entrants predict before a lock time. The existing PredictSport schema already has a `rounds` table that groups events with a shared lock time. These concepts overlap significantly.

Creating a separate `prediction_windows` table would duplicate round-management logic, event grouping, lock-time enforcement, and status transitions.

## Decision

In Phase 1, a Prediction Window maps to the existing `rounds` table. New columns are added to `rounds`:

- `sporting_stage_id` -- links the round to a Sporting Stage.
- `prediction_window_number` -- ordering within a stage.
- `auto_lock_offset_minutes` -- minutes before first event to lock (default 1).

The existing round locking behaviour (all events lock at earliest fixture's start time) already matches the Prediction Window design. Multiple future Prediction Windows may be open simultaneously, each locking independently.

## Rationale

- Reusing `rounds` avoids duplicating locking logic, status transitions, event grouping, and RLS policies.
- The column additions are backward-compatible: existing non-tournament rounds have NULL `sporting_stage_id` and function as before.
- A dedicated `prediction_windows` table can be introduced in a future phase if the concepts diverge enough to justify it.

## Consequences

- Tournament competitions create `rounds` rows as Prediction Windows, linked to `sporting_stages` via the new FK.
- Existing round-based UI (The Round view) can render tournament Prediction Windows with a window selector overlay.
- Per-Fixture locking is deferred. Phase 1 uses window-level (round-level) locking only.
