# Session Report — Display Site, B2B Plan, Ligas Merge, Master Deploy

**Date:** 2026-07-24
**Working branch:** `claude/predict-sport-display-planning-hs8ngv`
**End state:** merged to `master` (fast-forward) → production auto-deploy
**Database:** **untouched** — every DB access this session was read-only `SELECT`

> A granular, chronological record of every action taken, the application logic
> behind each change, and the reasoning ("why") for each decision. Written so a
> reviewer who was not present can reconstruct exactly what happened and judge it.

---

## 0. How the session was governed (rules of engagement)

The session began as **planning-only** with hard constraints the user set, then
the constraints were relaxed in stages. Tracking this matters because it explains
why some things were investigated long before they were changed.

| Phase of session | Repo writes | DB writes | Trigger to change posture |
|---|---|---|---|
| Initial planning | ❌ forbidden | ❌ forbidden | "make no amendments… I must say *please amend the repository*" |
| DB tightened | ❌ | ❌ (read/search only) | "do not touch the database in any shape or form… only read and search" |
| Build authorised | ✅ (branch only) | ❌ unless stated first | "please amend the repository… build out the display site… do not touch the database without explicitly stating what you plan to touch" |
| Master authorised | ✅ + `master` | ❌ (still) | "merge to master" |

Consequence honoured throughout: **no INSERT/UPDATE/DELETE/DDL was ever issued.**
The one migration encountered (ligas seed) was merged as a *file* and explicitly
**not** applied.

---

## 1. Establishing what the "display site" actually is

**Why:** the user asked to confirm the display site exists and is separate from
the standard site before any work.

**Actions (read-only):**
- Searched routes under `src/app`, git history (`git log --grep=display`), and
  env/mode references.
- Read `scripts/deploy-display.sh`, `src/lib/product-mode.ts`,
  `src/middleware.ts`, `src/lib/wc/resolve-wc-archive.ts`,
  `src/lib/wc/resolve-wc-competition.ts`.

**Findings / application logic:**
- The display site is **not** a separate codebase. It is the same Next.js app
  deployed to a **second Vercel project** (`predictsport-display`) and switched
  by one env var: `PRODUCT_MODE=world_cup_2026_archive`.
- `getProductMode()` resolves `NEXT_PUBLIC_PRODUCT_MODE || PRODUCT_MODE ||
  'predictsport_full'`. `isWorldCupArchive()` is the gate used across the app.
- `src/middleware.ts` `ARCHIVE_MODE` enforces: redirect `/` → `/wc`, a read-only
  route allowlist, and a **403 on every non-GET** (writes blocked).
- `resolveWcArchive()` returns the display competition via the **service client**
  (no auth session on the display site) plus a **synthetic demo viewer**, so all
  the normal data fetchers naturally pull that user's predictions/group/bracket —
  simulating a real member's experience without a login.

**Key architectural conclusion (drives the whole B2B plan):** deployment is fully
separate, but the *code* is shared. Both sites build from the same source; the
display site only diverges where code branches on `isWorldCupArchive()` /
`ARCHIVE_MODE`. A shared-component edit therefore lands on **both** sites at their
next respective deploys unless deliberately gated. This is the embryonic
white-label model.

---

## 2. Diagnosing the "coming soon" bug on the finished World Cup

**Why:** the user reported the WC surface showing "coming soon" after the
tournament had concluded.

**Actions (read-only):**
- Grepped for the copy → traced to two surfaces:
  - `/wc` landing: `src/app/wc/page.tsx:29` renders `ComingSoonPanel` when
    `md1Data.ready === false`.
  - `/wc/home`: `src/app/wc/home/page.tsx:47` renders "Dashboard is being set up"
    when `data.ready === false`.
- Read `fetchMd1PicksData.ts`, `fetchDashboardData.ts`, `WcPicksHub.tsx`,
  `Md1PicksLanding.tsx`, `resolve-wc-competition.ts`.

**Application logic uncovered:**
- `fetchMd1PicksData` only recognises an **actionable pick window**. Group rounds
  1–3 all `scored` → `hasActiveGroupRound = false` → `fetchKnockoutFallback`,
  which searches for a knockout round in `draft`/`open`/`locked`. After the final,
  rounds 4–8 are all `scored` → no match → `ready: false`.
- So the two ends of the lifecycle — *before the first fixture* and *after the
  final* — both collapse into the same `ready: false` branch, which only ever had
  **pre-launch** copy. Hence a finished tournament shows "coming soon".
- `fetchDashboardData` is **different**: it falls back to the most recent *scored*
  round (`scoredRoundResult`, `fetchDashboardData.ts:253`), so `currentRound` is
  set and `/wc/home` renders the finished dashboard. Therefore the user-visible
  bug was specifically the `/wc` landing.

**Root cause (single):** a **missing terminal ("concluded") state**. Not a status
problem (all instances are `active`, not `completed`), not a selection problem.

---

## 3. Read-only database investigation (instance map + proof)

**Why:** to (a) map which competition IDs correspond to which instance, since the
deploy script, code fallback, and comments disagreed, and (b) prove the concluded
diagnosis with data.

**Supabase authorisation:** confirmed the connector was authorised in-session
(`list_projects` returned the PredictSport project `wujgqjjddonxoddkgbxy`).

**Queries run (all `SELECT`, no writes):**
1. `list_projects` — locate the project.
2. WC instances: `competitions` filtered by `product_mode LIKE 'world_cup%'` +
   member counts.
3. Instance #1 round/event statuses.
4. Instance #3 round resolution + demo-user membership.
5. Instance #3 showcase richness (events, predictions, distinct predictors).

**Results:**

| Competition ID | Name | Instance | product_mode | Status | Members |
|---|---|---|---|---|---|
| `1a4448e5…370306` | World Cup | #1 | world_cup_2026_shell | active | 48 |
| `256bbbb0…3edc69` | World Cup | #2 | world_cup_2026_archive | active | 48 |
| `f54b17c9…ce36b2` | World Cup 2026 #2 | #2 | world_cup_2026_shell | active | 3 |
| `11b22173…1d78f52` | World Cup (Display) | #3 | world_cup_2026_shell | active | 48 |

- Instance #1: **all 8 rounds `scored`, 104 events confirmed** → confirms the
  concluded diagnosis exactly.
- Instance #3: **0 rounds by `competition_id`, 8 by `tournament_id`**
  (`a0000000…000026`), **0 not-scored**. Shares tournament rounds.
- Instance #3 richness: **104 events, 147 distinct predictors**, demo viewer
  `a1c5e324…` holds **240 predictions**. So a #3-based display showcase is full,
  not empty → **no seeding required**.
- Reconciliation of the earlier ID contradiction: the deploy script pinned #1
  (`1a4448e5…`) via env, overriding the code's #3 fallback (`11b22173…`); comments
  said "#1"/"#2"/"#3" inconsistently.

---

## 4. The concluded-state fix (code, with rationale)

**Why:** render a finished tournament's history instead of the pre-launch panel.
Chosen to be **minimal and low-risk** because `WcPicksHub` already has working
Results/Fixtures/Groups tabs on scored data, and `page.tsx` already fetches
`fixturesData`/`groupsData` independently of `md1Data.ready` — so no new data
plumbing was needed.

**Files & exact changes:**

1. `src/app/wc/_landing/fetchMd1PicksData.ts`
   - Added `concluded: false` to the two live-path success returns (so the return
     union carries the field on every `ready: true` member — required for the
     page to read `md1Data.concluded` after the `ready` narrowing).
   - In `fetchKnockoutFallback`, replaced the bare
     `if (!koRound) return { ready: false }` with: query round statuses for the
     competition's fixture filter; if **≥1 round exists and every round is
     `scored`**, return `{ ready: true, concluded: true, …, events: [] }`;
     otherwise (genuine pre-launch, no scored rounds) keep `ready: false`.
   - **Why this location:** every concluded path (group-all-scored, group fixtures
     all confirmed) funnels through `fetchKnockoutFallback`, so one guard covers
     all of them. Empty-typed literals (`[] as WindowEvent[]`, etc.) avoid
     `never[]` inference against the success shape.

2. `src/app/wc/page.tsx`
   - Passed `concluded={md1Data.concluded}` into `WcPicksHub`.
   - **Side effect leveraged:** the archive "Browse all rounds" block at
     `page.tsx:33` sits *after* the `if (!md1Data.ready) return` at line 29. With
     concluded now returning `ready: true`, that block finally runs on the display
     site, so the round index renders.

3. `src/app/wc/_landing/WcPicksHub.tsx`
   - Added a `concluded?: boolean` prop.
   - `parseTab(value, concluded)`: with no explicit `?tab`, a concluded tournament
     opens on **Results** instead of the empty Upcoming tab.
   - Added a minimal factual **"Tournament complete"** ribbon (green ✓), styled to
     match the existing `Completed`/`Live` status labels already in the file.
   - **Copy rule honoured:** this is a factual status label, not originated
     marketing/persona copy (which the project forbids).

4. `src/lib/wc/resolve-wc-archive.ts`
   - Corrected a stale/contradictory docstring (said "instance #1" while the
     constant was #3).

**Deliberate non-change:** `/wc/home` renders the finished dashboard via its
scored-round fallback, so it was left alone to keep risk low. A polished
post-tournament hero (champion + final standings) is logged as a follow-up.

**Verification:**
- `npm ci` (fresh clone had no `node_modules`).
- `npx eslint <changed files>` → clean.
- `npm run build` → **fails in the sandbox only** because `next/font` cannot fetch
  Google Fonts through the proxy (environment limit; aborts before typecheck).
  The real Vercel build has network access.
- `npx tsc --noEmit` → **exit 0** (validates the changed return union directly,
  without needing fonts).

---

## 5. Repointing the display site to instance #3

**Why:** the user decided the display should showcase **instance #3** (the
anonymised clone) rather than #1 (real beta users) — keeping real testers'
identities off a public marketing surface while still showing the true #1
experience.

**Precondition verified (read-only):** #3 shares 8 scored tournament rounds and
its demo viewer `a1c5e324…` has 240 predictions → repointing yields a full
showcase, no DB seeding needed.

**Files & changes:**
- `scripts/deploy-display.sh`: set both `WC_ARCHIVE_COMPETITION_ID` and
  `WC_ARCHIVE_DEMO_USER_ID` to instance #3's values (`11b22173…` /
  `a1c5e324…`) in **both** the build-time `.env.production` heredoc and the
  `vercel deploy --env` flags. (First `replace_all` matched only the heredoc pair;
  the `--env` flags were then edited separately because ` \` + `--env` breaks the
  two-line match.) `bash -n` confirmed the script still parses.
- `resolve-wc-archive.ts`: docstring now states the display targets #3 and that
  the deploy script sets the IDs explicitly.

**Effect:** takes hold on the **next** `scripts/deploy-display.sh` run. No display
deploy was triggered this session.

---

## 6. Plan document, artifact, email, downloadable

**Why:** the user asked for the full B2B/display plan captured, emailed, made
downloadable, rendered as a visual artifact, and written to a repo doc.

- **Repo doc:** `docs/PLAN-B2B-WHITE-LABEL-AND-DISPLAY.md` — full end-to-end plan
  (phases 0–5), Phase 0/1 detail (`TenantConfig` schema, shared surface kit),
  LIDOM + GAA baselines, target architecture (one shared Supabase + central
  worker; thin per-tenant deployments), risks, and appendices (IDs, files, the
  read-only queries).
- **Visual artifact:** published (theme-aware; PredictSport brand palette + mono
  data vernacular) at
  `https://claude.ai/code/artifact/99774992-d0e7-4642-978f-55c4a5b02a93`.
- **Email:** a **draft** created in Gmail to `eoinmaleoin@gmail.com` (the
  integration supports drafts, not send) with an HTML summary + the artifact link.
  The full markdown was **not** attached (large base64 was unreliable to inline);
  it is delivered instead via the downloadable file + the repo doc.
- **Downloadable:** the markdown delivered to the device via file transfer.

**B2B decisions captured (user-locked):**
- Auth: **hybrid** (one account system + a `tenant_id` scoping layer).
- Branding: **powered-by default, full white-label per client** (a `TenantConfig`
  flag, not two codebases).
- Build order: **LIDOM + GAA in parallel** off one shared surface kit.

**Phase 0 commit:** `a35062e` — the concluded fix + display repoint + the plan
doc. Pushed to the working branch.

---

## 7. Merging the ligas-invernales design branch

**Why:** the user asked to bring the ligas design branch together with this work
and with master.

**Branch identified:** `origin/claude/ligasinvernales-ui-branding-lhp2ue` — 5
commits, **strictly ahead of master** (clean), **no file overlap** with the
display branch → a conflict-free merge.

**What it contains:**
- Rebrand of the ligas surface: circular flags, official league logos, per-league
  fonts, team badges, per-league identity (`LeagueLogo`, `LeagueMark`,
  `TeamBadge`, `leagues.ts`, `teams.ts`).
- Standings (`tabla`) + results views + winter-results automation.
- **Route rename** `/ligas-invernales` → `/ligasinvernales` (user-visible URL).
- **DB migration** `20260722160000_seed_ligas_demo_first_month.sql`.

**Action:** `git merge --no-ff` into the working branch. Clean.

**Post-merge verification:**
- First `tsc --noEmit` reported 5 errors from `.next/types/validator.ts`
  referencing the **old** `ligas-invernales` route — a stale Next.js generated
  artifact, not a source error. Removed `.next` and re-ran → **exit 0**.
- `eslint src/app/ligasinvernales src/components/ligas` → clean.
- Pushed the branch (`7a0ffe1`).

**Migration characterised (read-only, to inform the apply decision):**
- **26 `INSERT`s, zero DDL** — no `CREATE`/`ALTER`/`DROP`/policy, **no
  `UPDATE`/`DELETE`/`TRUNCATE`**.
- Targets: `events` (9), `event_prediction_types` (9), `predictions` (4),
  `classification_memberships` (4) — additive demo data only.
- **Not applied.** Per the DB rule, applying it awaits explicit approval, and I
  proposed a pre-apply safety check (baseball no-draw — see §9) before running it.

---

## 8. Merging to master (production)

**Why:** the user instructed "merge to master".

**Action & safety:**
- `git fetch`; confirmed `origin/master` is an **ancestor** of the branch →
  clean **fast-forward**, no force, no merge commit, no history rewrite.
- `git push origin claude/predict-sport-display-planning-hs8ngv:master` →
  `fab2e3b..7a0ffe1`.
- `master` now carries: the concluded fix, the display repoint, the plan doc, and
  the full ligas design. **Production auto-deploys from master.**

**Ordering caveat flagged to the user:** the ligas pages read the **seeded** demo
data, which is **not yet in the database** (migration unapplied). So on the live
production deploy, `/ligasinvernales` will render with whatever ligas data already
exists in the DB (blueprint-level), and the specific first-month demo
fixtures/picks from the migration will be **absent until the migration is applied**.
This does not crash the pages (the migration is additive data, not schema the code
hard-depends on), but the showcase will look thinner than intended until applied.

---

## 9. Baseball ties — open design question (not implemented)

**Context:** while proposing a pre-apply safety check for the ligas migration, the
user raised whether baseball should support **ties** (as in NPB Japan, and
possibly the Caribbean winter leagues), and noted a data nuance: a recorded "score
after 9 innings" can read as a tie even when the game truly continued.

**Current platform logic (read `src/lib/score-format.ts`):**
- `NO_DRAW_SPORTS = ["baseball"]`. `deriveWinnerFromScore` returns **`null`** on a
  tied baseball score — a tie does **not** imply a result; a winner must be
  declared explicitly. An SQL equivalent (`derive_winner_from_score`, migration
  `20260620000000`) mirrors this and only derives "Draw" when the options array
  has ≥3 entries.
- Separately, `head_to_head` predictions already support **config-driven draws**
  (`config.allow_draw`, `config.draw_points`; both-DNF = void) — this is
  sport-independent and already in the platform.

**Assessment (recommendation, not yet built):**
- Ties are a **legitimate** outcome in some baseball competitions (NPB regular
  season ends level games in a tie after a set inning limit — currently 12,
  historically 15). Whether LIDOM/Caribbean winter leagues permit ties needs
  **confirming per league** before offering a Draw option there.
- The right shape is **per-competition/per-league config**, never a global change
  to the baseball rule — MLB and many winter leagues play to a winner, so a
  blanket "baseball allows draws" would be wrong and would break the existing
  no-draw guarantee.
- Two distinct pieces: **(a)** a rules feature (enable draws where legal — reuse
  the existing `allow_draw` infra, or thread an `allowDraw`/config flag into
  `deriveWinnerFromScore` instead of keying purely on `sport`); **(b)** a
  data-capture correctness concern (ensure the recorded result is the true final,
  not a 9-inning/regulation snapshot — analogous to the existing WC "AET vs FT
  scoreline" todo). Enabling ties makes (b) more important, so a real
  extra-innings win isn't stored as a false tie.
- Per project rules, this is a **new user-visible feature** → it should be
  **flag-gated** and requires the league tie-rules confirmed + sample scoring
  before building.

**Status:** discussed and scoped; **no code or data changed** for this.

---

## 10. Final state & outstanding decisions

**Shipped to `master` (production):**
- WC concluded-state rendering fix.
- Display deploy script repointed to instance #3.
- Full ligas-invernales UI/branding design (incl. route rename).
- Planning + this report docs.

**Verified:** `tsc --noEmit` exit 0; ESLint clean on all touched areas.

**Database:** unchanged. No migration applied.

**Awaiting explicit user decision:**
1. **Apply the ligas seed migration** `20260722160000` (26 additive INSERTs). If
   yes: run the baseball no-draw safety check on its `winner` EPT configs first,
   then apply.
2. **Baseball ties feature** — confirm which leagues allow ties (and the inning
   threshold), then design per-competition draw support behind a flag.
3. **Display deploy** — run `scripts/deploy-display.sh` to push the #3 repoint +
   concluded rendering live on the display project (separate from the master
   production deploy).

**Commit trail:**
- `a35062e` — concluded fix + display repoint + plan doc.
- `7a0ffe1` — merge of the ligas design branch.
- `fab2e3b..7a0ffe1` — fast-forward of `master`.
