# Design — World Cup Unified Prediction Model

Status: **accepted** · Created 2026-05-22 · Ratified by build (U0–U2 shipped;
storage decision locked by the user 2026-05-22). Supersedes the group-by-group
capture flow and the winner-only knockout framing in
`DESIGN-WC-H1-FULL-BRACKET.md` (which remains valid as the Bracket view).

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

## Decisions locked (from the user, 2026-05-22)

- **Storage:** Option A — per-event `predictions` is the single source of truth.
- **Window lifecycle:** schedule-based logic is *built* (real fixture dates,
  see `WC2026-OFFICIAL-FIXTURES.md`), driven by a cron job — but **admin
  control is the default** to avoid hitting Vercel Hobby cron limits. A
  **superadmin-only manual override** can open/lock any window for **all** WC
  competitions.
- **Carry-over:** **one-way, Bracket → windows.** A score entered in the Bracket
  (tiebreaker) pre-fills the matching matchday window. Window picks do NOT flow
  back into the Bracket. (Simpler; the cost is a user who picks windows first
  could re-enter in the Bracket — accepted.)

## Build plan (phased — file-level)

> **Progress (2026-05-22):** U0 ✅ done · U1 ✅ done · U2–U7 pending.

### U0 — Correct the placeholder group data  ✅ DONE (2026-05-22)
The codebase has **three inconsistent placeholder versions** of the WC groups,
none matching the real Dec-2025 draw (verified data in
`WC2026-OFFICIAL-FIXTURES.md`):
- `bracket_templates` DB row (migration `20260522000000_seed_wc2026_tournament.sql`)
- `WC2026_GROUPS` in `src/lib/bracket/adapters/fifa-world-cup-2026.ts`
- the bracket wizard (imports the adapter constant)

What was done:
1. ✅ `WC2026_GROUPS` in the adapter rewritten to the official 12 groups.
2. ✅ Migration `20260522300000_correct_wc2026_groups.sql` — updated
   `bracket_templates.config.groups`. (`r32Seeding`/`bestThirdConfig` are
   letter-keyed placeholders, unaffected — separate pre-existing TODO.)
3. ✅ Verified zero `bracket_prediction_submissions` rows — no user data
   referenced the placeholders.
4. ⚠️ Not yet visually verified that the bracket wizard renders the corrected
   groups — do this in the next session (load `/wc/bracket/wizard`).

The second WC adapter (`src/lib/tournament/bracket/adapters/`) holds only
structural group config (count/teamsPerGroup), no team names — nothing to fix.

### U1 — Group fixture events  ✅ DONE (2026-05-22)
Created the **72 group `events`** (12 groups × 6, 24 per matchday window) for
the World Cup competition, each with `winner` (2pts, `config.options`) +
`exact_score` (3pts) `event_prediction_types`. Times in UTC, `lock_time` =
kickoff − 30min, `sport='soccer'`, `external_event_id` = `wc2026-grp-{G}-md{N}-{n}`.
Idempotent seed script + fixture data committed (`scripts/seed-wc2026-group-events.ts`,
`scripts/wc2026-group-fixtures.ts`); this run applied via Supabase MCP.

⚠️ The events exist but are **not yet pickable** — `/wc/picks/[windowId]` is
still read-only (U2). They will show as fixtures with no working pick control
until U2 ships.
- `competition_id` = the World Cup competition.
- `round_id` = the matchday window (`rounds` rows already exist, 1–3).
- `sport='soccer'`, `start_time` from fixtures doc (UK→UTC −1h),
  `lock_time = start_time − 30min`, `status='upcoming'`.
- Best done as an idempotent seed script keyed on a stable `external_event_id`
  (e.g. `wc2026-A-md1-mex-rsa`) so it can be re-run safely.

### U2 — Windowed pick UI
`/wc/picks/[windowId]` is currently read-only. Build an interactive client
component (new file, e.g. `WindowPickList.tsx`) rendering each event with
W/D/L buttons + optional exact-score input, submitting to the existing
`POST /api/predictions`. Respect `events.lock_time` and window `status`.
Reuse `PickButton` / `ExactScoreInput` from the general app.

### U3 — BracketData→predictions adapter (one-way write)
On bracket wizard save (`/api/bracket/checkpoint` + `/api/bracket/submit`),
fan out group-stage W/D/L + tiebreaker scores into `predictions` rows
(`prediction_type='winner'`, and `'exact_score'` where a score exists), keyed
`(user_id, event_id)`. Knockouts + champion stay in `bracket_data`. The
windowed flow then reads those rows for pre-fill (U4). One-way only.

### U4 — Carry-over (Bracket → windows)
The U2 windowed UI reads existing `predictions` for the user+window and
pre-fills any value already written by U3. Verify: a tiebreaker score entered
in the Bracket shows pre-filled in its matchday window.

### The "after extra time" rule (global — applies to ALL score predictions)

**A score / result prediction is the score after extra time, excluding
penalties.** A match decided by a penalty shootout is predicted *and recorded*
as a **Draw** (the score it stood at when extra time ended); the team that
won the shootout is captured separately as the **advancing team**, never as
the match result.

Rationale — this is what the data actually gives us. Verified 2026-05-22
against the ESPN `soccer/fifa.world` API on the 2022 final
(Argentina 3-3 France, Argentina won on penalties): the provider returns
`score` = `3` / `3` (the drawn result), `shootoutScore` = `4` / `2` (a
*separate* field), and `winner` = `true`/`false` (the advancing team, derived).
So "draw + separate advancing team" is not a modelling choice imposed on the
data — it is the shape the data arrives in. Recording a knockout result is
therefore an ordinary `exact_score` (the drawn score); **no AET/penalties
prediction type is needed** and the scoring engine needs no change.

Group matches never reach extra time, so for them the rule is simply "the
final score". The rule matters only at the knockout stage but is stated
globally so result-confirmation is unambiguous everywhere.

### U5 — Complete the Bracket wizard knockouts
Replace `BracketWizardV2.tsx:191` `alert('Knockout stages coming soon!')` with
the knockout progression flow (`KnockoutStagePredictor` exists) and wire real
submission to `/api/bracket/submit`. Extend `BracketWizardV2` — do **not**
create a new wizard component.

**Knockout prediction has two views — the same split as a group match.**
There is no contradiction with `DESIGN-WC-H1-FULL-BRACKET.md`: that doc's
"winner" means *advancing team*, which is correct for Bracket.

- **Bracket classification** — the **advancing team** only: exactly one team
  progresses (a drawn match still advances one team via the shootout). Stored
  in the `bracket_data` blob. This is the locked exception to the per-event
  model. `KnockoutStagePredictor` already produces exactly this.
- **Overall & Format classifications** — the **90+ET result + exact score**:
  `winner` (Home win / Draw / Away win) + `exact_score`, identical in shape to
  a group-match prediction. Per the "after extra time" rule above, a shootout
  match is a **Draw** here. Stored as per-event `predictions` rows — scored by
  the existing engine, **no second scoring path** (this is the whole point of
  the Option A storage decision).

So the two views never fight: *advancing team* (never a draw, → blob) and
*90+ET result* (can be a draw, → `predictions` rows) are genuinely different
quantities. The method (AET vs penalties) is neither predicted nor needed — it
is implied (a Draw result + a named advancing team ⇒ decided after 90+ET).

### U5b — Knockout events for Overall/Format

For the 90+ET result to score via `predictions` rows, knockout matches must
exist as `events` (in the `rounds` for R32–Finals, which already exist as
`status='draft'`). Knockout fixtures are not known until the group stage
finishes — so they are **not** hand-seeded with placeholder teams. They are
created from the ESPN `soccer/fifa.world` provider once teams resolve (the
same fixture-fetch pattern the app already uses elsewhere). Once those events
exist, the **U2 `WindowPickList` component renders them verbatim** —
`winner` (H/D/A) + `exact_score` is exactly what it already does. U5b is the
events-creation mechanism; the pick UI is U2, reused.

### U6 — Window scheduling: cron + admin override
- **Cron:** build `/api/wc/cron/window-lifecycle` (or similar) that opens/locks
  matchday windows based on `events.lock_time`. Built but **NOT added to
  `vercel.json` crons by default** (Hobby limit — see
  `vercel.crons.dormant.json`). Document re-activation for Vercel Pro.
- **Admin override:** superadmin-only controls on `/wc/admin` to open/lock any
  window for any WC competition, plus an API route. This is the default
  operating mode while the cron stays dormant.

### U7 — Elimination-curve recompute (was C5)
Regenerate the `format` classification curve from the actual entrant count once
known (window 1 open → window 2 lock). The current `entrant_count: 48` is a
placeholder.

## Sequencing

`U0` → `U1` → (`U2` + `U3` together) → `U4` → `U5` → `U6` → `U7`.

U1 is NOT standalone — seeding events before U2/U3 produces fixtures advertising
a pick UI that doesn't exist. U0 strictly blocks U1: seeding events for
fictional groups would compound the placeholder problem.

## Open questions — RESOLVED 2026-05-22

- ~~Window lifecycle~~ → schedule logic built + cron, but admin-control default;
  superadmin override for all WC competitions. See U6.
- ~~Carry-over direction~~ → one-way, Bracket → windows. See U3/U4.

## Remaining unknowns to confirm at build time

- Group F lists only 5 fixtures in the source — the 6th (Netherlands vs Sweden,
  matchday 2) must be confirmed before U1 seeds Group F.
- Whether any `bracket_prediction_submissions` rows already exist (U0 step 3) —
  none expected, but verify; if present they reference placeholder teams.
- `r32Seeding` / `bestThirdConfig` in the bracket template may need review once
  real groups are in (U0 step 2) — the placeholder matrix was marked PLACEHOLDER.
