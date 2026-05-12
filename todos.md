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

### Phase 2: Card-Based UI (4-5 hours) — **DO NOT START UNTIL PHASE 1 COMPLETE**
- [ ] 2.1 — Design card component structure
- [ ] 2.2 — Create new state model for card-based predictions
- [ ] 2.3 — Build PrimaryOutcomeCard component (HOME/DRAW/AWAY buttons)
- [ ] 2.4 — Build ScoringPredictionsCard component (collapsible)
- [ ] 2.5 — Build YesNoCard component (collapsible)
- [ ] 2.6 — Refactor Step2Configure to use cards
- [ ] 2.7 — Add auto-population for head_to_head config (team names)
- [ ] 2.8 — Add validation (required fields, valid numbers)
- [ ] 2.9 — Add "Show all types" escape hatch toggle
- [ ] 2.10 — Mobile optimization (stacked cards, vertical buttons)
- [ ] 2.11 — Update fixture summary display with card icons
- [ ] 2.12 — Write tests for new UI flow

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
