# PredictSport — Product Specification

> Single source of truth. All other spec docs (`docs/SPEC-*.md`) are superseded by this file.
> Last updated: 2026-05-09.

## 1. Product Overview

Social sports prediction platform. Admin builds competitions with rounds of mixed-sport events. Participants predict outcomes, earn points, compete on leaderboards. Built for bragging rights.

**Origin:** Digitises a paper PDF prediction quiz used by Wexford FC supporters. MVP targets multiple independent friend groups.

**Stack:** Next.js (App Router) + TypeScript strict + Tailwind CSS + Supabase (PostgreSQL + Auth). Deployed on Vercel (free) + Supabase (free tier). No ORM.

**Design direction:** Light, mobile-first hybrid (Design 8: Arena/Terrace/Stadium blend). Tone is social, competitive, fun. Culturally inferred, never explicit. Preferred tone: "The fight for bragging rights starts here."

---

## 2. MVP Scope

### In MVP

- All 10 prediction types (see §6)
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
5. Auth callback redirects to `/` which redirects authenticated users to `/wc`
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

10 types. The admin selects which type(s) apply per event via `event_prediction_types` rows.

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
| `exact_score` | Predict the exact final score in sport-specific format | "What's the final score?" | `{ home: 2, away: 1 }` or `{ home: { goals: 2, points: 11 }, away: { goals: 1, points: 15 } }` (GAA) |

### Winner Draw Support

The `winner` type supports "Draw" as a valid prediction option for applicable sports.

- **Config:** `allow_draw: boolean` on the `winner` EPT row. Default: `false`.
- **Applicable sports:** Soccer, GAA, rugby (regular season), and any team sport where a draw is a valid result.
- **UI:** When `allow_draw: true`, the prediction card shows three options: Home / Draw / Away (or labels from `config.options`).
- **Scoring:** A draw result with `allow_draw: true` → only users who picked "Draw" earn points. Users who picked a side earn 0.
- **Draw result, `allow_draw: false`:** Prediction voided — `is_correct: null`, 0 points.
- **Required for exact_score:** When an exact score implies equal scores, winner derivation sets the winner pick to "Draw". This requires `allow_draw: true` on the same event.

### "After extra time" rule (knockout matches)

A `winner` / `exact_score` prediction (and the confirmed result) is the score
**after extra time, excluding penalties**. A knockout match decided by a
penalty shootout is predicted and recorded as a **Draw** — the score at the
end of extra time. The team that wins the shootout is captured separately as
the *advancing team* (a progression-style prediction for the World Cup
Bracket classification — see `docs/DESIGN-WC-UNIFIED-PREDICTIONS.md`), never as
the match result. This matches how providers report the data (ESPN
`soccer/fifa.world` exposes the drawn `score` and the `shootoutScore`
separately). Group-stage matches never reach extra time, so for them this is
simply "the final score".

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
  prediction_type   text (one of the 10 types)
  points            integer (default 10) — full credit
  partial_points    integer (default 0) — partial credit
  config            jsonb nullable — type-specific configuration
  UNIQUE (event_id, prediction_type)
```

### Config Shapes by Type

| Type | Config Fields |
|------|--------------|
| `winner` | `{ options?: string[], allow_draw?: boolean }` — if omitted, free-text input; `allow_draw` enables Draw as a third option |
| `yes_no` | `{ options?: string[] }` — defaults to `["Yes", "No"]` |
| `head_to_head` | `{ options: string[], allow_draw?: boolean, draw_points?: number }` |
| `top_n` | `{ n: number, options?: string[], points_ladder?: [{position, points}] }` |
| `final_standings` | `{ positions: number, points_per_correct: number, points_per_included: number }` |
| `margin` | (none — ranges provided in prediction_data) |
| `over_under` | `{ line: number }` |
| `handicap` | `{ line: number, team: string }` |
| `progression` | `{ stages: string[] }` — ordered list of tournament stages |
| `exact_score` | (none — score format is auto-derived from `events.sport`) |

### Exact Score Prediction

`exact_score` is the 10th prediction type. It always pairs with `winner` and cannot be added to an event that does not also have `winner` configured.

**Prerequisite:** `winner` draw support (see above) must be in place before `exact_score` is implemented, as score derivation relies on it.

**Admin setup:** When configuring a `winner` EPT row, the admin can toggle on exact score as a bonus. This creates a second `event_prediction_types` row (`prediction_type: 'exact_score'`) with its own `points` value. The two are always configured together in the admin UI.

**Player UX:** The prediction card is two-sided:

1. Front — winner pick (Home / Draw / Away, or option list)
2. Back (flip) — exact score input in sport-specific format

The flip is an invitation, not a gate. Submitting a winner pick without a score is valid — the participant earns winner points only and forfeits the exact score bonus.

**Winner derivation:** Submitting an exact score automatically updates the winner prediction to match the implied result. An inline notification confirms the change (e.g., "Your winner pick has been updated to Draw"). If the score implies a draw, the winner is set to "Draw" — requires `allow_draw: true` on the event. See ADR 0001 for rationale (confirmation prompt was considered and may serve better in high-stakes contexts).

**Score formats** — auto-derived from `events.sport`:

| Category | Format | Example prediction_data |
|----------|--------|------------------------|
| Standard team sports (soccer, rugby, NFL, NBA, NHL, MLB) | `{ home: number, away: number }` | `{ home: 2, away: 1 }` |
| GAA | `{ home: { goals: number, points: number }, away: { goals: number, points: number } }` | `{ home: { goals: 2, points: 11 }, away: { goals: 1, points: 15 } }` |
| Position-based (F1, horse racing, golf, tennis) | Not applicable — `exact_score` may not be added to these events | — |

**Result source:** Scores are sourced from the provider chain via `NormalizedResult`. Foireann returns GAA goals and points separately in `NormalizedResult.stats` (`home_goals`, `home_points`, `away_goals`, `away_points`). For manual events, the admin enters the canonical score at the result confirmation step.

**Scoring:** All-or-nothing. No partial credit. `winner` and `exact_score` score independently — a user who predicts the correct winner but wrong score earns winner points only.

---

## 7. Scoring

### Per-Event Scoring

Points come from `event_prediction_types` rows, NOT from competition-level `scoring_rules`. The competition's `scoring_rules` is a default template applied when creating new events.

### Scoring Logic by Type

| Type | Full Points | Partial Points | Zero |
|------|------------|----------------|------|
| `winner` | Exact match (including "Draw" if `allow_draw` enabled) | — | Wrong (draw result with `allow_draw: false` = voided) |
| `yes_no` | Exact match (against options or answer) | — | Wrong |
| `head_to_head` | Correct winner picked | — | Wrong (or null if both DNF) |
| `top_n` | Picked person finishes in top N (position 1 = full, others = configurable via ladder) | In top N but not position-matched | Not in top N |
| `final_standings` | Right person in right position = `points_per_correct`; right person wrong position = `points_per_included` | — | Not in top N at all |
| `margin` | Actual margin falls in predicted range | Margin is adjacent (off by 1 from range boundary) | Wrong team or way off |
| `over_under` | Correct side of the line | — | Wrong side |
| `handicap` | Selected team covers the spread | — | Doesn't cover |
| `progression` | Exact stage match | Off by one stage (if partial configured) | More than one stage off |
| `exact_score` | Score exactly matches result in sport-specific format | — | Any deviation |

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

**Primary navigation (TabBar)** — fixed bottom tab bar on the `/wc` surface, visible to all engaged users:

| Tab | Route | Description |
|-----|-------|-------------|
| Home | `/wc/home` | Dashboard overview — matchday cards, rival teaser, stats |
| Picks | `/wc` or `/wc/picks` | Current prediction window with inline pick inputs |
| Board | `/wc/leaderboard` | Leaderboard, classification tabs, rival predictions |
| Chat | `/wc/leaderboard#chat` | Competition chat (currently anchored to leaderboard; planned: dedicated `/wc/chat` route) |

**Generic route navigation** — used by non-WC competition surfaces (secondary, will adopt `/wc` patterns):

| Label | Route | Description |
|-------|-------|-------------|
| The Round | `/predictions` | Current round's events with prediction inputs |
| Results | `/predictions` (tab) | Resulted events with score breakdown |
| The Table | `/leaderboard` | Leaderboard |
| Competitions | `/competitions` | Competition management hub (admin redirects here) |

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

### Done

1–12. All P0/P1/P2 items from the original punch list are complete. See `todos.md` for details.
13. ~~**Alternative auth for in-app browsers**~~ — ✓ Done. UA detection in `LoginButton.tsx` hides Google button and auto-focuses email input when running inside Telegram, Messenger, Instagram, or similar in-app webviews.
14. ~~**Privacy policy & terms of service**~~ — ✓ Done. `/privacy` and `/terms` pages live, footer links site-wide, login page consent text, OAuth consent screen published.

---

## 16. Tournament Format (FIFA World Cup 2026)

> Source of truth for tournament-format decisions: `predictsport_world_cup_2026_format_design_brief_final.md` (80 locked decisions). This section summarises requirements. See ADRs 0002-0009 for architectural rationale.

### 16.1 Scope

Phase 1 targets FIFA World Cup 2026 only. The feature adds a tournament-format Prediction Game that runs inside the existing PredictSport application and as a simplified World Cup 2026 Product Shell.

**In scope:** Group Stage, Round of 32, Round of 16, Quarter-finals, Semi-finals, Third-place play-off, Final. Five concurrent Classifications (see 16.2). Generic Bracket Prediction Engine with World Cup adapter. Super Administrator-controlled result pipeline.

**Out of scope (Phase 1):** Goalscorer/player/squad prediction, general tournament-builder UI, All-Ireland/GAA backdoor modelling, user-generated activity feed, comments, reactions, direct messaging, media upload.

### 16.2 Classifications

Each World Cup Prediction Game contains five concurrent Classifications (see ADR 0002):

| Classification | Type | Eliminates? | Scoring Basis |
|---|---|---|---|
| Overall | `leaderboard` | No | Cumulative match points |
| Format Classification | `format_elimination` | Yes | Stage-local match points + elimination |
| Full Bracket Survivor | `bracket_survivor` | Yes (within bracket) | Progression correctness (slot-sensitive) |
| Knockout Bracket Survivor | `bracket_survivor` | Yes (within bracket) | Progression correctness |
| R32 Classification | `stage_pick` | No | Team accuracy at R32 stage |

**R32 Classification:** Automatic byproduct of Full Bracket group stage predictions. Scores how many of the 32 teams that qualified to the knockouts were correctly predicted (1 point per correct team, max 32). Not path-sensitive — only checks whether each team made the R32, regardless of position or bracket slot. No separate prediction flow required. Entry is automatic for anyone who completes Full Bracket. Designed as an achievable engagement metric when Full Bracket's slot-sensitive path predictions become chaotic due to best-third allocation complexity.

Classification principles:

- Classifications are first-class backend entities scoped to a Prediction Game.
- Entrant status is tracked per Classification, not globally.
- An Entrant can be active in Overall, eliminated in Format, dead in Full Bracket, and active in Knockout Bracket simultaneously.
- Classification config is an immutable snapshot cloned from template data at creation time. Template updates do not affect running competitions.

**Minimum schema:** `classifications`, `classification_memberships`, `classification_standings_snapshots`, `classification_events`. See ADR 0002 for field-level detail.

### 16.3 Prediction Windows

A Prediction Window is a lockable batch of Fixtures that Entrants predict before a lock time. In Phase 1, a Prediction Window maps to the existing `rounds` table (see ADR 0007).

| Rule | Detail |
|---|---|
| Lock trigger | 1 minute before first Fixture (fallback: 5 minutes) |
| Lock granularity | Prediction Window-level; per-Fixture locking deferred |
| Concurrent open windows | Multiple future windows may accept Picks simultaneously |
| Independent locking | Each window locks at its own time |

Group Stage uses 3 Prediction Windows (Group Matchday 1, 2, 3). Knockout stages R32 through Semi-Finals each use 1 Prediction Window. **PW8 bundles the Third-Place Play-Off and the Final** into a single Prediction Window. Total: **8 Prediction Windows**.

| PW | Sporting Stage(s) | Format Elimination? |
|---|---|---|
| PW1 | Group Matchday 1 | No |
| PW2 | Group Matchday 2 | No |
| PW3 | Group Matchday 3 | Yes (group stage cut) |
| PW4 | Round of 32 | Yes |
| PW5 | Round of 16 | Yes |
| PW6 | Quarter-Finals | Yes |
| PW7 | Semi-Finals | Yes (last elimination) |
| PW8 | Third-Place + Final | No (winner declared) |

### 16.4 Match Scoring Model

Phase 1 uses flat scoring across all Sporting Stages for both Overall and Format Classifications:

| Pick Type | Points |
|---|---:|
| Correct match outcome (home/draw/away) | 2 |
| Exact score bonus | 3 |
| Correct advancing team (knockout only) | 1 |
| Max per Group Stage Fixture | 5 |
| Max per Knockout Fixture | 6 |

No approximate-score points. Bracket Survivor Classifications do not use match scores; they use progression correctness only.

### 16.5 Standing Snapshots

Standing snapshots are immutable denormalised JSON records written at finalisation points (see ADR 0004).

- Snapshots are authoritative. Provisional standings may be displayed but are not authoritative.
- Correction workflows create new correction snapshots; old snapshots are never mutated.
- Archive reads snapshots rather than recalculating live standings.
- Snapshot types: `window`, `stage`, `final`, `correction`.
- Generation methods: `manual`, `automatic`, `correction`.

### 16.6 Result Finalisation (2-Step)

See ADR 0005 for rationale.

**Step 1 -- Fixture result confirmation.** Super Administrator confirms individual match results are correct.

**Step 2 -- Window/Stage finalisation.** Super Administrator confirms the full result set is complete. Scoring, standings, advancement, snapshots, and eliminations become authoritative.

**Provisional visibility:** Provisional results, Pick correctness, and points may be displayed if clearly labelled. Eliminations are never provisional.

**Fallback auto-finalisation:** If a completed window/stage has not been finalised, the system auto-finalises it 15 minutes before the next dependent window locks, provided all required results are present. Missing results block finalisation and trigger Super Administrator escalation.

**Corrections:** Audited emergency workflow only. Silent edits are not allowed. Every correction stores old/new data, reason, affected items, and snapshot references.

### 16.7 Bracket Engine

A generic Bracket Prediction Engine handles bracket predictions across all bracket-type Classifications. FIFA-specific logic (best-third allocation, 12-group structure, R32 slot mapping) lives in the World Cup 2026 template adapter (see ADR 0003).

Bracket predictions use versioned JSON snapshots stored in `bracket_prediction_submissions`. Until lock, each save creates or updates the Entrant's draft. At lock, the latest valid submission becomes immutable.

Full Bracket Survivor: Entrant ranks all 12 groups, picks 8 best thirds, system generates R32, Entrant picks winners through to champion. Editable until tournament-level lock. Slot-sensitive correctness.

Knockout Bracket Survivor: Opens after Group Stage finalisation. Uses official R32 bracket. Available to all parent-game Entrants regardless of other Classification status.

### 16.8 Format Classification

The Format Classification is a tournament-style survival competition with Prediction Groups. Full elimination curve design: `predictsport-world-cup-2026-elimination-curve-solution.md`. Audit: `docs/AUDIT-elimination-curve-solution.md`.

**Elimination curve:** Generated from actual entrant count (8-96) at PW1 lock. Group Stage survivor target = `ceil(N * 2/3)`. Later stages use generous halving `ceil(prev/2)` clamped to a minimum that guarantees at least 1 elimination per stage. SF elimination always reduces to the finalist band count. Curve becomes immutable at PW1 lock.

**Finalist bands (Phase 1):** 8-55 entrants → 2 finalists. 56-79 → 3 finalists. 80-96 → 4 finalists.

**Group allocation:** Target-aware. Groups of 3, 4, or 5. Prefer 4-player groups. Algorithm: start with max 4s, adjust with 3s/5s to reach survivor target. Immutable after PW1 lock. Admin may disallow late joining entirely.

**Group Stage qualification rules:**
1. Top 2 from every group qualify automatically.
2. Third place from 5-player groups qualifies automatically.
3. Additional best-third qualification from 4-player groups only.
4. Third place from 3-player groups never qualifies.
5. Fourth place never qualifies.

**Points reset** to zero at each Sporting Stage. Eliminations happen after Stage finalisation, not after each window. Eliminated Entrants remain active in Overall Classification.

**Final Prediction Window (PW8):** Third-Place Play-Off + Final bundled. No elimination. The 2-4 finalists predict both matches. Winner determined by cumulative PW8 stage-local points. Standard tie-break applies.

**Tie-break hierarchy (fixed in Phase 1):** Total points, exact-score hits, correct-outcome hits, earlier aggregate submission timestamp, random fallback.

**Reference curves:**

| N | Curve |
|---:|---|
| 12 | 12 → 8 → 5 → 4 → 3 → 2 → 1 |
| 24 | 24 → 16 → 8 → 4 → 3 → 2 → 1 |
| 48 | 48 → 32 → 16 → 8 → 4 → 2 → 1 |
| 64 | 64 → 43 → 22 → 11 → 6 → 3 → 1 |
| 96 | 96 → 64 → 32 → 16 → 8 → 4 → 1 |

UI must show resolved consequence table before launch, including group allocation, survivor counts per stage, and finalist count.

### 16.9 Product Shell

See ADR 0006. The World Cup shell is a branded Product Shell over shared core logic, not a forked rules engine.

Product modes: `predictsport_full` (default), `world_cup_2026_shell`, `world_cup_2026_archive`.

- One shared GitHub repo, two Vercel projects, **one shared Supabase database**.
- Product mode controlled by `NEXT_PUBLIC_PRODUCT_MODE` environment variable.
- Shell hides unrelated routes and redirects unsupported paths.
- After tournament: archive mode exports static JSON and static Next.js pages, no Supabase dependency.

**Main app (`predictsport_full`):** World Cup tab (`/wc/*`) appears in main navigation. Time-gated — visible from approximately May 2026 through one month after the Final. Users access WC alongside all other PredictSport features.

**Shell (`world_cup_2026_shell`):** Separate Vercel project. Shows ONLY the World Cup prediction game. No personal predictions, no group competitions. Same Supabase backend — a user joining via the shell appears on the same leaderboard as one joining via the main app. Super Admin actions are performed once and affect both deployments.

### 16.10 Entry Rules

- Parent World Cup Prediction Game remains joinable until **72 hours after the first MD1 kickoff** (2026-06-14 19:00 UTC for WC 2026). See [ADR 0014](./docs/adr/0014-wc-landing-picks-first.md) for rationale.
- The cutoff is persisted **declaratively** on the existing `competitions.entry_closes_at` column (timestamptz, nullable; added by migration `20260521600000`). For WC competitions this is seeded to the soft cutoff instant by migration `20260527000000`. Super Admin can override the value directly in Supabase for early/late cutoffs without a deploy.
- After the cutoff, no new Entrants may join. `/wc/join` renders a "Joins closed" panel for non-members; existing members always pass through.
- Late joiners during the soft 72h window can submit predictions for any match that hasn't yet locked. `lock_time` enforcement on `/api/predictions` server-side rejects submissions for already-locked matches, so they auto-forfeit those.
- Late joiners during the soft window are included in the elimination curve entrant count if joining before PW1 lock; if joining after PW1 lock but before the 72h soft cutoff, the curve is immutable and they are slotted into the smallest existing group.
- Entrants receive zero points for any Fixture whose `lock_time` was already in the past at the moment of their join.
- Scored participation requires authentication (Google OAuth or email magic link).

### 16.11 Roles and Authority

**Super Administrator:** Official template maintenance, result confirmation, result correction, finalisation, elimination triggers, standalone knockout publication, archive export.

**Competition Admin:** Private Prediction Game setup, invite settings, presentation copy, entrant preset selection. Cannot confirm results, finalise stages, correct results, or alter official fixtures.

### 16.12 Deferred Items

The following are explicitly deferred and must not be assumed or implied:

| Item | Status |
|---|---|
| ~~Exact Format Classification elimination curves~~ | **Resolved** — see §16.8 and ADR 0008 |
| ~~Awkward-count behaviour between 2, 3, and 4 Final Window Entrants~~ | **Resolved** — finalist bands in §16.8 |
| Proportional elimination curve | Phase 2 exploration |
| Full manual curve editor | Not Phase 1 |
| Pre-Tournament Stage Pick classification — detailed design | Phase 1, pending dedicated session |
| Live/projection leaderboards as authoritative | Phase 1 provisional only |
| Per-Fixture locking | Phase 1 uses window-level locking |
| Standalone Knockout Prediction surface abstraction model | Pending clarification (ADR 0009) |
| Escalating points mode | Phase 2 |
| ~~Best-third rounding for non-standard group counts~~ | **Resolved** — group-size-aware rules in §16.8 |

### 16.13 Superseded Decisions

| Earlier position | Updated position |
|---|---|
| Three concurrent Classifications | Five: Overall, Format, Full Bracket, Knockout Bracket, Pre-Tournament Stage Pick |
| Format final always has exactly 2 Entrants | Finalist count is band-derived: 2/3/4 (see 16.8) |
| New Entrants join until final Group Stage window locks | Parent game closes at PW1 lock |
| Parent game closes at PW1 lock | Parent game closes 72h after first MD1 kickoff (soft cutoff); see ADR 0014 |
| 9 Prediction Windows (Third-Place and Final separate) | 8 Prediction Windows (PW8 = Third-Place + Final bundled) |
| Elimination curves deferred (ADR 0008) | **Resolved** — formula-based generation from any count 8-96 |
| Knockout-only game as separate duplicated backend | Clarification required; must not duplicate canonical data (ADR 0009) |
| Admin confirms results | Super Administrator confirms; Competition Admin cannot |
