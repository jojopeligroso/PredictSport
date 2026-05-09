# PredictSport - MVP Punch List

Priority order. Mirrors SPEC.md §15. **Keep both files in sync.**

Audit date: 2026-05-09.

## P0 — Blocking launch

- [-] §15.1 — Fix Google OAuth on deployed app (redirect URL config)
- [x] §15.2 — User profile page (display name, avatar, notification prefs)
- [x] §15.3 — Competition activation UI (draft → active button in admin)
- [x] §15.4 — Competition completion/archive flow in admin

## P1 — Core functionality gaps

- [ ] §15.5 — H2H draw support: `allow_draw` config, draw option in UI, scorer update
- [ ] §15.6 — Over/under push handling: exact line hit → void (null), not wrong
- [ ] §15.7 — UI vocabulary: rename "The Damage" → "Results", "The Sheet" → "The Round", review AI-generated copy
- [ ] §15.8 — WhatsApp Cloud API integration (reminders, results, leaderboard)

## P2 — Polish & quality of life

- [ ] §15.9 — Scoring template redesign (clear explanations, examples, visual distinction)
- [ ] §15.10 — Logo redesign (current PS mark is placeholder)
- [ ] §15.11 — Persona callout configuration in settings

## Post-Launch

- [ ] Event nominations by participants (submission UI)
- [ ] Public competition browsing/discovery page
- [ ] Tiebreaker submission UI
- [ ] Co-admin appointment UI
- [ ] "New Season" clone from archived competition
