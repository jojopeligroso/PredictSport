# ADR 0017: Tournament Blueprint as Factory — Shared Fixture Catalogue with Instance-Scoped Aggregates

**Status:** Accepted
**Date:** 2026-06-10
**Supersedes:** Singleton assumption in all prior ADRs (qualified with Phase 1 notes)
**Resolves:** ADR 0009 (Standalone Knockout Surface)

## Context

The tournament system was designed as a multi-instance architecture (a Tournament Blueprint producing N Competition Instances) but implemented as a singleton: one `competitions` row, fixtures bound to it via `events.competition_id NOT NULL`, no mechanism to instantiate a second instance. A vocabulary audit (see `docs/WC-TERMINOLOGY-CONTRACT.md`) corrected the documentation; this ADR corrects the architecture.

The core domain model is:

- **Tournament Blueprint** — a Factory (in the GoF sense) that encapsulates the fixture catalogue, stage topology, classification definitions, scoring rule defaults, and bracket shape. Immutable once the tournament is live. Produces Competition Instances on demand.
- **Fixture Catalogue** — shared reference Entities owned by the Blueprint, not by any Instance. A Fixture (an `events` row) represents a real-world match. Results are confirmed once at the catalogue level; all Instances observe the same confirmed state by reading the same row. No fan-out, no event-driven propagation — shared state by reference.
- **Competition Instance** — an independent Aggregate instantiated from a Blueprint. Owns its own members, predictions, standings, classification memberships, prediction groups, and chat. Multiple Instances of the same Blueprint run concurrently with no shared mutable state between them.
- **Prediction** — a Value Object scoped to a single Instance. FKs to the shared Fixture (via `event_prediction_type_id` → `events.id`) but belongs to exactly one Instance via `competition_members.competition_id`.
- **Global Classification** — a cross-Aggregate read-model projection. Computes a platform-wide leaderboard by aggregating prediction scores across all Instances that share a common Blueprint origin. Implemented as a computed view, not a materialised table.

## Decision

### 1. Fixture Ownership: `tournament_id` column on `events`

Add `tournament_id uuid REFERENCES sporting_tournaments(id)` to the `events` table. World Cup fixtures are tagged `tournament_id = WC2026_TOURNAMENT_ID`. Instance-to-fixture resolution is derived: an Instance's fixtures are all events sharing its Blueprint's `tournament_id`.

Rejected alternative: a junction table (`instance_fixtures`) providing explicit per-Instance fixture linking. Unnecessary because fixture subsets are derivable from stage membership (see Instance Types below). A junction table adds write-path complexity and a mandatory join with no expressiveness gain for this domain.

### 2. Instance Types via Stage Scope

A single Blueprint produces multiple Instance types differentiated by stage scope:

- **Full Instance:** all stages (Group Matchday 1 through Final). All classifications enabled.
- **Knockout-Only Instance:** stages R32, R16, QF, SF, Final only. Reduced classification set (Overall + Knockout Bracket). This resolves ADR 0009 — the standalone knockout surface is simply an Instance with a narrower stage filter instantiated from the same Blueprint.

The Instance stores its type as `instance_type: 'full' | 'knockout_only'` (or equivalent `enabled_stages` array in competition config). Fixture queries filter: `WHERE tournament_id = :blueprint AND sporting_stage_id IN (:instance_stages)`.

### 3. Shared Rounds and Event Prediction Types

Rounds (Prediction Windows) and `event_prediction_types` are Blueprint-level shared reference data:

- **Rounds** gain a `tournament_id` column. All Instances of a Blueprint share the same 8 prediction windows with identical lock times (derived from real-world kick-off times). `competition_id` becomes nullable — NULL means "belongs to Blueprint, shared across Instances."
- **Event Prediction Types** are shared from the Blueprint. Scoring rules (points, partial points, config) are defined once. Instances do not override per-fixture scoring. The Blueprint's `scoring_rules` are authoritative.

### 4. Result Propagation: Shared-State-by-Reference

No propagation mechanism exists or is needed. All Instances read the same `events` rows. When the Super Administrator confirms a result (`result_data`, `result_confirmed = true`) on a Fixture, every Instance observes it on next read. Scoring recalculation is triggered per-Instance by the confirmation action (existing `confirm-result` endpoint fans out to each Instance's standing computation), but the source of truth is a single shared row.

Instances created after a result is confirmed see the confirmed state immediately — no backfill required.

### 5. Auto-Provisioning

When `max_entrants` is reached on all active full Instances of a Blueprint and a new user attempts to join:

1. System instantiates a new Competition Instance (Active state, all Blueprint defaults, no Competition Admin assigned).
2. New user is placed into the new Instance.
3. Super Administrator is notified (push + system flag).
4. UI displays "Waiting for 8 players" until `min_entrants` threshold is met. The Instance is Active and joinable; predictions are accepted immediately.
5. No human approval gate — fully automatic.

The join route (`/api/join`) is modified: instead of returning 403 "Competition is full," it calls the instantiation Factory, creates the Instance, and completes the join in one request.

### 6. Global Classification: Computed View

Implemented as a PostgreSQL view (not a materialised table):

```sql
CREATE VIEW global_classification AS
SELECT p.user_id, SUM(p.points_awarded) AS total_points
FROM predictions p
JOIN events e ON e.id = p.event_id
WHERE e.tournament_id = :blueprint_id
GROUP BY p.user_id
ORDER BY total_points DESC;
```

Activates when total distinct entrants across all Blueprint Instances exceed 2,000. Users may opt out via `users.notification_prefs`. Opted-out users appear anonymised. No write path, no cache invalidation — recomputed on read. If performance degrades at scale, upgrade to a materialised view with periodic refresh; the interface remains identical.

### 7. Public Instance Defaults

Auto-provisioned public Instances inherit:
- **Chat:** disabled by default. If enabled and any message is reported, chat is immediately and permanently closed for that Instance (no moderation workflow).
- **Admin:** none. Super Administrator owns all public tournament Instances. The Competition Admin role applies only to user-created private events.

### 8. Migration Path

**Phase 1 — Additive, zero-risk (deploy immediately):**
- `ALTER TABLE events ADD COLUMN tournament_id uuid REFERENCES sporting_tournaments(id);`
- `ALTER TABLE rounds ADD COLUMN tournament_id uuid REFERENCES sporting_tournaments(id);`
- `UPDATE events SET tournament_id = 'a0000000-...-000000000026' WHERE competition_id = <live_instance>;`
- `UPDATE rounds SET tournament_id = 'a0000000-...-000000000026' WHERE competition_id = <live_instance>;`

No existing queries, RLS policies, or application code are affected. The column is nullable and unused by the application until Phase 2.

**Phase 2 — Structural (deploy before R32, ~June 27):**
- `ALTER TABLE events ALTER COLUMN competition_id DROP NOT NULL;`
- `ALTER TABLE rounds ALTER COLUMN competition_id DROP NOT NULL;`
- `UPDATE events SET competition_id = NULL WHERE tournament_id IS NOT NULL;`
- `UPDATE rounds SET competition_id = NULL WHERE tournament_id IS NOT NULL;`
- Update RLS policies: replace `events.competition_id` checks with `tournament_id`-based membership resolution (user is member of any Instance sharing this Blueprint).
- Drop or modify the `enforce_event_competition_consistency` trigger.
- Wire auto-provisioning in `/api/join`.
- Add `instance_type` / `enabled_stages` to competition config.
- Create the Global Classification view.

**Invariant:** No prediction row is touched in either phase. All existing predictions remain intact, queryable, and correctly linked to their fixtures via `event_prediction_type_id`. Users experience zero disruption.

## Consequences

- The `events` table becomes a shared fixture catalogue for tournament competitions. Non-tournament competitions (personal, custom) continue to use `competition_id` as before.
- ADR 0009 is resolved: the standalone knockout surface is an Instance with `instance_type = 'knockout_only'`, not a new abstraction.
- The Super Administrator confirms results once. Scoring fans out per-Instance but reads a single authoritative fixture row.
- Auto-provisioning means no user is ever rejected from a public tournament — capacity scales by instantiation, not by raising caps.
- Phase 2 RLS changes are the highest-risk item. They must be tested against a branch database before deploying to production.
- Day-by-day fixture creation (adding Group Matchday 2 events after Matchday 1 concludes) is unaffected and simplified: create the fixture with `tournament_id` set, assign to the correct round — all Instances see it immediately.
