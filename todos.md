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

## Round Builder UX Improvements (2026-05-12)

See `ROUND-BUILDER-IMPROVEMENTS.md` for detailed task breakdown.

### Phase 1: Smart Filtering (30-45 mins)
- [ ] 1.1 — Add `getValidPredictionTypes()` helper function
- [ ] 1.2 — Update "Apply to all" section to filter by fixture type
- [ ] 1.3 — Update per-fixture override section to filter by fixture type
- [ ] 1.4 — Update initialisation logic to only enable valid types
- [ ] 1.5 — Test with rugby fixtures, F1 races, and mixed scenarios
- [ ] 1.6 — Add sport-specific draw logic helper

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
