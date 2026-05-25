# Session Handoff: DS-B — Format Classification Hero Surface

## What was done (Session A — 2026-05-25)

Grill-with-docs session defining the `/wc` Dashboard State machine. Produced:

- `docs/DESIGN-WC-DASHBOARD-STATE.md` — Section A design doc (state machine, card stacks, derivation rules, data contract)
- `docs/adr/0012-centralised-dashboard-state.md` — centralised `deriveWcDashboardState` function
- `CONTEXT.md` — "Dashboard State" glossary entry
- `design/wc26-*.png` — 5 FIFA WC26 brand mark variants (mono black)
- `todos.md` — DS-A/B/C tasks added

## What to do next (Session B)

**Goal:** Design the Format Classification hero card and onboarding experience — the content that fills the #1 card slot when Dashboard State is `format`.

### Must resolve

1. **Format hero card content** — What does the user see? Their prediction group (3-5 people), current standings within group, who's in danger, next matchday action. This is the USP — it needs to feel like survival drama, not a spreadsheet.

2. **Format onboarding flow** — First time a user enters `format` state (either via bracket submission or first matchday prediction), what do they see? Rules of format classification must be crystal clear: what the classifications are, what they're playing for.

3. **KO Bracket messaging** — During bracket wizard and format onboarding, set expectations: "the pre-tournament bracket is borderline impossible — a knockout bracket opens after the group stage for a second shot."

4. **R32 classification rename** — Current name ("R32 Classification" / "Last 32") is weak. It's more of a fun stat (X/32 correct) than a competitive classification. Needs a better name.

### Noted from Session A (owner's words, not yet designed)

- Format rules should be super clear — each classification explained, what they're playing for
- Animated demo concept: familiar names (Choice, Malone, Kev) with team icons, sped-up group→tiebreak→knockouts elimination flow. Onboard-only. Not implemented until refined.
- Public Format groups (32-48 strangers, confirmed by email) — post-launch feature, note the slot
- Visitor page should bias language toward Format drama but not exclude solo users
- Overall Classification detailed view is where most users end up by QF/SF — needs to be engaging

### Key files to read

- `docs/DESIGN-WC-DASHBOARD-STATE.md` — Section A (the skeleton this session builds on)
- `docs/adr/0012-centralised-dashboard-state.md` — data contract
- `SPEC.md` §16.8 — Format Classification rules (elimination curve, group allocation, qualification)
- `src/components/tournament/ClassificationTabs.tsx` — current leaderboard display
- `src/app/wc/page.tsx` — current landing page
- `CONTEXT.md` — glossary (Dashboard State, Classification, etc.)

### Approach

Run `/grill-with-docs` again for Section B. The output should be an update to `docs/DESIGN-WC-DASHBOARD-STATE.md` adding Section B, or a separate `DESIGN-WC-FORMAT-HERO.md` if it's large enough.
