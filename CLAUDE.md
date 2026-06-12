# CLAUDE.md

## Project Overview

Social sports prediction platform. Tournament blueprints define fixture catalogues, classification definitions, scoring rules, and bracket shapes. Competition instances are instantiated from blueprints — multiple instances can run concurrently from the same blueprint. Participants join instances, predict fixture outcomes, earn points, compete on per-instance leaderboards. A Global Classification aggregates across instances when total entrants exceed a threshold. Built for bragging rights.

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

### Primary Product Surface: `/wc`

The active product is the `/wc` surface. All real users interact here. Generic routes (`/predictions`, `/leaderboard`, `/competitions`) exist as platform infrastructure for future non-WC competitions but are secondary — they will adopt `/wc` design decisions when built out.

**Two separate layout/navigation systems exist:**

| Surface | Layout | Top Chrome | Bottom Chrome | Guard |
|---------|--------|------------|---------------|-------|
| `/wc/*` (primary) | `src/app/wc/layout.tsx` | WC-branded nav (BrandMark, WcNavLinks, UserMenu, MobileNav) | **TabBar** — fixed bottom, 4 tabs | N/A |
| Generic routes | `src/app/layout.tsx` | NavBar + Footer | None | `GlobalChromeGuard` hides this chrome on `/wc` |

**TabBar** (`src/components/wc/TabBar.tsx`) — the primary navigation for all engaged users on `/wc`:

| Tab | Icon | Route | Active when |
|-----|------|-------|-------------|
| Home | House | `/wc/home` | path starts with `/wc/home` |
| Picks | Crosshair | `/wc` | path is `/wc` or starts with `/wc/picks` |
| Board | Trophy | `/wc/leaderboard` | path starts with `/wc/leaderboard` |
| Chat | Speech bubble | `/wc/leaderboard#chat` | never (hardcoded `false` — no dedicated route yet) |

Rendered in `wc/layout.tsx:160` as `{engaged && <TabBar />}` — visible to all authenticated competition members across every `/wc` page. Fixed position, 52px height + safe-area-inset-bottom, z-40.

**Other infrastructure components rendered by layouts:**
- `DisplayNameModal` — blocks interaction until display name is set (z-60)
- `PushNotificationPrompt` — push notification opt-in (z-50, auto-triggers after 800ms)
- `InstallPrompt` / `PwaInstallGuide` — PWA install prompts (z-50)
- `ServiceWorkerRegistration` — registers `/sw.js` for PWA
- `ThemeProvider` / `LocaleProvider` — theme and i18n context

### Key Directories

- `src/app/wc/` — Primary product pages (home, picks, leaderboard, bracket, chat, admin)
- `src/app/` — Generic routes + API routes
- `src/components/wc/` — WC-specific components (TabBar, RivalPredictionsTab, JoinFlow, OnboardingFlow, etc.)
- `src/components/chat/` — Chat components (ChatWidget, ChatMessage, useRealtimeChat)
- `src/components/tournament/` — Tournament components (ClassificationTabs, bracket wizard)
- `src/components/ui/` — Shared UI primitives (Avatar, PickButton, CountdownChip, etc.)
- `src/components/` — Shared infrastructure (NavBar, Footer, MobileNav, ThemeProvider)
- `src/lib/supabase/` — Supabase clients (browser, server, proxy)
- `src/lib/sports/` — Sports data provider abstraction
- `src/lib/scoring.ts` — Scoring engine (10 prediction types)
- `src/types/database.ts` — TypeScript types mirroring schema
- `supabase/migrations/` — SQL migrations
- `docs/` — Spec docs (read when working on relevant area)

### Data Model (key relationships)

```
Tournament Blueprint (sporting_tournaments + sporting_stages + bracket_templates)
  └─ Fixture Catalogue (events — shared across all instances)

Competition Instance (competitions row) → Rounds → Events → EventPredictionTypes
                                                           → Predictions
Competition Instance → CompetitionMembers → ClassificationMemberships
```

- **Blueprint vs Instance:** A tournament blueprint defines the fixture catalogue, classification types, scoring defaults, and bracket shape. Competition instances are instantiated from blueprints. Fixtures are shared; predictions/standings are per-instance. See `docs/WC-TERMINOLOGY-CONTRACT.md`.
- **Personal competitions** — Each user has one `type='personal'` competition instance (auto-created at signup). Same schema as group instances but `scoring_rules='{}'`, no rounds, events created on-the-fly. See `docs/DESIGN-PERSONAL-PREDICTIONS-UNIFICATION.md`.
- **Rounds** group fixtures (can mix sports/leagues). `round_number` unique per instance.
- **EventPredictionTypes** normalised table. Each row = one prediction type for one event, with its own points/partial_points/config.
- **Competition.scoring_rules** is the default from the blueprint; `event_prediction_types` is source of truth per event.
- **Competition.min_rounds_required** — minimum rounds to participate (null = all).
- **Competition.allow_prediction_updates** — can participants change predictions before lock?
- `events.prediction_types` JSONB column has been dropped. All prediction type data is in `event_prediction_types` rows.
- **10 prediction types:** winner, yes_no, head_to_head, top_n, final_standings, margin, over_under, handicap, progression, exact_score. See SPEC.md §6 for full reference. `exact_score` always pairs with `winner`; score format is auto-derived from `events.sport`.
- **H2H draws** are sport-dependent. `config.allow_draw` enables draw option; `config.draw_points` sets points for correct draw prediction. Both-DNF = void (null). See SPEC.md §6.
- **Pick reveal** (`pick_reveal_at`): defaults to `lock_time` but admin can delay for dramatic tension. RLS enforces visibility.

### Sports Provider System

Provider abstraction in `src/lib/sports/`. `BaseProvider` handles fetch, rate limiting, timeouts. Registry chains providers per sport — first non-null result wins.

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

**Adding a sport/provider:** Add to `Sport` type → create provider extending `BaseProvider` → register in `registry.ts` → add env var to `.env.local.example`.

### API Routes

- `POST /api/predictions` — Submit/update prediction (lock time enforced server-side)
- `GET /api/sports/fixtures?league={id}` — Upcoming fixtures (TheSportsDB, 5min cache)
- `GET /api/sports/search?sport=X&q=Y` — Search events across providers
- `POST /api/sports/fetch-result` — Fetch result from provider chain
- `POST /api/admin/competitions` — Create; `PATCH` for status transitions
- `POST /api/admin/events` — Create; `PATCH` to update/postpone/cancel; `DELETE` to remove (blocked if predictions exist)
- `POST /api/admin/confirm-result` — Confirm + auto-score all predictions
- `POST /api/personal-predictions/event` — Create event in personal competition (idempotent on `external_event_id`)
- `POST /api/personal-predictions/predict` — Upsert personal prediction (no lock time, freely editable before start)
- `POST /api/personal-predictions/outrights` — Create/update outright (final_standings) prediction with change budget
- `GET /api/personal-predictions/outright-suggestions` — Leagues with 3+ picks but no outright; `POST` to dismiss

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
- Personal predictions unification: Phase A (migrations) + Phase B (APIs B1-B5)

**In progress:** Personal predictions unification Phase B6 (dashboard stats), Phases C-F. See `todos.md`.

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

**Layout container:** Layout files do NOT wrap children in a container. Each page provides its own `max-w-[480px]` wrapper. Landing page is full-width hero. The generic NavBar/Footer use `max-w-3xl`. The `/wc` surface uses its own branded top nav + fixed TabBar (see Architecture above).

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

## Gotchas — Elimination Curve & Group Draw

1. **Elimination curve stores absolute numbers but must scale to actual entrants.** The DB config has `{ entrantCount: 48, curve: [{remaining: 32}, ...] }`. If 37 people join, the raw target (32 survivors from 37) is mathematically impossible. `getEliminationCurve()` auto-scales via `generateEliminationCurve(actualEntrants)` when counts differ. NEVER use the stored curve without passing `actualEntrants`.

2. **Group draw is lazy, not scheduled.** There is no cron or timer. The draw triggers when a user hits `GET /api/tournament/my-group` after `drawAt` has passed. The countdown timer in the UI is purely cosmetic. If the draw fails, it will fail silently on every subsequent page load until the root cause is fixed.

3. **`computeGroupComposition(N, S)` has hard constraints.** Max survivors = `totalGroups * 2 + groups5 + groups4` (top 2 per group + thirds from 5-player groups auto-qualify + best-thirds from 4-player groups). If the survivor target exceeds this maximum, the function throws. Always verify targets are achievable or use `generateEliminationCurve()` which guarantees valid targets.

4. **Draw errors surface as `status: "draw_error"` not `"draw_pending"`.** Never silently return `draw_pending` when the draw actually failed — that creates an infinite silent failure loop where every page load retries and fails.

5. **`addLateEntrant` does not rebalance groups.** It adds the new member to the smallest group. It does NOT move existing members to create a cleaner composition (e.g. 40 entrants won't auto-redraw from 37+3). Rebalancing requires a full redraw via `allocatePredictionGroups` (only safe if `canRegenerateDraw` returns true).

## Gotchas — Vercel Hobby Plan Limits

This project runs on **Vercel Hobby (free)**. These limits bite silently:

1. **1 concurrent build** — pushes from multiple sessions queue up. Deploys can take 5–10 min when the queue is backed up. Don't push rapidly; batch changes into fewer commits when possible.
2. **2 cron jobs max, daily cadence only** — `vercel.json` has 1 active cron (`/api/results/cron`). Adding a second is the max. Sub-daily schedules (`*/5 * * * *`) require Pro. Dormant crons are documented in `vercel.crons.dormant.json` — never move more than 2 into `vercel.json`.
3. **100 deploys/day** — each push to `master` triggers a deploy. Multi-session days can burn through this fast. If deploys stop triggering, this limit may be the cause.
4. **6000 build min/month** — Next.js builds take ~1–2 min each. At 20+ deploys/day this adds up. No way to check remaining minutes via API.

## Multi-Session Warning

**NEVER run `npm run dev` or port-binding commands without explicit user confirmation.**

**Concurrent sessions:** `/PredictSport-next-task` runs `git status --short` first. If there are unstaged changes you didn't make, STOP — another session is active. List the modified files, ask which are safe to touch, and do not modify files another session is editing.
