# PredictSport -- Terminology Contract

> Canonical terminology for the tournament-format feature. Use these terms consistently in code, documentation, UI copy, and conversation to avoid ambiguity between blueprints, instances, and real-world sporting events.

| Term | Definition |
|---|---|
| **Tournament Blueprint** | A reusable configuration from which competition instances are instantiated. Defines the fixture catalogue, sporting stages, classification definitions, scoring rule defaults, and bracket shape. A single blueprint can produce many independent competition instances. Stored across `sporting_tournaments`, `sporting_stages`, `bracket_templates`, and seed data. |
| **Competition Instance** | The joinable game that Entrants participate in. Each instance is instantiated from a tournament blueprint and has its own members, predictions, standings, and classification memberships. Backed by a `competitions` row. Multiple instances of the same blueprint can run concurrently. |
| **Prediction Game** | Synonym for Competition Instance in user-facing contexts. |
| **Sporting Tournament** | The real-world event being predicted (e.g., FIFA World Cup 2026). Part of the tournament blueprint. Stored in `sporting_tournaments`. |
| **Sporting Stage** | A phase within a Sporting Tournament (e.g., Group Stage, Round of 32, Final). Part of the tournament blueprint. Stored in `sporting_stages`. |
| **Fixture** | A real sporting match. Belongs to the tournament blueprint's fixture catalogue and is shared across all competition instances. Stored in `events`. Fixtures are not duplicated per instance; results confirmed on a fixture propagate to all instances that reference it. |
| **Fixture Catalogue** | The complete set of fixtures for a tournament blueprint. Exists once regardless of how many competition instances reference it. |
| **Prediction Window** | A lockable batch of Fixtures that Entrants predict before a lock time. Scoped to a competition instance. Maps to the `rounds` table in Phase 1. Multiple Prediction Windows may be open concurrently. |
| **Classification** | A concurrent scoring or survival path inside one competition instance. Each classification is instantiated from the tournament blueprint's classification definitions. Config is captured as an immutable snapshot at instantiation time. Phase 1 supports four types: Overall (leaderboard), Format Classification (format_elimination), Full Bracket Survivor (bracket_survivor), Knockout Bracket Survivor (bracket_survivor). |
| **Entrant** | An authenticated human participant who makes scored Picks within a competition instance. Backed by a `competition_members` row with per-Classification status tracked in `classification_memberships`. The same person can be an Entrant in multiple instances simultaneously. |
| **Pick** | An Entrant's prediction for a Fixture, scoped to their competition instance. Stored in `predictions`. |
| **Prediction Group** | A mini-leaderboard of Entrants within the Format Classification. Target size is 4. Stored in `format_prediction_groups`. Scoped to a competition instance. |
| **Product Shell** | A simplified branded deployment over shared PredictSport core logic. The World Cup 2026 shell shares the same codebase, schema, and backend. Controlled by the `NEXT_PUBLIC_PRODUCT_MODE` environment variable. In Phase 1, the shell deploys a single competition instance; the architecture supports multiple concurrent instances from the same blueprint. |
| **Super Administrator** | The app-level operator with authority over tournament blueprints, fixture result confirmation, result correction, finalisation, elimination triggers, and archive export. Fixture results are confirmed at the blueprint level and propagate to all active instances. |
| **Competition Admin** | A user-level administrator for a specific competition instance. Manages invites, presentation copy, entrant preset selection. Cannot confirm official results, finalise stages, or correct results for tournament competitions. |
| **Global Classification** | A platform-wide leaderboard that aggregates standings across all competition instances instantiated from the same tournament blueprint. Activates when total entrants across all instances exceed a threshold (e.g., 2,000). Phase 2. |
| **Auto-Provisioning** | The process of automatically instantiating a new competition instance from a tournament blueprint when the current instance reaches its entrant cap (`max_entrants`). Ensures new users are never rejected — they are placed into a new instance instead. |
| **Instantiate** | To create a new competition instance from a tournament blueprint. Implies repeatability: the blueprint persists and can produce additional instances. Preferred over "clone" (which implies a one-time copy) or "create" (which is ambiguous about the source). |

## Usage Notes

- Existing database table names (`competitions`, `rounds`, `events`, `predictions`) are not renamed in Phase 1. This document maps domain terminology onto the current schema.
- "Round" in the existing app is equivalent to "Prediction Window" in tournament context.
- "Event" in the existing app is equivalent to "Fixture" in tournament context.
- "Competition" in the existing app is equivalent to "Competition Instance" (or "Prediction Game") in tournament context. Bare "competition" should only be used when referring to the `competitions` DB table.
- **Blueprint vs. Instance rule:** Fixture results are confirmed once at the blueprint level (shared). Scoring, standings, and elimination are computed per instance. Result confirmation propagates to all active instances.
- **Phase 1 singleton note:** Phase 1 deploys a single competition instance per tournament blueprint. All docs that reference "the World Cup Prediction Game" (singular) describe Phase 1 behaviour. The architecture supports multiple concurrent instances.
