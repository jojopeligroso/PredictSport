# Implementation Plan: Reputation Tags + Chat Improvements

**Branch:** `feat/reputation-tags` (both features — they're symbiotic)
**Rule:** Nothing merges to master until both features are complete and manually tested.

---

## Decisions Log (from grill session 2026-06-21)

| # | Decision | Detail |
|---|----------|--------|
| 1 | Scope | Both behavioural AND event-driven tags |
| 2 | Computation | Postgres RPC — pure SQL aggregation |
| 3 | Storage | New `member_tags` table with full history |
| 4 | Rejection | Phase 1: safe copy only, no edgier variants. User sees tag on dashboard, accepts/rejects. Both actions fire chat message. Rejecting does NOT hide data or prevent future tags. Framing must NOT imply "nothing will appear" if rejected. |
| 5 | Admin suppression | Participants section of admin page. Admin notified 6–8hrs before tags publish. |
| 6 | Density | Guideline 20–40%, hard cap 50%. Priority tiers + z-score tiebreaker. Vision: 100+ catalogue, 12–15 active per competition. |
| 7 | Chat: confidence | Remove confidence accordion from matchday view. Replace community picks bar chart flip-side with full 5-level confidence breakdown + "no vote" indicator. |
| 8 | Chat: result messages | Include actual score in result system messages (e.g. "France 2–1 Mexico — result confirmed") |
| 9 | Chat: message types | Add `system_tag_reveal`, `system_tag_change`, `system_tag_reject`, `system_round_summary` in one migration |
| 10 | Chat: tag rendering | New `TagRevealCard` component inside ChatMessage for `system_tag_reveal` |
| 11 | Chat: media | Build capacity for richer media features but keep dormant until DB thresholds change |
| 12 | Migration | One migration file for schema changes. RPC as separate migration. |

---

## Work Packages

### WP-1: Database Schema + RPC (Worker 1)

**Branch:** `feat/reputation-tags`
**Files:** `supabase/migrations/`, `src/types/database.ts`

1. **Migration: `member_tags` table**
   ```sql
   member_tags (
     id uuid PK,
     competition_id uuid FK → competitions,
     user_id uuid FK → users,
     round_id uuid FK → rounds (nullable — event tags may not have a round),
     event_id uuid FK → events (nullable — only for event-driven tags),
     tag_name text NOT NULL,
     tag_variant text (nullable — for edgier variant, phase 2),
     tag_category text CHECK (behavioural | event_driven | engagement_pressure),
     stats jsonb NOT NULL DEFAULT '{}',
     status text CHECK (pending | active | rejected | suppressed | expired) DEFAULT 'pending',
     assigned_at timestamptz DEFAULT now(),
     published_at timestamptz,
     rejected_at timestamptz,
     suppressed_by uuid FK → users (nullable),
     suppressed_at timestamptz,
     UNIQUE(competition_id, user_id, round_id, tag_name)
   )
   ```
   - RLS: members can read tags for their competition. Only service-role writes.
   - Index on `(competition_id, status)` for active tag queries.

2. **Migration: expand `chat_messages` constraint**
   - Add `system_tag_reveal`, `system_tag_change`, `system_tag_reject`, `system_round_summary` to `message_type` CHECK.
   - Allow `user_id IS NULL` for `system_tag_reveal`, `system_tag_change`, `system_round_summary` (system-generated, no sender).
   - Add `metadata jsonb` column if not present (for structured tag data in chat messages).

3. **RPC: `compute_behavioural_tags(p_competition_id, p_round_id)`**
   Computes all tag metrics per member for a given competition + round:
   - `contrarian_pct` — % of picks that went against majority
   - `majority_pct` — % of picks with majority
   - `avg_total_goals` — average predicted total goals across scorelines
   - `draws_predicted` — count of draw predictions
   - `repeat_score_count` + `most_repeated_score` — most-used scoreline
   - `unique_scores_used` — distinct scoreline count
   - `blowout_count` — predictions with ABS(home-away) ≥ 3
   - `prediction_changes` — count of prediction updates
   - `avg_submission_offset` — average time before lock (seconds)
   - `engagement_rate` — fixtures predicted / fixtures available
   - `accuracy` — correct predictions / total predictions
   - `contrarian_accuracy` — accuracy on minority picks only
   - `leaderboard_position` — current rank
   - `points_gap_to_first` — points behind leader
   - `remaining_max_points` — theoretical max remaining

   Returns one row per member with all metrics. The API route applies tag assignment logic (priority tiers, density control, z-scores) in TypeScript.

4. **RPC: `compute_event_tags(p_competition_id, p_event_id)`**
   Checks event-driven tag conditions for a single confirmed event:
   - Exact score matches (Nailed It, Crystal Ball, Clean Sheet)
   - Streak tracking (On a Roll, Cold Streak)
   - Upset detection (Giant Killer — winner picked by <25% of group)
   - Window-level aggregates (Perfect Window, Hat Trick, Heartbreaker)
   - Timing (Last Gasp — submitted <10min before lock + exact score)
   - Firsts (First Blood — first exact score in competition)
   - Position shifts (The Reverse — last to top-half in one window)

5. **Update `src/types/database.ts`** with `MemberTag` type.

### WP-2: Tag Assignment Engine (Worker 2)

**Branch:** `feat/reputation-tags`
**Files:** `src/lib/reputation/`

1. **`src/lib/reputation/tag-catalogue.ts`**
   - Full catalogue of all tags with metadata: name, category, metric, threshold logic, priority tier, copy layers (Layer 1/2/3), data fact card templates, visual treatment (border color, opacity, etc.)
   - Phase 1 safe copy only — no edgier variants.

2. **`src/lib/reputation/assign-behavioural.ts`**
   - Takes RPC output (metrics per member), returns tag assignments.
   - Priority tier resolution (Maverick > Anorak > individual > Dead Centre).
   - Z-score tiebreaker within individual tier.
   - Density control: target 20–40%, hard cap 50%.
   - Engagement pressure tags (Ghost, NPT) assigned independently of density cap.
   - Returns `{ userId, tagName, stats, category }[]`.

3. **`src/lib/reputation/assign-event-driven.ts`**
   - Takes event RPC output, returns moment tag assignments.
   - One-time-only enforcement (First Blood, The Whistle).
   - Streak state management (On a Roll, Cold Streak).
   - No density cap for event-driven tags (they're rare by nature).

4. **`src/lib/reputation/publish.ts`**
   - Writes `member_tags` rows with `status: 'pending'` (behavioural) or `status: 'active'` (event-driven).
   - Expires previous window's behavioural tags (`status: 'expired'`).
   - Sends admin preview notification for pending tags.
   - Schedules auto-publish (or: a lightweight cron/setTimeout that flips pending → active after preview window).

5. **Integration: hook into `/api/admin/confirm-result`**
   - After scoring: call `compute_behavioural_tags` RPC, run assignment, write tags.
   - For event-driven: call `compute_event_tags` RPC, assign, publish immediately.
   - Fire chat messages for published tags.

### WP-3: Tag UI — Dashboard + Leaderboard (Worker 3)

**Branch:** `feat/reputation-tags`
**Files:** `src/components/wc/`, `src/app/wc/home/`

1. **`src/components/wc/TagCard.tsx`**
   - PersonaCallout variant with amber left border (gold for Maverick/Anorak).
   - Renders Layer 1 (tag name, uppercase, Inter 800) + Layer 2 (subtitle, Instrument Serif italic) + stat (JetBrains Mono, amber).
   - Accept/Reject CTA buttons. Accept = dismiss card + fire chat message. Reject = dismiss + fire rejection chat message. Framing: "Wear it?" / "Not for me" (NOT "accept/reject" — both result in a chat message, both acknowledge the tag exists).
   - Ghost card: reduced opacity, no CTA.

2. **Dashboard integration (SocialSection or new TagSection)**
   - Fetch active tag for current user.
   - Render TagCard if tag exists.
   - Dismissable — once accepted/rejected, card disappears for that window.

3. **Leaderboard profile tag badge**
   - Small tag name badge next to display name on leaderboard rows.
   - Gold treatment for Maverick/Anorak.
   - Ghost: opacity treatment.
   - Tappable → expands to full tag card with Layer 2 + stat.

### WP-4: Chat Integration — Tag Messages + Result Scores (Worker 4)

**Branch:** `feat/reputation-tags`
**Files:** `src/components/chat/`, `src/app/api/chat/`

1. **`src/components/chat/TagRevealCard.tsx`**
   - Structured data fact card rendered inside ChatMessage for `system_tag_reveal`.
   - Reads from `metadata` JSONB on the chat message.
   - Layout: tag name (Inter 800 uppercase) → display name → fact line (Instrument Serif italic) → stat (JetBrains Mono, amber) → group context (Inter 400, secondary).
   - Amber left border (gold for Maverick/Anorak).

2. **Update `ChatMessage.tsx` rendering**
   - Switch on `message_type` for new types:
     - `system_tag_reveal` → render TagRevealCard
     - `system_tag_change` → styled system message with old→new tag narrative
     - `system_tag_reject` → styled one-liner from rejection pool
     - `system_round_summary` → structured round stats block
   - For `system_result`: include actual score in message text (fix: currently says "result confirmed" without score — add the 4 characters).

3. **API: tag chat message insertion**
   - `src/lib/reputation/chat-messages.ts`
   - Functions to insert `system_tag_reveal`, `system_tag_change`, `system_tag_reject` messages with proper metadata JSONB.
   - Uses service-role client (system-generated messages, no natural sender).

### WP-5: Confidence Flip Card (Worker 5)

**Branch:** `feat/reputation-tags`
**Files:** `src/components/wc/CommunityPicksCard.tsx`, `src/components/wc/ConfidenceAccordion.tsx`

1. **Remove confidence accordion from matchday picks view**
   - The current accordion underneath community picks bar chart is removed.

2. **Add flip-card to CommunityPicksCard**
   - Front: existing 3-option bar chart (Team A / Draw / Team B).
   - Back: 5-level confidence breakdown showing distribution across Hopeful→Dead Cert + "No vote" count.
   - "No vote" rendered as a small top-right indicator (not a full bar).
   - Flip trigger: tap/click anywhere on the card or a small flip icon.

3. **Consult UI agents on flip-card UX**
   - How to render 5 confidence levels + no-vote compactly.
   - Color coding improvement (current is poor per user feedback).
   - Mobile touch targets for flip interaction.

### WP-6: Admin Suppression + Preview (Worker 6)

**Branch:** `feat/reputation-tags`
**Files:** `src/app/admin/`, `src/app/api/admin/`

1. **Admin participants section: tag preview**
   - Show pending tags next to member names.
   - "Suppress" action button per tag.
   - Calls API to set `status: 'suppressed'`, `suppressed_by`.

2. **Admin notification**
   - Push notification when behavioural tags are computed: "X new tags pending for [Competition Name]. Review before they go live."
   - Link to admin participants page.

3. **Auto-publish mechanism**
   - After preview window (6hrs default), pending tags → active.
   - Fire chat messages for newly published tags.
   - Options: Supabase cron (pg_cron) or check-on-access pattern.

---

## Dependency Graph

```
WP-1 (Schema + RPC)
  ├── WP-2 (Assignment Engine) ── depends on WP-1
  │     ├── WP-3 (Tag UI) ── depends on WP-2 types
  │     ├── WP-4 (Chat Integration) ── depends on WP-2 publish
  │     └── WP-6 (Admin Suppression) ── depends on WP-2 publish
  └── WP-5 (Confidence Flip Card) ── independent, only needs WP-1 migration
```

**Parallelizable after WP-1 completes:**
- WP-2 must complete before WP-3, WP-4, WP-6
- WP-5 is fully independent
- WP-3, WP-4, WP-6 can run in parallel after WP-2

**Recommended execution order:**
1. WP-1 (schema) → sequential, foundational
2. WP-2 (engine) + WP-5 (flip card) → parallel
3. WP-3 (tag UI) + WP-4 (chat) + WP-6 (admin) → parallel after WP-2

---

## Acceptance Criteria

- [ ] All behavioural tags compute correctly after result confirmation via RPC
- [ ] Event-driven tags fire immediately on result confirmation
- [ ] Tags display on dashboard (TagCard with accept/reject CTA)
- [ ] Tags display on leaderboard profile rows (badge + expandable card)
- [ ] Rejection fires chat message (one-liner from pool)
- [ ] Accept fires chat message (tag reveal announcement)
- [ ] Tag reveal messages in chat include Data Fact Card
- [ ] Tag change narratives appear in chat when tags shift between windows
- [ ] Admin can suppress pending tags from participants section
- [ ] Admin receives notification 6hrs before tags publish
- [ ] Ghost renders at reduced opacity, no rejection CTA, no chat announcement
- [ ] NPT has chat announcement, no rejection CTA
- [ ] Density stays within 20–40% target (50% hard cap)
- [ ] Result system messages include actual score
- [ ] Community picks card flips to show confidence breakdown
- [ ] Confidence accordion removed from matchday view
- [ ] Manual testing on live app (both features end-to-end)
