# SportsPredict Design System

Brand identity and UI mockups. See `CLAUDE.md` "Design System" for active palette, typography, and component tokens.

## Folder Structure

```
design/
  brand/              Brand identity exports (Figma, May 2026 — settled)
  wc/
    logos/             WC26 official marks + sportspredict WC lockups
    host-cities/       16 city badge PNGs + colors.md
    poster/            Bracket poster (HTML + README)
  mockups/
    rules/             Rules page iterations (14 variants, dark + light)
    picks/             Fixture cards, match picker, colour explorations
    leaderboard/       Leaderboard card + screenshot mockups
    wc-dashboard/      WC landing, dashboard redesign, social CTA
    wc-landing/        Landing page explorations
    wc-picks-first/    Picks-first flow explorations
    upcoming-fixtures.html
  archive/             Dead first-pass iterations (pre-May 10)
```

## Brand Brief

**Tagline:** "call it, claim it." / "Call it before the lads do."

**Personality:** Confident, cheeky, craftsman-warm. Never gambly.

**Audience:** Friend groups, WhatsApp natives, half-banter half-bragging-rights.

**Avoid:** Slot-machine gradients, shiny chrome, AI-cliche orbs, big-sportsbook green.

**Origin:** Digitises the [Wexford FC paper prediction sheet](../docs/Wexford%20FC%20Prediction%20Quiz%20Round%207.pdf).

## Palette

| Role    | Hex       | Usage                                    |
|---------|-----------|------------------------------------------|
| Cream   | `#efe9de` | Background, default surface              |
| Ink     | `#191512` | Primary text, dark UI elements           |
| Amber   | `#f59e0b` | Accent, "predict" in wordmark, CTA       |
| Right   | `#0aa86d` | Correct prediction, success states, GAA  |
| Wrong   | `#e23d4f` | Incorrect prediction, error states       |

## Three Brand Marks

### A. Oracle Dot (primary, ~60%)
Ink circle with amber dot and white highlight. "Called shot."
- See: `brand/B _ Oracle dot.png`, `brand/Oracle dot.png`

### B. GAA Umpire (~30%, always for GAA events)
Outlined umpire with green flag. Native to GAA fans.
- See: `brand/Outlined umpire _ primary.png`, `brand/Outline _mark only_.png`

### C. Bubble Call (~10%)
Ink speech bubble with amber checkmark. "The banter brand."
- See: `brand/F _ Bubble call.png`

## Reference Documents

| File | Description |
|------|-------------|
| [`PredictSport-Design-Brief.pdf`](PredictSport-Design-Brief.pdf) | Full design brief (PDF) |
| [`brand-palette.md`](brand-palette.md) | Extended palette reference |
| [`../docs/DESIGN-BRIEF-ROUND-BUILDER.md`](../docs/DESIGN-BRIEF-ROUND-BUILDER.md) | Round builder UI design spec |
| [`../docs/DESIGN-RULES.md`](../docs/DESIGN-RULES.md) | Rules page design spec |

## HTML Source Files

Each `.png` in `brand/` has a corresponding `.html` — original editable source from the design tool.
