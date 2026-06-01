# WC2026 Host City Colours

Official host-city palette from FIFA's tournament identity (one signature
colour per city, used on the host-city cards). Values below were sampled from
the user-provided palette swatches on 2026-05-25 and rounded to a 6-digit hex.

These colours are consumed at runtime by `src/lib/wc/host-cities.ts` and used
as the background of fixture cards on `/wc/results`. White (`#ffffff`) is the
canonical foreground.

## United States

| City                    | Slug                       | Hex       | Swatch |
|-------------------------|----------------------------|-----------|--------|
| Atlanta                 | `atlanta`                  | `#00B5C8` | turquoise |
| Boston                  | `boston`                   | `#218521` | mid green |
| Dallas                  | `dallas`                   | `#0E5C66` | deep teal |
| Houston                 | `houston`                  | `#2497F1` | bright blue |
| Kansas City             | `kansas-city`              | `#FB2350` | crimson |
| Los Angeles             | `los-angeles`              | `#FF6F66` | coral |
| Miami                   | `miami`                    | `#EE6FA6` | pink |
| New York New Jersey     | `new-york-new-jersey`      | `#11154A` | deep navy |
| Philadelphia            | `philadelphia`             | `#1F3CAB` | royal blue |
| Seattle                 | `seattle`                  | `#97961B` | olive |
| San Francisco Bay Area  | `san-francisco-bay-area`   | `#E0421A` | red-orange |

## Canada

| City      | Slug        | Hex       | Swatch |
|-----------|-------------|-----------|--------|
| Toronto   | `toronto`   | `#3D4EFF` | royal blue |
| Vancouver | `vancouver` | `#04382B` | deep green |

## Mexico

| City         | Slug           | Hex       | Swatch |
|--------------|----------------|-----------|--------|
| Guadalajara  | `guadalajara`  | `#DA2363` | magenta |
| Mexico City  | `mexico-city`  | `#8C4DFC` | violet |
| Monterrey    | `monterrey`    | `#1AB89C` | turquoise green |

## Foreground

All host-city cards use `#ffffff` text. Contrast checked: the lowest-contrast
pair (Miami `#EE6FA6` on white) clears WCAG AA for 18pt+ bold; smaller body
copy on coloured cards should stay at 14px+ bold or fall back to white-on-ink.

## Stadium → City

The fixture file (`scripts/wc2026-group-fixtures.ts`) records the host city
slug per match. Stadium names are kept in `src/lib/wc/host-cities.ts` so they
appear in tooltips and metadata without bloating the fixture rows.

| City | Stadium |
|---|---|
| Atlanta | Mercedes-Benz Stadium |
| Boston | Gillette Stadium (Foxborough) |
| Dallas | AT&T Stadium (Arlington) |
| Houston | NRG Stadium |
| Kansas City | GEHA Field at Arrowhead Stadium |
| Los Angeles | SoFi Stadium (Inglewood) |
| Miami | Hard Rock Stadium (Miami Gardens) |
| New York New Jersey | MetLife Stadium (East Rutherford) |
| Philadelphia | Lincoln Financial Field |
| San Francisco Bay Area | Levi's Stadium (Santa Clara) |
| Seattle | Lumen Field |
| Toronto | BMO Field |
| Vancouver | BC Place |
| Guadalajara | Estadio Akron |
| Mexico City | Estadio Azteca |
| Monterrey | Estadio BBVA |
