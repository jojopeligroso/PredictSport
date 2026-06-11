# Dashboard Refresh — Design Rules & Terminology

## Design Vocabulary

These terms have specific meanings in this project. Use them consistently in code comments, commit messages, and conversation.

| Term | Definition | CSS implementation |
|------|-----------|-------------------|
| **Floor** | The deepest background layer — the page body. Darker than the panels that sit on it. | `--ps-floor` — light: `#ddd7cc`, dark: `#080c08` |
| **Panel** | Mid-layer surface that groups related cards. Sits on the floor. | `--ps-bg` (`#efe9de` light / `#111911` dark), `border-radius: 14px`, `box-shadow`, `padding: 10px` |
| **Card** | Top-layer surface inside a panel. Individual content containers. | `--ps-surface` (`#ffffff` light / `#1a231a` dark), `border-radius: 10px`, `border`, `padding: 10px` |
| **Island** | A panel whose background inverts the surrounding theme to create focal contrast. Light theme → dark island. Dark theme → light island. | `.is-live .field-island` overrides `background` |
| **Surface sheen** | A multi-stop gradient overlay on match cards that simulates dimensional lighting (highlight bottom-left, shadow top-right). | `::after` pseudo-element with layered `radial-gradient` + `linear-gradient` at low alpha |
| **Translucent state layer** | A white alpha overlay (`rgba(255,255,255, 0.12)`) on the selected team button, letting the city colour bleed through at reduced intensity. | `background: rgba(255,255,255, 0.12)` on selected element |
| **Gold inset ring** | The selection indicator on team buttons. An inward box-shadow in trophy gold. | `box-shadow: inset 0 0 0 2px rgba(212,175,55, 0.45)` |
| **Live pill** | The pulsing red dot + "LIVE" text label indicating an in-progress fixture. | 6px circle `#e23d4f` + `@keyframes pulse-live` (2s cycle) + "LIVE" text |
| **Tab bar** | Fixed bottom navigation with 4 icon tabs. Stroke-only icons, gold active state with indicator dot. | `position: fixed; bottom: 0`, 52px height + safe area |
| **City colour** | The host-city background colour on match cards (e.g., Guadalajara `#c8102e`, Mexico City `#006847`). | `backgroundColor` on `FixtureCardSurface` |
| **Grip indicator** | A horizontal bar showing positional fragility — gap to players above and below in the group standings. | Track with positioned marker dot and directional fills |
| **State blindness** | The design anti-pattern where the UI looks identical during a live match and during downtime. The enemy. | — |

## 3-Layer Depth System

The dashboard uses three distinct background layers to create visual depth:

```
Layer 0 — Floor (#ddd7cc / #080c08)
  └── Layer 1 — Panel (#efe9de / #111911)
       └── Layer 2 — Card (#ffffff / #1a231a)
```

Rules:
- Never skip a layer (no cards directly on floor, except: match cards and leaderboard CTA)
- The floor is visible in gaps between panels (8px)
- Match cards and the leaderboard button sit directly on the floor — they are standalone, not contained in panels

### Island Inversion (Live State)

When a fixture is in progress, the AT A GLANCE section swaps its content to show THE FIELD community data and its panel inverts:

| User theme | Island background | Inner cards | Text colours |
|------------|------------------|-------------|-------------|
| Light | `#141c14` (dark stadium green) | `#1a231a` | Dark-theme tokens (`#f1ece2`, `#a8a090`, `#706858`) |
| Dark | `#efe9de` (cream) | `#ffffff` | Light-theme tokens (`#191512`, `#5e554a`, `#8b8275`) |

The island always opposes the surrounding panels. This is what creates the focal "spotlight" effect.

## Dashboard States

### Idle (no live match)

```
1. Date pills (sliding window, selected day in full gold fill + white text)
2. YOUR PICKS — all fixtures in the 24-hour window (host-city-coloured match cards)
3. "Continue to full round →"
4. AT A GLANCE — rank, points, accuracy (3 stat cards in panel)
5. THE FIELD — community prediction data (2 cards in panel)
6. Your Group — mini leaderboard table (card in panel)
7. Leaderboard CTA (on floor)
8. Chat (panel)
9. Tab bar (fixed bottom)
```

### Live (fixture in progress)

```
1. Date pills
2. Single live match card (auto-expanded, locked prediction, LIVE pill)
3. AT A GLANCE → THE FIELD content on island (dark/light inverted)
   - Community outcome split (with user pick in gold below divider)
   - Popular score predictions (with YOU badge on matching row)
   - Live pill in section header
4. Your Group
5. Leaderboard CTA
6. Chat
7. Tab bar
```

Key differences:
- Single fixture only (not the full 24h window)
- AT A GLANCE and THE FIELD merge — community data IS the "at a glance" during live play
- Stats (rank/points/accuracy) are hidden during live — they're irrelevant while waiting for a result
- Match card shows locked prediction with translucent state layer on selected team

## Match Card Effects

### Surface Sheen

Applied via `::after` pseudo-element on every `FixtureCardSurface`:

```css
.match-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 15% 65%, rgba(255,255,255,0.08) 0%, transparent 55%),
    radial-gradient(ellipse at 85% 15%, rgba(0,0,0,0.15) 0%, transparent 50%),
    linear-gradient(155deg, rgba(255,255,255,0.04) 0%, transparent 55%);
  pointer-events: none;
  z-index: 1;
}
```

Three layers:
1. Diffuse white highlight (bottom-left) — simulates light catch
2. Dark shadow (top-right) — simulates depth/curvature
3. Diagonal wash — ties the two radials together

Card content needs `position: relative; z-index: 2` to sit above.

### Translucent State Layer (selected team)

```css
/* Selected */
background: rgba(255,255,255, 0.12);
box-shadow: inset 0 0 0 2px rgba(212,175,55, 0.45);
border-radius: 8px;

/* Unselected */
background: transparent;
color: rgba(255,255,255, 0.45);
```

## Tab Bar

Fixed bottom navigation. 4 tabs, stroke-only SVG icons (20px, stroke-width 1.5).

| Position | Icon | Label | Route |
|----------|------|-------|-------|
| 1 | House | Home | `/wc/home` |
| 2 | Crosshair | Picks | `/wc/picks` |
| 3 | Trophy | Board | `/wc/leaderboard` |
| 4 | Chat bubble | Chat | `/wc/leaderboard#chat` |

- Inactive: tertiary text colour (icon stroke + label)
- Active: gold colour + 4px gold dot below label
- Bar height: 52px + `env(safe-area-inset-bottom)`
- Background: panel colour. Top border: 1px border colour.
- Labels: Inter 9px weight 600 uppercase

## Spacing Rules

| Element | Value |
|---------|-------|
| Page horizontal padding | 12px |
| Panel gap (floor showing between) | 8px |
| Panel internal padding | 10px |
| Card gap inside panels | 6px |
| Card internal padding | 10px |
| Table row vertical padding | 8px |
| Section label margin-bottom | 6px |

## CSS Custom Properties to Add

```css
/* Add to :root */
--ps-floor: #ddd7cc;
--ps-shadow-rest: 0 1px 3px rgba(25,21,18,0.08), 0 1px 2px rgba(25,21,18,0.05);
--ps-shadow-raised: 0 4px 12px rgba(25,21,18,0.12), 0 2px 4px rgba(25,21,18,0.07);

/* Add to html[data-theme="dark"] */
--ps-floor: #080c08;
--ps-shadow-rest: 0 1px 3px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.18);
--ps-shadow-raised: 0 4px 12px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.25);

/* Add to .wc-theme */
--ps-live-island-bg: #141c14;

/* Add to html[data-theme="light"] .wc-theme */
--ps-live-island-bg: #141c14;

/* Add to @theme inline */
--color-ps-floor: var(--ps-floor);
--shadow-ps-rest: var(--ps-shadow-rest);
--shadow-ps-raised: var(--ps-shadow-raised);
```

## CSS Classes for Live State

```css
.is-live .field-island {
  background: var(--ps-live-island-bg);
  border-radius: 14px;
  padding: 10px;
}

/* Dark theme: island inverts to light */
html[data-theme="dark"] .is-live .field-island {
  background: #efe9de;
}

@keyframes pulse-live {
  0%, 100% { box-shadow: 0 0 0 0 rgba(226,61,79,0.4); }
  50% { box-shadow: 0 0 0 4px rgba(226,61,79,0); }
}
```

## Implementation Order

1. **Add `--ps-floor` token + body background** — globals.css only
2. **Wrap dashboard sections in panels** — DashboardClient.tsx
3. **Tighten spacing** — Tailwind classes across dashboard components
4. **Surface sheen on FixtureCardSurface** — pseudo-element addition
5. **Translucent state layer on selected team** — WindowPickList.tsx button styles
6. **Live state: AT A GLANCE / THE FIELD swap** — DashboardClient.tsx conditional render
7. **Island inversion** — CSS class + dark mode override
8. **Tab bar** — new component, layout.tsx integration
9. **Grip indicator** — new component in StatsCard area
10. **City-colour glow** — FixtureCardSurface keyframe (optional, lower priority)

## Mockups

Final mockups at:
- /tmp/dash-final-light.html (light theme, live state)
- /tmp/dash-final-dark.html (dark theme, live state)
- /tmp/dashboard-mockups.html (navigator with all versions)
