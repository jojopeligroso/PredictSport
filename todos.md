# PredictSport - MVP Punch List

Priority order. Mirrors SPEC.md §15. **Keep both files in sync.**

Audit date: 2026-05-09.

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
- [ ] **C2 — Sport-aware prediction type defaults** — Util `getPersonalDefaults(sport, format)`: team sports → `winner` + `exact_score` as primary, 2-3 extra pills; race sports → `winner` only. Wire into B2.
- [x] **C3 — Familiar terminology pills** — Map internal types to pill labels: `exact_score` → "Correct Score", `margin` → "Winning Margin", `over_under` → "Over/Under", `handicap` → "Spread", `head_to_head` → "H2H", `yes_no` → "Prop Bet", `top_n` → "Top 3", `progression` → "To Qualify", `final_standings` → "Outright Winner". Apply across personal predictions UI.
- [ ] **C4 — Contextual outright card in Fixtures tab** — When browsing a specific league, show a contextual card at top: "Who wins [League]?" if no outright exists. Tapping creates the outright via B4.

### Phase D — Outrights Tab

- [x] **D1 — Outrights tab scaffold** — New tab in personal predictions nav. Lists all user's active outright picks with status (open, resolved, pending resolution).
- [ ] **D2 — Inferred suggestions section** — Secondary section in Outrights tab. Calls B5. Shows dismissable suggestion cards ("You've picked 4 Premier League games — who wins the title?"). Dismissal stored per user per league.
- [x] **D3 — Outright change rules UX** — Before tournament start: freely editable. After start: show change budget (e.g. "2 changes remaining"), timestamped history inline. UX discourages flipping (confirm dialog).

### Phase E — Dashboard Tab

- [x] **E1 — Dashboard tab scaffold + stats fetch** — New tab. Calls B6. Renders fixed widget order: Recent Picks → Summary Strip → By Year → By Sport → By League.
- [x] **E2 — Recent Picks widget** — Last 5 picks in super-compact single-card view (one line per pick: team badge, result icon, sport tag). Expandable dropdown to show all. Correct/wrong/pending colour coding.
- [ ] **E3 — Summary Strip widget** — Lifetime stats row: total picks, % correct, current streak, best streak.
- [ ] **E4 — By Year/Season widget** — Year selector (2024 / 2025 / 2026). Shows hit rate for selected year. Auto-defaults to current year.
- [ ] **E5 — By Sport widget** — Hit rate per sport as a simple ranked list (Football 64%, GAA 71%, ...). Tap sport to drill into By League.
- [ ] **E6 — By League widget** — Drill-down view within a sport. Hit rate per league/competition. Triggered by tapping a sport in E5.
- [ ] **E7 — My Favourite Team widget** — Opt-in. If `users.favourite_team` is set: show recent pick history for that team + next upcoming fixture. If not set: show a small "Set a favourite team" prompt card.
- [ ] **E8 — Customise button (placeholder)** — "Customise" button in dashboard header. For now shows a toast: "Widget reordering coming soon." Lays the groundwork (widget order stored in `users.notification_prefs` or new `dashboard_prefs` column).

### Phase F — Onboarding

- [ ] **F1 — Favourite team prompt at signup** — After first successful login (detect via `created_at` within last 60s or a `onboarding_complete` flag), show a one-time modal: "Got a favourite team? We'll track your picks for them." Sport selector + team name input. Saves to `users.favourite_team`. Skippable.
- [ ] Event nominations by participants (submission UI)
- [ ] Public competition browsing/discovery page
- [ ] Tiebreaker submission UI
- [ ] Co-admin appointment UI
- [ ] "New Season" clone from archived competition

## Round Builder UX Improvements

See `ROUND-BUILDER-IMPROVEMENTS.md` for full details.

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

See `MANUAL-EVENTS-AND-API-GAPS.md` for detailed task breakdown.

### Phase 3: Manual Event Management (3-4 hours) — **INDEPENDENT, can run parallel to Phase 1/2**

**Admin Workflow Improvements**
- [ ] 3.1 — Audit existing manual event creation flow (AddEventForm.tsx)
- [ ] 3.2 — Design ManualEventWizard component (5-step guided creation)
- [ ] 3.3 — Add team name validation & autocomplete suggestions
- [ ] 3.4 — Create manual event templates (GAA, soccer, snooker, etc.)
- [ ] 3.5 — Build bulk manual event creator (CSV upload or multi-row form)
- [ ] 3.6 — Improve manual result entry UX (pre-populate, validation, preview)
- [ ] 3.7 — Add result undo/edit capability (10-min window)
- [ ] 3.8 — Add "Events Missing Results" admin alert dashboard
- [ ] 3.9 — Auto-fetch reminder for manual events (cron notification)
- [ ] 3.10 — Add "Duplicate Event" cloning feature
- [ ] 3.11 — Validation before round/competition activation (pre-flight checks)
- [ ] 3.12 — Documentation & inline help (tooltips, admin guide)

### Phase 4: Sports API Coverage Analysis (2-3 hours) — **INDEPENDENT, run Phase 4.1-4.8 first**

**Research & Integration (prioritized by audit)**
- [ ] 4.1 — Audit current provider success rates (script + report)
- [ ] 4.2 — Identify high-priority gaps (frequency × manual_rate)
- [ ] 4.3 — Research Cricket API alternatives (Cricbuzz, CricAPI, etc.)
- [ ] 4.4 — Research GAA API improvements (ClubZap, GAA.ie scraping)
- [ ] 4.5 — Evaluate Rugby League sources (NRL, Super League APIs)
- [ ] 4.6 — Research Athletics APIs (World Athletics, Tilastopaja)
- [ ] 4.7 — Evaluate Snooker coverage improvements (Snooker.org, CueTracker)
- [ ] 4.8 — Cost-benefit analysis for paid APIs (ROI calculation)
- [ ] 4.9 — Create provider integration guide (docs for contributors)
- [ ] 4.10 — Implement top-priority provider (TBD based on 4.8 ROI)
- [ ] 4.11 — Add provider health monitoring dashboard
- [ ] 4.12 — Document unsupported sports & workarounds

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
- [ ] 5.2a — Rename `mlb` → `baseball`, `nfl` → `american_football`, `nba` → `basketball`, `nhl` → `ice_hockey` in `Sport` type
- [ ] 5.2b — Update `SPORT_PATHS`, `registry.ts`, all provider `supportedSports` arrays
- [ ] 5.2c — Update DB `sport` column values in all existing rows (migration)
- [ ] 5.2d — Update UI labels, fixture browser sport selector

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

- [ ] 7.1 — Check `AddEventForm.tsx`: does fixture → event creation correctly wire `fixture.participants` into `config.options` for the `winner` prediction type? Check `parseWinnerOptions` is called with participants, not just the event name string.
- [ ] 7.2 — Query existing cricket events to confirm `config.options` is empty:
  ```sql
  SELECT e.event_name, ept.prediction_type, ept.config
  FROM events e JOIN event_prediction_types ept ON ept.event_id = e.id
  WHERE e.sport = 'cricket' ORDER BY e.created_at DESC LIMIT 20;
  ```
- [ ] 7.3 — Confirm `allow_draw: false` for cricket (no draw in cricket). `parseWinnerOptions` in `src/lib/parse-options.ts` already handles this — verify it's being called correctly.
- [ ] 7.4 — Confirm `exact_score` is excluded for cricket. Check `supportsExactScore()` (likely `src/lib/sports/scoring.ts`).
- [ ] 7.5 — Fix: ensure admin event creation populates `config: { options: ["Team A", "Team B"] }` from `fixture.participants`.
- [ ] 7.6 — Backfill any existing broken cricket events with correct `config.options`.

**Expected result:** Cricket winner prediction renders two pill buttons (Team A / Team B), no Draw, no exact score.

## TBA/TBC Fixture Eligibility

Fixtures with unknown participants (TBA / TBC team names from providers) should not be predictionable in personal picks or group competition events, except when explicitly part of a bracket where predicting the winner before teams are known is the point.

- [ ] **G1 — TBA detection util** — Add `hasTBAParticipant(participants: string[]): boolean` in `src/lib/sports/`. Matches case-insensitively: `"TBA"`, `"TBC"`, `"To Be Announced"`, `"To Be Confirmed"`, `""`. Used by all eligibility checks below.
- [ ] **G2 — Block personal prediction creation for TBA fixtures** — In `POST /api/personal-predictions/event`, if any participant in `config.options` matches TBA, return 422 with `{ error: "tba_fixture" }`. Fixture browser should show these as greyed-out with "Teams TBA" label instead of a pick button.
- [ ] **G3 — Block admin event creation for TBA fixtures (non-bracket)** — In `POST /api/admin/events`, if `config.options` contains TBA values and the event is not marked `is_bracket_placeholder: true`, return 422. In `AddEventForm.tsx`, show a warning when a fixture with TBA participants is selected.
- [ ] **G4 — Bracket placeholder flag** — Add `is_bracket_placeholder boolean default false` to `events` table (migration). Admin can set this when creating a bracket-style event ("Winner of Match A vs Winner of Match B"). TBA check is bypassed for these events. Bracket placeholders are locked at round lock time regardless.
- [ ] **G5 — Filter TBA fixtures from personal fixture browser** — In `PersonalFixtureBrowser.tsx`, filter out fixtures where `hasTBAParticipant` returns true before rendering the pick list. Show a count if any were hidden ("3 fixtures hidden — teams not yet confirmed").

## All-Competitions Dashboard (Future — Needs Design)

> **Note:** Run `/grill-with-docs` before implementing any of this. Significant design decisions required (card layout, data model, cross-competition aggregation, what's useful vs noisy).

A global dashboard card/view accessible from `/competitions` — giving users a high-level view across all competitions they're in, not just personal predictions.

- [ ] **F1 — Design spike (grill session)** — What does a cross-competition dashboard show? Options: recent activity across all competitions, leaderboard positions at a glance, upcoming lock times, hit rate per competition. Use `/grill-with-docs` to define scope before any implementation.
- [ ] **F2 — Dashboard card on /competitions** — A summary card on the competitions list page showing user's position and recent activity for each competition they're in. Requires deciding what data to surface.
- [ ] **F3 — Global stats** — Aggregate hit rate across all scored predictions (personal + group). Separate from personal dashboard stats.
