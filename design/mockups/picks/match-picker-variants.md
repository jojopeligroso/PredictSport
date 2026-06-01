# Match Outcome Picker — 3 Design Variants

**Context:** World Cup bracket prediction wizard. 6 cards per group, 12 groups, 72 total matches.
**Primary viewport:** 390px (iPhone 14 / most Android flagships).
**Constraint:** All interactive targets >= 44px. "draw" lowercase, always.

---

## Variant A — Inline Expanded

**Tagline:** Minimum change from current, maximum legibility.

### Layout logic

Same single-row structure as today. "D" becomes "draw". The word is wider (~36px at
base size vs ~12px for "D"), so the center column gets a fixed min-width of 64px to
contain it without squishing team names. Teams are flex-1 on each side.

```
┌─────────────────────────────────────────┐
│  [ MX  Mexico    ] [draw] [  South Korea  KR ]  │
│  ─────────────────────────────────────  │
│  + Exact score                          │
└─────────────────────────────────────────┘
```

### States

UNSELECTED
```
┌────────────────────────────────────────────┐
│                                            │
│  [ MX  Mexico    ]  [draw]  [ Korea  KR ]  │
│    muted text        muted    muted text   │
│                                            │
│  + Exact score                             │
└────────────────────────────────────────────┘
```

HOME WIN SELECTED (Mexico)
```
┌────────────────────────────────────────────┐
│                                            │
│  [ MX  Mexico    ]  [draw]  [ Korea  KR ]  │
│  ╔══════════════╗   muted    muted text    │
│  ║ amber bg     ║                          │
│  ║ ink text     ║                          │
│  ╚══════════════╝                          │
│                                            │
│  + Exact score                             │
└────────────────────────────────────────────┘
```

DRAW SELECTED
```
┌────────────────────────────────────────────┐
│                                            │
│  [ MX  Mexico    ]  [draw]  [ Korea  KR ]  │
│    muted text      ╔══════╗  muted text    │
│                    ║amber ║               │
│                    ║ bg   ║               │
│                    ╚══════╝               │
│                                            │
│  + Exact score                             │
└────────────────────────────────────────────┘
```

### Rationale

Pros:
- Zero learning curve. Users who've already used the app understand the structure.
- Single row = smallest vertical footprint. Six of these stack very tight.
- Left/right spatial metaphor is already established (left = home, right = away).

Cons:
- "draw" is a wider word. At 390px the three columns will feel slightly uneven unless
  the center column is explicitly fixed-width. Team names may truncate on long names
  like "Saudi Arabia" or "United States".
- The asymmetry of left-aligned home name vs right-aligned away name can feel
  unbalanced when names differ greatly in length.

Trade-off call: This is the safest choice if the wizard already has users with muscle
memory. The width problem is solvable with `min-w-[64px]` on the draw button and
`truncate` on team name spans.

### Tailwind implementation notes

```
// Card wrapper
<div class="flex items-center gap-1 py-2 px-3 rounded-lg">

  // Home team button — flex-1, right-aligned text so it reads toward center
  <button class="flex-1 flex items-center justify-end gap-1.5 rounded-md px-3
                 min-h-[44px] text-ps-text-sec hover:bg-ps-chip
                 data-[selected]:bg-amber-100 data-[selected]:text-ps-ink
                 transition-colors">
    <span class="truncate text-sm font-medium">Mexico</span>
    <span class="text-base">🇲🇽</span>  // flag on right edge, near center
  </button>

  // Draw button — fixed width, always centered
  <button class="min-w-[64px] min-h-[44px] flex items-center justify-center
                 rounded-md px-2 text-xs font-medium text-ps-text-sec
                 hover:bg-ps-chip
                 data-[selected]:bg-amber-100 data-[selected]:text-ps-ink
                 transition-colors">
    draw
  </button>

  // Away team button — flex-1, left-aligned text so it reads away from center
  <button class="flex-1 flex items-center justify-start gap-1.5 rounded-md px-3
                 min-h-[44px] text-ps-text-sec hover:bg-ps-chip
                 data-[selected]:bg-amber-100 data-[selected]:text-ps-ink
                 transition-colors">
    <span class="text-base">🇰🇷</span>
    <span class="truncate text-sm font-medium">South Korea</span>
  </button>

</div>
```

Key: flags face inward (home flag on the right of its button, away flag on the left of
its button) so visually they "face each other" across the draw button. This creates a
natural confrontation metaphor without any extra chrome.

---

## Variant B — Stacked Draw

**Tagline:** Teams breathe, draw lives below.

### Layout logic

Two team name buttons sit side-by-side in row 1, taking the full width with no
intervening element. A "draw" pill sits centered below in row 2. Vertical height is
greater than Variant A but each individual button is easier to tap accurately because
home/away each get ~50% width.

```
┌──────────────────────────────────────┐
│  [ MX  Mexico    ] [ South Korea  KR ]  │  ← row 1: full-width split
│           [   draw   ]               │  ← row 2: centered pill
│  ─────────────────────────────────── │
│  + Exact score                       │
└──────────────────────────────────────┘
```

### States

UNSELECTED
```
┌──────────────────────────────────────────┐
│                                          │
│  [ MX  Mexico       ][ South Korea  KR ] │
│    muted               muted             │
│                                          │
│          [    draw    ]                  │
│           muted text                     │
│                                          │
│  + Exact score                           │
└──────────────────────────────────────────┘
```

HOME WIN SELECTED (Mexico)
```
┌──────────────────────────────────────────┐
│                                          │
│  ╔══════════════════╗[ South Korea  KR ] │
│  ║ MX  Mexico       ║  muted             │
│  ║ amber bg         ║                    │
│  ╚══════════════════╝                    │
│                                          │
│          [    draw    ]                  │
│           muted text                     │
│                                          │
│  + Exact score                           │
└──────────────────────────────────────────┘
```

DRAW SELECTED
```
┌──────────────────────────────────────────┐
│                                          │
│  [ MX  Mexico       ][ South Korea  KR ] │
│    muted               muted             │
│                                          │
│          ╔══════════╗                    │
│          ║  draw    ║                    │
│          ║ amber bg ║                    │
│          ╚══════════╝                    │
│                                          │
│  + Exact score                           │
└──────────────────────────────────────────┘
```

### Rationale

Pros:
- Each team gets a large, generous tap zone (~185px wide x 44px+). Much easier to hit
  accurately during rapid 72-match entry sessions.
- Long team names ("United States", "Saudi Arabia") fit without truncation.
- "draw" as a secondary row communicates its lower-probability nature — it's available
  but not prominent. This matches real-world prediction behavior (most matches have a
  winner, draws are the exception).
- No left/right asymmetry problem. Both team cells are equal width.

Cons:
- Taller card. At ~88-96px per card (two rows + draw pill + padding), six cards per
  group is ~576px+ of scroll — heavier than Variant A's ~52px per card.
- The draw option is less immediately discoverable. A first-time user might tap
  a team without noticing the draw option below.
- Creates a visual hierarchy where teams are "primary" and draw is "secondary" — this
  may not match all competition formats where draws are equally valid outcomes.

Trade-off call: Best for groups with long team names or where usability testing shows
mis-taps on Variant A's narrow center column. The extra height is the only real cost.

### Tailwind implementation notes

```
// Card wrapper — flex column
<div class="flex flex-col gap-1 py-2 px-3 rounded-lg">

  // Row 1: teams
  <div class="flex gap-1">

    // Home team — half width
    <button class="flex-1 flex items-center gap-1.5 rounded-md px-3
                   min-h-[44px] text-ps-text-sec hover:bg-ps-chip
                   data-[selected]:bg-amber-100 data-[selected]:text-ps-ink
                   transition-colors">
      <span class="text-base">🇲🇽</span>
      <span class="text-sm font-medium">Mexico</span>
    </button>

    // Away team — half width, right-aligned
    <button class="flex-1 flex items-center justify-end gap-1.5 rounded-md px-3
                   min-h-[44px] text-ps-text-sec hover:bg-ps-chip
                   data-[selected]:bg-amber-100 data-[selected]:text-ps-ink
                   transition-colors">
      <span class="text-sm font-medium">South Korea</span>
      <span class="text-base">🇰🇷</span>
    </button>

  </div>

  // Row 2: draw — centered, pill shape, narrower
  <div class="flex justify-center">
    <button class="px-5 min-h-[36px] rounded-full text-xs font-medium
                   text-ps-text-sec hover:bg-ps-chip
                   data-[selected]:bg-amber-100 data-[selected]:text-ps-ink
                   transition-colors">
      draw
    </button>
  </div>

</div>
```

Note: the draw button uses a 36px min-height here (not 44px) because it sits alone in
a row with generous spacing above and below — the effective tap zone is larger than the
button's own height. If accessibility is strictly required at 44px, bump to
`min-h-[44px]` and add `px-6`.

---

## Variant C — Three-Way Segmented Control

**Tagline:** One element, three equal choices, no ambiguity.

### Layout logic

Abandon the "two teams with draw between/below" mental model entirely. Treat the
outcome picker as a single segmented control with three equal segments: home win,
draw, away win. Team names label the outer segments. "draw" labels the center segment.
The entire control is one visual unit — a rounded pill split into three.

This is the mental model used by football score apps and betting interfaces. Users
recognize it immediately.

```
┌────────────────────────────────────────────────┐
│  Mexico  MX  │   draw   │  KR  South Korea     │
│ ─────────────────────────────────────────────  │
│ + Exact score                                  │
└────────────────────────────────────────────────┘
```

More precisely, the control has a shared border/outline and the selected segment gets
a filled background:

```
╔══════════════════════════════════════════════╗
║  [ MX Mexico  ] │ [ draw ] │ [ Korea KR ]   ║
╚══════════════════════════════════════════════╝
```

### States

UNSELECTED
```
┌──────────────────────────────────────────────┐
│                                              │
│ ┌────────────┬──────────┬────────────────┐   │
│ │ MX Mexico  │  draw    │ Korea  KR      │   │
│ │  muted     │  muted   │  muted         │   │
│ └────────────┴──────────┴────────────────┘   │
│                                              │
│ + Exact score                                │
└──────────────────────────────────────────────┘
```

The outer border of the segmented control is `border border-ps-border` (or
`ring-1 ring-ps-border`). Internal dividers are `border-r border-ps-border`.

HOME WIN SELECTED (Mexico)
```
┌──────────────────────────────────────────────┐
│                                              │
│ ┌────────────┬──────────┬────────────────┐   │
│ │▓▓MX Mexico▓│  draw    │ Korea  KR      │   │
│ │▓amber tint▓│  muted   │  muted         │   │
│ └────────────┴──────────┴────────────────┘   │
│                                              │
│ + Exact score                                │
└──────────────────────────────────────────────┘
```

DRAW SELECTED
```
┌──────────────────────────────────────────────┐
│                                              │
│ ┌────────────┬──────────┬────────────────┐   │
│ │ MX Mexico  │▓▓ draw ▓▓│ Korea  KR      │   │
│ │  muted     │▓amber   ▓│  muted         │   │
│ └────────────┴──────────┴────────────────┘   │
│                                              │
│ + Exact score                                │
└──────────────────────────────────────────────┘
```

The selected segment's border-left and border-right merge with the filled background —
the internal dividers adjacent to the selected segment disappear or shift color so the
selected segment reads as a solid block. This is standard segmented control behavior
(iOS UISegmentedControl / Material tabs pattern).

### Rationale

Pros:
- Three equal options presented simultaneously. No visual hierarchy between win and
  draw — they are equally available with equal affordance.
- Single tap target row = smallest possible vertical footprint. Even more compact than
  Variant A because there's no separate draw button element — everything is one unit.
- The segmented control pattern is deeply familiar from phone OS components (iOS
  control centers, tab bars, filter bars). Zero learning curve.
- Eliminates the "D is cryptic" complaint entirely. The three labels are all readable
  at a glance before any tap.
- The purple column problem from the current design (draw column feeling visually
  detached) is solved structurally — all three segments are part of one enclosed shape.
- Post-result state (green/red for correct/wrong) maps cleanly: fill that segment's
  background green or red.

Cons:
- The center "draw" segment is narrower than the outer segments, which is visually
  unavoidable given the word "draw" is shorter than most team names. On 390px:
  home gets ~145px, draw gets ~80px, away gets ~145px (approx). The 80px draw
  segment is still a comfortable tap at 44px height.
- Team names longer than ~10 characters ("United States", "Saudi Arabia") will
  truncate or require smaller font. Options: abbreviate to 3-letter code + flag only
  inside the control, and show full names in a header row above.
- Cannot easily add a flag emoji inside the segment if team names are long — may need
  to drop to flag-only or 3-letter code inside the control for long name matches.

Trade-off call: Best overall UX for rapid-fire picking. The name truncation problem
can be solved by putting full team names as a static header above the picker control
(not interactive, just labels), and using flag + 3-letter code inside the segments.
This is the pattern used by all major sportsbook apps.

### Extended layout with name headers (recommended for Variant C)

```
┌──────────────────────────────────────────────┐
│  Mexico           South Korea                │  ← static name labels
│                                              │
│ ┌──────────┬──────────┬────────────────┐     │
│ │  MX      │  draw    │       KR       │     │  ← segmented control
│ │          │          │                │     │
│ └──────────┴──────────┴────────────────┘     │
│                                              │
│ + Exact score                                │
└──────────────────────────────────────────────┘
```

With this pattern, segments become flag + country code only (tight), and the
full names float above as non-interactive labels. This solves truncation completely
and is 2px wider top padding for the static label row — still very compact.

### Tailwind implementation notes

```
// Card wrapper
<div class="flex flex-col gap-1.5 py-2 px-3 rounded-lg">

  // Optional: name header row (use when team names > 10 chars)
  <div class="flex justify-between text-xs text-ps-text-sec px-1">
    <span>Mexico</span>
    <span>South Korea</span>
  </div>

  // Segmented control — single bordered pill
  <div class="flex rounded-lg border border-ps-border overflow-hidden min-h-[44px]">

    // Home win segment
    <button class="flex-1 flex items-center justify-center gap-1 px-2
                   min-h-[44px] text-ps-text-sec hover:bg-ps-chip
                   border-r border-ps-border
                   data-[selected]:bg-amber-100 data-[selected]:text-ps-ink
                   data-[selected]:border-r-amber-200
                   transition-colors text-sm font-medium">
      <span class="text-base">🇲🇽</span>
      <span>MEX</span>
    </button>

    // Draw segment
    <button class="px-4 flex items-center justify-center
                   min-h-[44px] text-ps-text-sec hover:bg-ps-chip
                   border-r border-ps-border
                   data-[selected]:bg-amber-100 data-[selected]:text-ps-ink
                   data-[selected]:border-r-amber-200
                   transition-colors text-xs font-medium">
      draw
    </button>

    // Away win segment
    <button class="flex-1 flex items-center justify-center gap-1 px-2
                   min-h-[44px] text-ps-text-sec hover:bg-ps-chip
                   data-[selected]:bg-amber-100 data-[selected]:text-ps-ink
                   transition-colors text-sm font-medium">
      <span>KOR</span>
      <span class="text-base">🇰🇷</span>
    </button>

  </div>

  // Exact score expander
  <button class="text-xs text-ps-text-sec text-left px-1 py-0.5 hover:text-ps-ink
                 transition-colors">
    + exact score
  </button>

</div>
```

Post-result state — add to each segment button as needed:
```
data-[result=correct]:bg-green-100 data-[result=correct]:text-green-800
data-[result=wrong]:bg-red-100 data-[result=wrong]:text-red-700
```

The `overflow-hidden` on the container clips the segment fills flush to the outer
border-radius so you never get a fill bleeding outside the pill shape.

---

## Comparison Summary

| Criteria                   | A — Inline Expanded | B — Stacked Draw   | C — Segmented     |
|----------------------------|---------------------|--------------------|-------------------|
| Card height (approx)       | ~52px               | ~88px              | ~56px             |
| Long name handling         | truncates           | fits comfortably   | needs 3-letter code|
| Draw discoverability       | medium (inline)     | lower (below)      | high (equal parity)|
| Tap zone quality           | center is narrow    | generous all three | equal all three   |
| Visual unity of 3 options  | fragmented          | fragmented         | unified           |
| Learning curve             | zero (familiar)     | low                | near-zero         |
| Matches sportsbook norms   | partial             | no                 | yes               |
| Recommended for            | low-risk iteration  | accessibility-first| best overall UX   |

## Recommendation

**Variant C** is the strongest design for rapid-fire 72-match entry. The segmented
control solves both stated problems (cryptic "D", draw column feels detached) at once,
without adding vertical height. The only implementation consideration is the 3-letter
country code abbreviation inside segments — all FIFA matches have official 3-letter
codes, so this is not a data problem.

If you want to ship Variant A first as a low-risk change (only swap "D" -> "draw"),
then iterate to Variant C after validation, that is a reasonable two-step path.

Variant B is worth testing only if usability testing reveals mis-tap rates on the
outer segments of Variant C on small phones.
