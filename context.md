# PredictSport -- Terminology Contract

> Canonical terminology for the tournament-format feature. Use these terms consistently in code, documentation, UI copy, and conversation to avoid ambiguity between the app-level game and the real-world sporting event.

| Term | Definition |
|---|---|
| **Prediction Game** | The app-level game that Entrants join. A Prediction Game is backed by a `competitions` row and contains one or more Classifications. |
| **Sporting Tournament** | The real-world event being predicted (e.g., FIFA World Cup 2026). Stored in `sporting_tournaments`. |
| **Sporting Stage** | A phase within a Sporting Tournament (e.g., Group Stage, Round of 32, Final). Stored in `sporting_stages`. |
| **Prediction Window** | A lockable batch of Fixtures that Entrants predict before a lock time. Maps to the `rounds` table in Phase 1. Multiple Prediction Windows may be open concurrently. |
| **Classification** | A concurrent scoring or survival path inside one Prediction Game. Phase 1 supports four types: Overall (leaderboard), Format Classification (format_elimination), Full Bracket Survivor (bracket_survivor), Knockout Bracket Survivor (bracket_survivor). |
| **Entrant** | An authenticated human participant who makes scored Picks within a Prediction Game. Backed by a `competition_members` row with per-Classification status tracked in `classification_memberships`. |
| **Fixture** | A real sporting match. Stored in `events`. |
| **Pick** | An Entrant's prediction for a Fixture. Stored in `predictions`. |
| **Prediction Group** | A mini-leaderboard of Entrants within the Format Classification. Target size is 4. Stored in `format_prediction_groups`. |
| **Product Shell** | A simplified branded deployment over shared PredictSport core logic. The World Cup 2026 shell shares the same codebase, schema, and backend. Controlled by the `NEXT_PUBLIC_PRODUCT_MODE` environment variable. |
| **Super Administrator** | The app-level operator with authority over official templates, result confirmation, result correction, finalisation, elimination triggers, and archive export. |
| **Competition Admin** | A user-level administrator for a specific Prediction Game. Manages invites, presentation copy, entrant preset selection. Cannot confirm official results, finalise stages, or correct results for tournament competitions. |

## Usage Notes

- Existing database table names (`competitions`, `rounds`, `events`, `predictions`) are not renamed in Phase 1. This document maps domain terminology onto the current schema.
- "Round" in the existing app is equivalent to "Prediction Window" in tournament context.
- "Event" in the existing app is equivalent to "Fixture" in tournament context.
- "Competition" in the existing app is equivalent to "Prediction Game" in tournament context.
