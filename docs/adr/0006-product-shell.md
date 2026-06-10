# ADR 0006: Product Shell over shared logic

**Status:** Accepted
**Date:** 2026-05-20

## Context

The World Cup 2026 feature needs a simplified, branded entry point for users who only care about the World Cup prediction game. This could be built as a separate codebase, a forked branch, or a product mode within the existing application.

## Decision

The World Cup 2026 shell is a Product Shell -- a branded deployment that shares all business logic, schema, and backend with the main PredictSport application. It is not a forked rules engine.

Three product modes: `predictsport_full` (default), `world_cup_2026_shell`, `world_cup_2026_archive`. Controlled by the `NEXT_PUBLIC_PRODUCT_MODE` environment variable.

Deployment: one shared GitHub repo, two Vercel projects pointing to the same Supabase backend. The shell hides unrelated routes and redirects unsupported paths to the World Cup home page.

World Cup specificity belongs in: the tournament blueprint (scoring rules, classification definitions, bracket shape, fixture catalogue), product mode configuration, adapter logic, seeded schedule data, branded shell copy and routing.

World Cup specificity must not be hard-coded into: generic bracket engine, generic Classification persistence, generic leaderboard calculations, generic result finalisation jobs, generic Prediction Window locking logic. These generic systems must support multiple concurrent competition instances instantiated from the same tournament blueprint.

In Phase 1, the shell deploys a single competition instance. The architecture supports multiple concurrent instances from the same tournament blueprint, with auto-provisioning when an instance reaches its entrant cap.

## Rationale

- A shared codebase avoids feature divergence and double maintenance.
- Product mode gating is a simple environment variable check, not a build-time fork.
- After the tournament, `world_cup_2026_archive` mode serves static exports without Supabase dependency, preventing breakage as the main app evolves.

## Consequences

- No World Cup-only tables (e.g., `world_cup_2026_predictions`). All tables are reusable tournament-format tables.
- Middleware must gate routes based on product mode.
- Navigation components must conditionally render based on product mode.
- Archive mode must export static JSON and static pages before the main app schema evolves post-tournament.
- The fixture catalogue is shared across all competition instances. Fixtures are not duplicated per instance.
