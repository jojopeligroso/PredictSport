# Handoff: Leaderboard, Join Flow, Group Draw — 2026-05-27

## Session Commits

| Hash | Summary |
|------|---------|
| `7c61074` | Competition-scoped admin access + member management APIs |
| `7444cc2` | Entrant caps (48 max, 8 min), join flow with display name prompt, leaderboard enhancements |
| `a9b2d10` | Format group draw engine, lazy auto-draw, leaderboard preview cards |
| `d286894` | Design mockups for all leaderboard states |

## What Was Built

### 1. Admin System (7c61074)
- Admin link now checks `competition_members` role (admin/co_admin) instead of global `is_super_admin`
- `PATCH/DELETE/PUT /api/admin/members` — role changes, member removal (blocked after PW1 lock), callout labels
- `WcAdminClient` dashboard: entrant list, invite link copy, classifications list, operations panel
- `/api/wc/admin/create` route for WC competition creation

### 2. Entrant Caps + Join Flow (7444cc2)
- **Schema:** `max_entrants` (INT, nullable) and `min_entrants` (INT, nullable) on `competitions` table
- **Migration:** `20260527000000_entrant_caps.sql` — applied to live DB (WC set to 48/8)
- **Join flow rewrite:** `/wc/join` now shows display name confirmation before enrolling
  - Copy: "This is how you'll show up to the lads on the leaderboard. Use the name they'll know you by."
  - Cap enforcement at both page level and API level (`/api/tournament/enroll`)
  - New `JoinFlow.tsx` client component
- **Leaderboard:** Format tab is now default, entrant counter ("23 / 48 entrants" or "3 of 8 minimum required"), per-classification scoring rules shown pre-kickoff
- **Overall tagline:** "Even if you're out, you're in" in serif italic

### 3. Format Group Draw Engine (a9b2d10)
- **Config:** `group_draw_hours_before` added to format classification config (default 24h)
  - Admin can adjust in competition create form
- **API:** `GET /api/tournament/my-group?classificationId=X&competitionId=Y`
  - Returns `draw_pending` (with `drawAt` timestamp) or `drawn` (with group members, names, prediction counts)
  - **Lazy auto-draw:** When draw window opens (24h before first event), groups are drawn automatically via `allocatePredictionGroups()` on first request
  - Uses existing `getEliminationCurve()` for survivor target
- **UI Cards in ClassificationTabs:**
  - `FormatGroupCard` — pre-draw: user name + 3 blurred placeholders + countdown. Post-draw: real group with names, x/y predictions, points
  - `OverallPreviewCard` — 12-row placeholder (user at #6, 11 blurred), entrant count footer
  - `DrawCountdown` — live countdown updating every minute
- **Rules copy updated:** "Groups are drawn 24 hours before the first match of each stage."

## What Was NOT Built (Next Session)

### Immediate Follow-ups
1. **Click-for-breakdown** — group card and overall card should be tappable for per-match prediction breakdown
2. **Post-elimination redraw trigger** — after `eliminateFromFormat` runs, need to trigger `allocatePredictionGroups` for the next stage's groups
3. **Nav changes** — hide Bracket from nav, rename Results to "Fixtures & Results" (deferred for UI revamp merge)
4. **UI revamp merge** — incoming from another device (aesthetic/bracket hiding). May conflict with `WcNavLinks.tsx` and `layout.tsx`

### Phase 2 (Parked)
5. **Competition lifecycle guardrails** — 2,000 platform cap, 3 per user, 8-member minimum within 5 days or archive+delete, WC exempt
6. **Entry cap enforcement in RLS** — database-level guard (currently app-level only)

## Key Files Modified This Session

| File | What |
|------|------|
| `src/app/api/tournament/my-group/route.ts` | NEW — group data + lazy draw trigger |
| `src/app/api/tournament/enroll/route.ts` | Added max_entrants cap check |
| `src/app/wc/join/page.tsx` | Rewritten — display name prompt + cap |
| `src/components/wc/JoinFlow.tsx` | NEW — client component for join flow |
| `src/components/tournament/ClassificationTabs.tsx` | Format default, counter, rules, preview cards |
| `src/app/wc/leaderboard/page.tsx` | Passes memberCount, caps, displayName |
| `src/app/wc/admin/WcAdminClient.tsx` | Dashboard + group draw hours input |
| `src/app/api/admin/members/route.ts` | PATCH/DELETE/PUT member management |
| `src/lib/tournament/create-world-cup-competition.ts` | maxEntrants, minEntrants, groupDrawHoursBefore |
| `src/types/database.ts` | max_entrants, min_entrants on Competition |
| `supabase/migrations/20260527000000_entrant_caps.sql` | Schema migration |

## Design Mockups

- `design/leaderboard-cards-mockup.html` — 3-screen comparison (Format pre-draw, post-draw, Overall placeholder)
- `design/leaderboard-mockup.html` — Pre-kickoff states (below min, above min, Overall tab)

## Live DB State

- WC competition exists: `max_entrants=48`, `min_entrants=8`, status `active`
- Only super admin: `eoinmaleoin@gmail.com`
- Format classification has `group_draw_hours_before: 24` in config (for new competitions — existing WC competition config unchanged, would need SQL update)

## Watch Out For

- **Revamp merge:** The incoming UI revamp touches aesthetic/bracket/nav. Files we changed (`ClassificationTabs.tsx`, `leaderboard/page.tsx`) should not conflict, but `WcNavLinks.tsx` and `layout.tsx` were committed earlier in this session (admin access changes) — the revamp may also touch these
- **Existing WC competition config:** The live WC competition was created before `group_draw_hours_before` was added to the create function. Its format classification config won't have this field — the API defaults to 24h via `?? 24`, so it works, but an explicit SQL update would be cleaner
