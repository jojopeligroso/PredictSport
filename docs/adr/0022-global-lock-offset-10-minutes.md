# ADR 0022: Global Lock Offset — 10 Minutes Before Event Start

**Status:** Accepted
**Date:** 2026-07-11
**Deciders:** Eoin

## Context

Predictions lock before each fixture's start time to prevent last-second changes
after lineups or conditions are known. The original implementation used a 30-minute
offset, but this was inconsistent: some surfaces used 5, 10, or 30 minutes.

Commit `9c7b7e5` (2026-07-04) standardised to 10 minutes across 6 files and a
migration, but missed `create-world-cup-competition.ts` which hardcoded
`lock_default_minutes: 30`. This caused 8 knockout events (QF/SF/Finals) created
after the migration to inherit the stale 30-minute default via the admin UI.

## Decision

**All events lock 10 minutes before `start_time` by default.** This applies globally
to every competition on the platform unless explicitly overridden at the blueprint
or instance level.

### Where the default is enforced

| Layer | File | Mechanism |
|-------|------|-----------|
| DB schema | `initial_schema.sql` | Column default `start_time - interval '10 minutes'` |
| DB migration | `20260611200000_per_fixture_lock_times.sql` | Backfill existing events |
| Seed script | `seed-wc2026-group-events.ts` | `LOCK_OFFSET_MIN = 10` |
| WC template | `wc2026-template.ts` | `lockOffsetMinutes: 10` |
| Competition creation | `create-world-cup-competition.ts` | `lock_default_minutes: 10` |
| Daily lock utility | `daily-lock.ts` | `LOCK_OFFSET_MINUTES = 10` |
| Admin UI | `CreateCompetitionForm.tsx` | Default form value |
| Admin UI | `RoundBuilder.tsx` | Fallback offset |
| Ingest script | `ingest-fixtures.ts` | Offset constant |
| Nominations API | `nominations/route.ts` | Offset constant |

### Override mechanism

Blueprints and competition instances store `lock_default_minutes` on their row.
The admin UI reads this value to auto-compute `lock_time` for new events. To use
a different offset for a specific competition, update `lock_default_minutes` on
that competition's row. Individual events can also have `lock_time` set manually.

## Consequences

- Users get maximum prediction time — 10 minutes is enough to prevent post-lineup
  gaming while not locking people out unnecessarily early.
- The admin UI auto-computes lock times from this default, reducing manual error.
- Any new competition creation path must set `lock_default_minutes: 10` or inherit
  from the blueprint. Hardcoding a different value without updating the competition
  row will cause the same drift that produced this ADR.
