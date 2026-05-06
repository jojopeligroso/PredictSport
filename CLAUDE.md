# CLAUDE.md

## Project Overview

Social sports prediction platform. Admin builds competitions with rounds of mixed-sport events. Participants predict outcomes, earn points, compete on leaderboards. No betting. Digitises a paper prediction sheet used by Wexford FC supporters.

## Commands

```bash
npm run dev          # Start Next.js dev server (ASK before running — port conflicts)
npm run build        # Production build
npm run lint         # ESLint (flat config, eslint.config.mjs)
```

No test framework configured yet.

## Architecture

**Stack:** Next.js 16 (App Router) + TypeScript strict + Tailwind CSS 4 + Supabase (PostgreSQL + Auth). No ORM. Deployed on Vercel (free) + Supabase (free tier).

**Path alias:** `@/*` maps to `./src/*`

### Key Directories

- `src/app/` — Pages and API routes
- `src/components/` — Shared components
- `src/lib/supabase/` — Supabase clients (browser, server, proxy)
- `src/lib/sports/` — Sports data provider abstraction
- `src/lib/scoring.ts` — Scoring engine (6 prediction types)
- `src/types/database.ts` — TypeScript types mirroring schema
- `supabase/migrations/` — SQL migrations
- `docs/` — Spec docs (read when working on relevant area)

### Data Model (key relationships)

```
Competition → Rounds → Events → EventPredictionTypes
                                → Predictions
Competition → CompetitionMembers
```

- **Rounds** group events (can mix sports/leagues). `round_number` unique per competition.
- **EventPredictionTypes** normalised table. Each row = one prediction type for one event, with its own points/partial_points/config.
- **Competition.scoring_rules** is the default template; `event_prediction_types` is source of truth per event.
- **Competition.min_rounds_required** — minimum rounds to participate (null = all).
- **Competition.allow_prediction_updates** — can participants change predictions before lock?
- `events.prediction_types` JSONB column has been dropped. All prediction type data is in `event_prediction_types` rows.

### Sports Provider System

Provider abstraction in `src/lib/sports/`. `BaseProvider` handles fetch, rate limiting, timeouts. Registry chains providers per sport — first non-null result wins.

| Provider | Sports | Key Needed | Cost |
|----------|--------|------------|------|
| OpenF1 | F1 | No | Free |
| API-Football | Soccer | `API_FOOTBALL_KEY` | Free (4/hr cap) |
| TheSportsDB | Soccer, Golf, Rugby, Tennis | No | Free |
| ESPN | NFL, NHL, NBA, MLB, Soccer, Rugby, Golf, Tennis, Snooker | No | Free (unofficial) |
| BallDontLie | NBA (+paid: NFL, MLB, NHL) | `BALLDONTLIE_KEY` | Free NBA |
| MLB Stats | MLB | No | Free |
| TheRacingAPI | Horse Racing | `THERACING_API_KEY` | Free tier |
| Foireann | GAA | `FOIREANN_API_KEY` | Free |
| Manual | All (fallback) | N/A | N/A |

**Adding a sport/provider:** Add to `Sport` type → create provider extending `BaseProvider` → register in `registry.ts` → add env var to `.env.local.example`.

### API Routes

- `POST /api/predictions` — Submit/update prediction (lock time enforced server-side)
- `GET /api/sports/fixtures?league={id}` — Upcoming fixtures (TheSportsDB, 5min cache)
- `GET /api/sports/search?sport=X&q=Y` — Search events across providers
- `POST /api/sports/fetch-result` — Fetch result from provider chain
- `POST /api/admin/competitions` — Create; `PATCH` for status transitions
- `POST /api/admin/events` — Create; `PATCH` to update/postpone/cancel
- `POST /api/admin/confirm-result` — Confirm + auto-score all predictions

### Auth

`@supabase/ssr` cookie sessions. `src/proxy.ts` refreshes on every request. Google OAuth at `/login`. `<AuthRequired>` wrapper for protected pages.

## Current Phase: Prototype Testing

**Deployed:** https://predictsport-rust.vercel.app (auto-deploys from master)
**Supabase:** ref `wujgqjjddonxoddkgbxy` (West EU Ireland)
**Google OAuth:** project `predictsport-495219`

**Completed:**
- Schema + RLS (rounds, event_prediction_types, all CRUD policies)
- Google OAuth, Vercel deployment
- 9 sports providers + fixture browser
- MVP pages (auth, predictions, leaderboard, admin)
- Scoring engine, UI polish, E2E scaffolding

**Next priorities:**
1. Fixture search UX (search by team/competition/date, admin competition builder)
2. WhatsApp notification integration (Cloud API)
3. Wire up full prediction → result → scoring flow with real data
4. Request Foireann API key and test GAA provider
5. Run seed script (`npx tsx scripts/seed-quiz-2026.ts`) and test full flow

## Environment Variables

See `.env.local.example`. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Optional: `API_FOOTBALL_KEY`, `BALLDONTLIE_KEY`, `THERACING_API_KEY`, `FOIREANN_API_KEY`.

## Conventions

- Server components by default, client only for interactivity
- RLS for access control — don't duplicate in API routes
- Handle loading/error states (see global CLAUDE.md pitfalls)
- Feature branches off `master`

## MCP Servers

Supabase, Playwright, Context7, GitHub, Firecrawl

## Specs (read when working on relevant area)

- [docs/SPEC-MVP.md](docs/SPEC-MVP.md) — MVP philosophy, competition structure, nominations
- [docs/SPEC-PREDICTIONS.md](docs/SPEC-PREDICTIONS.md) — 6 prediction types, scoring, presets
- [docs/SPEC-SPORTS-DATA.md](docs/SPEC-SPORTS-DATA.md) — API coverage, data flow, rate limits
- [docs/SPEC-DATA-MODEL.md](docs/SPEC-DATA-MODEL.md) — Full schema, domain rules, roles

## Multi-Session Warning

**NEVER run `npm run dev` or port-binding commands without explicit user confirmation.**

**Concurrent sessions:** `/PredictSport-next-task` runs `git status --short` first. If there are unstaged changes you didn't make, STOP — another session is active. List the modified files, ask which are safe to touch, and do not modify files another session is editing.
