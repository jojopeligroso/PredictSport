# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Social sports prediction platform. Users join competitions across different friend groups, predict outcomes of real sporting events, earn points based on accuracy, and compete on leaderboards. No betting or wagering. Digitises a paper prediction sheet used by Wexford FC supporters.

## Commands

```bash
npm run dev          # Start Next.js dev server (ASK before running — port conflicts)
npm run build        # Production build
npm run lint         # ESLint (flat config, eslint.config.mjs)
npm start            # Start production server
```

No test framework configured yet.

## Architecture

**Stack:** Next.js 16 (App Router) + TypeScript strict + Tailwind CSS 4 + Supabase (PostgreSQL + Auth). No ORM — Supabase JS client directly. Deployed on Vercel (free tier).

**Path alias:** `@/*` maps to `./src/*`

### Key Directories

- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — Shared components (NavBar, AuthRequired, UserMenu, etc.)
- `src/lib/supabase/` — Supabase client helpers (browser: `client.ts`, server: `server.ts`, session refresh: `middleware.ts`)
- `src/lib/sports/` — Sports data provider abstraction layer
- `src/lib/admin.ts` — Admin role verification helper
- `src/lib/scoring.ts` — Scoring engine for all 6 prediction types
- `src/types/database.ts` — TypeScript types mirroring the Supabase schema
- `supabase/migrations/` — SQL migration files

### Sports Provider System

All external sports data flows through a provider abstraction in `src/lib/sports/`:

- **`types.ts`** — `SportsProvider` interface: every provider implements `getResult()` and `searchEvents()`, returning `NormalizedResult` or `SearchableEvent[]`
- **`providers/base.ts`** — `BaseProvider` abstract class with shared `apiFetch()`, rate limiting, timeout (10s), and auth header handling. The only place `fetch()` is called.
- **`providers/*.ts`** — 8 provider implementations (OpenF1, API-Football, TheSportsDB, BALLDONTLIE, MLB Stats, ESPN, TheRacingAPI, Manual)
- **`registry.ts`** — Priority-ordered provider list per sport. First non-null result wins, falls back to manual.

**Adding a new provider:** Extend `BaseProvider`, implement `getResult`/`searchEvents`, register in `registry.ts`.

### Auth Flow

Uses `@supabase/ssr` with cookie-based sessions. `src/middleware.ts` runs on every request (except static assets) to refresh sessions via `src/lib/supabase/middleware.ts`. Google OAuth login at `/login`. Protected pages use the `<AuthRequired>` wrapper component.

### API Routes

- `POST /api/predictions` — Submit/update a prediction (validates lock time server-side)
- `POST /api/sports/fetch-result` — Fetch result for a sport/event from providers
- `POST /api/sports/search` — Search upcoming events across providers
- `POST /api/admin/competitions` — Create competition; `PATCH` for status transitions
- `POST /api/admin/events` — Create event; `PATCH` to update/postpone/cancel
- `POST /api/admin/confirm-result` — Confirm result + auto-score all predictions
- `PATCH /api/admin/members` — Promote/demote competition members
- `PATCH /api/admin/nominations` — Approve (auto-creates event) or reject
- `POST /api/admin/invite` — Generate invite token

## Current Phase: Integration & Testing

**Completed:** MVP scope, Supabase schema + RLS, Next.js scaffold, sports providers (8), all MVP pages (auth, predictions, leaderboard, admin), scoring engine.

**Next priorities:**
1. Deploy migration to Supabase project
2. Configure Google OAuth in Supabase dashboard
3. End-to-end testing with real data
4. UI polish and responsive testing
5. Vercel deployment

## Environment Variables

See `.env.local.example`. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Optional server-side: `API_FOOTBALL_KEY`, `BALLDONTLIE_KEY`, `THERACING_API_KEY` (providers disabled if missing).

## Development Conventions

- Server components where possible, client components only for interactive elements
- Supabase RLS policies for access control — no server-side auth checks duplicating RLS
- Handle loading/error states properly (see global CLAUDE.md pitfalls)
- Feature branches off `master`

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

## Specification Documents

Detailed product specs are split into separate files. Read these when working on the relevant area:

- **[docs/SPEC-MVP.md](docs/SPEC-MVP.md)** — MVP philosophy, competition structure, event nominations, WhatsApp integration
- **[docs/SPEC-PREDICTIONS.md](docs/SPEC-PREDICTIONS.md)** — All 6 prediction types, scoring system, presets, tiebreakers, open questions
- **[docs/SPEC-SPORTS-DATA.md](docs/SPEC-SPORTS-DATA.md)** — Sports API coverage per sport, data flow, rate limits, BALLDONTLIE details
- **[docs/SPEC-DATA-MODEL.md](docs/SPEC-DATA-MODEL.md)** — Full data model (all tables), domain rules, roles

## Future Enhancements (NOT MVP)

- Seasons / best-X-of-N aggregation across competitions
- Competition cloning
- Promotion/relegation
- Mobile native app
- Email/SMS notifications
- Public competition discovery / browse page
- Social features (comments, reactions on predictions)
- Live in-play predictions
