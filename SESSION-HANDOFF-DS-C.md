# Session Handoff: DS-C — Surface-Wide Polish

## What was done (Session B — 2026-05-25)

Grill-with-docs session designing the Format Classification hero card. Produced:

- `docs/DESIGN-WC-DASHBOARD-STATE.md` Section B (Sections 11-17) — hero card two modes (weigh-in / survival), ternary headline (safe/contested/danger), qualification shading (neutral/amber/red mirroring WC group rules), knockout neighbourhood view, enriched Format leaderboard tab
- `CONTEXT.md` — "The Cut" glossary entry
- R32 classification renamed to "The Cut" (tab) / "Who Made the Cut" (full title)

### Key decisions from Session B

- **One component, two modes** — PW1 "weigh-in" mode (group roster, curve, minimal guide) vs post-PW1 "survival" mode (ternary headline + shaded mini-leaderboard)
- **PW1 card IS the onboarding** — no separate modal or interstitial
- **Ternary qualification model** — safe (neutral), contested/best-third (amber), danger (red), matching the WC group stage format
- **Knockout stages use neighbourhood view** — your row + 1 above + 1 below from the survivor pool
- **Display name nudge** — conditional link to `/profile`, not an inline editor
- **No scoring in the card** — already on the `/wc` page
- **Curve persists in both modes**
- **Format detail = enhanced leaderboard Format tab** — not a new route
- **KO Bracket messaging stays in bracket wizard only**
- **H2H knockout format** — noted as Phase 2 future classification type

## What to do next (Session C)

**Goal:** Surface-wide polish — the copy, tone, and visual details that make the designed structures from Sections A and B feel alive.

### Must resolve

1. **Copy tone rules** — What voice does the `/wc` surface use? The brand brief says "confident, cheeky, craftsman-warm" and "pub chalkboard vibe." How does that translate to specific headline patterns, CTA wording, and status messages? The Section B design doc has placeholder copy ("2nd of 4. You're through.", "Your group. Your rivals.") — these need finalising or at least a tone framework that Session D/implementation can follow.

2. **Fixture card anatomy** — The existing fixture/results cards use city colour backgrounds + white text. What's the full anatomy? Score display, team names, prediction status indicator, result badge, kick-off time format. These cards appear across multiple surfaces (picks page, dashboard, bracket review).

3. **Naming conventions** — "Prediction Window" (spec term) vs "Matchday" (user-facing) vs "Round" (existing DB term). "Sporting Stage" vs "Stage". What terms does the user see? The glossary has backend terms but no user-facing language mapping.

4. **Brand mark usage rules** — When does the Oracle Dot appear vs the Umpire vs the Bubble Call? Section 10 has the asset list. Rules for placement (card corners? section dividers? watermarks?) need defining. The `<BrandMark>` component uses daily-stable weighted random — does the WC surface follow the same pattern or have its own rules?

5. **Visitor page copy** — Session A noted: "bias language toward Format drama but not exclude solo users." The current `/wc/page.tsx` has placeholder copy. What's the actual visitor pitch?

### Noted from earlier sessions (still unresolved)

- Overall Classification detailed view needs to be engaging — most users end up here by QF/SF
- Animated demo concept (familiar names progressing through elimination) — still deferred but could be discussed if time allows
- Nav adaptation to Dashboard State beyond leaderboard tab defaults

### Key files to read

- `docs/DESIGN-WC-DASHBOARD-STATE.md` — Sections A + B (the full structural design)
- `src/app/wc/page.tsx` — current landing page with placeholder copy
- `src/components/tournament/ClassificationTabs.tsx` — leaderboard display
- `design/README.md` — brand brief, palette, typography
- `design/WC26 host cities/colors.md` — host city colour language
- `CONTEXT.md` — glossary
- `SPEC.md` §16 — World Cup feature spec

### Approach

Run `/grill-with-docs` for Section C. Output should be an update to `docs/DESIGN-WC-DASHBOARD-STATE.md` adding Section C, or a separate `DESIGN-WC-SURFACE-POLISH.md` if it grows large.
