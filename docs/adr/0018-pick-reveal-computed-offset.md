# ADR 0018: Pick Reveal as Computed Offset, Not Stored Copy

**Status:** Accepted
**Date:** 2026-06-11

## Context

Rival Predictions requires a visibility gate: other participants' predictions should not be visible the instant lock_time passes. A 5-minute gap between lock and reveal prevents last-second gaming (submitting just before lock to see if others' picks leak immediately).

The `pick_reveal_at` column already existed on `events` as a nullable admin override (migration `20260507`). The question was how to establish the default: backfill every row with `lock_time + 5 minutes`, use a trigger to keep them in sync, or compute the default at query time.

## Decision

**Compute the default at query time.** When `pick_reveal_at IS NULL`, the RLS policy evaluates `now() >= lock_time + interval '5 minutes'`. The explicit `pick_reveal_at` column is reserved for admin overrides only.

No backfill. No trigger. No stored copy that can drift from `lock_time`.

The same logic is mirrored in the one server-side computation (`src/app/predictions/[eventId]/page.tsx`) that determines reveal state outside of RLS.

## Alternatives Considered

1. **Backfill + trigger**: Populate `pick_reveal_at` on every event and add an `ON INSERT/UPDATE` trigger to recompute when `lock_time` changes. Rejected — a synced copy is a bug waiting to happen. If `lock_time` shifts (admin reschedule, postponement), a missed trigger update silently breaks reveal timing.

2. **Blueprint-level offset config**: Store `pick_reveal_offset_minutes` on the tournament and join at query time. Rejected — adds a join to an RLS policy (performance cost), and the offset is unlikely to vary across tournaments. If it does, the admin override column handles it.

3. **Generated column**: PostgreSQL generated columns can only reference the same row, so `pick_reveal_at GENERATED ALWAYS AS (lock_time + interval '5 minutes')` would work mathematically but would remove the admin override capability.

## Consequences

- The 5-minute offset is hardcoded in two places: the RLS policy and `page.tsx`. If the offset ever needs to change, both must be updated. This is acceptable — it's a platform-level constant, not a per-competition setting.
- Admin overrides still work: setting `pick_reveal_at` explicitly bypasses the computed default.
- UI components that show a "picks reveal in X" countdown must compute the reveal time using the same logic: `pick_reveal_at ?? (lock_time + 5min)`.
