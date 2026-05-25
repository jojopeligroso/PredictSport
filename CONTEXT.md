# Domain Glossary

This file is a glossary only. No implementation details, no specs, no decisions.
When a term here conflicts with how you're using it, stop and resolve the conflict first.

---

## Competition

An admin-defined prediction contest. Contains rounds, has a lifecycle (draft → active → completed → archived), and has members with roles.

---

## Round

An admin-defined grouping of events within a competition. Rounds can mix sports. A round has an authoring lifecycle: `draft → open → finalised → scored`. The lifecycle is about admin authoring, not about user prediction availability — predictions are gated per-[[Event]] by that event's `lock_time`, never by `round.status`.

---

## Finalised (Round status)

Admin authoring is complete: the round's structure (events, prediction types, points) is frozen as a design artefact. Distinct from "locked for predictions" — individual events in a finalised round can still accept predictions until their own `lock_time` passes. A [[Super Administrator]] or [[Competition Admin]] may unfinalise the round (return to `open`) only to edit events that have not yet started; events past their `lock_time` remain frozen. Renames the previous `locked` status, which was misleading.

---

## Event

A single fixture or occurrence that participants predict the outcome of. Belongs to a round. Has a sport, lock time, and one or more prediction types configured on it.

---

## Prediction Type

A mechanic through which participants predict an event outcome. Each type is configured as an `EventPredictionType` row with its own points value. Multiple types can exist on one event. The 10 types are: `winner`, `yes_no`, `head_to_head`, `top_n`, `final_standings`, `margin`, `over_under`, `handicap`, `progression`, `exact_score`.

---

## Winner Prediction

A prediction where the participant picks who wins an event from a set of options (or free text). For applicable sports, "Draw" is a valid option when `allow_draw` is enabled.

---

## Draw

A valid match outcome where neither side wins. A valid winner prediction option for sports where draws can occur (soccer, GAA, rugby regular season, etc.), when explicitly enabled by the admin on the event.

---

## Exact Score Prediction

A prediction where the participant predicts the final score of a match in sport-specific format. Always paired with a `winner` prediction on the same event — it cannot exist on an event without `winner`. The participant first picks the winner, then optionally flips the card to predict the exact score.

---

## Score Format

The sport-specific schema used to represent and compare exact scores. Auto-derived from the event's sport. Standard team sports use `{ home, away }` totals. GAA uses `{ home: { goals, points }, away: { goals, points } }`. Position-based sports (F1, horse racing, golf, tennis) do not have a score format and cannot have `exact_score` configured.

---

## Winner Derivation

The automatic process by which a participant's winner prediction is updated to match the result implied by their exact score submission. If the score implies a draw, the winner prediction is updated to "Draw" (requires `allow_draw: true` on the event). The participant is notified inline when this override occurs.

---

## Score Format — GAA

In GAA, a score is expressed as goals and points separately (e.g., 2-14), not as a single aggregate. A goal is worth 3 points in aggregate but is tracked independently. The canonical prediction and result format for GAA is `{ home: { goals, points }, away: { goals, points } }`.

---

## Provider Chain

The ordered sequence of sports data providers queried to fetch fixtures and results for a given sport. First non-null result wins. Providers: OpenF1, API-Football, TheSportsDB, ESPN, BallDontLie, MLB Stats, TheRacingAPI, Foireann, Manual.

---

## NormalizedResult

The canonical output shape of the provider chain. All providers normalise their API responses into this shape. Includes `score` (home/away totals), `positions` (for position-based sports), `winner`, `margin`, and `stats` (sport-specific breakdown, e.g., GAA goals/points).

---

## Manual Event

An event with no sports data provider coverage. Result and score must be entered by the admin at confirmation time. Covers local GAA clubs, niche competitions, and any event where the provider chain returns null.

---

## All-Competitions Dashboard

A cross-competition summary surface on `/competitions` that answers "how am I doing" across every competition a participant belongs to. Shows performance/standing per competition, with a conditional action prompt when a prediction is genuinely due. Not a per-competition leaderboard and not the personal predictions stats page.

---

## Standing

A participant's position and accumulated points within a single competition, derived from the `points_awarded` on their predictions. Always computed live by the leaderboard from prediction rows — there is no authoritative stored standing.

---

## Standings Cache

A best-effort, non-authoritative stored copy of competition standings (`competition_standings`), written after results are confirmed, carrying an `updated_at`. Read for speed by the All-Competitions Dashboard. The live leaderboard remains the source of truth; a missing or stale cache row triggers a live recompute, so the cache is never silently wrong.

---

## Global Hit Rate

A participant's aggregate prediction accuracy across all their competitions (group and personal combined) — distinct from the personal-predictions hit rate, which covers only the personal competition.

---

## Super Administrator

A platform-level role responsible for canonical tournament truth: confirming official fixture results, finalising windows/stages, maintaining tournament templates. Operates across all Prediction Games that share a tournament. Desktop-primary user. See ADR 0005.

---

## Competition Admin

The owner of a single Prediction Game. Manages invites, copy, and preset selection for their own game; cannot confirm official results or alter fixtures (those are [[Super Administrator]] actions). Mobile-first user — typically picks from a small set of presets rather than authoring rounds from scratch.

---

## Preset

A pre-built, ready-to-use bundle of rounds, events, and prediction-type configuration that a [[Competition Admin]] selects to set up their Prediction Game without authoring anything from scratch. Presets are authored by the [[Super Administrator]] and intentionally limited in variation.

---

## Dashboard State

A UI-level concept, never stored in the database. Computed from the user's auth session, bracket submission status, and [[Classification]] membership statuses to determine which dashboard layout the `/wc` surface shows. The states are: `visitor`, `bracket`, `format`, `overall`, and `archive`. No table, no column — a pure function of existing data.
