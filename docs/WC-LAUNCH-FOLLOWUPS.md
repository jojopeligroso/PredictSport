# World Cup — Launch Follow-Ups

Context: the "World Cup" competition was created directly in the database
(2026-05-22) so the home/landing cards and `/wc/join` → `/wc/picks` → bracket
flow could go live immediately. The competition (`product_mode =
world_cup_2026_shell`, `tournament_id = a0000000-0000-0000-0000-000000000026`)
is `active` with 4 classifications (`overall`, `format`, `full_bracket` active;
`knockout_bracket` draft) and 8 prediction windows (group matchdays 1–3 `open`,
knockouts `draft`). The Full Bracket is predictable now.

The items below were deferred from that session.

## C1 — App-wide general leaderboard (cross-competition)
A global leaderboard aggregating points across **all** competitions, not scoped
to one. Today `classifications.classification_key='overall'` is per-competition
(`competition_id` FK). This needs a new app-wide aggregate (table or view) plus
a **user-level opt-out** setting (likely `users.notification_prefs` or a new
column). Entrants can opt out of appearing on the global board.

## C2 — World Cup-wide leaderboard
Surface the World Cup `overall` classification as an **app-wide** board (every
World Cup participant across the whole app on one leaderboard — it is already
app-wide-within-the-competition; it needs a leaderboard view/page at
`/wc/leaderboard`, which currently exists as a route — verify it renders the
`overall` classification standings).

## C3 — WC admin "Create competition" UI  ⚠️ recurring-pain
`createWorldCupCompetition()` (`src/lib/tournament/create-world-cup-competition.ts`)
has **no caller** — the competition had to be created by hand-written SQL.
Wire it to a button in `/wc/admin` behind an API route so this is repeatable.
Note: `/wc/admin` requires `users.is_super_admin = true`; the creator account
(eoinmaleoin@gmail.com) currently has `is_super_admin = false` — grant it or
this panel is unreachable.

### C3a — Entrant count UX (from launch discussion)
At creation, show the admin a participant counter: `x/8` minimum (the min
disappears once the 8-entrant threshold is met) and `x/96` maximum cap. 8 and
96 are the hard bounds of `generateEliminationCurve()`.

## C4 — Unified prediction model (SUPERSEDES the old "seed 72 events" framing)
Originally scoped as "create 72 group fixture events". That framing was wrong.
Investigation (2026-05-22) found the World Cup has **two storage-isolated
prediction systems**:

- **Bracket** → `bracket_prediction_submissions` (JSON blob). Group stage uses
  W/D/L picks with scores only for tiebreaker-tied matches. Works today.
- **Per-event picks** → `predictions` rows. The `/wc/picks/[windowId]` page is
  **read-only** — no pick-submission UI exists; nothing calls `/api/predictions`.

Nothing bridges them, so the user's "never enter a prediction twice"
requirement is currently **architecturally impossible**. Seeding 72 events
without the windowed pick UI + shared store would advertise an interaction the
app can't fulfil — do NOT do it as a standalone step.

The real work is a unified prediction model: per-event `predictions` as the
single source of truth, the Bracket writing through a `BracketData⇄predictions`
adapter, a windowed pick UI, and carry-over. Full design + phased plan (U1–U6)
in **`docs/DESIGN-WC-UNIFIED-PREDICTIONS.md`**. The `overall` and `format`
classifications are unscoreable until this is built.

## C5 — Elimination curve recompute  ⚠️ blocking-for-format-classification
The `format` classification was created with a **placeholder** `entrant_count`
of 48 and a pre-computed curve (`config.elimination_curve`, `locked: false`).
By design the real count isn't known until prediction window 1 opens (groups
set) and is final when window 2 locks. The curve **must be regenerated** from
the actual entrant count at that point — nothing currently does this. The
format classification's scoring is wrong until it is.

## C6 — "World Cup" copy audit
User-facing copy should always read "World Cup" (never "WC 2026" / "WC 26" /
"WC"). Home promo cards fixed 2026-05-22. The `/wc` hero still renders
"World Cup 2026" (the "2026" is a styled amber design accent) — left as a
deliberate-design judgement call; confirm or change. Sweep the rest of `/wc/**`.

## D — Deployment / "cell" architecture (advice given, no action taken)
Recommendation from the launch session: keep World Cup as a **modular boundary
within this single repo/app/DB** (`src/app/wc/**`, `src/lib/tournament/**`,
namespaced `sporting_*` / `bracket_*` tables) — do NOT split into a separate
Vercel project. App-wide leaderboards (C1/C2) require a shared user base, which
a split would break. If the project goes commercial and moves to Vercel Pro,
the cron limit disappears and the dormant crons in `vercel.crons.dormant.json`
can be reactivated — that is the natural graduation point, needing no
re-architecture if the boundary is kept clean now.
