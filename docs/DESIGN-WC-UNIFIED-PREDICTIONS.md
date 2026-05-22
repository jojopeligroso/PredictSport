# Design — World Cup Unified Prediction Model

Status: **proposal** · Created 2026-05-22

## The requirement (user's words, restated)

A user must **never enter the same prediction twice**. The World Cup's three
classifications — **Bracket**, **Format**, **Overall** — are *views* over one
shared, progressively-built set of predictions.

- **Bracket** — deliberately low input. Group stage: pick **W/D/L** per match
  (home win / draw / away win), *not* scores. Scores are required **only** for
  matches involving teams that the user's own W/D/L picks have left **tied**,
  so standings (1st/2nd/3rd) and best-third ranking can be resolved. Knockouts:
  pick **who progresses** only.
- **Format & Overall** — need a predicted **score for every group match**. But
  collected **per matchday window**, never all at once: prediction window 1 =
  the 24 matchday-1 matches, window 2 = the 24 matchday-2 matches, window 3 =
  the 24 matchday-3 matches. This paces engagement and cuts cognitive load.
- **Carry-over** — any prediction already made is reused. A tiebreaker score
  entered in the Bracket pre-fills the windowed flow; a W/D/L (or score)
  entered in a window pre-fills the Bracket. Same underlying data, surfaced and
  completed progressively.

The Bracket must **not** demand all 72 group scores upfront.

## Current implementation — audit (2026-05-22)

| Requirement | Status | Evidence |
|---|---|---|
| Bracket group stage = W/D/L, not scores | ✅ Built | `GroupResultsStepV2`: `match.result` is W/D/L |
| Bracket: scores only for tiebreaker-tied matches | ✅ Built | `detectTiebreakers()` + `needsScore` + `TiebreakerResolutionPage` |
| Bracket: knockouts = progression only | ⚠️ Not built | `BracketWizardV2:191` — `alert('Knockout stages coming soon!')` |
| Format/Overall windowed score capture (24/24/24) | ❌ Not built | `/wc/picks/[windowId]` is read-only; nothing calls `/api/predictions` |
| One shared prediction store | ❌ Not built | Bracket → `bracket_prediction_submissions` (JSON blob); windows → `predictions` (rows); no bridge |
| Carry-over / pre-fill between systems | ❌ Not built | Consequence of two isolated stores |

**Conclusion:** the Bracket's group-stage UX matches the intent and works.
The unifying architecture — shared store, windowed capture, carry-over — does
not exist. The two systems are storage-isolated.

## Storage decision — per-event `predictions` is the single source of truth

Two models were considered:

- **Option A — per-event `predictions` rows as source of truth.** Group matches
  are `events`; every prediction is a `predictions` row. The Bracket wizard
  writes/reads these via an adapter; the windowed flow writes them natively.
- **Option B — `bracket_data` JSON blob as source of truth.** The windowed flow
  reads/writes into the blob.

**Chosen: Option A.** Rationale:

- The scoring engine (`src/lib/scoring.ts`) already scores `predictions` rows
  per event. The `overall` and `format` classifications score on per-event
  outcomes — Option A reuses the existing engine; Option B needs a second one.
- Carry-over becomes *structural*: both systems read/write the same
  `predictions` row keyed by `(user_id, event_id)`. No sync code, no copy —
  "no double entry" is guaranteed by the schema, not maintained by hand.
- The app-wide leaderboard aggregates `predictions`; WC group picks feed it
  for free. A blob is opaque to leaderboard aggregation.
- `/wc/picks` pages were already built against `events`.

Cost of Option A: an adapter converting between the wizard's `BracketData`
representation and per-event `predictions` rows. Contained and testable.

**Knockouts are the documented exception.** Progression / survivor predictions
do not fit the per-event model and stay in `bracket_data`. That is acceptable —
a knockout progression pick is a genuinely different kind of prediction from a
group-match score, and only the bracket classifications consume it.

## Target architecture

```
events (72 group matches, 3 per group per matchday)
  └── round_id → rounds (prediction window 1/2/3)
predictions  ← SINGLE SOURCE OF TRUTH for group-match predictions
  ├── written by the windowed pick UI (/wc/picks/[windowId])
  └── written by the Bracket wizard via the BracketData⇄predictions adapter
       - W/D/L pick           → predictions row, prediction_type='winner'
       - tiebreaker score     → same match, prediction_type='exact_score'
bracket_prediction_submissions.bracket_data  ← knockouts + champion only
```

- Bracket group step reads existing `predictions` for the user → pre-fills W/D/L.
- Windowed flow reads the same rows → pre-fills any score already entered
  (e.g. from a Bracket tiebreaker).
- A group match score entered in a window → satisfies a Bracket tiebreaker with
  no re-prompt.

## Build plan (phased — none of this is done yet)

- **U1 — Group fixture events.** Create the 72 group `events` (12 groups × 6
  matches), distributed across windows 1–3 by matchday (24 each), each with
  `winner` + `exact_score` `event_prediction_types`. Per CLAUDE.md manual-event
  checklist: `sport='soccer'`, `lock_time` before `start_time`,
  `config.options` = the two team names.
- **U2 — Windowed pick UI.** Build the interactive pick component for
  `/wc/picks/[windowId]` (currently read-only): W/D/L buttons + optional score,
  submitting to `/api/predictions`.
- **U3 — BracketData⇄predictions adapter.** Bracket wizard save fans out group
  W/D/L + tiebreaker scores to `predictions` rows; wizard load hydrates from
  them. Knockouts stay in `bracket_data`.
- **U4 — Carry-over wiring.** Both surfaces read existing `predictions` and
  pre-fill. Verify a tiebreaker score in the Bracket appears pre-filled in the
  window, and vice versa.
- **U5 — Complete the Bracket wizard knockouts.** Replace
  `alert('Knockout stages coming soon!')` with the knockout progression flow
  and real submission.
- **U6 — Elimination-curve recompute** (see WC-LAUNCH-FOLLOWUPS C5): regenerate
  the `format` classification curve from the actual entrant count once known.

U1 is *not* a standalone task — seeding events before U2/U3 produces fixtures
that advertise a pick UI that doesn't exist. U1–U4 ship together.

## Open questions for the user

- Window lifecycle: do matchday windows open/lock on a schedule (real fixture
  dates) or by admin action? Affects `rounds.deadline` / `events.lock_time`.
- Does predicting a window also count toward the Bracket's group stage, or only
  the reverse? (Design assumes fully bidirectional carry-over.)
