# ADR 0014: World Cup Landing — Picks-First, Soft Join Cutoff, Bracket Demoted

**Status:** Accepted
**Date:** 2026-05-27

## Context

A user test of the WC surface revealed that the four-tab IA (Picks · Bracket · Table · Results) is too heavy for casual users. The bracket UI, in particular, overwhelms participants who just want to predict the matches they'll watch. The format users actually engage with on day one is the group-stage match picks.

The previous `/wc` landing was an ink-on-poster hero card stack with the bracket as the headline CTA. This shipped well for power users but tested poorly with casuals — they bounced before submitting a single pick.

Separately, SPEC.md §16.10 says the parent prediction game closes at PW1 lock (1 minute before the first MD1 kickoff). This is a hard cutoff with no slack — viable for a fully-marketed tournament with everyone signed up beforehand, but unsuitable for our small-friend-group reality where someone always remembers the day before kickoff.

## Decision

Six binding decisions:

1. **`/wc` becomes the picks surface.** The landing IS the matchday-1 group-stage picker — 24 fixtures in one page, ordered by calendar date by default. No more hero card stack. The picks-first promise is the visible identity of the WC product.

2. **By-date default with a by-group toggle.** Sections group by calendar date (Thu 11 Jun → Thu 18 Jun, 8 days) by default. A peer segmented control toggles to by-group (A → L) view. View state lives in `?view=` URL param. Both views render the same 24 events — pure client-side reorder, no extra fetch.

3. **Host-city palette stays on fixture cards; brand 16-swatch palette governs chrome only.** Cards render with their host-city colour as the background (already shipped on `/wc/results`). The user-supplied 16-swatch brand palette (saved at `design/brand-palette.md`) is used exclusively for chrome — day pills, the toggle, the `!` cutoff marker, hero accent flashes. Cards and chrome carry distinct visual identities; no per-group accent palette is introduced.

4. **Bracket demoted to a `More` dropdown.** `Bracket` is removed from the top-level `WcNavLinks` (Picks · Bracket · Table · Results · Rules). A new `WcMoreMenu` component sits in the trailing nav slot. Inside, `Bracket prediction` carries an `Advanced — not for casuals` warning sub-label. The `/wc/bracket` route stays fully functional.

5. **Soft 3-day join cutoff overrides SPEC.md §16.10.** The parent WC game remains joinable for 72h after the first MD1 kickoff (Thu 11 Jun 19:00 UTC → Sun 14 Jun 19:00 UTC). After that, no new entrants. Late joiners during the soft window can pick remaining matches but auto-forfeit any already-locked match (lock_time enforcement on `/api/predictions` already handles this server-side). The cutoff is persisted on a new `competitions.joins_locked_at` column flipped by the existing daily results cron.

6. **Anonymous and non-member visitors see a blurred preview.** `/wc` renders for everyone. For anon/non-members the sections container applies `filter: blur(6px) saturate(0.7)` with `pointer-events: none`, and a tap-to-unblur `Join now` overlay routes to `/wc/join`. Hero, calendar pills, progress strip, and toggle remain crisp — the format is communicated without giving away picks behind a paywall.

## Alternatives Considered

1. **Keep the hero card stack, just add a "make picks" button.** Rejected — user test showed the hero stack hides the picks. Adding another button doesn't change the IA enough to move casuals.
2. **Hard redirect anon visitors to `/login`/`/wc/join`.** Rejected — kills the picks-first impression. Blurred preview gives the value prop in <2 seconds without a conversion hop.
3. **Per-group accent palette for cards.** Rejected — FIFA's WC 2026 brand uses gold/black/white plus host-city palettes; no official group palette exists. Introducing one fragments the visual system. The host-city palette already covers the 16 surface colours needed.
4. **Hard cutoff at PW1 lock (status quo).** Rejected per user direction — our friend-group context tolerates and benefits from a 72h soft window. The trade-off (some auto-forfeited matches) is acceptable.

## Consequences

- SPEC.md §16.10 updated in lockstep. The "Superseded Decisions" table gets one new row.
- Bracket usage drops sharply (the point — it's still there for the keen). Bracket conversion funnel needs separate tracking if we care.
- Late joiners during the soft window will see some matches locked on entry. `/api/predictions` rejects submissions for those events; we render them as read-only on the landing.
- Super Admin can edit `competitions.joins_locked_at` directly in Supabase for one-off overrides (early close, post-mortem extension). No admin UI work needed in this PR series.
- One Vercel Hobby cron slot remains free — the cutoff flip is embedded in the existing daily results cron, not a new schedule.
- Pending proposal `docs/DESIGN-WC-UNIFIED-PREDICTIONS.md` is implicitly resolved: the picks-first landing IS the unified surface. The proposal doc should be marked resolved as part of the landing PR.

## Supersedes

- Pending proposal: `docs/DESIGN-WC-UNIFIED-PREDICTIONS.md` (resolved as adopted).
- Earlier SPEC.md §16.10 rule: "remains joinable until PW1 locks" → "remains joinable until 72h after first MD1 kickoff".

## Does NOT touch

- ADR-0009 (Standalone Knockout) — still pending. Standalone knockout is not surfaced on the new landing.
- ADR-0006 (Product Shell) — competition lifecycle stays on the competition row; `joins_locked_at` is consistent with this pattern.
- ADR-0007 (Prediction Window as Round) — round structure unchanged. The landing simply renders the MD1 round verbatim.
