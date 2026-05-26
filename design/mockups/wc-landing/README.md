# /wc landing — design alternatives

Static HTML mockups exploring landing-page treatments for `/wc`. Open in a
browser via `file://` to compare; the hero PNG is referenced via a
repo-relative path so the mockups render from any clone.

## Landed direction

**[`bg-3b-ink-warm.html`](./bg-3b-ink-warm.html)** — the ink-on-poster
variant that shipped to production. The FIFA 2026 hero PNG is the page
background (fixed, scaled 145%), with four dark warm-ink cards floating on
top. Production port lives in `src/app/wc/page.tsx`.

Lockable parameters captured in the mockup:

| Param | Value |
|-------|-------|
| Hero scale | `145%` width |
| Hero attachment | `fixed`, `center top` |
| Card surface | `radial-gradient(120% 80% at 0% 0%, rgba(245,158,11,0.10) → 0)` over `linear-gradient(160deg, rgba(28,22,16,0.80) → rgba(8,8,8,0.84))` |
| Card border | `1px solid rgba(255,255,255,0.12)` |
| Card radius | `16px` |
| Backdrop blur | `5.6px` + saturate `1.05` |
| Card gap | `24px` |
| Page top padding | `35px` |
| Page bottom padding | `39px` |
| Brand sign-off | OracleDot, 36×36, opacity 0.6, centred |

## Other variants kept for reference

- `bg-3a-ink-sharper.html` — same shell, plain vertical ink gradient (no
  warm amber bloom).
- `bg-3c-ink-edge.html` — same shell, radial edge-darkening vignette.

Earlier exploration iterations (`reading-*`, `overlap-*`, `superimpose-*`,
`bg-1-*`, `bg-2-*`, `bg-3-ink.html`) are also in this folder as a record of
the design path. They are not maintained.
