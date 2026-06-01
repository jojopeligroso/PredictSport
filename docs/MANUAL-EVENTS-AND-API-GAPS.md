# Manual Events & API Coverage Analysis

**Created:** 2026-05-12
**Context:** Admin workflow improvements for manual event creation, result entry, and identifying sports API coverage gaps.

---

## Phase 3: Manual Event Management (3-4 hours)

**Goal:** Streamline admin workflow for creating events without API coverage and managing manual result entry.

### Current State Analysis

**Existing Manual Flow:**
1. Admin creates event via `AddEventForm.tsx` (in admin panel)
2. Event stored with `external_event_id = null` if no API source
3. Result entry via `ResultPanel.tsx`:
   - Shows "Enter Manual Result" form
   - Admin inputs team names, scores
   - Confirms → triggers scoring

**Gaps:**
- ❌ No guided "Create Event from Scratch" wizard for non-API sports
- ❌ Manual events lack validation helpers (e.g., "Is this team name correct?")
- ❌ No templates for common manual events (local leagues, friendly matches)
- ❌ Admin must remember scoring config when creating manual events
- ❌ No bulk manual event creation (e.g., "Add 10 local GAA matches")
- ❌ Result confirmation has no "undo" or edit after confirmation
- ❌ No admin notification when events approach start time without results

### Tasks

**3.1** Audit existing manual event creation flow
- File: `src/app/admin/components/AddEventForm.tsx`
- Review current UX:
  - What fields are required?
  - How does admin set `sport`, `event_name`, `start_time`, `lock_time`?
  - Can admin preview prediction types before saving?
  - Are team names validated?
- Test creating a manual GAA hurling match end-to-end
- Document pain points and missing validations

**3.2** Design "Manual Event Wizard" component
- Component: `src/app/admin/components/ManualEventWizard.tsx`
- Features:
  - Step 1: Sport selection (with emoji icons, filter to manual-only sports)
  - Step 2: Event details (name, date/time, venue)
  - Step 3: Participants (team names with autocomplete from past events)
  - Step 4: Prediction types (show relevant types only, like Phase 1 smart filtering)
  - Step 5: Review & create
- Mobile-optimized, accordion-style steps
- Save draft capability (store in localStorage or drafts table)

**3.3** Add team name validation & suggestions
- Build helper: `src/lib/team-validation.ts`
- Features:
  - Query past events for team name matches (fuzzy search)
  - Show "Did you mean: Cardiff Blues?" if admin types "cardiff"
  - Autocomplete dropdown from `events` table team history
  - Prevent common typos (extra spaces, case inconsistency)
- Integrate into ManualEventWizard Step 3

**3.4** Create manual event templates
- File: `src/lib/manual-event-templates.ts`
- Templates:
  ```typescript
  interface EventTemplate {
    sport: Sport;
    name: string;
    description: string;
    defaultPredictionTypes: PredictionTypeName[];
    participantCount: number; // 2 for matches, N for tournaments
    customFields?: { label: string, type: 'text' | 'number' }[];
  }
  ```
- Examples:
  - GAA Hurling Match (2 teams, H2H + margin)
  - Local Soccer League Game (2 teams, H2H + O/U)
  - Golf Tournament (multi-player, winner + top_n)
  - Snooker Match (2 players, H2H + frame handicap)
- UI: Dropdown in ManualEventWizard Step 1 "Or start from template"

**3.5** Bulk manual event creation
- Component: `src/app/admin/components/BulkEventCreator.tsx`
- Features:
  - CSV upload (columns: event_name, sport, start_time, home_team, away_team)
  - Or multi-row form (add 5-10 events at once)
  - Preview table before saving
  - Validation errors highlighted per row
  - Save all → creates events + event_prediction_types in transaction
- Use case: Admin adds full weekend's GAA fixtures from league schedule

**3.6** Improve manual result entry UX
- File: `src/app/admin/components/ResultPanel.tsx`
- Enhancements:
  - Pre-populate team names from event config (if available)
  - Add score validation (non-negative integers, realistic ranges)
  - Show "Result summary" before confirm (e.g., "Cardiff 21 - 14 Stormers → Winner: Cardiff")
  - Add "Edit" button after provisional result set (before final confirm)
  - Add confirmation modal: "This will score X predictions. Continue?"
- Accessibility: Keyboard shortcuts (Enter to confirm, Esc to cancel)

**3.7** Result entry undo/edit capability
- Backend: `src/app/api/admin/unconfirm-result/route.ts` (new)
- Logic:
  - Check `result_confirmed = true` → set back to `false`
  - Delete all associated `scored_points` from predictions
  - Recalculate leaderboard (or mark stale)
  - Audit log: "Admin unconfirmed result for event X"
- Frontend: Add "Undo Confirmation" button in ResultPanel (only visible for 10 mins after confirm)
- RLS: Only competition admin can undo

**3.8** Add "Events Missing Results" admin alert
- Component: `src/app/admin/components/EventsAwaitingResults.tsx`
- Shows:
  - Events where `start_time` < now AND `result_data` is null
  - Grouped by urgency: "Overdue 2+ days", "Overdue 1 day", "Today"
  - Click event → opens ResultPanel
- Placed at top of admin dashboard (CompetitionTabs.tsx)
- Badge count on "Results" tab

**3.9** Auto-fetch reminder for manual events
- Cron job: `src/app/api/results/cron/route.ts` (modify existing)
- Logic:
  - For events with no API provider (manual-only sports)
  - If `start_time` + 2 hours passed AND no result
  - Send notification to admin: "Please enter result for [Event Name]"
  - Uses existing web push or email notification system
- Admin can snooze reminder (store in event metadata)

**3.10** Manual event cloning
- Feature: "Duplicate Event" button in EventsSection.tsx
- Clones event with:
  - Same sport, prediction types, scoring config
  - Incremented name (e.g., "Round 2" → "Round 3")
  - Start/lock times cleared (admin must set)
- Use case: Weekly league matches with same structure

**3.11** Validation before event activation
- Add pre-flight check before round/competition activation:
  - All events have prediction types configured?
  - All events have valid start_time > lock_time?
  - All manual events have team names (if head-to-head)?
  - Show checklist modal with warnings/errors
  - Block activation if critical errors
- Integrate into existing round "Open" transition (route.ts PATCH)

**3.12** Documentation & help text
- Add inline help in ManualEventWizard:
  - "What's a lock time?" tooltip
  - "When should I use margin vs handicap?" info button
  - Link to SPEC.md §6 from prediction type selector
- Create admin guide: `docs/ADMIN-GUIDE-MANUAL-EVENTS.md`
  - Common manual event scenarios
  - Best practices (naming, timing, validation)
  - Troubleshooting (what if result is disputed? how to void?)

### Success Criteria
- ✅ Admin can create manual event in <2 mins (vs current ~5 mins)
- ✅ Team name typos reduced by 80% (autocomplete working)
- ✅ Zero invalid events activated (validation gates working)
- ✅ Admin sees overdue results dashboard on login
- ✅ Bulk creation works for 10+ events without errors
- ✅ Manual result entry has undo capability (within 10 mins)

### Files Created/Modified
- **Created:**
  - `src/app/admin/components/ManualEventWizard.tsx` (~400 lines)
  - `src/app/admin/components/BulkEventCreator.tsx` (~300 lines)
  - `src/app/admin/components/EventsAwaitingResults.tsx` (~150 lines)
  - `src/lib/team-validation.ts` (~100 lines)
  - `src/lib/manual-event-templates.ts` (~150 lines)
  - `src/app/api/admin/unconfirm-result/route.ts` (~100 lines)
  - `docs/ADMIN-GUIDE-MANUAL-EVENTS.md` (~800 words)
- **Modified:**
  - `src/app/admin/components/ResultPanel.tsx` (enhanced UX, edit capability)
  - `src/app/admin/components/EventsSection.tsx` (clone button)
  - `src/app/admin/components/CompetitionTabs.tsx` (awaiting results alert)
  - `src/app/api/results/cron/route.ts` (manual event reminders)
  - `src/app/api/admin/rounds/route.ts` (validation pre-flight)

### Reference Docs
- `SPEC.md` §11 — Sports Data Integration (manual as fallback principle)
- `SPEC.md` §6 — Prediction Types (for template defaults)
- `CLAUDE.md` lines 129-136 — Manual Event Creation Checklist
- `src/lib/sports/registry.ts` — Current provider chains, manual fallback

---

## Phase 4: Sports API Coverage Analysis (2-3 hours)

**Goal:** Identify sports with poor/no API coverage, evaluate new providers, and prioritize integration.

### Current Coverage (from registry.ts)

| Sport | Providers | Coverage Quality |
|-------|-----------|------------------|
| F1 | OpenF1 ✅ | Excellent (official API) |
| Soccer | API-Football, ESPN, TheSportsDB ✅ | Excellent (3 sources) |
| Rugby | ESPN, TheSportsDB ✅ | Good (2 sources) |
| Golf | ESPN, TheSportsDB ✅ | Good |
| Tennis | ESPN, TheSportsDB ✅ | Good |
| MLB | MLB Stats, ESPN, BallDontLie ✅ | Excellent (official + 2) |
| NFL | ESPN, BallDontLie ✅ | Good |
| NBA | BallDontLie, ESPN ✅ | Excellent (BDL free tier) |
| NHL | ESPN, BallDontLie ✅ | Good |
| Cricket | ESPN, TheSportsDB, Manual ⚠️ | Fair (ESPN unreliable) |
| GAA | Foireann, Manual ⚠️ | Fair (Foireann limited) |
| Gaelic Football | Foireann, Manual ⚠️ | Fair |
| Hurling | Foireann, Manual ⚠️ | Fair |
| Horse Racing | TheRacingAPI ⚠️ | Fair (free tier limits) |
| Snooker | ESPN, Manual ⚠️ | Poor (ESPN spotty) |
| Athletics | Manual ❌ | None |
| Rugby League | ESPN, Manual ⚠️ | Poor |

**Gap Summary:**
- ❌ **Athletics** — No API coverage
- ⚠️ **GAA/Hurling/Gaelic Football** — Limited to Foireann (Irish only)
- ⚠️ **Cricket** — ESPN unreliable (see CLAUDE.md probe strategy)
- ⚠️ **Snooker** — ESPN coverage inconsistent
- ⚠️ **Rugby League** — Separate from Rugby Union, ESPN limited

### Tasks

**4.1** Audit current provider success rates
- File: Create `scripts/audit-api-coverage.ts`
- Logic:
  - Query `events` table for last 90 days
  - Group by `sport`
  - Calculate:
    - % events with `result_data` populated
    - % events with `external_event_id` (API-sourced)
    - Average time between `start_time` and `result_data` fetch
  - Generate report: `docs/API-COVERAGE-AUDIT-2026-05.md`
- Run against production database (Supabase)

**4.2** Identify high-priority gaps
- Based on audit + user requests:
  - Which sports are users creating events for most?
  - Which sports have highest manual result entry rate?
  - Which sports cause most admin complaints?
- Prioritize by: (frequency × manual_rate) = priority_score
- Document in audit report

**4.3** Research Cricket API alternatives
- Current issue: ESPN cricket unreliable (per CLAUDE.md cricket fetcher notes)
- Evaluate:
  - **Cricbuzz API** (unofficial scrapers available on GitHub)
  - **CricAPI** (paid, $10/mo for 1000 req)
  - **CricketData.org** (free, limited coverage)
  - **ESPN Cricinfo RSS feeds** (free, delayed results)
- Test each with sample IPL/Test match
- Document findings: API URL, cost, coverage, reliability

**4.4** Research GAA API improvements
- Current: Foireann (Irish club GAA only)
- Evaluate:
  - **GAA API** (if official exists?)
  - **ClubZap API** (used by clubs for fixtures)
  - **Screen scraping GAA.ie** (last resort, fragile)
  - **Community-maintained datasets** (GitHub, Kaggle)
- Test with recent All-Ireland Championship fixture
- Document findings

**4.5** Evaluate Rugby League sources
- Current: ESPN (limited)
- Evaluate:
  - **NRL API** (official Australian league)
  - **Super League API** (official UK league)
  - **TheSportsDB** (may have RL separate from RU)
  - **RFL (Rugby Football League) data feeds**
- Test with recent NRL/Super League game
- Document findings

**4.6** Research Athletics/Track & Field APIs
- Current: Manual only
- Evaluate:
  - **World Athletics API** (official, may require partnership)
  - **Tilastopaja** (Finnish athletics DB, broad coverage)
  - **OpenTrack API** (open-source meet management)
  - **Diamond League results feeds** (for major events)
- Test with recent Diamond League meet (e.g., Prefontaine Classic)
- Document findings

**4.7** Evaluate Snooker coverage
- Current: ESPN (spotty)
- Evaluate:
  - **Snooker.org API** (official World Snooker, may be paid)
  - **CueTracker** (fan-maintained, comprehensive)
  - **BBC Sport Snooker feed** (free, UK-focused)
  - **TheSportsDB snooker** (re-check, may have improved)
- Test with recent World Championship match
- Document findings

**4.8** Cost-benefit analysis for paid APIs
- For each paid option from 4.3-4.7:
  - Monthly cost
  - Request limits
  - Coverage breadth (leagues, competitions)
  - Reliability (uptime, data freshness)
  - Integration effort (1-5 day estimate)
- Compare against "admin time saved per month"
- Calculate ROI: (admin_hours_saved × $25/hr) / monthly_cost
- Prioritize by ROI

**4.9** Create provider integration guide
- Doc: `docs/ADDING-A-SPORTS-PROVIDER.md`
- Sections:
  1. Extending `BaseProvider` class
  2. Implementing `searchEvents()` (fixture discovery)
  3. Implementing `getResult()` (result fetching)
  4. Normalizing to `NormalizedResult` interface
  5. Registering in `registry.ts`
  6. Adding to sport chains (priority order)
  7. Environment variables (API keys)
  8. Testing checklist
  9. Rate limit handling
- Reference existing providers as examples

**4.10** Implement top-priority provider (TBD based on 4.8)
- Example: If Cricket API prioritized:
  - Create `src/lib/sports/providers/cricbuzz.ts`
  - Implement `searchEvents()` and `getResult()`
  - Add to `registry.ts` cricket chain
  - Add `CRICBUZZ_API_KEY` to `.env.local.example`
  - Test with 3 recent IPL matches
  - Document in CLAUDE.md provider table

**4.11** Add provider health monitoring
- Component: `src/app/admin/components/ProviderHealthDashboard.tsx`
- Shows:
  - List of all providers
  - Success rate (last 7 days)
  - Average response time
  - Last successful fetch timestamp
  - Error messages (last 5 failures)
- Admin can manually trigger test fetch per provider
- Placed in admin settings or diagnostics section

**4.12** Document unsupported sports & alternatives
- Create `docs/UNSUPPORTED-SPORTS.md`
- For each sport with no/poor API:
  - Current status (manual only, unreliable provider, etc.)
  - Alternative workflows (admin workarounds)
  - When to expect support (if planned)
  - Community contribution opportunities
- Link from admin panel when creating manual event
- Helps set user expectations

### Success Criteria
- ✅ API coverage audit complete with data-driven priorities
- ✅ At least 1 new provider integrated (top ROI sport)
- ✅ Admin sees provider health dashboard
- ✅ Integration guide enables community contributions
- ✅ Manual sports documented with workarounds

### Files Created/Modified
- **Created:**
  - `scripts/audit-api-coverage.ts` (~200 lines)
  - `docs/API-COVERAGE-AUDIT-2026-05.md` (generated report)
  - `docs/ADDING-A-SPORTS-PROVIDER.md` (~1200 words)
  - `docs/UNSUPPORTED-SPORTS.md` (~800 words)
  - `src/app/admin/components/ProviderHealthDashboard.tsx` (~250 lines)
  - `src/lib/sports/providers/[new-provider].ts` (if Phase 4.10 implemented)
- **Modified:**
  - `src/lib/sports/registry.ts` (if new provider added)
  - `CLAUDE.md` (update provider table if changed)

### Reference Docs
- `SPEC.md` §11 — Sports Data Integration principles
- `CLAUDE.md` lines 54-67 — Current provider table
- `src/lib/sports/types.ts` — SportsProvider interface
- `src/lib/sports/providers/base.ts` — BaseProvider abstract class

---

## Phase Dependencies

- **Phase 3** is **independent** — Can start immediately after Phase 1 or 2
- **Phase 4** is **independent** — Can run in parallel with Phase 3
- Both phases complement each other:
  - Phase 3 improves manual workflow (immediate admin relief)
  - Phase 4 reduces need for manual workflow (long-term solution)

## Recommended Sequencing

1. **Complete Phase 1** (Smart Filtering) — Foundation for prediction type logic
2. **Run Phase 4.1-4.8** (API audit & research) — Gather data, no coding yet
3. **Implement Phase 3** (Manual Event Management) — Immediate admin UX win
4. **Decide on Phase 2** (Card UI) — Based on Phase 1 feedback
5. **Implement Phase 4.9-4.12** (Provider integration) — Data-driven, after audit complete

Total estimated effort: **9-12 hours across all phases**

---

## Next Steps

1. Add Phase 3 & 4 tasks to `todos.md`
2. Commit and push this document
3. Begin with Phase 4.1 (audit script) — runs async, gathers baseline data
4. Parallel: Prototype ManualEventWizard (Phase 3.2) while audit runs
5. Review audit results → prioritize Phase 4.10 provider choice
