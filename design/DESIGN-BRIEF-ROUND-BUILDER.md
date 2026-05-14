# Design Brief: Round Builder & Fixture Search UI

## Context

PredictSport is a social sports prediction app for friend groups (~12 users). Admins build competitions with rounds of mixed-sport events. Participants predict outcomes and compete on leaderboards. No betting.

**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Supabase. Deployed on Vercel.

**Current state:** The admin competition detail page has tabs (Events, Participants, Nominations, Settings). The Events tab shows a flat list of events with an "Add Event" button that opens a single-event form. This needs to evolve into a round-based system.

## What needs designing

### 1. Events tab → Rounds view

The Events tab should show **rounds as collapsible sections**, ordered by round number. Each round contains its events. Ungrouped events (legacy, no round) should appear in an "Ungrouped" section at the bottom.

Each round section shows:
- Round number and name (e.g., "Round 3 — Bank Holiday Weekend")
- Status badge (draft / open / locked / scored)
- Event count
- Expand/collapse to show events
- Actions: Open (draft→open), Lock, Delete (draft only)

### 2. Round builder (the main new feature)

When admin clicks "New Round", they need to:

**Step 1 — Find fixtures:**
- Search by free text (team name, competition name)
- Browse by league (dropdown of 60+ leagues across all sports)
- Filter by sport and date range
- Results appear as a checklist with "Select All"
- Show: event name, competition, date/time, sport badge

**Step 2 — Configure prediction types:**
- Selected fixtures listed with prediction type pickers
- "Apply to all" option (most common: admin wants the same prediction types for all fixtures in a round)
- Per-event override if needed
- Points per prediction type (defaults from competition scoring template)

**Step 3 — Name and save:**
- Round name (auto-suggest "Round N")
- Round number (auto-increment)
- Optional deadline
- Review summary of what will be created
- Save → calls `POST /api/admin/rounds` (creates round + events + prediction types in one call)

### 3. Single event add (keep existing)

The existing "Add Event" flow should still work for manual one-off entries. It should be accessible from within a round or as a standalone action.

## API endpoints available

```
GET  /api/sports/search?sport=soccer&q=liverpool&dateFrom=2026-05-01&dateTo=2026-05-07&limit=25
GET  /api/sports/search?sport=soccer&league=4328  (bulk: all upcoming fixtures for a league)
POST /api/admin/rounds  (bulk create round + events + prediction types)
GET  /api/admin/rounds?competition_id=X
PATCH /api/admin/rounds  (update status/name)
DELETE /api/admin/rounds?round_id=X&competition_id=X  (draft only)
```

## Data model

```
Competition → Rounds → Events → EventPredictionTypes
                                → Predictions
```

- Rounds group events (can mix sports/leagues in one round)
- `round_number` unique per competition, displayed as simple number
- Round status: draft → open → locked → scored
- Each event has multiple `event_prediction_types` rows (winner, margin, over_under, etc.) with individual points

## Prediction types available

| Type | Label | Description |
|------|-------|-------------|
| winner | Winner | Pick the outright winner |
| yes_no | Yes / No | Binary outcome |
| top_n | Top N Finish | Pick someone to finish in top N |
| head_to_head | Head to Head | Pick which of two finishes higher |
| margin | Margin of Victory | Predict winning margin range |
| over_under | Over / Under | Predict above or below a line |
| handicap | Beat the Handicap | Predict whether a team covers the spread |
| progression | How Far Will They Go? | Predict tournament progression stage |

## Sports covered

Soccer, Formula 1, Golf, Rugby, Tennis, GAA, Horse Racing, Snooker, MLB, NFL, NBA, NHL

## Existing design patterns

- Dark/light mode support (zinc colour palette throughout)
- Cards with `border-zinc-200 dark:border-zinc-800` borders
- Status badges (coloured pills)
- Form inputs: `rounded-md border border-zinc-300 px-3 py-2 text-sm` with dark mode variants
- Primary buttons: `bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900`
- Secondary buttons: `border border-zinc-300 text-zinc-700`
- Tabs: underline style with `border-b-2`
- Mobile responsive (max-w-5xl container)

## Key UX principles

1. **Admin is a competition designer** — the UI should feel like building something, not just adding data
2. **Bulk operations first** — selecting 10 fixtures at once is the common case, not one-by-one
3. **Sensible defaults** — auto-fill lock times, auto-suggest round names/numbers, default prediction types from competition template
4. **Mixed sports** — a single round can contain fixtures from different leagues and sports
5. **Progressive disclosure** — show search first, configure after selection

## Files to modify

- `src/app/admin/components/EventsSection.tsx` — becomes the rounds view
- `src/app/admin/components/CompetitionTabs.tsx` — may need data changes
- `src/app/admin/competitions/[id]/page.tsx` — needs to fetch rounds
- New component(s) for the round builder

## Constraints

- Hobby project, free tier everything
- ~12 users, no need for enterprise scale
- Mobile-friendly but desktop is primary admin interface
- No external UI libraries — Tailwind only
