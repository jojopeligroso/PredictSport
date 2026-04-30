# PredictSport

Social sports prediction platform. Users join competitions across different friend groups, predict outcomes of real sporting events, earn points based on accuracy, and compete on leaderboards. No betting or wagering.

Originated as a paper/PDF prediction sheet used by a local soccer club. This app digitises and scales that experience — making it accessible to multiple groups with minimal admin overhead.

## Current Phase: Project Setup

**Status:** Greenfield — defining MVP scope, then scaffolding.

**Immediate priorities:**
1. Finalise MVP scope (this file)
2. Set up Supabase project (PostgreSQL + Auth)
3. Scaffold Next.js app
4. Implement core data model
5. Build prediction submission + leaderboard pages

## MVP Philosophy

**Reduce admin friction.** The biggest problem with the current PDF format is that one person has to maintain everything manually. The app must automate as much as possible — especially result ingestion — so running a competition is nearly zero-effort.

**Support multiple groups.** Different friend groups, clubs, or workplaces should each be able to run their own competitions independently. A user can be in multiple competitions.

**Full prediction type system.** The PDF only uses "pick the winner", but the app should support all prediction types from the start. This is core product differentiation, not a nice-to-have.

**Engaging leaderboard.** This is where the fun lives. Make it worth checking daily.

## Architecture

| Layer | Technology | Hosting |
|-------|-----------|---------|
| App | Next.js (App Router, TypeScript, Tailwind) | Vercel (free) |
| Database | PostgreSQL | Supabase (free tier) |
| Auth | Supabase Auth | Supabase |
| Notifications | WhatsApp Cloud API | Meta (free tier — 1,000 conversations/month) |

**No separate backend for MVP.** Next.js API routes + Supabase direct client handle auth, data, and scoring. Sports API fetching runs as Vercel cron jobs (free tier: 1 per day) or on-demand via admin trigger.

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

### Open Scoring Questions (TBD)

- Exact partial credit formula for margin-of-victory predictions
- Whether multiple prediction types can stack on a single event (e.g. both "Winner" and "Margin")
- Full tiebreaker ordering when multiple users have same distance from correct value

## Sports Data & Result Ingestion

**Minimising admin maintenance is critical for accessibility.** If every result requires manual entry, only dedicated admins will run competitions. Sports API integration is MVP, not future.

| Sport | Primary API | Fallback | Notes |
|-------|-----------|----------|-------|
| Formula 1 | OpenF1 (official) | — | Excellent. Race, qualifying, fastest lap. Free, no key. |
| Soccer (Premier League, Champions League, etc.) | API-Football (free tier) | TheSportsDB | 100 req/day free. Major leagues well covered. |
| Soccer (League of Ireland, FAI Cup) | TheSportsDB | Manual | Niche leagues may need manual entry. |
| Soccer (World Cup 2026) | BALLDONTLIE | API-Football | BALLDONTLIE has dedicated World Cup 2026 endpoint. |
| Golf | TheSportsDB | Manual | Majors only on free tier. Tour events need manual. |
| Rugby (Six Nations, Heineken Cup) | TheSportsDB | Manual | International + major club competitions. |
| Tennis (Grand Slams, ATP/WTA) | TheSportsDB | — | Good coverage of majors. |
| GAA (Football, Hurling, Camogie) | None | — | **No public API exists.** Manual admin entry only. |
| Horse Racing (Cheltenham, Grand National, Epsom) | TheRacingAPI | Manual | Free tier available for UK & Ireland. Evaluate coverage. |
| Snooker | None (reliable free) | Manual | No good free API. Manual entry. |
| MLB | MLB Stats API (official) | BALLDONTLIE | `statsapi.mlb.com` — free, no key, excellent. |
| NFL | ESPN unofficial | BALLDONTLIE | `site.api.espn.com` — no key, undocumented. |
| NBA | BALLDONTLIE (free tier) | ESPN unofficial | BALLDONTLIE has strong NBA coverage. |
| NHL | ESPN unofficial | BALLDONTLIE | Same ESPN caveat as NFL. |
| Ladies Football / Camogie | None | — | Manual admin entry only. |
| Ladies Golf (Solheim Cup) | TheSportsDB | Manual | Limited coverage. |

**Use the best official API per sport, not ESPN for everything.** ESPN's unofficial API (`site.api.espn.com`) is undocumented and may break — use it as fallback, not default.

**BALLDONTLIE** (`balldontlie.io`): Free tier covers basic data for NBA, NFL, MLB, NHL, EPL, World Cup. Paid tiers ($9.99-$39.99/mo) add real-time data and odds. Evaluate free tier coverage before committing.

**API discovery:** Use the **Firecrawl MCP** to scrape API docs when evaluating new sports data sources. The **Public APIs** catalogue (`github.com/public-apis/public-apis`) is a good starting point for finding free endpoints.

**Data flow:**
1. Vercel cron job or admin-triggered fetch checks for results of active events
2. Results stored in DB as **provisional**
3. Admin gets notification: "Result ingested for [Event] — confirm or correct"
4. Admin confirms (one-click) or corrects, then result becomes **final**
5. Scores calculated automatically on confirmation
6. Users never hit external APIs directly

**Key principles:**
- Prefer official APIs over unofficial scrapers
- Cache aggressively — fetch once, serve from DB
- Graceful fallback to manual entry when APIs fail or lack coverage
- Rate-limit awareness: most free tiers are 100-1000 req/day

## Event Nominations

Participants can nominate sporting events for inclusion in a competition:

1. Any participant submits a nomination (event name, sport, date, suggested prediction type)
2. Competition admin receives notification
3. Admin approves (optionally modifying details), rejects (with optional reason), or ignores
4. Approved events appear in the competition; nominator is notified
5. Rejected nominations notify the nominator with the reason

This keeps competitions fresh and reduces the burden on the admin to think of every event.

## Competition Structure

- **Multiple groups supported.** Each competition is independent with its own admin, participants, scoring rules, and events.
- **A user can be in multiple competitions simultaneously** with different roles in each.
- **Visibility:** Public (open join) or Private (invite only), set at creation.
- **Join methods:** Direct invite, shareable invite link (tokenised URL), or open join for public competitions.
- **Competition types:**
  - *Fixed* — all events defined at creation, locked set
  - *Open/Rolling* — events added throughout the lifetime (requires nominations or admin adding)
- **Co-admins:** Creator can appoint co-admins who share all powers except deleting the competition.

## MVP Pages

### Page 1: My Predictions / Home
- List of all events in the active competition
- User's predictions inline (editable if not yet locked)
- Colour coding: correct (green), wrong (red), partial (amber), pending (grey), locked-awaiting-result (neutral)
- Lock countdown for upcoming events
- Submit/edit predictions directly on this page
- Filter by sport, status, date

### Page 2: Leaderboard
- Rank, name, total points, correct/partial/wrong counts, accuracy %
- Expandable rows to see each person's predictions vs correct answers
- Tiebreaker value shown for tied scores
- Visual flair — position changes, streaks, momentum indicators
- Competition selector if user is in multiple competitions

### Page 3: Admin Panel
- Add/edit events for the competition
- Enter or confirm results (one-click confirm for API-fetched results)
- Review event nominations (approve/reject)
- Manage participants and co-admins
- Invite link management
- Scoring rule configuration (at creation only)

### Auth
- Google OAuth via Supabase
- Invite link to join a competition (share in WhatsApp/wherever)

## WhatsApp Integration

Use the **WhatsApp Cloud API** (official Meta API). Free tier: 1,000 service conversations/month.

**Notifications:**
- "New competition created — join here: [link]"
- "Reminder: [Event] locks in 24 hours — submit your prediction!"
- "Result confirmed: [Event] — [Answer]. Leaderboard updated!"
- Weekly/monthly leaderboard summary
- "New event nominated by [User] — review it"

**Requirements:**
- WhatsApp Business Account (free)
- A dedicated phone number for the bot
- Users opt in by messaging the bot first (WhatsApp policy)

**If WhatsApp adds too much friction to initial build:** ship with in-app notifications first, add WhatsApp as a fast follow.

## Data Model

```
users
  id                      uuid PK
  email                   text unique
  display_name            text
  avatar_url              text nullable
  is_super_admin          boolean (default false)
  notification_prefs      jsonb
  created_at              timestamp

competitions
  id                      uuid PK
  name                    text
  description             text nullable
  type                    text ('fixed' | 'open')
  visibility              text ('public' | 'private')
  status                  text ('draft' | 'active' | 'completed')
  scoring_rules           jsonb (preset name + overrides)
  lock_default_minutes    integer (default 5)
  allow_nominations       boolean (default true)
  created_by              uuid FK users
  invite_code             text unique
  created_at              timestamp

competition_members
  id                      uuid PK
  competition_id          uuid FK competitions
  user_id                 uuid FK users
  role                    text ('admin' | 'co_admin' | 'participant')
  joined_at               timestamp

events
  id                      uuid PK
  competition_id          uuid FK competitions
  event_name              text
  sport                   text
  start_time              timestamp
  lock_time               timestamp
  prediction_types        jsonb (which types are active + config)
  result_data             jsonb nullable (raw result from API or manual)
  result_confirmed        boolean (default false)
  result_confirmed_by     uuid FK nullable
  status                  text ('upcoming' | 'locked' | 'resulted' | 'postponed' | 'cancelled')
  nominated_by            uuid FK nullable
  external_event_id       text nullable (API reference)
  created_at              timestamp

predictions
  id                      uuid PK
  event_id                uuid FK events
  user_id                 uuid FK users
  prediction_type         text (which type this prediction is for)
  prediction_data         jsonb (flexible — structure depends on type)
  is_correct              boolean nullable
  is_partial              boolean (default false)
  points_awarded          integer (default 0)
  submitted_at            timestamp
  updated_at              timestamp

tiebreakers
  id                      uuid PK
  competition_id          uuid FK competitions
  question_text           text
  correct_value           integer nullable

tiebreaker_answers
  id                      uuid PK
  tiebreaker_id           uuid FK tiebreakers
  user_id                 uuid FK users
  value                   integer
  submitted_at            timestamp

event_nominations
  id                      uuid PK
  competition_id          uuid FK competitions
  nominated_by            uuid FK users
  event_name              text
  sport                   text
  proposed_date           date
  proposed_prediction_type text nullable
  status                  text ('pending' | 'approved' | 'rejected')
  admin_note              text nullable
  reviewed_by             uuid FK nullable
  created_at              timestamp

invite_tokens
  id                      uuid PK
  competition_id          uuid FK competitions
  token                   text unique
  created_by              uuid FK users
  expires_at              timestamp nullable
  max_uses                integer nullable
  use_count               integer (default 0)
  created_at              timestamp
```

## Key Domain Rules

1. **Prediction lock is server-side.** Client countdown is cosmetic. Supabase RLS or API route rejects submissions after `lock_time`.
2. **Predictions hidden until lock.** Other users' answers invisible before lock. Admin cannot see them either.
3. **After lock, all predictions visible.** Everyone can see what everyone else picked.
4. **Results: provisional then confirmed.** API-fetched results are provisional until admin confirms with one click. Manual results also go through confirmation.
5. **Scoring is automatic on confirmation.** Once admin confirms a result, points are calculated for all users immediately.
6. **Scoring rules immutable after competition starts.** Set at creation, cannot change mid-competition.
7. **Competition type immutable after creation.** Fixed stays fixed, open stays open.

## Roles

| Role | Scope | Key Power |
|------|-------|-----------|
| Super Admin | Global | Override scores, view all predictions, manage all users |
| Competition Admin | Per competition | Create/manage competitions, confirm results, approve nominations |
| Co-Admin | Per competition | Same as admin except cannot delete competition |
| Participant | Per competition | Submit predictions, nominate events, view leaderboard |

A user may hold different roles across different competitions simultaneously.

## Development Conventions

### Stack
- Next.js (App Router) with TypeScript strict mode
- Tailwind CSS for styling
- Supabase client (JS SDK) for auth and database
- Supabase RLS policies for access control
- No ORM — use Supabase client directly

### Patterns
- Server components where possible, client components for interactive elements
- Handle loading/error states properly (see global CLAUDE.md pitfalls)
- No emojis in code or comments
- Meaningful commit messages
- Feature branches off `main`

## MCP Servers Available

| MCP | Purpose |
|-----|---------|
| Supabase | Database operations, project management, migrations |
| Playwright | Browser testing, E2E |
| Context7 | Up-to-date library/framework documentation |
| GitHub | PRs, issues, repo management |
| Firecrawl | Scrape web pages as markdown — use for API docs research, sports data source evaluation |

## Multi-Session Warning

**NEVER run these commands without explicit user confirmation:**
- `npm run dev` — starts dev server
- Any command that binds to a port

**Before running any server command, ASK:**
> "Should I start the dev server? (Check no other session is using the port)"

## Future Enhancements (NOT MVP)

- Seasons / best-X-of-N aggregation across competitions
- Competition cloning
- Promotion/relegation
- Mobile native app
- Email/SMS notifications
- Public competition discovery / browse page
- Social features (comments, reactions on predictions)
- Live in-play predictions
