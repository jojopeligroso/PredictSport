# Domain Glossary

This file is a glossary only. No implementation details, no specs, no decisions.
When a term here conflicts with how you're using it, stop and resolve the conflict first.

---

## Competition

An admin-defined prediction contest. Contains rounds, has a lifecycle (draft → active → completed → archived), and has members with roles.

---

## Round

An admin-defined grouping of events within a competition. Rounds can mix sports. All events in a round lock at the earliest fixture start time in that round.

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
