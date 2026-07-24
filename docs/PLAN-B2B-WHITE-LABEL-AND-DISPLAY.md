# PLAN — B2B White-Label & Display-Site Build-Out

**Status:** Planning + Phase 0 (display-site fixes shipped to branch)
**Date:** 2026-07-24
**Branch:** `claude/predict-sport-display-planning-hs8ngv`
**Author:** Session planning doc (read-only DB investigation + display-site code changes)

> This document captures the full session: what the display site is, why the
> concluded World Cup was showing "coming soon", the fix that shipped, the
> decision to repoint the display to instance #3, and the complete end-to-end
> plan to build the B2B white-label product using the **Dominican Winter League
> (LIDOM)** and the **All-Ireland football & hurling championships (GAA)** as the
> two baseline tenants.

---

## 0. Executive summary

- **The display site is a separate *deployment*, not a separate *codebase*.** It's
  the same Next.js app deployed to a second Vercel project (`predictsport-display`)
  and switched into read-only, anonymised behaviour by one env var
  (`PRODUCT_MODE=world_cup_2026_archive`). Pushing to `master` does **not** change
  the live display site until someone re-runs `scripts/deploy-display.sh`.
- **The "coming soon" bug** on the finished World Cup was a **missing terminal
  state**: the `/wc` landing only recognised *pre-launch* and *live*, so a
  tournament where every round is `scored` fell back to the pre-launch empty
  panel. **Fixed** on-branch by adding a `concluded` state that renders the
  finished experience (Results / Fixtures / Groups tabs + round index).
- **The display site now targets WC instance #3** ("World Cup (Display)"), a
  purpose-built anonymised clone (synthetic members, demo viewer with a full
  240-prediction history). Deploy script updated on-branch.
- **B2B decisions locked:** hybrid auth, powered-by branding by default with a
  per-client full white-label option, and both baselines (LIDOM + GAA) built in
  parallel off one shared "surface kit".
- **No database changes were made.** All DB access this session was read-only
  `SELECT`. The display work is code + deploy-script only.

---

## PART 1 — The Display Site

### 1.1 What it actually is

| | Standard site | Display site |
|---|---|---|
| Vercel project | `predictsport-rust` (auto-deploys from `master`) | `predictsport-display` (manual — `scripts/deploy-display.sh`) |
| Env flag | `PRODUCT_MODE=predictsport_full` (default) | `PRODUCT_MODE=world_cup_2026_archive` |
| Auth | Full Google OAuth, real sessions | **None** — no login, viewer is a synthetic member |
| Writes | Full CRUD | **Blocked** — middleware 403s every non-GET |
| Routes | Everything | Read-only allowlist (`/wc/home`, `/leaderboard`, `/bracket`, `/entrant`, `/picks`, `/rules`, a few APIs) |
| Data | Live user competitions | A dedicated anonymised showcase instance |

Mechanism:
- `src/lib/product-mode.ts` — `getProductMode()` / `isWorldCupArchive()` resolve the mode.
- `src/middleware.ts` — `ARCHIVE_MODE` enforces read-only + the route allowlist and redirects `/` → `/wc`.
- `src/lib/wc/resolve-wc-archive.ts` — returns the display competition via the
  service client + a synthetic demo viewer, so data fetchers naturally pull that
  user's predictions/group/bracket.

**Key architectural point for the B2B plan:** deployment is fully separate, but
the *code* is shared. Both sites are built from the same source; the display site
only diverges where code branches on `isWorldCupArchive()` / `ARCHIVE_MODE`. So a
shared component edit lands on **both** sites at their next respective deploys
unless deliberately gated. This is exactly the seed of a white-label model.

### 1.2 The WC instance map (read-only investigation)

Project `wujgqjjddonxoddkgbxy` (PredictSport, active). `competitions` table:

| Competition ID | Name | Instance | `product_mode` | Status | Members | Created |
|---|---|---|---|---|---|---|
| `1a4448e5…370306` | World Cup | **#1** | `world_cup_2026_shell` | active | 48 | 22 May (earliest) |
| `256bbbb0…3edc69` | World Cup | #2 | `world_cup_2026_archive` | active | 48 | 22 May |
| `f54b17c9…ce36b2` | World Cup 2026 #2 | #2 | `world_cup_2026_shell` | active | 3 | 13 Jun |
| `11b22173…1d78f52` | World Cup (Display) | **#3** | `world_cup_2026_shell` | active | 48 | 19 Jul |

- **Instance #1** (`1a4448e5…`) is the foundational beta-testing core — 48 real members.
- **Instance #3** (`11b22173…`) is the purpose-built anonymised **display** clone —
  48 synthetic members. Shares the tournament's rounds via `tournament_id`
  (`a0000000…000026`); has no rounds of its own by `competition_id`.
- **Instance #3 is data-rich:** 104 events, **147 distinct predictors**, and the
  display demo viewer `a1c5e324…` holds **240 predictions** (a full tournament).
  So the display showcase is full, not empty — no seeding required.

### 1.3 The "coming soon" bug — root cause

Every WC instance is `status = 'active'` (not `completed`), and for instance #1
**all 8 rounds are `scored`** with all 104 events confirmed. The tournament is
complete in the data.

The `/wc` landing (`src/app/wc/page.tsx`) renders `ComingSoonPanel` whenever
`fetchMd1PicksData().ready === false`. That fetcher only recognises an
**actionable pick window**:

1. Group rounds 1–3 all `scored` → `hasActiveGroupRound = false` →
   `fetchKnockoutFallback`.
2. `fetchKnockoutFallback` looks for a knockout round in `draft`/`open`/`locked`.
   After the final, rounds 4–8 are all `scored` → no match → `ready: false`.

So the two ends of the lifecycle — *before the first fixture* and *after the
final* — both collapsed into the same `ready: false` branch, which only ever had
pre-launch copy. Hence a finished tournament showed "coming soon".

- `/wc/home` (`fetchDashboardData`) is **not** affected: it falls back to the most
  recent *scored* round (`scoredRoundResult`), so `currentRound` is set and it
  renders the finished dashboard. The user-visible "coming soon" was the `/wc`
  landing specifically.
- It was **not** a status problem (instance is `active`) and **not** a selection
  problem (display env pinned to an instance). It was purely the missing terminal
  state.

### 1.4 The fix (shipped on-branch)

Added a `concluded` terminal state so a finished tournament renders its history
instead of the pre-launch panel. Reuses the hub's existing scored-data tabs — no
new data plumbing, since `page.tsx` already fetches `fixturesData`/`groupsData`
independently of `md1Data.ready`.

**Files changed:**

- `src/app/wc/_landing/fetchMd1PicksData.ts`
  - Added `concluded: false` to the live-path success returns.
  - In `fetchKnockoutFallback`, when there's no actionable round: query round
    statuses; if ≥1 round exists and **every** round is `scored`, return a
    `ready: true, concluded: true` payload (empty events) instead of `ready: false`.
    Genuine pre-launch (no scored rounds) still returns `ready: false`.
- `src/app/wc/page.tsx` — pass `concluded={md1Data.concluded}` to `WcPicksHub`.
- `src/app/wc/_landing/WcPicksHub.tsx`
  - Accept a `concluded` prop.
  - When concluded and no explicit `?tab`, open on **Results** (not the empty
    Upcoming tab).
  - Show a minimal factual "Tournament complete" ribbon (consistent with the
    existing `Completed`/`Live` status labels — no originated marketing copy).
- On the display site (archive mode), the existing "Browse all rounds" round
  index in `WcPicksHub` now renders, because `ready: true` no longer
  short-circuits before that block in `page.tsx`.

**Verification:** `tsc --noEmit` passes (exit 0); ESLint clean on changed files.
(`npm run build` cannot complete in the sandbox because `next/font` can't reach
Google Fonts through the proxy — an environment limit, not a code issue; the
Vercel build has network access.)

**Design note — deliberately minimal:** `/wc/home` renders the finished dashboard
via its scored-round fallback, so it was left unchanged to keep risk low. Making
the concluded Upcoming tab and the dashboard "next picks" surfaces read as a
polished *post-tournament* view (champion hero, final standings headline) is a
follow-up polish item, not a blocker.

### 1.5 Repoint display → instance #3 (shipped on-branch)

Decision: the display site should showcase **instance #3** (the anonymised clone),
not instance #1 (real beta users). This keeps real testers' identities off a
public marketing surface while still showing the true #1 experience.

- Previously `scripts/deploy-display.sh` pinned instance #1 (`1a4448e5…`) via
  `WC_ARCHIVE_COMPETITION_ID` / `WC_ARCHIVE_DEMO_USER_ID`, which overrode the code
  fallback (which already targeted #3).
- **Changed:** both env vars in the deploy script now point at instance #3
  (`11b22173…`) and its valid demo viewer (`a1c5e324…`) — in both the build-time
  `.env.production` heredoc and the `vercel deploy --env` flags.
- Fixed the stale/contradictory docstring in `resolve-wc-archive.ts` (it said
  "instance #1" while the constant was #3).

This change takes effect on the next `scripts/deploy-display.sh` run — no live
deploy was triggered from this session.

### 1.6 Display-site follow-ups (not yet built)

- Post-tournament "champion + final standings" hero on the concluded `/wc` and on
  `/wc/home`.
- Optionally surface the "Browse all rounds" round index on the **standard** site
  too when concluded (currently archive-only).
- Decide the archival policy per blueprint: **concluded ≠ auto-hidden**. Visibility
  on the display side is a deliberate, per-instance editorial choice (e.g. WC #1's
  experience stays showcased via #3).

---

## PART 2 — B2B White-Label Build Plan

### 2.1 Locked decisions

| Decision | Choice | Consequence |
|---|---|---|
| **Auth model** | **Hybrid** | One underlying account system (single Google OAuth, one `users` table) + a `tenant_id` scoping layer. End users feel they belong to the customer brand; underneath it's one account space, so cross-tenant aggregation + Global Classification still work. |
| **Branding** | **Powered-by default, full white-label per client** | A `TenantConfig` flag (`branding: 'powered_by' \| 'full'`) — not two codebases. The "powered by sportspredict" mark shows unless a client's config sets `full`. |
| **Build order** | **Both baselines in parallel** | The shared kit is validated against two deliberately different sports at once (LIDOM baseball, no-draw, ES/EN; GAA goals+points, provincial draws, EN/GA). Most robust abstraction; the trade-off is a slightly slower first *live* deployment. |
| **Domains** | Custom domain per customer (assumed) | Vercel supports it; part of per-tenant deployment config. |
| **Backend/crons** | One shared Supabase + one central "worker" deployment | Results ingestion & scoring run once for all tenants, keeping per-deployment crons at zero (Vercel Hobby caps daily crons at 2). |

### 2.2 Target architecture

**One shared codebase + one shared Supabase.** Divergence is config-driven, not
fork-driven.

```
                 ┌─────────────────────────────────────────────┐
                 │            Shared Supabase (one DB)          │
                 │  competitions · rounds · events · predictions│
                 │  classifications · members · users(+tenant)  │
                 └───────────────▲──────────────▲───────────────┘
                                 │              │
        ┌────────────────────────┘              └───────────────────────┐
        │ reads/writes (scoped by tenant_id + RLS)                        │
┌───────┴────────┐   ┌────────────────┐   ┌────────────────┐   ┌─────────┴────────┐
│ Worker deploy  │   │ Tenant: LIDOM  │   │ Tenant: GAA    │   │ Aggregate /       │
│ (central cron: │   │ predictsport-  │   │ predictsport-  │   │ directory site    │
│ ingest+score   │   │ lidom (domain) │   │ gaa (domain)   │   │ (all tenants)     │
│ ALL tenants)   │   │ TENANT_ID=lidom│   │ TENANT_ID=gaa  │   │                   │
└────────────────┘   └────────────────┘   └────────────────┘   └───────────────────┘
   thin, branded read/write surfaces, each reading one TENANT_ID env
```

- **Thin per-tenant deployments**: each is a branded surface reading a single
  `TENANT_ID` env, pointed at the shared DB. No per-tenant backend or cron.
- **Central worker**: the existing main app runs `/api/results/cron` + scoring for
  every tenant's events.
- **Aggregation is a query, not a migration**: all tenants' competitions live in
  one DB; the Global Classification already aggregates across instances above a
  threshold.

**Precedent that de-risks this:** `scripts/deploy-display.sh` already proves
"same repo → separate Vercel project → behaviour switched by env var + a couple of
IDs". A tenant deployment is that pattern, generalised from a single hardcoded
mode to a `TenantConfig` registry.

### 2.3 What already exists (reusable today)

The app already runs **three branded surfaces from one engine**, which is the
white-label pattern in embryo:

- `/wc` (World Cup) — `src/app/wc/*`
- `/ligas-invernales` (Caribbean winter baseball, incl. LIDOM) — `src/app/ligas-invernales/*`
- `/hundred` (cricket) — `src/app/hundred/*`

Each has its own thin layout + a theme file + a blueprint creator, all on top of
the shared data model, scoring engine, 9 providers, and UI primitives:

- Per-surface theming via CSS custom properties: `src/components/ligas/theme.ts`
  (`--liga-accent` / `--liga-accent-deep`, falling back to `ps-amber`),
  `src/components/hundred/theme.ts`, `src/app/wc/_landing/brand-palette.ts`.
- Blueprint creators: `src/lib/tournament/create-lidom-competition.ts`,
  `create-lvbp/lmp/lbprc-competition.ts`, `create-gaa-competition.ts`,
  `create-the-hundred-competition.ts`, `create-world-cup-competition.ts`.
- Product-mode switch + separate-deploy machinery: `src/lib/product-mode.ts`,
  `src/middleware.ts`, `scripts/deploy-display.sh`, `scripts/clone-display-instance.ts`.

The build-out **formalises** this into a single config-driven surface rather than
N hand-rolled ones.

### 2.4 The two baselines

| | Dominican Winter League (LIDOM) | All-Ireland (Sam Maguire + Liam MacCarthy) |
|---|---|---|
| Blueprint / data | ✅ Seeded (`create-lidom-competition.ts`) | ✅ Seeded (`create-gaa-competition.ts`, 4 GAA blueprints) |
| Branded surface | ✅ `/ligas-invernales`, Dominican-blue theme, ES/EN bilingual | ❌ **None yet** — blueprints exist, no `/gaa` route |
| Sport support | ✅ Baseball scoring, no-draw rules | ✅ Hurling/football goals+points, provincial draws |
| Buyer (to confirm) | Dominican media brand / league sponsor / bar chains | GAA county boards, Irish bars, GAA media, sponsors |

- **LIDOM** is the fast proof — its surface exists, so the work is a re-skin + a
  separate deployment. Validates the deployment pipeline end-to-end.
- **GAA** is the repeatability proof — it forces standing up a **brand-new**
  white-label surface from an existing blueprint, which is exactly the motion sold
  to future customers.

Relevant blueprint IDs (from `create-gaa-competition.ts`): Liam MacCarthy
`a0000000…000207` (hurling), Sam Maguire `a0000000…000205` (football), plus Joe
McDonagh `…000208` and Tailteann `…000206`.

### 2.5 Phased plan

| Phase | Goal | Baseline |
|---|---|---|
| **0** | Display-site fixes (concluded state + repoint to #3) — **done on-branch** | WC #3 |
| **0.5** | Decisions + `TenantConfig` schema (this doc) | — |
| **1** | Extract the shared "surface kit" — one config-driven surface | — |
| **2** | Tenant configs for LIDOM + GAA (parallel); build the GAA surface | LIDOM + GAA |
| **3** | Separate per-tenant deployments via a generalised `deploy-tenant.sh` | LIDOM + GAA |
| **4** | Aggregate / directory site + cross-tenant Global Classification | both |
| **5** | Sales polish — self-serve tenant spin-up, B2B landing, pricing | — |

### 2.6 Phase 0.5 — `TenantConfig` schema (detail)

Start as a typed code registry (fast, reviewable), graduate to a DB table only
when self-serve (Phase 5) needs it.

```ts
// src/lib/tenants/types.ts  (proposed)
export interface TenantConfig {
  /** URL-safe id; also the TENANT_ID env value for a dedicated deployment. */
  slug: string;                       // 'lidom' | 'gaa' | ...
  /** Brand shown in chrome/wordmark. */
  brandName: string;                  // "Liga Dominicana" / "GAA Predictor"
  /** 'powered_by' shows a small sportspredict mark; 'full' hides it entirely. */
  branding: 'powered_by' | 'full';
  /** Palette → CSS custom properties (mirrors ligas/theme.ts today). */
  palette: { accent: string; accentDeep: string; /* extendable */ };
  /** Optional logo asset (data-URI or public path). */
  logo?: string;
  /** Blueprint(s) this tenant exposes (tournament_ids + creator keys). */
  blueprints: Array<{
    key: string;                      // 'lidom' | 'liam_maccarthy' | 'sam_maguire'
    tournamentId: string;
    label: string;
  }>;
  /** Default + supported locales. */
  locales: { default: string; supported: string[] };  // e.g. {default:'es', supported:['es','en']}
  /** Custom domain(s) for the dedicated deployment. */
  domains?: string[];
}

// src/lib/tenants/registry.ts  (proposed)
export const TENANTS: Record<string, TenantConfig> = { lidom: {...}, gaa: {...} };

// Resolution: prefer TENANT_ID env (dedicated deploy), else path segment (aggregate).
export function resolveTenant(): TenantConfig | null { /* env-first, then route */ }
```

Hybrid-auth data shape:
- Add a nullable `tenant_id` (text/uuid) to the tenant-scoped rows the surface
  reads/writes — primarily `competitions` (and derive membership scope from there).
  Users stay in one `users` table; a user's *presentation* is scoped per tenant.
- **This is a DB change and must be planned + stated explicitly before applying.**
  It is out of scope for the current session's read-only rule — a dedicated
  migration task with an explicit column/RLS plan is required first.

### 2.7 Phase 1 — Shared "surface kit" (detail)

Goal: one config-driven branded surface that the current `/wc`, `/ligas`, and
`/hundred` prove is feasible.

1. **Theming primitive** — generalise `ligas/theme.ts` into
   `tenantVars(config)` returning the CSS custom properties, and confirm the
   `@theme inline` tokens in `globals.css` cover accent/deep/logo. Powered-by vs
   full toggles a single chrome element.
2. **Layout shell** — a `TenantLayout` parameterised by `TenantConfig` (brand mark,
   nav, optional bottom TabBar), factored from `wc/layout.tsx` +
   `ligas-invernales/layout.tsx` (which already share structure).
3. **Surface routes** — a `/t/[tenant]/…` route group for the aggregate site, and
   the same components mounted at the domain root when `TENANT_ID` is set.
4. **Reuse the concluded-state work** — the terminal-state rendering shipped in
   Phase 0 becomes a kit primitive so every tenant's finished competition shows
   its history, not "coming soon".
5. **Locale** — reuse the existing i18n (`src/lib/i18n`, `Bi` bilingual component)
   driven by `TenantConfig.locales`.

Exit criteria: `/wc` re-expressed as (or coexisting with) a `TenantConfig` without
visual regression; a second tenant renders purely from config.

### 2.8 Phase 2–3 — LIDOM + GAA in parallel, then deploy

- **LIDOM config** — brand, Dominican-blue palette (already in `ligas/theme.ts`),
  LIDOM blueprint, `{default:'es', supported:['es','en']}`. Mostly configuration.
- **GAA surface** — build the new surface from the kit: green/gold palette (a GAA
  umpire brand mark already exists via `<BrandMark>`), Liam MacCarthy + Sam Maguire
  blueprints, `{default:'en', supported:['en','ga']}` (Irish optional).
- **`scripts/deploy-tenant.sh`** — generalise `deploy-display.sh` to take a
  `TENANT_ID` and target the matching Vercel project/domain.

### 2.9 Phase 4–5 — aggregate + sales

- **Aggregate/directory** — the main deployment lists live tenant games and rolls
  up the cross-instance Global Classification.
- **Self-serve** — admin tooling to spin up a tenant (brand + blueprint pick +
  deploy); B2B marketing/landing; pricing. Copy must be supplied by the
  customer/user (see risks).

### 2.10 Risks & constraints

- **Auth is the deepest piece.** Hybrid needs a `tenant_id` scoping column + RLS
  scoping on the membership/competition read/write paths, plus care that a tenant
  deployment only surfaces its own blueprint's competitions. Google OAuth callback
  per custom domain must be configured.
- **Vercel Hobby limits bite at scale**: 1 concurrent build, 100 deploys/day, 2
  daily crons, 6000 build-min/month. A few tenants is fine; many customers means
  Vercel Pro. Centralising crons in the worker deployment is what keeps tenants at
  zero crons.
- **Never originate user-facing copy** (project rule). Marketing/brand/persona copy
  must come from the user or customer. This doc's only added UI string is the
  factual "Tournament complete" status label.
- **Feature-flag new user-visible features** (project rule) — tenant surfaces ship
  behind config/flags, enabled per client after review.
- **DB changes require an explicit stated plan first** (per this session's rule).
  The `tenant_id` migration is the first such item and is not yet written.

---

## Appendix A — Files changed this session (Phase 0)

- `src/app/wc/_landing/fetchMd1PicksData.ts` — `concluded` discrimination.
- `src/app/wc/page.tsx` — pass `concluded` to the hub.
- `src/app/wc/_landing/WcPicksHub.tsx` — `concluded` prop, default-to-Results, ribbon.
- `src/lib/wc/resolve-wc-archive.ts` — corrected docstring (targets instance #3).
- `scripts/deploy-display.sh` — repoint display env to instance #3 + demo viewer.
- `docs/PLAN-B2B-WHITE-LABEL-AND-DISPLAY.md` — this document.

## Appendix B — Key identifiers

- Supabase project: `wujgqjjddonxoddkgbxy` (PredictSport, eu-west-1).
- WC instance #1 (beta core): `1a4448e5-a178-45ab-b819-a0dfab370306`.
- WC instance #3 (display): `11b22173-a17e-48e2-895b-3c12b1d78f52`; shared
  tournament `a0000000-0000-0000-0000-000000000026`; demo viewer
  `a1c5e324-d2ea-4ee6-9c1b-8f30e1aaf42e` (240 predictions).
- Standard site: `predictsport-rust.vercel.app`. Display: `predictsport-display`.

## Appendix C — Read-only DB queries run this session

All were `SELECT` only (no writes):
1. `list_projects` — locate the PredictSport project.
2. WC instances map — `competitions` filtered by `product_mode LIKE 'world_cup%'`.
3. Instance #1 round/event statuses — all 8 rounds `scored`, 104 events confirmed.
4. Instance #3 round resolution — 0 rounds by `competition_id`, 8 by
   `tournament_id`, 0 not-scored; demo-user membership check.
5. Instance #3 showcase richness — 104 events, 240 demo-viewer predictions, 147
   distinct predictors.
