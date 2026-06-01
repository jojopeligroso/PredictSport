# Prototype-to-App Migration Map

## Prototype Inventory

### Design Tokens (`ps-tokens.jsx`)
| Token | Values | Status in App |
|-------|--------|---------------|
| `PS_TOKENS.light` | bg:#efe9de, bgAlt:#e7dfd0, surface:#fff, surface2:#faf6ee, border:rgba(40,30,20,0.10), text:#191512, textSec:#5e554a, textTer:#8b8275 | **Done** — globals.css has all CSS vars |
| `PS_TOKENS.dark` | bg:#0e1116, bgAlt:#161a21, surface:#1a1f27, etc. | **Done** — `prefers-color-scheme: dark` block |
| Semantic colors | amber:#f59e0b, amberDeep:#d97706, green:#0aa86d, red:#e23d4f, blue:#3b82f6, violet:#8b5cf6 | **Done** |
| `PS_SPORTS` | 5 sports with from/to gradients, pillBg/pillFg light+dark | **Done** in globals.css + `sport-config.ts` |
| `PS_DENSITY` | cosy: {card:16, gap:14, radius:16, title:17, sub:13}, compact: {card:12, gap:10, radius:14, title:16, sub:12} | **MISSING** — no density system exists |
| `PS_TOP_INSET` | 54px padding-top for iOS dynamic island | **MISSING** — app uses NavBar instead of safe-area inset |
| Fonts | Inter (300-900), Bebas Neue (display), Instrument Serif (loaded, unused) | **Partial** — Inter+Bebas loaded, Instrument Serif missing |

### Sample Data (`ps-data.jsx`)
| Data | Shape | App equivalent |
|------|-------|----------------|
| `PS_PARTICIPANTS` | id, name, initials, color, callout, form[5], pts, acc, mv | DB: `competition_members` + `users` — callout_label exists |
| `PS_EVENTS` | id, sport, title, league, venue, kickoff, locksIn, type, options[], community{}, fact, callout, yourPick, points | DB: `events` + `event_prediction_types` |
| `PS_RIVALRY` | headline + body, derived from top-2 gap | Computed in `LeaderboardTable.tsx:getRivalryBanner()` |
| `PS_ALL_PICKS` | post-lock picks by eventId -> optionId -> userId[] | DB: `predictions` table — query needed |
| `PS_COMMENTS` | keyed by `eventId:ownerId`, with from/text/t/priv | **DEPRECATED** — using WhatsApp model, not in-app threads |
| `PS_NOTIFICATIONS` | in-app activity feed | **DEPRECATED** — Archive section |

### Reusable Components (`ps-components.jsx`)
| Component | Prototype | App (`src/components/ui/`) | Delta |
|-----------|-----------|---------------------------|-------|
| `SportPill` | Emoji + uppercase name, tinted pill, size sm/md | `SportPill.tsx` exists | Audit pixel fidelity |
| `FormBadge` | W/L/P squares, semantic color, configurable size | `FormBadge.tsx` exists | Audit |
| `Avatar` | Initials disc, person.color bg, optional ring | `Avatar.tsx` exists | Audit ring style |
| `AccuracyRing` | Conic-gradient donut, pct label in hole | `AccuracyRing.tsx` exists | Audit |
| `MovementBadge` | +N/-N pill, green/red, dash for 0 | `MovementBadge.tsx` exists | Audit |
| `CommunityDonut` | Conic-gradient, 5-color palette, total+picks in hole | `CommunityDonut.tsx` exists | Audit — needs real community data |
| `SportBar` | 3px gradient strip, sport-coded, inherits border-radius | `SportBar.tsx` exists | Audit |
| `PersonaCallout` | border variant (left 3px amber bar) + ticket variant | `PersonaCallout.tsx` exists | Audit — needs wiring to callout_label |
| `PickButton` | Selected=amber border+bg, community %, odds display | `PickButton.tsx` exists | Audit — no community% or odds yet |
| `SectionHeader` | 4x18 accent bar + uppercase label | `SectionHeader.tsx` exists | Audit |
| `CountdownChip` | Clock icon + text, urgent=red | `CountdownChip.tsx` exists | Audit |
| `PointsStamp` | Gradient pill (+N/max), correct/wrong/partial variants | `PointsStamp.tsx` exists | Audit |
| `EmojiReactions` | Open emoji picker, tap-to-add, count badges | `EmojiReactions.tsx` exists | **Needs wiring** to `prediction_reactions` API |
| `PickNote` | Editable pre-lock, readonly post-lock, public/private toggle | `PickNote.tsx` exists | **Needs wiring** to `note_text`/`note_visibility` fields |
| `SendToThread` | icon/inline/block variants, wa.me deep-link, long-press composer | `SendToThread.tsx` exists | **Needs wiring** — currently no-op |
| `WAIcon` | WhatsApp SVG glyph | `WAIcon.tsx` exists | Done |

### Screen Mapping

| # | Prototype Screen | Component | Existing Route | Gap |
|---|-----------------|-----------|----------------|-----|
| 1a | WhatsApp chat (invite in group) | `WhatsAppEntryScreen` stage="chat" | `/` (landing) | **Rethink** — current landing is generic. Prototype shows WA chat with link card. For the real app, the landing page at `/` for unauthenticated users should match the "landing sheet" (1b), not the WA chat mockup. WA chat is a context illustration, not a buildable screen. |
| 1b | Landing sheet overlay (tap link -> half-sheet) | `WhatsAppEntryScreen` stage="landing" | `/` (landing) | **Partial** — current landing has PS logo + "Get started". Needs: warm cream bg, "You've been invited to Round 7" copy, auto-join flow via invite code from URL |
| 2 | Home / "Round 7 — Mixed Weekend" | `HomeScreen` | `/predictions` | **Major rework** — Hero header (Bebas "MIXED WEEKEND"), filter chips, event cards with SportBar+CommunityDonut+PersonaCallout all exist but: (a) no round name in hero (data gap — rounds exist but aren't surfaced); (b) tiebreaker section is placeholder; (c) PersonaCallout not wired to member's callout_label; (d) no density system |
| 3a | Event detail — winner/overunder (<=3 options: columns) | `EventDetailScreen` | None (inline in cards) | **NEW PAGE NEEDED** — `/predictions/[eventId]`. Prototype has a full-page event detail with sport-gradient hero, lock indicator card, "Your Pick" section, "What the lads picked" donut breakdown, Intel Report callout, and amber CTA button. Currently picks are inline in event cards — need both. |
| 3b | Event detail — margin/top3 (>3 options: stacked rows) | `EventDetailScreen` | None | Same as 3a — layout switches based on `options.length <= 3` |
| 4 | Result states ("The Damage") | `ResultStatesScreen` + `ResultCard` | `/predictions` (resulted section) | **Major rework** — Prototype has a dedicated "Last Round" view with Bebas "THE DAMAGE" header, round points summary, and ResultCards with PointsStamp + verdict quip + SendToThread. Current app just shows "Resulted" section inline. Needs either a separate tab/view or filter state on predictions page. |
| 5 | Leaderboard ("The Table") | `LeaderboardScreen` | `/leaderboard` | **Good shape** — podium cards, table rows, rivalry banner, Best in Class all implemented. Gaps: (a) no SendToThread on table rows; (b) no person detail navigation; (c) rivalry text is computed but may not match prototype's exact tone |
| 6 | Person detail | `PersonScreen` | None | **NEW PAGE NEEDED** — `/leaderboard/[userId]`. Hero with person.color gradient, avatar, rank, callout. Stat strip (points/accuracy/streak). Form badges. Picks vs Results table. Fun fact callout. |
| 7 | Banter layer — post-lock event detail | `EventDetailPostLockWA` | None | **NEW PAGE/STATE NEEDED** — `/predictions/[eventId]` post-lock state. Reveals all picks with per-pick EmojiReactions + SendToThread + PickNotes. Split-bar showing pick distribution. "Banter happens in the group" footer. |
| 7b | Pre-lock pick with PickNote | `EventDetailPickWithNote` | None | Part of event detail page — add PickNote between picker and CTA |
| 8 | Admin / Match Day Desk | `AdminScreen` | `/admin` + `/admin/competitions/[id]` | **Major visual rework** — Current admin is a competition list. Prototype shows: tabbed panel (Confirm Results / Add Event / Nominations), auto-fetched results with provider badges, fixture search with sport filter chips, nomination accept/reject. Structurally the routes exist but the UI doesn't match. |
| 9 | Settings / Members (callout edit) | `SettingsScreen` | None (settings section in admin comp detail) | **NEW PAGE/TAB NEEDED** — Member list with expandable callout edit + live preview. `callout_label` field exists in DB. Currently `SettingsSection.tsx` in admin exists but is minimal. |
| -- | Archive: in-app threads, DMs, notifications, lockscreen | `EventDetailPostLockScreen`, `NotificationsScreen`, `LockscreenScreen` | None | **DO NOT BUILD** — deprecated in prototype. If any in-app thread/DM/notification code exists, confirm removal with user. |

### New Features to Build

| Feature | Prototype Reference | Data Model | Status |
|---------|-------------------|------------|--------|
| WhatsApp deep-link sharing | `SendToThread` (icon/inline/block) + `psDefault*Copy` generators | No DB needed — client-side `wa.me/?text=` | Component exists, needs wiring on every pick/result/leaderboard row |
| PickNote (public/private) | `PickNote` component in `ps-whatsapp.jsx` | `predictions.note_text` + `predictions.note_visibility` **already in schema** | Component exists, needs API integration |
| EmojiReactions on picks | `EmojiReactions` in `ps-whatsapp.jsx` | `prediction_reactions` table **already in schema** + `/api/reactions` route exists | Component exists, needs wiring |
| Tiebreaker field on Home | `HomeScreen` tiebreaker section | `tiebreakers` + `tiebreaker_answers` tables **already in schema** | UI placeholder exists in event-list, needs real implementation |
| Per-member callout label edit | `SettingsScreen` with live preview | `competition_members.callout_label` **already in schema** | New UI needed |
| Admin auto-fetched results | `AdminScreen` confirm section with provider badge | Providers exist (`src/lib/sports/`), `/api/sports/fetch-result` exists | Admin UI needs redesign to show fetched results with confirm flow |
| Best in Class | `LeaderboardScreen` 3-up grid | Computed from predictions | **Already implemented** in `LeaderboardTable.tsx` |
| Rivalry banner | `LeaderboardScreen` dashed-border amber card | Computed from top-2 gap | **Already implemented** in `LeaderboardTable.tsx` |
| Density preference (cosy/compact) | `PS_DENSITY` in tokens, wired through all components | User preference (localStorage or DB) | **NEW** — needs implementation |

### Data Model Gaps

| Field/Table | Needed For | Exists? |
|-------------|-----------|---------|
| `competition_members.callout_label` | Persona callouts | **Yes** |
| `predictions.note_text` | PickNote | **Yes** |
| `predictions.note_visibility` | PickNote public/private | **Yes** |
| `prediction_reactions` | EmojiReactions | **Yes** |
| `tiebreakers` + `tiebreaker_answers` | Tiebreaker input | **Yes** |
| `event_nominations` | Admin nominations | **Yes** |
| `rounds` | Round name in hero, grouping | **Yes** — but predictions page doesn't query/display round info |
| Community pick aggregates | CommunityDonut real data | **No table** — need to aggregate predictions per event per option. Could be a view or computed at query time |
| User density preference | Cosy/compact toggle | **No column** — could use `users.notification_prefs` JSON or localStorage |

### Screens/Features to DELETE (Archive/Deprecated)

The prototype's "Archive" section contains deprecated in-app social features. Confirm before removing:
- In-app threaded comments (`PS_COMMENTS`, `CommentRow`, `CommentComposer`, `ReactionStrip`, `RevealedPickRow` with thread expansion)
- In-app notifications screen (`NotificationsScreen`, `PS_NOTIFICATIONS`)
- In-app DMs (private comments visible as DMs)
- Lockscreen notification preview
- **No backend tables need deletion** — `prediction_reactions` is used by the WhatsApp model's EmojiReactions. There are no in-app thread/comment tables in the schema.

### Implementation Order

1. **Tokens & density system** — Wire `PS_DENSITY` as CSS vars or a React context. Add Instrument Serif font. Verify all existing component tokens match prototype values exactly.
2. **Typography audit** — Ensure Bebas Neue is used for: hero headlines, points totals, podium ranks, leaderboard names. Verify letter-spacing (0.6-1.5) and line-height (0.9-1.0) on all display text.
3. **Component pixel audit** — Walk each of the 16 reusable components, diff against prototype measurements, fix deviations.
4. **Home screen rework** — Surface round name in hero, wire PersonaCallout to callout_label, implement tiebreaker section, add density support.
5. **Event detail page** — New route `/predictions/[eventId]` with sport-gradient hero, lock card, pick section (column/stacked layout by option count), community breakdown, Intel Report, PickNote, amber CTA.
6. **Post-lock event detail** — Same route, locked state: reveal all picks, show EmojiReactions + SendToThread per pick, PickNotes revealed.
7. **Result states view** — "The Damage" section on predictions page (tab or filter), ResultCards with PointsStamp + verdict + SendToThread.
8. **Person detail page** — New route `/leaderboard/[userId]` with hero, stats, form, picks-vs-results, fun fact.
9. **Leaderboard polish** — Add SendToThread to table rows, link rows to person detail.
10. **Admin visual overhaul** — Tabbed panel, confirm-results with provider badges, fixture search, nominations list.
11. **Settings/Members page** — Callout label edit with live preview.
12. **WhatsApp sharing** — Wire SendToThread across all surfaces with context-appropriate default copy.
13. **API wiring** — PickNote save/load, EmojiReactions CRUD, community aggregate query, callout_label CRUD.
