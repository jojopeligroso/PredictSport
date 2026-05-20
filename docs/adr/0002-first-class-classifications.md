# ADR 0002: First-class Classification entities

**Status:** Accepted
**Date:** 2026-05-20

## Context

The existing PredictSport data model tracks Entrant status at the competition level via `competition_members`. The World Cup 2026 feature requires four concurrent scoring/survival paths (Overall, Format Classification, Full Bracket Survivor, Knockout Bracket Survivor) inside a single Prediction Game. An Entrant may be active in one Classification while eliminated or dead in another.

Representing this with flags or status arrays on `competition_members` would create brittle multi-column logic that does not generalise beyond four Classifications.

## Decision

Classifications are first-class backend entities with their own tables:

- `classifications` -- one row per Classification per Prediction Game.
- `classification_memberships` -- one row per Entrant per Classification, tracking individual status (`active`, `eliminated`, `dead`, `winner`, `withdrawn`).
- `classification_standings_snapshots` -- immutable finalised standings per Classification per finalisation point.
- `classification_events` -- maps which Events/Prediction Windows count for each Classification.

Entrant status is never inferred from `competition_members` alone. Each Classification owns its own scoring strategy, elimination strategy, config snapshot, membership, and standings history.

## Rationale

- Entrant status per Classification eliminates cross-contamination (e.g., Format elimination does not affect Overall or Bracket Survivor status).
- The schema generalises to future Classification types without schema changes.
- Classification config is an immutable snapshot cloned from template data, preserving commercial trust and archive integrity.

## Consequences

- All leaderboard queries must be scoped to a specific Classification.
- Enrollment creates one `classification_memberships` row per active Classification, not just one `competition_members` row.
- Template updates do not silently alter running competitions. A Super Administrator migration is required to propagate changes.
