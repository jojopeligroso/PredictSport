# Prediction Types & Scoring Specification

## Prediction Types

All six types are in scope for MVP. The admin selects which type(s) apply when creating each event.

| Type | Description | Example | Scoring |
|------|-------------|---------|---------|
| Winner | Pick the outright winner | "Who wins the US Masters?" | Configurable points (default 10) |
| Top N Finish | Pick someone to finish in top N | "Top 5 at The Masters?" | Configurable; partial credit possible |
| Head to Head | Pick which of two finishes higher | "Verstappen vs Hamilton?" | Configurable points |
| Margin of Victory | Predict winning margin in a range | "Ireland win by 1-7 points?" | Exact range = full points; adjacent range = partial |
| Over / Under | Predict whether a metric exceeds a threshold | "Over 2.5 goals?" | Configurable points |
| Beat the Handicap | Predict whether a team covers the spread | "Leinster -12.5 vs Munster?" | Configurable points |

The admin (or API data) sets the line/threshold for margin, over/under, and handicap types.

## Scoring System

Scoring is configurable per competition, not hardcoded:

- **Points per prediction type** are set by the competition admin at creation
- **Partial credit rules** are configurable (on/off, and how much)
- **Preset templates** available for quick setup:
  - *Classic Quiz* — 10pts correct, 20pts dual questions, 10pts partial (mirrors the PDF format)
  - *Tournament* — 10pts winner, 5pts top 5, 3pts top 10
  - *Weekly Fixtures* — 3pts correct result, 1pt correct draw
  - *Head to Head Series* — 5pts per correct H2H, bonus for clean sweep
  - *Custom* — admin defines everything
- **No negative points** (confirmed from existing format)
- **Tiebreaker:** One numeric prediction per competition (e.g. "Total goals in the World Cup"). Closest to actual value wins. Used only when total points are tied.
- **Scoring rules are immutable after competition starts.** Clone competition to change.

## Open Scoring Questions (TBD)

- Exact partial credit formula for margin-of-victory predictions
- Whether multiple prediction types can stack on a single event (e.g. both "Winner" and "Margin")
- Full tiebreaker ordering when multiple users have same distance from correct value
