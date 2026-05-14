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
