# CLAUDE.md

## Project Overview

Social sports prediction platform. Admin builds competitions with rounds of mixed-sport events. Participants predict outcomes, earn points, compete on leaderboards. Built for bragging rights. Digitises a paper prediction sheet used by Wexford FC supporters.

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
- **9 prediction types:** winner, yes_no, head_to_head, top_n, final_standings, margin, over_under, handicap, progression. See SPEC.md §6 for full reference.
- **H2H draws** are sport-dependent. `config.allow_draw` enables draw option; `config.draw_points` sets points for correct draw prediction. Both-DNF = void (null). See SPEC.md §6.
- **Pick reveal** (`pick_reveal_at`): defaults to `lock_time` but admin can delay for dramatic tension. RLS enforces visibility.

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
- `POST /api/admin/events` — Create; `PATCH` to update/postpone/cancel; `DELETE` to remove (blocked if predictions exist)
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

**Known gaps:** All §15 punch list items complete. See `todos.md` and `SPEC.md §15` for history.

## Environment Variables

See `.env.local.example`. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Optional: `API_FOOTBALL_KEY`, `BALLDONTLIE_KEY`, `THERACING_API_KEY`, `FOIREANN_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

## Design System

See `design/README.md` for full brand brief and asset references.

**Mobile-first.** Primary target is 390px (iPhone 14). App pages use `max-w-[480px]` containers. Desktop should look intentional but is secondary — widen nav/footer (max-w-3xl), scale up landing page, keep app screens narrow and centered.

**Palette:** Cream `#efe9de` (bg), Ink `#191512` (text), Amber `#f59e0b` (accent), Green `#0aa86d` (correct), Red `#e23d4f` (wrong). All via `ps-*` Tailwind tokens.

**Typography:** Inter 800 (`font-display font-extrabold`) for headlines/wordmark. Inter 600 for UI labels. Inter 500 for body. JetBrains Mono (`font-mono`) for scores/stats/metadata. Instrument Serif italic (`font-serif italic`) for taglines/quips.

**Wordmark:** `sportspredict.` — Inter 800, lowercase, tight tracking. `sports` in ink, `predict.` in amber with period. Never "PredictSport" or "PS".

**Brand marks:** Three rotating marks via `<BrandMark>` component (daily-stable weighted random): Oracle Dot (60%), GAA Umpire (30% / always for GAA), Bubble Call (10%). All use `currentColor` for auto dark mode inversion.

**Personality:** "Confident, cheeky, craftsman-warm." — pub chalkboard vibe. Culturally inferred, never explicit.

**Layout container:** `layout.tsx` does NOT wrap children in a container. Each page provides its own `max-w-[480px]` wrapper. Landing page is full-width hero. NavBar/Footer use `max-w-3xl`.

## Conventions

- Server components by default, client only for interactivity
- RLS for access control — don't duplicate in API routes
- Handle loading/error states (see global CLAUDE.md pitfalls)
- Feature branches off `master`

## Manual Event Creation Checklist

When creating events via Supabase API/SQL (not through admin UI), always verify:
1. **`sport` field matches the actual sport** — not the provider default. Rugby is `rugby`, GAA is `gaa`, F1 is `formula_1`, etc. Never default to `soccer`.
2. **`lock_time`** is set before `start_time` (typically 30min before).
3. **`event_prediction_types`** rows are created for each prediction type on the event.
4. **`round_id`** is set if the event belongs to a round.
5. **`config.options`** on `winner` prediction types must list the team/participant names for A/B selection buttons. Without `config.options`, the UI falls back to a free-text input. For head-to-head matches: `{"options": ["Team A", "Team B"]}`. Use short team names (e.g. "Wexford" not "Wexford GAA Hurling").

## MCP Servers

Supabase, Playwright, Context7, GitHub, Firecrawl

## Specification

**[SPEC.md](SPEC.md)** — Single source of truth for product requirements, data model, scoring rules, prediction types, auth, competition lifecycle, and known gaps. Read before any feature work.

The `docs/SPEC-*.md` files are superseded by SPEC.md and kept only for historical reference.

## Multi-Session Warning

**NEVER run `npm run dev` or port-binding commands without explicit user confirmation.**

**Concurrent sessions:** `/PredictSport-next-task` runs `git status --short` first. If there are unstaged changes you didn't make, STOP — another session is active. List the modified files, ask which are safe to touch, and do not modify files another session is editing.
