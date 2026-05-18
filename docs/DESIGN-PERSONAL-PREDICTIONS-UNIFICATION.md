# Personal Predictions Unification — Design Session

**Date:** 2026-05-17
**Status:** Design complete (2026-05-18) — ready for implementation

## Problem Statement

Personal Predictions and Competition Predictions are diverging in code and UX despite being conceptually similar. Two independent fixture browsers (1,360 LOC vs 600 LOC), duplicated `determineIsCorrect()` logic, and the personal side lacks scoring, multi-prediction-type support, and rounds.

## Key Decision: Unify on the Competition Model

Personal Predictions becomes a **solo competition** where the user is both admin and sole participant. Same backend tables (`competitions`, `events`, `event_prediction_types`, `predictions`), same scoring engine, same UX patterns.

## Decisions Made

### 1. Architecture

| Decision | Detail |
|----------|--------|
| Personal Predictions = solo competition | One competition per user, forever. All sports, all time. |
| No rounds in personal | Flat event stream. `round_id` stays null. Filtering is a UI concern. |
| Events created on-the-fly | Tap fixture → system creates event + event_prediction_types + prediction atomically. No pre-population. |
| Design for unified model now | Don't build more on the legacy `personal_predictions` table. |

### 2. Prediction Types & Defaults

| Decision | Detail |
|----------|--------|
| Smart defaults per sport | Auto-assign sensible prediction types (winner + exact_score for team sports, winner for races). |
| Secondary pills for extras | 2-3 sport-appropriate pills shown (e.g. "Correct Score", "Over/Under"), expandable for more. |
| Familiar terminology | Use bookmaker/fantasy language: "Correct Score", "Winning Margin", "Over/Under", "Spread", "H2H", "Prop Bet", "Top 3", "To Qualify", "Outright Winner". |
| Format-aware defaults | Defaults vary by format within a sport (Test cricket: home/draw/away; T20: home/away; F1 sprint vs GP vs quali have different options). Requires fixture metadata (separate task). |

### 3. Outrights (Tournament Predictions)

| Decision | Detail |
|----------|--------|
| UX: Outrights tab + contextual card | Dedicated "Outrights" tab for canonical view. Contextual card appears in Fixtures tab when browsing a specific league. |
| User-initiated creation | First time browsing a league, contextual card prompts "Who wins X?" Tapping creates the outright. |
| Inferred suggestions | Outrights tab has secondary section: tournaments you've predicted fixtures in but haven't made an outright pick for. Dismissable or promotable. |
| Change rules (Personal) | Freely editable before tournament starts. After start: timestamped, history shown, max 2 changes during (3 total budget). UX discourages flipping. |
| Change rules (Competition) | One and done. Locked at round lock / competition start. |

### 4. Scoring

| Decision | Detail |
|----------|--------|
| No scoring for personal | Personal predictions are for tracking intent, not points. `scoring_rules = '{}'` on the personal competition row satisfies the NOT NULL constraint. Hidden entirely from UI. |
| `event_prediction_types.points` | Store `points=0` as sentinel for personal events. No display. |

### 5. Migration Path

| Decision | Detail |
|----------|--------|
| Migrate (Option A) | Convert all existing `personal_predictions` rows into the unified model. Drop legacy table after migration. |
| Migration maps | Each row → one `events` row (keyed by `external_event_id`) + one or two `event_prediction_types` rows (infer `winner`; add `exact_score` if `score_prediction` was set) + one or two `predictions` rows. All attached to the user's personal competition. |
| No dual-write period | Clean cutover. Migration script runs once, legacy table dropped. |

### 6. Outright Resolution

| Decision | Detail |
|----------|--------|
| Preferred: provider data (C) | Use API season/competition status field to detect tournament conclusion. |
| Fallback: inferred from fixtures (B) | Detect when all fixtures in a league/season have results → auto-resolve. |
| Last resort: manual (A) | Admin marks outright resolved. Avoid — target is ≤1 admin action/month. |

### 7. Inferred Tournament Suggestions

| Decision | Detail |
|----------|--------|
| Trigger threshold | 3+ fixture picks in the same league = show "Who wins X?" suggestion card. |
| Dismissal | User can dismiss. Resurfaces when they reach 10 total picks in that league. |

### 8. Dashboard

| Decision | Detail |
|----------|--------|
| Navigation | Three tabs: `[Fixtures]` `[Outrights]` `[Dashboard]` |
| Customisable widgets | Full drag-and-drop widget customisation via "Customise" button. |
| Default widget order | 1. Recent picks (last 5, super-compact single card, expandable dropdown) → 2. Summary strip (lifetime: total picks, % correct, current streak, best streak) → 3. By year/season → 4. By sport (hit rate per sport) → 5. By league (drill-down within sport) |
| My Favourite Team | Opt-in widget. Prompted at signup. Shows pick history + upcoming fixtures for that team. |
| Locked default | Until drag-and-drop is implemented, the above order is the fixed default. |

## Related Tasks

- **Fixture metadata (competition stage/phase)** — Separate task. Required for format-aware defaults and auto-detecting tournament structure. ESPN already returns round/season data that we discard.
- **Schema Normalisation Audit** — Identified during design session. `predictions` should FK to `event_prediction_types` not store `(event_id, prediction_type)` as text. See `todos.md`.
- **My Favourite Team at signup** — Requires a new field on `users` (or `users.notification_prefs` JSONB) and an onboarding prompt at first login.

## Architecture Comparison

```
CURRENT (diverged):
  personal_predictions (flat, 1 row per fixture, no types/scoring)
  vs
  events → event_prediction_types → predictions (normalised, scored)

UNIFIED (target):
  competitions (one "personal" per user)
    → events (created on-the-fly when user predicts)
      → event_prediction_types (smart defaults per sport/format)
        → predictions (same table as competition predictions)
```

## Terminology Mapping

| Internal type | Pill label | Notes |
|---|---|---|
| winner | (default, no pill) | home/draw/away or home/away depending on sport/format |
| exact_score | "Correct Score" | Team sports only |
| margin | "Winning Margin" | Team sports, boxing |
| over_under | "Over/Under" | Goals/points total |
| handicap | "Spread" / "Handicap" | Team sports |
| head_to_head | "H2H" | Race sports, matchups |
| yes_no | "Prop Bet" | Context-specific labels |
| top_n | "Top 3" / "Podium" | Race sports, golf |
| progression | "To Qualify" | Knockout tournaments |
| final_standings | "Outright Winner" | Tournaments, leagues |
