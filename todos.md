# PredictSport - MVP Punch List

Priority order. **Queue reads unchecked tasks top-to-bottom — active work must appear before backlog.**

Audit date: 2026-05-09. Updated: 2026-06-30.

## P0 — Blocking launch

- [x] §15.1 — Fix Google OAuth on deployed app (redirect URL config)
- [x] §15.2 — User profile page (display name, avatar, notification prefs)
- [x] §15.3 — Competition activation UI (draft → active button in admin)
- [x] §15.4 — Competition completion/archive flow in admin

## P1 — Core functionality gaps

- [x] §15.5 — H2H draw support: `allow_draw` config, draw option in UI, scorer update
- [x] §15.6 — Over/under push handling: exact line hit → void (null), not wrong
- [x] §15.7 — UI vocabulary: rename "The Damage" → "Results", "The Sheet" → "The Round", review AI-generated copy
- [x] §15.8 — Web push notifications (replaced WhatsApp; PWA-based reminders, results)

## P2 — Polish & quality of life

- [x] §15.9 — Scoring template redesign (clear explanations, examples, visual distinction)
- [x] §15.10 — Logo redesign (GAA umpire mark replaces PS placeholder)
- [x] §15.12 — ~~Google OAuth consent screen branding~~ — won't fix (requires Supabase custom domain, Pro plan)
- [x] §15.14 — Privacy policy, terms of service pages + Google OAuth consent screen published
- [x] §15.13 — Alternative auth for in-app browsers (magic link for Telegram/Messenger webviews)
- [x] §15.11 — Persona callout configuration in settings

## Post-Launch

- [x] **Schema Normalisation Audit & Code Review** — Full BCNF analysis and realignment. Key issues: (1) `predictions` lacks FK to `event_prediction_types` — should use `event_prediction_type_id` not text `(event_id, prediction_type)`; (2) `events.competition_id` transitively determined by `events.round_id`; (3) `events.prediction_types` JSONB dead weight — confirm dropped; (4) fixture metadata duplicated on `events` — no `sporting_event_id` FK to `sporting_events` pool. Full BCNF review of all tables, write migration(s), realign all code to new FKs.

## Personal Predictions Unification

Design complete. See `docs/DESIGN-PERSONAL-PREDICTIONS-UNIFICATION.md`. Implement in order below.

### Phase A — Migration (foundation, do first)

- [x] **A1 — Personal competition bootstrap migration** — SQL migration: for each existing `users` row, insert one `competitions` row (`type='personal'`, `status='active'`, `scoring_rules='{}'`, `name='Personal'`) and one `competition_members` row (`role='admin'`). Add `type` check constraint to include `'personal'`. Add unique constraint: one personal competition per user.
- [x] **A2 — Port legacy rows migration** — SQL migration: for each `personal_predictions` row, upsert an `events` row (keyed by `external_event_id` + `competition_id`), insert `event_prediction_types` rows (`winner` always; `exact_score` if `score_prediction` was set, `points=0`), insert `predictions` rows from `prediction_value` + `score_prediction`. Preserve `result_confirmed` where result was known.
- [x] **A3 — Drop legacy table migration** — Drop `personal_predictions` table and all associated cron jobs / API routes that write to it. Remove dead code.
- [x] **A4 — Add `favourite_team` to users** — SQL migration: add `favourite_team jsonb` column to `users` (stores `{sport, team_name, provider_id}`). Nullable — opt-in only.

### Phase B — Backend / API

- [x] **B1 — Personal competition resolver** — Server util `getOrCreatePersonalCompetition(userId)` — looks up the user's personal competition, creates it if missing (handles new signups post-migration). Used by all personal prediction API routes.
- [x] **B2 — Personal event creation API** — `POST /api/personal-predictions/event` — atomically creates `events` + `event_prediction_types` rows for a fixture in the user's personal competition. Idempotent on `external_event_id`. Returns event + prediction types.
- [x] **B3 — Personal prediction submit API** — `POST /api/personal-predictions/predict` — upserts a `predictions` row. No lock time enforcement (personal predictions can be changed freely before event starts).
- [x] **B4 — Outright creation API** — `POST /api/personal-predictions/outrights` — creates a `final_standings` prediction for a league/tournament (stored as an event with `is_outright=true` flag or separate `outright_predictions` table — decide at implementation). Handles change budget (max 3 total, timestamped history).
- [x] **B5 — Inferred suggestions API** — `GET /api/personal-predictions/outright-suggestions` — returns leagues where user has 3+ fixture picks but no outright, filtered to those not dismissed or dismissed but now at 10+ picks.
- [x] **B6 — Dashboard stats API** — `GET /api/personal-predictions/stats` — returns: lifetime hit rate + streak, by-sport breakdown, by-league breakdown, by-year breakdown, recent 5 picks with results. Aggregates from `predictions` join `events` on personal competition.

### Phase C — Fixtures Tab (replace legacy browser)

- [x] **C1 — New PersonalFixtureBrowser component** — Replace legacy 1,412-LOC `PersonalFixtureBrowser.tsx` with unified-model version. Fixture tap → calls B2 + B3 atomically. Same provider/league browsing UX, but writes to competition model.
- [x] **C2 — Sport-aware prediction type defaults** — Util `getPersonalDefaults(sport, format)`: team sports → `winner` + `exact_score` as primary, 2-3 extra pills; race sports → `winner` only. Wire into B2.
- [x] **C3 — Familiar terminology pills** — Map internal types to pill labels: `exact_score` → "Correct Score", `margin` → "Winning Margin", `over_under` → "Over/Under", `handicap` → "Spread", `head_to_head` → "H2H", `yes_no` → "Prop Bet", `top_n` → "Top 3", `progression` → "To Qualify", `final_standings` → "Outright Winner". Apply across personal predictions UI.
- [x] **C4 — Contextual outright card in Fixtures tab** — When browsing a specific league, show a contextual card at top: "Who wins [League]?" if no outright exists. Tapping creates the outright via B4.

### Phase D — Outrights Tab

- [x] **D1 — Outrights tab scaffold** — New tab in personal predictions nav. Lists all user's active outright picks with status (open, resolved, pending resolution).
- [x] **D2 — Inferred suggestions section** — Secondary section in Outrights tab. Calls B5. Shows dismissable suggestion cards ("You've picked 4 Premier League games — who wins the title?"). Dismissal stored per user per league.
- [x] **D3 — Outright change rules UX** — Before tournament start: freely editable. After start: show change budget (e.g. "2 changes remaining"), timestamped history inline. UX discourages flipping (confirm dialog).

### Phase E — Dashboard Tab

- [x] **E1 — Dashboard tab scaffold + stats fetch** — New tab. Calls B6. Renders fixed widget order: Recent Picks → Summary Strip → By Year → By Sport → By League.
- [x] **E2 — Recent Picks widget** — Last 5 picks in super-compact single-card view (one line per pick: team badge, result icon, sport tag). Expandable dropdown to show all. Correct/wrong/pending colour coding.
- [x] **E3 — Summary Strip widget** — Lifetime stats row: total picks, % correct, current streak, best streak.
- [x] **E4 — By Year/Season widget** — Year selector (2024 / 2025 / 2026). Shows hit rate for selected year. Auto-defaults to current year.
- [x] **E5 — By Sport widget** — Hit rate per sport as a simple ranked list (Football 64%, GAA 71%, ...). Tap sport to drill into By League.
- [x] **E6 — By League widget** — Drill-down view within a sport. Hit rate per league/competition. Triggered by tapping a sport in E5.
- [x] **E7 — My Favourite Team widget** — Opt-in. If `users.favourite_team` is set: show recent pick history for that team + next upcoming fixture. If not set: show a small "Set a favourite team" prompt card.
- [x] **E8 — Customise button (placeholder)** — "Customise" button in dashboard header. For now shows a toast: "Widget reordering coming soon." Lays the groundwork (widget order stored in `users.notification_prefs` or new `dashboard_prefs` column).

### Phase F — Onboarding

- [x] **F1 — Favourite team prompt at signup** — After first successful login (detect via `created_at` within last 60s or a `onboarding_complete` flag), show a one-time modal: "Got a favourite team? We'll track your picks for them." Sport selector + team name input. Saves to `users.favourite_team`. Skippable.
- [x] Event nominations by participants (submission UI)
- [x] Public competition browsing/discovery page
- [x] Tiebreaker submission UI
- [x] Co-admin appointment UI
- [x] "New Season" clone from archived competition

## Round Builder UX Improvements

See `docs/ROUND-BUILDER-IMPROVEMENTS.md` for full details.

### Phase 1: Smart Filtering ✅ COMPLETED (2026-05-12)

- [x] Smart filtering by fixture type (2-team vs multi-competitor)
- [x] Primary type default selection (H2H for rugby, Winner for F1)
- [x] Added helper functions: `getValidPredictionTypes()`, `allowsDraws()`, `getPrimaryPredictionType()`
- [x] User testing & verification in production
- [x] Deployed: commits `0ea3a74`, `f11d042`

### Phase 2: Card-Based UI ✅ COMPLETED (2026-05-14)

- [x] 2.1 — Design card component structure (`PredictionCards.tsx`)
- [x] 2.2 — Create new state model for card-based predictions (`CardBasedPredictionState`, `cardsToConfigs`/`configsToCards`)
- [x] 2.3 — Build PrimaryOutcomeCard component (HOME/DRAW/AWAY preview + points)
- [x] 2.4 — Build ScoringPredictionsCard component (collapsible margin/O/U/handicap)
- [x] 2.5 — Build YesNoCard component (collapsible, question input + validation)
- [x] 2.6 — Refactor Step2Configure to use cards (per-fixture expanded section)
- [x] 2.7 — Auto-population for head_to_head config (team names + allow_draw from sport)
- [x] 2.8 — Validation: yes/no question required when enabled; min=1 on points inputs
- [x] 2.9 — "Apply to all" global panel retained as escape hatch for cross-fixture defaults
- [x] 2.10 — Mobile optimization: flex-col on small screens, collapsible sections
- [x] 2.11 — Fixture summary pills show active prediction types (up to 3 + overflow count)
- [x] 2.12 — No test framework; covered by E2E scaffold

---

## Manual Events & API Coverage (2026-05-12)

See `docs/MANUAL-EVENTS-AND-API-GAPS.md` for detailed task breakdown.

### Phase 3: Manual Event Management (3-4 hours) — **INDEPENDENT, can run parallel to Phase 1/2**

**Admin Workflow Improvements**
- [x] 3.1 — Audit existing manual event creation flow (AddEventForm.tsx) — AddEventForm replaced by ManualEventWizard; orphaned file deleted
- [x] 3.2 — Design ManualEventWizard component (5-step guided creation)
- [x] 3.3 — Add team name validation & autocomplete suggestions
- [x] 3.4 — Create manual event templates (GAA, soccer, snooker, etc.)
- [x] 3.5 — Build bulk manual event creator (CSV upload or multi-row form)
- [x] 3.6 — Improve manual result entry UX (pre-populate, validation, preview) — pre-pop from event name, score preview, edit button, 2-step confirmation
- [x] 3.7 — Add result undo/edit capability (10-min window) — unlimited undo via unconfirm-result API (window constraint dropped; better UX for small groups)
- [x] 3.8 — Add "Events Missing Results" admin alert dashboard
- [x] 3.9 — Auto-fetch reminder for manual events (cron notification)
- [x] 3.10 — Add "Duplicate Event" cloning feature
- [x] 3.11 — Validation before round/competition activation (pre-flight checks)
- [x] 3.12 — Documentation & inline help (tooltips, admin guide)

### Phase 4: Sports API Coverage Analysis (2-3 hours) — **INDEPENDENT, run Phase 4.1-4.8 first**

**Research & Integration (prioritized by audit)**
- [x] 4.1 — Audit current provider success rates (script + report)
- [x] 4.2 — Identify high-priority gaps (frequency × manual_rate)
- [x] 4.3 — Research Cricket API alternatives (Cricbuzz, CricAPI, etc.)
- [x] 4.4 — Research GAA API improvements (ClubZap, GAA.ie scraping)
- [x] 4.5 — Evaluate Rugby League sources (NRL, Super League APIs)
- [x] 4.6 — Research Athletics APIs (World Athletics, Tilastopaja)
- [x] 4.7 — Evaluate Snooker coverage improvements (Snooker.org, CueTracker)
- [x] 4.8 — Cost-benefit analysis for paid APIs (ROI calculation)
- [x] 4.9 — Create provider integration guide (docs for contributors)
- [x] 4.10 — Implement top-priority provider (TBD based on 4.8 ROI)
- [x] 4.11 — Add provider health monitoring dashboard
- [x] 4.12 — Document unsupported sports & workarounds

**Recommended sequencing:**
1. Complete Phase 1 ✅
2. Run Phase 4.1-4.8 (audit & research, async)
3. Implement Phase 3 (immediate admin UX win)
4. Decide on Phase 2 (based on Phase 1 feedback)
5. Implement Phase 4.9-4.12 (data-driven, after audit)

---

## Sports Data Architecture Overhaul (2026-05-14)

See `SPORTS-ARCHITECTURE.md` for detailed spec (TBD).

### Phase 5: Sport/League Decoupling — **BLOCKING for multi-league sports accuracy**

**Background:** Current model has one ESPN path per `Sport` type (e.g. `cricket/8048` = IPL only). MLB/NFL/NBA/NHL are leagues, not sports. An event picked from one league (e.g. Big Bash League) will fail to fetch results because the provider uses the wrong path.

**Phase 5.1 — Data model changes**
- [x] 5.1a — Add `provider_league` column to `personal_predictions` (stored at pick time)
- [x] 5.1b — Add `provider_league` column to `events` table (stored when event is created)
- [x] 5.1c — Add `result_provider` column to `personal_predictions` (which API returned the result)
- [x] 5.1d — Migration + RLS policy updates

**Phase 5.2 — Sport type renames**
- [x] 5.2a — Rename `mlb` → `baseball`, `nfl` → `american_football`, `nba` → `basketball`, `nhl` → `ice_hockey` in `Sport` type
- [x] 5.2b — Update `SPORT_PATHS`, `registry.ts`, all provider `supportedSports` arrays
- [x] 5.2c — Update DB `sport` column values in all existing rows (migration)
- [x] 5.2d — Update UI labels, fixture browser sport selector

**Phase 5.3 — Provider routing by league**
- [x] 5.3a — Pass `providerLeague` (e.g. `"cricket/8048"`) through `fetchResult()` signature
- [x] 5.3b — Update `ESPNProvider.getResult()` to accept and use stored league path
- [x] 5.3c — Store `result_provider` when result is saved in personal_predictions + events
- [x] 5.3d — Remove MLBStats from MLB provider chain (ESPN IDs ≠ MLB gamePk)

### Phase 6: Data Quality & Reliability

- [x] 6.1 — **Reset stale MLB picks** — nulled and re-fetched via cron after ESPN `is_final` fix (2026-05-15)
- [x] 6.2 — **Resolve null cricket results** — RCB v KKR (id `0e435b0e`, ESPN id `1529300`) and Punjab Kings v Mumbai Indians (id `66750591`, ESPN id `1529301`) — fixed via ESPN `state=post` bug fix (2026-05-15)
- [x] 6.3 — **Add result-fetch cron job** — `/api/personal-predictions/cron`, runs 3am UTC daily, also fixed ESPN `is_final` bug so results actually resolve (2026-05-15)
- [x] 6.4 — **Provider success rate audit** — confirmed via cron re-fetch: MLB and cricket now resolving correctly after ESPN `is_final` fix (2026-05-15)

### Phase 7: Cricket Fixture Cards Fix

**Problem:** Cricket event fixture cards show no Home/Draw/Away buttons. `config.options` is empty/missing on `winner` prediction type — prediction form falls back to free-text.

**Investigation checklist:**

- [x] 7.1 — Check `AddEventForm.tsx`: fixture → event creation correctly wires participants into `config.options`. For `head_to_head`: explicit `[homeTeam, awayTeam]` in config. For `winner`: `getRaceEntrants()` for F1, UI fallback via `parseWinnerOptions()` for others. No fix needed.
- [x] 7.2 — Query existing cricket events: all 8 cricket events (personal predictions, `round_id=null`) have `config.options` correctly populated. No cricket events in group competitions. 5 non-cricket admin-created events have null config (backfill candidates for 7.6).
- [x] 7.3 — Confirmed: `allowsDraws("cricket")` returns false (RoundBuilder:199), `config.allow_draw` set false at creation, prediction form only shows Draw if truthy. `parseWinnerOptions` drawSports also excludes cricket. No fix needed.
- [x] 7.4 — Fixed: `supportsExactScore("cricket")` was returning true. Added cricket to `NO_EXACT_SCORE_SPORTS` in `score-format.ts`. Cricket scores are too variable (multi-format, innings) for exact_score predictions.
- [x] 7.5 — Fixed: `applyGlobalToAll` and `resetFixtureToGlobal` in RoundBuilder were stripping `config` (options, allow_draw) when rebuilding prediction types. Now preserves existing config. Also added safety net in `configsToCards` to auto-generate config from fixture data when missing.
- [x] 7.6 — Backfilled: all 8 cricket events already had correct config.options. Also fixed 3 non-cricket events (rugby, soccer, F1) with missing options and deleted a duplicate GAA event. Only GAA hurling final remains null (finalists TBD).

**Expected result:** Cricket winner prediction renders two pill buttons (Team A / Team B), no Draw, no exact score.

## World Cup 2026 — Elimination Curve Implementation

> Source: `predictsport-world-cup-2026-elimination-curve-solution.md` (design), `docs/AUDIT-elimination-curve-solution.md` (audit). SPEC.md §16.8 (locked spec). ADR 0008 (resolved).

### Phase WC-E — Curve Generator & Storage

- [x] **WC-E1 — Formula-based curve generator** — Implemented. Passes all 22 test cases (16 design + 6 audit edge). All 89 curves (8-96) are strictly decreasing. Boundary validation for <8 and >96.
- [x] **WC-E2 — Curve storage format migration** — No SQL migration needed. No existing data in old format. Writer (WC-E3) and reader (WC-F4) both use the new `{ entrantCount, locked, curve: CurveStep[] }` format. Non-tournament classifications have null config which is already handled.
- [x] **WC-E3 — Replace `getEliminationCurveForPreset()`** — Replaced with `generateEliminationCurve()`. Changed `entrantPreset` (5 fixed values) to `entrantCount` (any 8-96). New curve format: `{ entrantCount, locked, curve: CurveStep[] }`.
- [x] **WC-E4 — Merge PW8/PW9** — Merged Third-Place Play-Off and Final into PW8 "Finals". PREDICTION_WINDOWS reduced from 9 to 8 entries. Removed THIRD from STAGE_IDS. Seed migration stages unchanged (still separate sporting events).

### Phase WC-F — Group Allocation & Qualification

- [x] **WC-F1 — Target-aware group allocation** — Rewrite `src/lib/tournament/format/group-allocation.ts` `allocatePredictionGroups()` to implement the deterministic algorithm from the design doc S22.4. Must handle groups of 3, 4, and 5 entrants. Must be target-aware (choose group sizes to reach the survivor target).
- [x] **WC-F2 — Group-size-aware best-third ranking** — Update `src/lib/tournament/format/scoring.ts` `computeBestThirdRanking()` to filter by group size: exclude thirds from 3-player groups (never qualify), exclude thirds from 5-player groups (auto-qualify, not in the best-third pool), only include thirds from 4-player groups.
- [x] **WC-F3 — Rewrite elimination logic** — Update `src/lib/tournament/format/elimination.ts` `eliminateFromFormat()` to implement the full qualification rules: top 2 auto-qualify, 5-player thirds auto-qualify, 3-player thirds never qualify, best-third from 4-player groups only. Variable best-third pool size.
- [x] **WC-F4 — Curve reader update** — Update `getEliminationCurve()` in `elimination.ts` to read the new array-format curve from classification config instead of the old stage-keyed map.

### Phase WC-G — Consequence Table & UI

- [x] **WC-G1 — Consequence table API** — `GET /api/tournament/consequence-table?competitionId=X` returns the resolved curve, group allocation, qualification rules, and finalist count for display before launch.
- [x] **WC-G2 — Consequence table UI** — Pre-launch admin/entrant view showing the full elimination curve, group allocation breakdown, and "this locks when PW1 locks" warning. Copy per design doc S16.1.

### Phase WC-H — Full Bracket & R32 Classification

> Design complete: `docs/DESIGN-WC-H1-FULL-BRACKET.md`. Full Bracket is a pre-tournament wizard where entrants predict all group matches and knockouts. R32 Classification is an automatic byproduct (no separate flow) that scores how many of the 32 knockout teams were correctly predicted.

**WC-H1: Core Components**
- [x] **Design spike** — Full design complete (2026-05-21). R32 Classification is automatic, not a separate flow.
- [x] **H1.1 — Tiebreaker utilities** — Implemented in `tiebreakers/fifa.ts` + `engine.ts`. Full hierarchy: H2H points/GD/GS → overall GD/GS → random fallback. Phase 2 stubs for fair play and FIFA ranking.
- [x] **H1.2 — Best-third ranking** — `rankBestThirds(allThirds)` applies steps 1-5 + random to rank 12 third-place teams, returns top 8.
- [x] **H1.3 — Best-third slot allocation** — `allocateBestThirdsToSlots(bestThirds)` applies FIFA R32 slot rules based on group origins. **✅ Fully implemented in fifa-world-cup-2026.ts:130** with group-origin tracking, validation, and Phase 1 rule-based allocation (Phase 2: full 495-combination FIFA matrix from Annex C).
- [x] **H1.4 — R32 bracket generation** — `generateR32Bracket(winners, runnersUp, thirds)` creates full R32 matchup structure. **Implemented as `generateFIFAR32Bracket()` in fifa-world-cup-2026.ts:172**

**WC-H2: Group Stage UI**
- [x] **H2.1 — GroupMatchPredictor component** — Implemented as `GroupResultsStepV2.tsx`. Single-group UI with team-name buttons, real-time standings.
- [x] **H2.2 — LiveGroupStandings component** — Implemented in `LiveGroupStandings.tsx`. Live table with tie highlighting.
- [x] **H2.3 — ScoreCollector component** — Implemented in `ScoreCollector.tsx`. Smart score input for tied-team matches only.
- [x] **H2.4 — Tiebreaker messaging** — Implemented in `TiebreakersStep.tsx`. Random fallback warning with score tips.

**WC-H3: Bracket Wizard Shell**
> Resolved: unified design approved (2026-05-23). `BracketWizard.tsx` is the live 9-step wizard. `BracketWizardV2.tsx` was the prototype; `BracketWizard.tsx` is the production version. Group picks write to `predictions` table (shared with `/picks` matchday flow).
- [x] **H3.1 — BracketWizard component** — Implemented in `BracketWizard.tsx`. 9-step wizard: Groups → Tiebreakers → Third-place → R32 → R16 → QF → SF → Final → Review.
- [x] **H3.2 — Save/resume state** — Draft persistence via `bracket_prediction_submissions`, resumes from last step.
- [x] **H3.3 — Progress indicator** — Step progress bar in wizard header.

**WC-H4: Knockout Stage UI**
- [x] **H4.1 — KnockoutStagePredictor component** — Shows all matches for a stage (16 for R32, 8 for R16, etc.), winner picker per match. **✅ Implemented in `KnockoutStagePredictor.tsx` + `KnockoutMatchCard.tsx`** — stage-by-stage winner picker, match count from `template.knockoutStages[].matchCount`, auto-populates later stages from previous winners.
- [x] **H4.2 — Bracket context hints** — Slot source labels in `KnockoutStageStep` ("Winner Group A", "Runner-up Group C", etc.).
- [x] **H4.3 — Auto-population** — Winners from previous stages auto-fill into next stage via `resolveAllKnockoutMatchups`.

**WC-H5: Review & Submission**
- [x] **H5.1 — BracketReview component** — Implemented in `BracketReviewStep.tsx`. Visual bracket summary with champion path.
- [x] **H5.2 — Edit navigation** — Jump-back to any wizard step from review.
- [x] **H5.3 — Submit & lock** — `POST /api/tournament/bracket/submit` + `/lock` routes. Writes to `bracket_prediction_submissions`.

---

## Active Sprint (2026-06-10)

> **Queue processes these first.** Everything below "Backlog" is lower priority.

## i18n Translation Proofread

> 510 EN/ES keys wired (2026-06-10). Coverage is comprehensive but quality needs a native-speaker pass.

- [x] **i18n-PR1 — Native speaker proofread of es.json** — Full review of all 510 Spanish translations for grammar, tone, and natural phrasing. Many were machine-translated or rough from the original translator. Key areas: prediction summaries ("Pronosticaste que X ganaría"), chat strings, profile/settings labels, rules page copy. Fix any awkward phrasing, missing accents, or overly literal translations. (Audited 2026-06-21: `src/lib/i18n/locales/es.json` — 684 lines, 510+ entries present.)
- [x] **i18n-PR2 — ClassificationRulesPreview content** — Done. All rules-preview strings now use `t()` keys (`rules_preview.*`) at ClassificationTabs.tsx:633-779. (Audited 2026-06-14.)
- [x] **i18n-PR3 — Country name localisation** — Removed from queue (not needed for MVP).

## Competition Chat

> Design complete: grill session 2026-06-10. ADR: `docs/adr/0016-db-backed-chat-over-broadcast.md`. CONTEXT.md updated with: Competition Chat, System Message, Tombstone, @Mention.
>
> Per-competition async chat. DB-backed via Supabase `postgres_changes`. Admin can enable/disable (hides UI, preserves data). No prediction content in system messages.

### Phase CH-A — Schema & API

- [x] **CH-A1 — chat_messages table migration** — `chat_messages` (id uuid, competition_id FK, user_id FK, content text, message_type enum('user','system'), mentioned_user_ids uuid[], created_at, updated_at, deleted_at, deleted_by enum('user','admin') null). RLS: read/write scoped to competition members. Realtime publication enabled.
- [x] **CH-A2 — Chat toggle on competitions** — Add `chat_enabled boolean default true` to `competitions`. Admin UI checkbox in competition settings.
- [x] **CH-A3 — Send message API** — `POST /api/chat` — validates membership, rate limiting (standard), max message length, inserts row.
- [x] **CH-A4 — List messages API** — `GET /api/chat?competitionId=X&cursor=Y` — cursor-based pagination, newest first, tombstones for deleted messages.
- [x] **CH-A5 — Delete message API** — `DELETE /api/chat/:id` — user can delete own; admin can delete any. Within 10s: hard delete. After 10s: soft delete (set deleted_at + deleted_by).
- [x] **CH-A6 — Edit message API** — `PATCH /api/chat/:id` — user can edit own within 5 minutes. Sets updated_at. Returns 403 after window.
- [x] **CH-A7 — System message on join** — Trigger: when a new `competition_members` row is inserted, insert a system message "X joined the competition".

### Phase CH-B — Components

- [x] **CH-B1 — ChatMessage component** — Renders a single message: display name, content, timestamp, "(edited)" indicator, tombstone state. @mention highlighted + tappable (no-op v1, future: scroll to profile).
- [x] **CH-B2 — ChatWidget component** — Shared component with mini/full modes. Mini: last 3 messages (5 if user sent one), single input field, close button (X). Full: ~75% iPhone screen height, full input, scroll to load history.
- [x] **CH-B3 — MentionAutocomplete component** — Triggered by `@` in input. Dropdown of competition members by display name. Inserts `@DisplayName` into message text.
- [x] **CH-B4 — Realtime subscription** — Subscribe to `postgres_changes` on `chat_messages` filtered by `competition_id`. Append new messages, handle edits/deletes live.

### Phase CH-C — Integration

- [x] **CH-C1 — Mini chat on dashboard** — Add ChatWidget (mini mode) to DashboardClient.tsx. Position: below group fixtures section (section 5), above leaderboard link. Smart close: closed state in localStorage, reappears when new message arrives after close timestamp.
- [x] **CH-C2 — Full chat on leaderboard** — Add ChatWidget (full mode) to leaderboard page. Overall leaderboard collapses to show user + ~4 above/below. Chat takes remaining ~75% of screen.
- [x] **CH-C3 — Move leaderboard link up on dashboard** — Reorder dashboard sections: leaderboard link moves to after group fixtures (section 5 → section 6), displacing current position. *(Audited 2026-06-20: done at `DashboardClient.tsx:552-569`.)*
- [x] **CH-C4 — Unread badge on tab bar** — Done via `useUnreadChat()` hook (`src/hooks/useUnreadChat.ts:48-79`) consumed in `TabBar.tsx:115-145`. Capped at 9+, localStorage-backed. (Audited 2026-06-14.)
- [x] **CH-C5 — Dedicated /wc/chat page** — Full-screen chat page accessible exclusively via tab bar. Top: leaderboard classification pills (Overall, Format, Rival Predictions) that navigate to `/wc/leaderboard` with the corresponding tab active. Main content: ChatWidget in full mode at ~90% viewport height. Update TabBar to point Chat tab to `/wc/chat` and highlight when active. Keep existing mini/full widgets on dashboard and leaderboard. (Audited 2026-06-21: route, ChatWidget full mode, TabBar, and classification pills all complete at `ChatPageClient.tsx:17-59`.)

### Phase CH-D — Notifications

- [x] **CH-D1 — Push notification for @mentions** — When a message contains @mention, send push to mentioned user (if opted in).
- [x] **CH-D2 — Push notification for new member join** — When system message "X joined" fires, push to all competition members (if opted in).
- [x] **CH-D3 — Notification settings** — Add chat notification preferences to user settings: @mention alerts (on/off), new member alerts (on/off).

### Phase CH-E — System Notifications in Chat

- [x] **CH-E1 — Result confirmed system message** — Done. `notifyResultConfirmed()` at `src/lib/notifications/result-confirmed.ts:45-51` inserts a `message_type: 'system_result'` row; called from confirm-result/route.ts:180. Copy is "{team} {score} {team} — result confirmed." (Audited 2026-06-14.)
- [x] **CH-E2 — System message styling** — Done. System messages render centered, italic, muted (`text-xs text-ps-text-ter italic`) with no avatar and reply/edit/delete suppressed (`!isSystem` gate) at `ChatMessage.tsx:189-196`. (Audited 2026-06-14.)
- [ ] **CH-E3 — Additional system events** — Extend system messages to: round opened ("Round {n} is open for predictions"), draw completed ("Groups have been drawn"), competition status changes. Each gated behind `chat_enabled`. *(2026-07-01 audit: PARTIAL — system_result, system_join, system_reckons, system_tag_reveal/change/reject, system_round_summary all exist in CHECK constraint + ChatMessage.tsx:221-251. Remaining: round_opened, draw_completed, status_changed message types.)*

## Prediction Visibility Revisit

> **Run `/grill-with-docs` before any implementation.** Raised during chat feature design (2026-06-10). Currently predictions are hidden behind `pick_reveal_at` (defaults to `lock_time`). Questions to resolve: (1) Should other competition members see *what* you predicted after lock, or only *that* you predicted? (2) If visible, when — at lock, after result, or never? (3) How does this interact with chat (no prediction spoilers in system messages — already decided)? (4) Does the leaderboard or any social surface expose individual picks?

- [ ] **PV-1 — Design spike (grill session)** — Run `/grill-with-docs`. Define visibility rules for predictions across all surfaces: chat, leaderboard, match cards, profile. Do not change code until this is complete. *(2026-07-01 audit: PARTIAL — applyVisibility() at visibility.ts:52 with 3-tier viewer roles (admin/member/public), standings route passes viewerRole. Chat shows preview for non-members. Remaining: chat message display names not pseudonym-resolved, match card/profile visibility rules still undefined. No grill session run yet.)*

## Provisional Groups & Admin Redraw

> Groups are currently drawn once (lazily, at `drawAt`) and are final. Late joiners slot into the smallest group via `addLateEntrant()` with no reshuffle. This feature adds provisional groups that auto-redraw as more participants join, plus an admin redraw button.
>
> **Run `/grill-with-docs` before implementation.** Key design decisions: redraw threshold formula, UX for "your group may change" messaging, interaction with predictions already submitted against provisional groups, lock-in timing.

### Phase PG-A — Schema & Config

- [ ] **PG-A1 — Design spike (grill session)** — Run `/grill-with-docs`. Define: (1) redraw trigger — threshold-based (e.g. 25% increase or N+ new entrants since last draw) vs time-interval re-draws; (2) what happens to predictions submitted against provisional groups (void? carry over? block predictions until final?); (3) lock-in rule — groups become final at first prediction window lock (existing `canRegenerateDraw()` already checks this); (4) admin override — can admin force a redraw within the window even without threshold? Do not write code until this is complete.
- [ ] **PG-A2 — Add provisional fields to classification config** — Add `redraw_threshold` (int, minimum new entrants to trigger auto-redraw) and `groups_provisional` (boolean, true until lock-in) to `classifications.config`. Migration + type update.
- [ ] **PG-A3 — Track draw metadata** — Add `last_draw_at` (timestamptz) and `entrant_count_at_draw` (int) to `format_prediction_groups` or classification config. Needed to evaluate whether threshold is met.

### Phase PG-B — Auto-Redraw Logic

- [ ] **PG-B1 — Redraw evaluation function** — `shouldRedrawGroups(classificationId)`: compares current member count vs `entrant_count_at_draw`. Returns true if delta >= `redraw_threshold` AND `canRegenerateDraw()` (before first window lock).
- [ ] **PG-B2 — Lazy redraw in my-group endpoint** — Extend `GET /api/tournament/my-group` to call `shouldRedrawGroups()` before returning existing groups. If true, re-run `allocatePredictionGroups()` (which already deletes + recreates). Update draw metadata. *(2026-06-30 audit: PARTIAL — allocatePredictionGroups() wired at route.ts:138. Remaining: shouldRedrawGroups() gate — blocked by PG-B1.)*
- [ ] **PG-B3 — Admin redraw API** — `POST /api/admin/redraw-groups` — admin can force a redraw for a classification. Validates `canRegenerateDraw()`. Returns new group allocation.

### Phase PG-C — UI

- [ ] **PG-C1 — Provisional banner** — When `groups_provisional` is true, show "Groups are provisional — may change as more people join" banner in `ClassificationTabs` and `GroupMiniTable`. Remove banner when groups lock in.
- [ ] **PG-C2 — Admin redraw button** — Add "Redraw Groups" button to WC admin dashboard, visible only when `canRegenerateDraw()` is true. Confirmation dialog explaining all current groups will be dissolved.
- [ ] **PG-C3 — Draw history indicator** — Show "Draw #N" or "Last redrawn at [time]" in group header. Helps participants understand that groups have changed.

## Scoring Hardening Follow-ups

- [x] **SH-1 — Broadcast scores_updated from auto-resolve path** — Done. `auto-result.ts:329-332` broadcasts on `scoring_events` channel after batch scoring. (Audited 2026-06-30.)
- [x] **SH-2 — Investigate competition_id scoping for multi-instance leaderboards** — All 72 WC events have `competition_id = 1a4448e5` (first instance only). The `sum_prediction_points` RPC uses `tournament_id` for scoping, which is correct because events are shared. However, if a future blueprint creates per-instance events (not shared), the RPC would need a `competition_id` path on the predictions table. Document the assumption or add a `competition_id` FK to predictions when multi-instance divergence is needed. *(Audited 2026-06-19: RPC handles both tournament_id and competition_id via CASE branch at `20260616140000_sum_prediction_points_rpc.sql:33`.)*
- [x] **SH-3 — Clean up orphaned migration history entries** — All 91 migrations synced (local = remote). No orphans remain. (Audited 2026-07-01.)
- [x] **SH-4 — Multi-provider cross-validation for auto-resolved results** — Design complete (ADR 0019). Optimistic model: score immediately on primary `is_final`, verify async against next provider in chain, promote or dispute. Implementation: (1) `compareResults()` pure function — team sports compare `home_score`/`away_score`, position sports compare top 3; (2) `verifyResult()` orchestration — walks chain excluding primary, max 2 attempts (immediate + 1 retry); (3) verification state in `result_data` JSONB (`verification_status`, `verification_provider`, `verification_attempts`, `verified_at`); (4) `notifyResultDisputed()` — push to admin + chat system message to all members; (5) dispute resolution via existing confirm-result endpoint with force-rescore; (6) `autoResolveEvent` re-enters confirmed events with `verification_status: "pending"`. Generic across all sports — single-provider sports auto-promote to `unverifiable`. (Audited 2026-06-21: fully implemented — `fetch-result.ts:53,138`, `auto-result.ts:347`, `result-disputed.ts:33`. Commit `10e1784`.)

- [ ] **SH-5 — Admin UI overhaul + role duality** — Current admin UI is inadequate. Fundamental issue: the admin role means different things for Sanctioned Competitions (social organiser — pick preset, invite friends, moderate chat) vs Custom Competitions (operational manager — author fixtures, enter results, resolve disputes). The admin surface must serve both without overwhelming sanctioned admins or under-serving custom admins. Includes: rate budget quality review for SH-4 once live. Requires dedicated design session (`/grill-with-docs`). *(2026-07-01 audit: PARTIAL — ADR 0013 defines the split. Super-admin surface exists at /wc/admin/WcAdminClient.tsx. Remaining: competition admin Settings + Members pages, participant-view toggle.)*

---

## Backlog

**WC-H6: R32 Classification (Automatic)**
- [x] **H6.1 — R32 team extraction** — `extractR32Teams()` in `r32-classification.ts`. 24 from groups + 8 from bestThirdPicks.
- [x] **H6.2 — R32 scoring logic** — `scoreR32Classification()` in `r32-classification.ts`. 1 point per correct team, path-insensitive.
- [ ] **H6.3 — R32 leaderboard** — Standings display: "Alice 31/32 (96.9%)". Ranked by score, ties broken by submission timestamp. *(2026-07-01 audit: PARTIAL — scoring engine at r32-classification.ts + stage-pick.ts:60 calculateR32Classification(). ClassificationTabs label registered at :831 ("Last 32"). Remaining: ClassificationTabs LEADERBOARD_KEYS filters out bracket classifications — needs adding to visible set + R32-specific ranking display.)*
- [ ] **H6.4 — Dashboard widget** — "You correctly predicted 29 of the final 32 teams!" *(Not built. Blocked: needs real group stage results.)*

**WC-H7: FAQ Page**
- [x] **H7.1 — /wc/rules page** — Implemented at `/wc/rules` (sticky pill nav, single-scroll layout) and `/wc/faq` (generated FAQ).
- [x] **H7.2 — FAQ content** — Copy written for Points, Format, Picks, Ties sections + FAQ generator in `faq/generator.ts`.
- [x] **H7.3 — Searchable/linkable** — Anchor links via `StickyPillNav` + `FormatProgressDots` for deep linking to sub-sections.

**WC-H8: Onboarding Integration**
- [ ] **H8.1 — Add Full Bracket step to onboarding** — After Classifications Overview, show "Want to fill out your bracket now?" with [Start] / [Skip] options.
- [ ] **H8.2 — Skip flow** — If user skips, exclude from Full Bracket and R32 classifications, proceed to Format enrollment. *(2026-06-30 audit: PARTIAL — goToStep5() skip exists. Remaining: no exclusion from bracket/R32 classifications on skip.)*
- [x] ~~**H8.3 — Champion pick (UI warmer)** — Add "Who takes home all the biscuits?" step early in onboarding. Copy: "Just because you love them doesn't mean that's what your head wants to pick."~~ *(DONE — audited 2026-06-27: FinalStep.tsx + ChampionFlagFountain.tsx)*
- [x] **H8.4 — Privacy settings** — Add leaderboard visibility choice: public / anonymous (Player #N) / private-only. *(Audited 2026-06-19: API at `tournament/visibility/route.ts:9`, VisibilityToggle inline on leaderboard rows at `ClassificationTabs.tsx:436`, pseudonym system via `ensurePseudonym()`. Fully shipped.)*

**WC-H9: Data Model & API**
- [x] **H9.1 — Bracket submission schema** — `bracket_prediction_submissions` table in `20260521400000_bracket_system.sql`.
- [x] **H9.2 — R32 classification config** — Migration `20260523000000_r32_pick_classification.sql` + `stage-pick.ts` scorer.
- [x] **H9.3 — Save draft API** — `POST /api/tournament/bracket/submit` with draft support.
- [x] **H9.4 — Lock bracket API** — `POST /api/tournament/bracket/lock` finalizes and locks submission.

**Phase 2 Enhancements:**
- [ ] **H-P2.1 — Fair play tiebreaker** — Add fair play score tracking (requires card data from providers). *(2026-06-30 audit: PARTIAL — fair_play type defined in tiebreaker schema. Remaining: no card tracking implementation.)*
- [ ] **H-P2.2 — FIFA ranking tiebreaker** — Maintain FIFA ranking dataset, use as final tiebreaker before random.
- [ ] **H-P2.3 — Favorites/underdogs toggle** — Show betting odds or FIFA rankings during group predictions (optional config).
- [ ] **H-P2.4 — Bracket comparison** — Compare your bracket vs friends, highlight differences.
- [ ] **H-P2.5 — "What if" simulator** — Change one match result, see cascading bracket impact.

**Multi-Instance UX:**
- [ ] **MI.1 — Block auto-provision on invite code** — When a user joins via invite code and the target competition is full, don't silently redirect to a new instance. Show a message ("This competition is full") and offer to join another or create their own. *(2026-06-30 audit: PARTIAL — non-tournament 403 works. Remaining: tournament path at join/route.ts:144-150 still auto-provisions via findOrProvisionInstance().)*
- [ ] **MI.2 — Instance navigation UI** — Users in multiple WC instances have no way to switch between them. Add a competition switcher to the WC surface.

## Tournament Brackets (Future — Needs Design)

> **Run `/grill-with-docs` before any implementation.** Critical design decisions: (1) predict-as-you-go vs. fill-your-bracket-upfront; (2) how to handle GAA backdoor/qualifier systems vs pure single elimination; (3) automatic winner advancement vs admin-triggered; (4) whether bracket is a `CompetitionType` or a setting on existing competitions.
>
> Reference formats: NCAA March Madness (64-team pure single elimination), All Ireland Hurling (provincial rounds → All Ireland series), All Ireland Senior Football (provincial + Super 8 round-robin → knockouts).

### Phase H — Data Model

- [x] **H1 — Design spike (grill session)** — Run `/grill-with-docs`. Define: bracket prediction mode (match-by-match vs. upfront bracket fill), GAA backdoor handling, winner propagation trigger, bracket type vs competition setting, bye handling. Do not write code until this is complete. *(Audited 2026-06-19: ADR 0003 at `docs/adr/0003-versioned-bracket-snapshots.md`, plus `docs/research-tournament-formats.md` and `docs/DESIGN-PROMPT-WC2026-BRACKET.md`. WC bracket architecture designed and shipped. GAA backdoor not yet designed — separate scope under K3.)*
- [x] **H2 — Bracket schema migration** — *(Audited 2026-06-19: Implementation took a different architectural path — JSON-based bracket templates + versioned snapshot predictions (`20260521400000_bracket_system.sql`) instead of relational event-linking. The original columns (bracket_slot, advances_to_event_id) were superseded by this design. Marking done — the schema need is met, just differently.)*
- [x] ~~**H3 — Bracket slot ordering util** — `src/lib/bracket.ts`: `buildBracketTree(rounds, events)` — takes flat rounds + events, returns a tree structure `BracketNode[]` suitable for rendering. Handles byes (null participants). Validates that advancement links are consistent.~~ *(DONE — audited 2026-06-27: bracket/utils.ts + fifa-world-cup-2026.ts)*

### Phase I — Admin Bracket Builder

- [x] ~~**I1 — Bracket template definitions** — `src/lib/bracket-templates.ts`: define standard bracket shapes as slot-count-per-round arrays. Built-in templates: `single_elim_4`, `single_elim_8`, `single_elim_16`, `single_elim_32`, `single_elim_64`, `gaa_all_ireland_hurling` (QF×4 → SF×2 → F), `gaa_all_ireland_football` (QF×4 → SF×2 → F). Templates describe slot count per round and how slot winners advance — not teams.~~ *(DONE — audited 2026-06-27: bracket/templates/index.ts + types.ts)*
- [ ] **I2 — Bracket competition wizard** — New admin flow for creating bracket-style competitions. Selects a template → auto-creates rounds with correct `bracket_round_label` values + placeholder events with `is_bracket_placeholder=true`. Admin fills in known teams; TBA slots remain as placeholders until rounds progress. *(2026-06-30 audit: PARTIAL — User prediction wizard exists. Remaining: admin bracket creation wizard.)*
- [ ] **I3 — Winner advancement UI** — After admin confirms a bracket event result, show "Advance winner to next round" action. Pre-fills the winner's name into the correct slot (`advances_to_slot`) of the target event. If target event now has both teams confirmed, it becomes predictionable (clears TBA flag).
- [ ] **I4 — Bracket event management** — Extend existing admin event editing to show bracket context: which event this advances from, which event it advances to. Block deletion of events that have downstream advancement links.

### Phase J — Participant Bracket View

- [x] ~~**J1 — Bracket visualisation component** — `src/components/BracketTree.tsx`: renders a competition's bracket as a horizontal tree (rounds as columns, matches as nodes). Each node shows: team A vs team B (or TBA), lock status, user's pick (if any), result. Mobile-friendly — scrolls horizontally. Uses `buildBracketTree()` from H3. **⚠ Name collision:** WC-hardcoded `BracketTree.tsx` exists at `src/components/tournament/bracket/BracketTree.tsx` (imports `WC2026_KNOCKOUT_ROUNDS`). The generic J1 component must be template-driven, not WC-specific.~~ *(DONE — audited 2026-06-27: BracketTree.tsx + FoldedBracket.tsx)*
- [x] ~~**J2 — Bracket page** — `/competitions/[id]/bracket` route. Shows `BracketTree` for bracket-enabled competitions. Linked from competition nav alongside "The Round" and leaderboard. Non-bracket competitions don't show this tab.~~ *(DONE — audited 2026-06-27: /wc/bracket/page.tsx + wizard/page.tsx)*
- [ ] **J3 — Inline prediction in bracket view** — Tapping a node in the bracket tree opens a prediction sheet (same prediction flow as existing). Locked/TBA nodes are non-interactive with clear visual state. *(2026-07-01 audit: PARTIAL — EmbeddedBracketKoEditor.tsx allows editing KO picks inline from /wc/picks/[windowId]. Remaining: tap-to-predict from the /wc/bracket view itself.)*

### Phase K — GAA-Specific Templates

- [ ] **K1 — All Ireland Hurling bracket** — Template covering the standard All Ireland series structure: 4 quarter-finals (2 provincial champions + 2 qualifiers), 2 semi-finals, 1 final. Note: provincial championship rounds (Munster, Leinster) are separate and can be modelled as standalone competitions that feed into this one — no need to model the full championship in one bracket.
- [ ] **K2 — All Ireland Football bracket** — Template for the All Ireland senior football series knockouts. Account for current format (quarter-finals onwards). Provincial stages modelled separately if needed.
- [ ] **K3 — Backdoor/qualifier pathway (stretch)** — For GAA competitions: support a "loser's path" where a first-round loser can re-enter via qualifiers. Requires `advances_loser_to_event_id` on events. Only implement after H1 design spike confirms this is in scope.

## TBA/TBC Fixture Eligibility

Fixtures with unknown participants (TBA / TBC team names from providers) should not be predictionable in personal picks or group competition events, except when explicitly part of a bracket where predicting the winner before teams are known is the point.

- [x] **G1 — TBA detection util** — `hasTBAParticipant()` in `src/lib/sports/tba-detection.ts`. Matches TBA, TBC, TBD, full phrases, and empty strings (case-insensitive).
- [x] **G2 — Block personal prediction creation for TBA fixtures** — In `POST /api/personal-predictions/event`, if any participant in `config.options` matches TBA, return 422 with `{ error: "tba_fixture" }`. Fixture browser should show these as greyed-out with "Teams TBA" label instead of a pick button.
- [x] **G3 — Block admin event creation for TBA fixtures (non-bracket)** — In `POST /api/admin/events`, if `config.options` contains TBA values and the event is not marked `is_bracket_placeholder: true`, return 422. In `AddEventForm.tsx`, show a warning when a fixture with TBA participants is selected.
- [x] **G4 — Bracket placeholder flag** — Add `is_bracket_placeholder boolean default false` to `events` table (migration). Admin can set this when creating a bracket-style event ("Winner of Match A vs Winner of Match B"). TBA check is bypassed for these events. Bracket placeholders are locked at round lock time regardless.
- [x] **G5 — Filter TBA fixtures from personal fixture browser** — Filters TBA fixtures before grouping, shows "N fixtures hidden — teams not yet confirmed" notice. Also added 422 block in personal-predictions/event API route.

## All-Competitions Dashboard

> **Design complete:** `docs/DESIGN-F1-ALL-COMPETITIONS-DASHBOARD.md` (2026-05-22, grill session). Decision record: `docs/adr/0010-cached-non-authoritative-standings.md`. The dashboard answers "how am I doing" across all of a user's competitions via a top "Your form" card + a per-card rank line on `/competitions`.

- [x] **F1 — Design spike (grill session)** — ✅ Done. Produced `DESIGN-F1-ALL-COMPETITIONS-DASHBOARD.md`, ADR-0010, and four `CONTEXT.md` terms. Primary job = "how am I doing"; cached non-authoritative `competition_standings`; lazy read-through write path; scheduled job built dormant.
- [ ] **F2a — Standings cache layer** — Finish the cache plumbing per design doc §3–§4: (c) implement the bodies of `recomputeStandings()` + `getCachedStandings()` in `src/lib/standings-cache.ts` (both currently throw "not impl"); (d) add dormant `/api/cron/recompute-standings` route (NOT in `vercel.json`). *(2026-07-01 audit: PARTIAL — migration at 20260522500000_competition_standings_cache.sql, ADR 0010. Table exists in DB. No app code reads/writes the cache. recomputeStandings() + getCachedStandings() stubs still throw "not impl". No cron route.)*
- [ ] **F2b — Dashboard UI card on /competitions** — Build per design doc §3–§4: (e) top "Your form" card with three display modes (empty / single-competition / full), gated to ≥1 group competition; (f) per-card rank line. Card expansion: 1 line → 5 results (stop there — F4 is the deeper target). Depends on F2a + F3a.
- [ ] **F3a — `computeGlobalHitRate()` implementation** — Implement the body of `computeGlobalHitRate(userId)` at `src/lib/leaderboard.ts:370` (currently throws "not impl"). Aggregates correct ÷ resolved across ALL the user's competitions (personal + group). See design doc §3.7.
- [ ] **F3b — Surface global hit rate in dashboard card** — Wire `computeGlobalHitRate()` into the F2b "Your form" card as the headline number. Distinct from the personal-stats hit rate (which is personal-competition-only).
- [ ] **F4 — Cross-competition results page** — *(new — added by F1 spike)* `/competitions/results`: every resolved prediction across all the user's competitions, with sport/competition filtering. The real target of the dashboard card's second expansion (F2 stops at 5 results because this page doesn't exist yet). Note: today's only `ResultsTab` lives inside `PersonalFixtureBrowser` and is personal-only.

## WC Dashboard State — Design Sessions

> Design doc: `docs/DESIGN-WC-DASHBOARD-STATE.md`. ADR: `docs/adr/0012-centralised-dashboard-state.md`.
> Three-part design. Section A (state machine, card stacks, derivation rules) complete.

- [x] **DS-A — Dashboard State Machine (Section A)** — Grill session complete (2026-05-25). Defined 5 dashboard states, card stack ordering, bracket card visibility rules, derivation logic, data contract (`WcDashboardState` interface), Full Bracket eligibility rule (sealed at PW1 lock), leaderboard state awareness. ADR 0012 accepted. CONTEXT.md updated with "Dashboard State" term.
- [x] **DS-B — Format Classification Hero Surface (Section B)** — Done. Captured in `docs/DESIGN-WC-DASHBOARD-STATE.md` §11–17 (lines 301–498): two-mode hero card (weigh-in / survival), group roster display, qualification shading, elimination curve, knockout neighbourhood view, enriched leaderboard detail page. (Audited 2026-06-14.) Implementation tasks not yet broken out.
- [x] **DS-C — Surface-Wide Polish (Section C)** — Done. Captured in `docs/DESIGN-WC-DASHBOARD-STATE.md` §18–22 (lines 501+): copy tone tiers, naming conventions (Matchday/Stage, "The Cut" for R32), fixture card anatomy, brand mark placement rules, visitor narrative flow. (Audited 2026-06-14.) Implementation tasks not yet broken out.

*(PV-1, Competition Chat, and Provisional Groups moved to Active Sprint above.)*
