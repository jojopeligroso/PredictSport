# Brand chrome palette (16 swatches)

User-supplied palette for **WC chrome only**. Use these on day pills, the by-date/by-group toggle, marker badges (`!` cutoff warning, `✓` complete accents), hero accent flashes, and other non-card UI.

**Do not use these on fixture cards.** Fixture cards stay on the host-city palette in `src/lib/wc/host-cities.ts` — that's locked. See ADR 0014 and `design/DESIGN-RULES.md`.

The source PNG should be saved at `design/brand-palette.png` when convenient — keep this `.md` as the canonical hex reference.

## The 16 swatches

Read left-to-right, top-to-bottom from the source image. Hex values are best-effort approximations from the image; refine when the source PNG is in the repo.

| | Col 1 | Col 2 | Col 3 | Col 4 |
|---|---|---|---|---|
| **Row 1** | `#8a1a1a` dark red | `#7c3aed` electric violet | `#0f1b5e` deep navy | `#0a4d3a` dark forest |
| **Row 2** | `#e63946` vivid red | `#c4a8e8` lilac | `#1e6cff` royal blue | `#22c55e` kelly green |
| **Row 3** | `#ff6b1a` orange | `#a855d1` magenta-violet | `#22b8ff` sky blue | `#c4e835` lime |
| **Row 4** | `#ffb4a1` peach | `#e63990` hot pink | `#5eead4` aqua | `#fff200` yellow |

Plus a base black `#000000` and white `#ffffff` for type and accents.

## Usage rules

- **Day pills** (DayCalendarPills) — pill chrome is neutral cream/ink. Active day uses one swatch; "today" indicator uses one swatch; `!` cutoff warning uses one swatch. Pick three from this palette and stay consistent across sessions.
- **By date / By group toggle** (ViewToggle) — active segment uses a single chrome swatch underline. Inactive segments stay on neutral ink.
- **`!` marker** (day-before joins close) — high-saturation warning swatch. Yellow `#fff200` or vivid red `#e63946` both work; yellow reads as urgency without alarm.
- **`✓` accent** below a pill when all matches that day have winner + exact-score saved — keep on amber `#f59e0b` (existing brand token, not from this palette) for consistency with the existing pick selection treatment. The chrome palette does *not* replace the amber selection token.

## Suggested initial mapping

(Adjustable in PR3 during implementation; this is a starting point, not law.)

- Pill `today` indicator: amber `#f59e0b` underline (existing brand)
- Pill `!` cutoff warning: yellow `#fff200` background with ink fg, OR vivid red `#e63946` with white fg — TBD via Playwright contrast check
- Pill `✓` complete accent: amber `#f59e0b` checkmark
- ViewToggle active segment underline: royal blue `#1e6cff`
- Hero accent flash (FWC 2026 big numeral underline): vivid red `#e63946`

## Why a separate palette for chrome?

The host-city palette already uses 16 distinct saturated hues for fixture cards. If chrome also drew from that palette, the page would feel monotonous and the chrome would visually compete with the cards. This palette is the **counterpoint**: bold, primary-leaning, slightly different vibe — gives the chrome its own personality without breaking the WC brand.

## Source

User-provided image attached during the picks-first redesign planning session (May 2026). See `design/mockups/wc-picks-first/` for the mockups this palette informs.
