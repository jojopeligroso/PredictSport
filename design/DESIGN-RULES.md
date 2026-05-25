# Design Rules

Decisions that should outlive any single feature. Add to this file when a design choice has been made deliberately and you'd want a future contributor to follow it without re-litigating.

Companion docs: [`README.md`](README.md) for the brand brief, palette, and asset index.

## Country Flag Icons

PredictSport renders country flags in two distinct shapes. The shape is part of the brand, not a per-component choice.

### Default — Circle

- **Where:** Everywhere in the app except FIFA World Cup competition surfaces.
- **Why:** Confirmed as the project-wide default during the May 2026 flag-shape exploration. Reads as an avatar; aligns with circular brand marks (Oracle Dot); packs tightly in lists.
- **Spec:**
  - `rounded-full`, 1:1 aspect.
  - `object-cover` on a 4:3 source. Side stripes of vertical tricolours (FR, CI, IE) will clip; this is an accepted trade for visual consistency.
  - 0.5px white inner hairline (`inset 0 0 0 0.5px rgba(255,255,255,0.9)`) plus a subtle drop shadow (`0 1px 2px rgba(0,0,0,0.15)`).
  - At 1× device pixel ratio the hairline snaps to ~1px — acceptable degradation; no fallback needed.

### FIFA World Cup — "Flag" pill

- **Where:** Only under `src/app/wc/**` and `src/components/tournament/bracket/**`. Never roll this out app-wide.
- **Why:** Matches the official FIFA 2026 poster's flag silhouette. Tied to the WC visual identity and intentionally distinct from the rest of the app.
- **Spec:**
  - 4:3 horizontal rectangle.
  - **Rotationally symmetric corners:** top-right and bottom-left rounded; top-left and bottom-right sharp. The shape maps onto itself under 180° rotation. This is *not* a "page curl" — it is a deliberate graphic mark.
  - Corner radius = 35% of width.
  - Visible 1px white hairline around the entire silhouette, implemented as two stacked `clip-path` regions (outer white shape, inner flag inset by the border width). The inner-radius is `outer-radius − border-width` so curve thickness stays uniform.
  - Flag artwork gets a slight desaturation/dim pass: `saturate(0.88) brightness(0.96)`. Source flags are otherwise too punchy against the dark bracket surface.
  - Drop shadow: `0 1px 2px rgba(0,0,0,0.25)` (applied as `filter: drop-shadow(...)` so it follows the clip).
  - Placeholders (`1B`, `W73`, `EFGJ`) render the slot label in mono inside the same silhouette.

### Implementation notes

- Source of truth: `src/components/CountryFlag.tsx`. Both shapes ship from the same component via the `shape?: 'circle' | 'pill'` prop. Default is `'circle'`.
- `box-shadow` cannot be used as the pill border — `clip-path` clips it. Use the layered outer/inner clip-path approach.
- `border-radius` cannot produce the pill silhouette — it always produces symmetric corners. The pill must use `clip-path: path(...)`.
- Do not change the `CountryFlag` default. Do not extend the pill outside the WC scope without revisiting this rule.

## Layout

- **Mobile-first.** App pages target 390px (iPhone 14) and use a `max-w-[480px]` container. Desktop is secondary — widen `NavBar` / `Footer` (`max-w-3xl`), scale up the landing page, keep app screens narrow and centred.
- `layout.tsx` does **not** wrap children in a container. Each page owns its own wrapper. Landing page is full-bleed hero.

## Personality

"Confident, cheeky, craftsman-warm" — pub-chalkboard vibe. Culturally inferred, never explicit. Avoid slot-machine gradients, shiny chrome, AI-cliché orbs, and big-sportsbook green.
