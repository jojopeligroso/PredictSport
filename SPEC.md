# PredictSport — Product Specification

> Single source of truth. All other spec docs (`docs/SPEC-*.md`) are superseded by this file.
> Last updated: 2026-05-09.

## 1. Product Overview

Social sports prediction platform. Admin builds competitions with rounds of mixed-sport events. Participants predict outcomes, earn points, compete on leaderboards. No betting — bragging rights only.

**Origin:** Digitises a paper PDF prediction quiz used by Wexford FC supporters. MVP targets multiple independent friend groups.

**Stack:** Next.js (App Router) + TypeScript strict + Tailwind CSS + Supabase (PostgreSQL + Auth). Deployed on Vercel (free) + Supabase (free tier). No ORM.

**Design direction:** Light, mobile-first hybrid (Design 8: Arena/Terrace/Stadium blend). Tone is social, competitive, fun. No defensive language ("no betting, no wagering..."). Preferred tone: "The fight for bragging rights starts here."

---

## 2. MVP Scope

### In MVP

- All 9 prediction types (see §6)
- Configurable scoring per competition with preset templates
- Sports API integration (9 providers) — reduces admin burden
- Google OAuth + Magic Link auth (Supabase free tier)
- User profile editing (display name, avatar, notification prefs)
- Competition lifecycle: draft → active → completed → archived
- Round-based event grouping with mixed sports
- WhatsApp Cloud API notifications (reminders, results, leaderboard)
- Telegram bot integration (already built)
- Invite links (tokenised URLs, shareable via WhatsApp/wherever)
- Leaderboard with percentage scoring, qualification, tiebreakers
- Pick reveal (admin-controlled, separate from lock time)
- Social features: pick notes, emoji reactions, persona callouts

### Post-Launch

- Event nominations by participants
- Public competition browsing/discovery
- Tiebreaker submission UI (leaderboard reads them; submission not yet built)
- Co-admin appointment UI
- "New Season" clone from archived competition

---

## 3. Auth

### Providers

1. **Google OAuth** (primary) — seamless sign-in. If user is already logged into Google on device, should bypass password input entirely. Standard Supabase OAuth flow.
2. **Magic Link** (permanent alternative) — email-based OTP via Supabase. User enters email, receives login link.

### Flow

1. Unauthenticated user lands on `/` → sees landing page → clicks "Get started" → `/login`
2. Login page shows Google button + magic link input
3. On successful auth, Supabase creates `auth.users` row
4. Database trigger `handle_new_user()` auto-creates `public.users` row with `display_name` from Google metadata (or email prefix) and `avatar_url`
5. Auth callback redirects to `/` which redirects authenticated users to `/predictions`
6. If user arrived via invite link (`/join?code=xxx`), redirect to join flow after auth

### Session Management

- `@supabase/ssr` cookie sessions
- Middleware (`src/middleware.ts`) refreshes session on every request via `updateSession()`
- `<AuthRequired>` server component wrapper for protected pages
- Pages that need auth redirect to `/login?next={current_path}` to preserve intent

---

## 4. Competition Lifecycle

### States

```
draft → active → completed → archived
```

### Admin Flow

1. **Login** → navigate to admin ("Match Day Desk")
2. **Create competition** in `draft` status — set name, type (fixed/open), visibility (public/private), scoring template
3. **Add rounds and events** while in draft
4. **Activate** — competition becomes `active`. Can be triggered manually or automatically on first event lock
5. **Ongoing** — if rolling/open competition, admin adds rounds throughout the season
6. **Complete** — admin marks competition as `completed` when season ends
7. **Archive** — admin archives for historical record. Post-launch: "New Season" clones settings for next iteration

### Rules

- Scoring rules are immutable after competition activates
- Competition type (fixed/open) is immutable after creation
- Delete allowed only while in `draft`
- `invite_code` generated automatically on creation (12-char hex)

### Competition Settings

| Field | Description |
|-------|-------------|
| `name` | Competition name |
| `description` | Optional description |
| `type` | `fixed` (all events defined upfront) or `open` (events added throughout) |
| `visibility` | `public` or `private` |
| `scoring_rules` | Default scoring template (JSON). Applied to new events as defaults. |
| `lock_default_minutes` | Minutes before start_time to auto-set lock_time (default 5) |
| `allow_nominations` | Whether participants can nominate events (post-launch feature) |
| `min_rounds_required` | Minimum rounds a participant must play. NULL = all required. |
| `allow_prediction_updates` | Can participants change predictions before lock? Default true. |

---

## 5. Rounds & Events

### Rounds

Rounds are admin-created groupings — NOT tied to sporting competition rounds. A round called "Bank Holiday Weekend" can contain Premier League, F1, GAA, and rugby fixtures simultaneously.

- `round_number` unique per competition (sequential)
- `name` is freeform (e.g., "Round 1", "Grand National Weekend", "Champions Cup Semis")
- Status: `draft` → `open` → `locked` → `scored`

### Events

An event is a single sporting fixture or question within a round.

| Field | Description |
|-------|-------------|
| `event_name` | Display name (e.g., "Liverpool vs Arsenal") |
| `sport` | Sport key (e.g., `soccer`, `rugby`, `formula_1`, `gaa`, `golf`) |
| `start_time` | When the event actually starts |
| `lock_time` | When predictions close (server-enforced) |
| `pick_reveal_at` | When other users' picks become visible. NULL = same as lock_time. |
| `result_data` | JSONB — raw result from API or manual entry |
| `result_confirmed` | Boolean — admin has confirmed the result |
| `status` | `upcoming` → `locked` → `resulted` / `postponed` / `cancelled` |
| `external_event_id` | API reference for auto-fetching results |

### Locking Rules

**All events in a round lock at the earliest fixture's start time**, not individually. This prevents information leakage — if events locked individually, a user could see early results and adjust later picks.

When seeding a round, set every event's `lock_time` to the `start_time` of the earliest fixture in the round.

### Pick Reveal

`pick_reveal_at` defaults to the same as `lock_time` but can be set later by the admin for dramatic tension. RLS enforces: other users' predictions are invisible until `pick_reveal_at` (or `lock_time` if `pick_reveal_at` is NULL, or result is confirmed).

### Result Flow

1. Vercel cron job or admin-triggered fetch checks for results of active events
2. Results stored as **provisional** (`result_data` set, `result_confirmed = false`)
3. Admin reviews and confirms with one click → `result_confirmed = true`, `status = 'resulted'`
4. Scoring runs automatically on confirmation (see §7)
5. Admin can provide/override `result_data` during confirmation

---

## 6. Prediction Types

9 types. The admin selects which type(s) apply per event via `event_prediction_types` rows.

**Key insight:** Prediction types are *mechanics*, not questions. Any question maps to a mechanic:
- "Who wins the US Masters?" → `winner`
- "Will Ireland qualify for the World Cup?" → `winner` with options `["Ireland", "Not Ireland"]`, or `yes_no` with options `["Yes", "No"]`. Either works. Ireland "winning" means winning the qualification, not the tournament itself.
- "Verstappen or Hamilton?" → `head_to_head`

### Type Reference

| Type | Mechanic | Example | Data Shape |
|------|----------|---------|------------|
| `winner` | Pick from options or free text | "Who wins the Masters?" | `{ value: "Scheffler" }` |
| `yes_no` | Pick from 2+ labelled options | "Will Ireland qualify?" | `{ selection: "Yes" }` |
| `head_to_head` | Pick which of 2 finishes higher, with optional draw | "Verstappen vs Hamilton?" | `{ selection: "Verstappen" }` |
| `top_n` | Pick someone to finish in top N | "Top 5 at Augusta?" | `{ value: "Rory McIlroy", n: 5 }` |
| `final_standings` | Rank N positions in order | "Predict the top 4" | `{ rankings: [{position:1,name:"X"}, ...] }` |
| `margin` | Predict winning margin in a range | "Ireland win by 1-7?" | `{ team: "Ireland", range_low: 1, range_high: 7 }` |
| `over_under` | Over or under a line | "Over 2.5 goals?" | `{ selection: "over", threshold: 2.5 }` |
| `handicap` | Covers the spread or not | "Leinster -12.5?" | `{ selection: "covers", line: -12.5, team: "Leinster" }` |
| `progression` | How far does X go in a tournament | "How far will Ireland go?" | `{ stage: "Quarter-Finals" }` |

### `yes_no` vs `winner` Overlap

`yes_no` is functionally similar to `winner` with 2 options. The distinction is UX: `yes_no` frames the question as a binary ("Will X happen?") while `winner` frames it as selection ("Who wins?"). Both are valid ways to express the same question. The admin picks whichever framing fits better.

### Head-to-Head Draw Handling

Draws are sport-dependent and admin-configurable:

- **Config:** `event_prediction_types.config` includes `allow_draw: boolean` and optionally `draw_points: number`
- **Team sports** (soccer, rugby, etc.): score tied = draw. If `allow_draw` is true, "Draw" appears as a third option.
- **Individual sports** (F1, golf): position comparison determines winner. One DNF = other wins. Both DNF = null (void prediction, no points awarded to anyone).
- **Default:** `allow_draw: false`. Draw is NOT an option unless admin explicitly enables it.
- **Scoring:** If draw is enabled and the result is a draw:
  - Users who picked "Draw" get `draw_points` (or `points` if `draw_points` not set)
  - Users who picked a side get 0 points
  - If draw is NOT enabled and the result is a draw: prediction is voided (null), no points

### `event_prediction_types` Table

Source of truth for per-event prediction configuration. Each row = one prediction type on one event.

```
event_prediction_types
  id                uuid PK
  event_id          uuid FK events
  prediction_type   text (one of the 9 types)
  points            integer (default 10) — full credit
  partial_points    integer (default 0) — partial credit
  config            jsonb nullable — type-specific configuration
  UNIQUE (event_id, prediction_type)
```

### Config Shapes by Type

| Type | Config Fields |
|------|--------------|
| `winner` | `{ options?: string[] }` — if omitted, free-text input |
| `yes_no` | `{ options?: string[] }` — defaults to `["Yes", "No"]` |
| `head_to_head` | `{ options: string[], allow_draw?: boolean, draw_points?: number }` |
| `top_n` | `{ n: number, options?: string[], points_ladder?: [{position, points}] }` |
| `final_standings` | `{ positions: number, points_per_correct: number, points_per_included: number }` |
| `margin` | (none — ranges provided in prediction_data) |
| `over_under` | `{ line: number }` |
| `handicap` | `{ line: number, team: string }` |
| `progression` | `{ stages: string[] }` — ordered list of tournament stages |

---

## 7. Scoring

### Per-Event Scoring

Points come from `event_prediction_types` rows, NOT from competition-level `scoring_rules`. The competition's `scoring_rules` is a default template applied when creating new events.

### Scoring Logic by Type

| Type | Full Points | Partial Points | Zero |
|------|------------|----------------|------|
| `winner` | Exact match | — | Wrong |
| `yes_no` | Exact match (against options or answer) | — | Wrong |
| `head_to_head` | Correct winner picked | — | Wrong (or null if both DNF) |
| `top_n` | Picked person finishes in top N (position 1 = full, others = configurable via ladder) | In top N but not position-matched | Not in top N |
| `final_standings` | Right person in right position = `points_per_correct`; right person wrong position = `points_per_included` | — | Not in top N at all |
| `margin` | Actual margin falls in predicted range | Margin is adjacent (off by 1 from range boundary) | Wrong team or way off |
| `over_under` | Correct side of the line | — | Wrong side |
| `handicap` | Selected team covers the spread | — | Doesn't cover |
| `progression` | Exact stage match | Off by one stage (if partial configured) | More than one stage off |

### Over/Under Push

When the actual value exactly equals the line (a "push"), the prediction is voided — `is_correct: null`, 0 points. Neither over nor under wins.

### Scoring Templates

Preset templates for quick competition setup:

| Template | Description |
|----------|-------------|
| Classic Quiz | 10pts correct, 20pts dual questions, 10pts partial. Mirrors original PDF format. |
| Tournament | 10pts winner, 5pts top 5, 3pts top 10 |
| Weekly Fixtures | 3pts correct result, 1pt correct draw |
| Head to Head Series | 5pts per correct H2H, bonus for clean sweep |
| Custom | Admin defines everything |

### Scoring Rules Immutability

Once a competition is `active`, `scoring_rules` cannot change. Per-event scoring (`event_prediction_types`) is set when the event is created and immutable once any prediction exists on the event.

---

## 8. Leaderboard

### Ranking Method

**Percentage-based**, not raw points. This ensures fairness when participants play different numbers of rounds.

```
percentage = (total_points / max_possible_points_in_participated_rounds) × 100
```

### Qualification

A participant must play at least 1/3 of all scored rounds to qualify for the ranked leaderboard. Unqualified participants appear below the ranked list with no rank number.

### Tiebreaker

One numeric question per competition (e.g., "Total goals in the Premier League season"). Closest to actual value wins when percentage scores are tied.

### Display

| Column | Description |
|--------|-------------|
| Rank | Position (tied users share rank; unqualified = "—") |
| Name | Display name + avatar |
| Percentage | Score as % of max possible |
| Points | Raw total points |
| Record | Correct / Partial / Wrong counts |
| Accuracy | Correct predictions / total resulted predictions × 100 |
| Streak | Consecutive correct predictions (most recent first) |
| Rounds | X of Y rounds participated |

### Expandable Detail

Each leaderboard row expands to show the user's individual predictions vs correct answers for resulted events.

---

## 9. UI Vocabulary & Views

### Navigation

| Label | Route | Description |
|-------|-------|-------------|
| The Round | `/predictions` | Current round's events with prediction inputs |
| Results | `/predictions` (tab) | Resulted events with score breakdown |
| The Table | `/leaderboard` | Leaderboard |
| Match Day Desk | `/admin` | Admin panel |

### "The Round" View

Primary predictions page. Shows:
- Hero header with round name, pick progress bar, earliest lock countdown
- Tab toggle: **The Round** / **Results**
- Filter chips: All, per-sport, Open, Locked
- Event cards with inline pick buttons or form inputs
- Persona callout showing current pick summary

### "Results" View

Tab on the predictions page showing resulted events:
- Summary of user's total points from the round
- Result cards: event name, sport, result, user's prediction, points awarded, correct/wrong/partial indicator

### Event Card Anatomy

```
┌─ Sport colour bar (3px) ──────────────────────┐
│ [Sport Pill]          [Countdown] [Share icon] │
│                                                │
│ Event Name                    [Community Donut]│
│ Sat 10 May, 15:00                              │
│                                                │
│ ┌────────┐ ┌────────┐ ┌────────┐              │
│ │ Team A │ │ Draw   │ │ Team B │  ← picks     │
│ └────────┘ └────────┘ └────────┘              │
│                                                │
│ [Persona callout: "Your pick: Team A"]         │
└────────────────────────────────────────────────┘
```

### Persona Callouts

Per-participant custom personas stored as `callout_label` on `competition_members`. Examples:
- "Parker's fantasy nous notes..."
- "Jay's suss..."
- Default: "{name} reckons..."

Deep customisation available but hidden in settings, not in the main prediction flow.

---

## 10. Notifications

### WhatsApp (MVP)

WhatsApp Cloud API (Meta). Free tier: 1,000 service conversations/month.

**Notification types:**
- "New competition created — join here: [link]"
- "Reminder: [Event] locks in 24 hours — submit your prediction!"
- "Result confirmed: [Event] — [Answer]. Leaderboard updated!"
- Weekly/monthly leaderboard summary

**Requirements:**
- WhatsApp Business Account (free)
- Dedicated phone number for the bot
- Users opt in by messaging the bot first (WhatsApp policy)

### Telegram (Built)

Bot with inline predictions, account linking, result notifications to group chat. Uses Mini App for web integration.

---

## 11. Sports Data Integration

### Principle

Minimise admin effort. If an API can fetch the result, the admin should only need to click "Confirm". Manual entry is the fallback, not the default.

### Provider Registry

| Provider | Sports | Key Needed | Cost |
|----------|--------|------------|------|
| OpenF1 | F1 | No | Free |
| API-Football | Soccer | `API_FOOTBALL_KEY` | Free (100 req/day) |
| TheSportsDB | Soccer, Golf, Rugby, Tennis | No | Free |
| ESPN | NFL, NHL, NBA, MLB, Soccer, Rugby, Golf, Tennis, Snooker | No | Free (unofficial) |
| BallDontLie | NBA (+paid: NFL, MLB, NHL) | `BALLDONTLIE_KEY` | Free NBA |
| MLB Stats | MLB | No | Free |
| TheRacingAPI | Horse Racing | `THERACING_API_KEY` | Free tier |
| Foireann | GAA | `FOIREANN_API_KEY` | Free |
| Manual | All (fallback) | N/A | N/A |

### Data Flow

1. Cron job or admin-triggered fetch checks for results
2. Provider registry chains providers per sport — first non-null result wins
3. Result stored as provisional (`result_data` set, `result_confirmed = false`)
4. Admin confirms → scoring runs → leaderboard updates
5. Users never hit external APIs directly

### Key Rules

- Prefer official APIs over unofficial scrapers
- Cache aggressively — fetch once, serve from DB
- Graceful fallback to manual entry when APIs lack coverage
- Rate-limit awareness: most free tiers are 100-1000 req/day

---

## 12. Roles

| Role | Scope | Powers |
|------|-------|--------|
| Super Admin | Global | Override scores, view all predictions, manage all users |
| Competition Admin | Per competition | Create/manage competitions, confirm results, manage members |
| Co-Admin | Per competition | Same as admin except cannot delete competition |
| Participant | Per competition | Submit predictions, view leaderboard |

A user may hold different roles across different competitions simultaneously.

---

## 13. Data Model

### Tables

```
users                        — extends auth.users via trigger
competitions                 — the container
competition_members          — who's in which competition + role + callout_label
rounds                       — grouping of events within a competition
events                       — individual fixtures/questions
event_prediction_types       — what prediction types are available per event + scoring config
predictions                  — user's actual predictions (+ notes)
prediction_reactions         — emoji reactions on predictions
tiebreakers                  — per-competition tiebreaker question
tiebreaker_answers           — user's tiebreaker answer
event_nominations            — participant-submitted event suggestions (post-launch)
invite_tokens                — tokenised invite links
```

### Key Constraints

- `predictions` unique on `(event_id, user_id, prediction_type)` — one prediction per type per event per user
- `event_prediction_types` unique on `(event_id, prediction_type)` — one config per type per event
- `competition_members` unique on `(competition_id, user_id)` — one membership per competition
- `users.id` references `auth.users(id)` with cascade delete

### RLS Summary

- Users see own predictions always; others' predictions only after `pick_reveal_at` (or `lock_time` if null) or after result confirmed
- Predictions can only be inserted/updated before `lock_time`
- Competition members see their competition's events, members, tiebreakers
- Invite tokens readable by anyone (needed for join flow)

---

## 14. Domain Rules

1. **Lock is server-side.** Client countdown is cosmetic. RLS + API route reject submissions after `lock_time`.
2. **Predictions hidden until reveal.** Other users' picks invisible until `pick_reveal_at` (defaults to `lock_time`). Admin cannot see them either.
3. **After reveal, all predictions visible.** Everyone can see what everyone else picked.
4. **Results: provisional then confirmed.** API-fetched results are provisional until admin confirms.
5. **Scoring is automatic on confirmation.** Points calculated immediately using `event_prediction_types` config.
6. **Scoring rules immutable after activation.** Per-event scoring immutable once predictions exist.
7. **Competition type immutable after creation.**
8. **Rounds group events.** A round can mix sports/leagues. Round lock = earliest event's start_time.
9. **Participation is flexible.** `min_rounds_required` sets minimum. Participants opt in/out per round.
10. **Prediction updates.** If `allow_prediction_updates` is true, participants can change predictions before lock. If false, predictions are final on first submission.
11. **No negative points.** Confirmed from original paper format.
12. **H2H draws are sport-dependent.** Admin enables draw option per event. Both-DNF = void.

---

## 15. Known Gaps & Issues

Tracked in `todos.md` as a prioritised punch list. Keep both files in sync.

### P0 — Blocking launch

1. **Google OAuth broken on deploy** — redirect URL configuration needs investigation
2. **No user profile editing page** — users can't change display name, avatar, or notification prefs
3. **Competition activation UI** — no button to transition draft → active
4. **Competition completion/archive flow** — no UI for completing or archiving a competition

### P1 — Core functionality gaps

5. **H2H draw support** — scorer doesn't handle draws; needs `allow_draw` config and UI
6. **Over/under push** — scorer returns `is_correct: false` for exact line hit; should be null/void
7. **UI vocabulary** — rename "The Damage" → "Results", "The Sheet" → "The Round", review all AI-generated placeholder copy
8. **WhatsApp integration** — specified but not yet implemented (Telegram is done)

### P2 — Polish

9. **Scoring template redesign** — templates need clear explanations, inline examples, visual distinction
10. **Logo redesign** — current PS mark is a placeholder
11. **Persona callout configuration** — settings UI for custom callout labels per member
