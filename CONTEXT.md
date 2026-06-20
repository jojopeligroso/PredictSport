# Domain Glossary

This file is a glossary only. No implementation details, no specs, no decisions.
When a term here conflicts with how you're using it, stop and resolve the conflict first.

---

## Competition

An admin-defined prediction contest. Contains rounds, has a lifecycle (draft → active → completed → archived), and has members with roles.

---

## Round

An admin-defined grouping of events within a competition. Rounds can mix sports. A round has an authoring lifecycle: `draft → open → locked → scored`. The lifecycle is about admin authoring, not about user prediction availability — predictions are gated per-[[Event]] by that event's `lock_time`, never by `round.status`.

---

## Locked (Round status)

Admin authoring is complete: the round's structure (events, prediction types, points) is frozen as a design artefact. Distinct from "locked for predictions" — individual events in a locked round can still accept predictions until their own `lock_time` passes.

---

## Event

A single fixture or occurrence that participants predict the outcome of. Belongs to a round. Has a sport, lock time, and one or more prediction types configured on it.

---

## Prediction Type

A mechanic through which participants predict an event outcome. Each type is configured as an `EventPredictionType` row with its own points value. Multiple types can exist on one event. The 10 types are: `winner`, `yes_no`, `head_to_head`, `top_n`, `final_standings`, `margin`, `over_under`, `handicap`, `progression`, `exact_score`.

---

## Winner Prediction

A prediction where the participant picks who wins an event from a set of options (or free text). For applicable sports, "Draw" is a valid option when `allow_draw` is enabled.

---

## Draw

A valid match outcome where neither side wins. A valid winner prediction option for sports where draws can occur (soccer, GAA, rugby regular season, etc.), when explicitly enabled by the admin on the event.

---

## Exact Score Prediction

A prediction where the participant predicts the final score of a match in sport-specific format. Always paired with a `winner` prediction on the same event — it cannot exist on an event without `winner`. The participant first picks the winner, then optionally flips the card to predict the exact score.

---

## Score Format

The sport-specific schema used to represent and compare exact scores. Auto-derived from the event's sport. Standard team sports use `{ home, away }` totals. GAA uses `{ home: { goals, points }, away: { goals, points } }`. Position-based sports (F1, horse racing, golf, tennis) do not have a score format and cannot have `exact_score` configured.

---

## Winner Derivation

The automatic process by which a participant's winner prediction is updated to match the result implied by their exact score submission. If the score implies a draw, the winner prediction is updated to "Draw" (requires `allow_draw: true` on the event). The participant is notified inline when this override occurs.

---

## Score Format — GAA

In GAA, a score is expressed as goals and points separately (e.g., 2-14), not as a single aggregate. A goal is worth 3 points in aggregate but is tracked independently. The canonical prediction and result format for GAA is `{ home: { goals, points }, away: { goals, points } }`.

---

## Provider Chain

The ordered sequence of sports data providers queried to fetch fixtures and results for a given sport. First non-null result wins. Providers: OpenF1, API-Football, TheSportsDB, ESPN, BallDontLie, MLB Stats, TheRacingAPI, Foireann, Manual. After the primary provider returns a final result, cross-validation walks the remaining chain to verify the score against a second provider (see ADR 0019).
_Avoid_: API chain, fallback chain

---

## NormalizedResult

The canonical output shape of the provider chain. All providers normalise their API responses into this shape. Includes `score` (home/away totals), `positions` (for position-based sports), `winner`, `margin`, and `stats` (sport-specific breakdown, e.g., GAA goals/points).

---

## Manual Event

An event with no sports data provider coverage. Result and score must be entered by the admin at confirmation time. Covers local GAA clubs, niche competitions, and any event where the provider chain returns null.

---

## All-Competitions Dashboard

A cross-competition summary surface on `/competitions` that answers "how am I doing" across every competition a participant belongs to. Shows performance/standing per competition, with a conditional action prompt when a prediction is genuinely due. Not a per-competition leaderboard and not the personal predictions stats page.

---

## Standing

A participant's position and accumulated points within a single competition, derived from the `points_awarded` on their predictions. Always computed live by the leaderboard from prediction rows — there is no authoritative stored standing.

---

## Standings Cache

A best-effort, non-authoritative stored copy of competition standings (`competition_standings`), written after results are confirmed, carrying an `updated_at`. Read for speed by the All-Competitions Dashboard. The live leaderboard remains the source of truth; a missing or stale cache row triggers a live recompute, so the cache is never silently wrong.

---

## Global Hit Rate

A participant's aggregate prediction accuracy across all their competitions (group and personal combined) — distinct from the personal-predictions hit rate, which covers only the personal competition.

---

## Super Administrator

A platform-level role responsible for canonical tournament truth: confirming official fixture results, finalising windows/stages, maintaining tournament templates. Operates across all Prediction Games that share a tournament. Terminal-primary user — the surface can be extremely utilitarian (CLI-like). See ADR 0005.

---

## Competition Admin

The owner of a single Prediction Game. Their surface is deliberately minimal: league settings and member management across two dedicated pages. Cannot confirm official results, alter fixtures, or edit round/event structure (those are [[Super Administrator]] actions). Mobile-first, non-technical user — picks from presets, never authors from scratch.

---

## Global Classification

A platform-wide leaderboard across all users on the /wc surface, regardless of which private league they belong to. Same scores as league standings, just a wider ranking pool. Only activates once the platform exceeds 2,000 users to avoid a sparse leaderboard. Users who have opted out of visibility appear anonymised. Phase 2 — deferred.

---

## Privacy Mode

The access control setting for a competition. Three modes: **Open** (discoverable, instant join), **Link-only** (need the invite link, link = instant join), **Approval** (need the invite link, admin approves from queue). No email gating in any mode — the link is the invitation. Email allowlists deferred to phase 2 as an optional layer on top of Approval mode.

---

## Treasurer

A distinct member role within a competition, nominated by the [[Competition Admin]]. Responsible for tracking entry fee payments. Can mark members as paid/unpaid but has no other admin powers. Admin can hold the treasurer role themselves. Only available for competitions with 96 or fewer members. Phase 2 — deferred.

---

## Preset

A pre-built, ready-to-use bundle of rounds, events, and prediction-type configuration that a [[Competition Admin]] selects to set up their Prediction Game without authoring anything from scratch. Presets are authored by the [[Super Administrator]] and intentionally limited in variation.

---

## Dashboard State

A UI-level concept, never stored in the database. Computed from the user's auth session, bracket submission status, and [[Classification]] membership statuses to determine which dashboard layout the `/wc` surface shows. The states are: `visitor`, `bracket`, `format`, `overall`, and `archive`. No table, no column — a pure function of existing data.

---

## Stage

A phase of the tournament after which Format elimination occurs. During the group stage, all three matchdays form a single stage — elimination happens after Matchday 3, not after each matchday. During knockouts, each round is its own stage (Round of 32, Round of 16, Quarter-finals, Semi-finals, Final). The Final stage includes the third-place match — one prediction window, two fixtures. User-facing label is always lowercase "stage" with no qualifier. "Sporting Stage" is not used.

---

## Matchday

User-facing label for a prediction window during the World Cup group stage. Maps to a `rounds` row in the database. "Matchday 1", "Matchday 2", "Matchday 3". During knockout stages, the user-facing label switches to the stage name: "Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Final". The spec/admin term "Prediction Window" and the DB term "Round" are never shown to users on the `/wc` surface. Outside the WC surface, "Round" is the default user-facing label.

---

## Display Name

The user-chosen name shown on leaderboards, standings, and to other participants. One per user. Required before any write action (predictions, competition joins, admin actions). Super-admins are exempt from the requirement. Setting a display name for the first time and the first change are free; all subsequent changes are subject to a 7-day cooldown.

---

## The Cut

The R32 Classification, renamed. Measures how many of the 32 knockout-stage teams the user correctly predicted from their Full Bracket group stage picks. Not path-sensitive — only checks whether each team made the knockouts, regardless of position. Short label: "The Cut". Full title: "Who Made the Cut". No question mark.

---

## Tab Bar

The fixed bottom navigation bar on the `/wc` surface. Four tabs: Home, Picks, Board, Chat. Visible to all engaged (authenticated, competition-joined) users across every `/wc` page. This is the primary navigation for the product. Generic competition routes will adopt the same pattern when built out.
_Avoid_: Bottom nav, navigation bar (ambiguous with the top NavBar)

---

## Competition Chat

A per-competition messaging feature scoped to members of a single [[Competition]]. Async-first — designed for users who dip in and out around their lives, not for synchronous group presence. Messages persist in the database. The [[Competition Admin]] can enable or disable chat; disabling hides the entire chat surface but preserves messages in storage. Lives at `/wc/chat` as a dedicated page; the [[Tab Bar]] Chat tab links there. A notification card on the dashboard shows unread count + last sender when messages are unread (hidden when caught up).
_Avoid_: Group chat, channel, thread

---

## System Message

An auto-generated [[Competition Chat]] message triggered by a competition event. Two types: member joins ("X joined the competition") and result confirmations ("France 2-1 Mexico — result confirmed"). System messages never reveal prediction content — no spoilers. Result confirmation messages count toward the unread badge; join messages do not.
_Avoid_: Bot message, notification

---

## Moderator (Mod)

A [[Competition]] member role between [[Co-Admin]] and [[Participant]] in the role hierarchy (`admin > co_admin > mod > participant`). Mods can delete chat messages from lower-role members (tombstoned as "deleted by mod") and mute [[Participant]]s for 15 minutes. Mods cannot act on other mods or above. Promotion to mod generates a [[System Message]].
_Avoid_: Chat admin, super user

---

## Mute

A 15-minute block preventing a [[Competition]] member from sending [[Competition Chat]] messages. Stored as a `chat_muted_until` timestamp on the membership. Only visible to the muted user ("You're muted for X minutes") when they attempt to send. No system message. Hierarchy-enforced: admins/co-admins can mute anyone below them; mods can mute participants only.
_Avoid_: Ban, silence, timeout

---

## Tombstone

The placeholder displayed in [[Competition Chat]] when a message is deleted after the grace window (20 seconds). Shows "This message was deleted" (user), "This message was deleted by mod" ([[Moderator]]), or "This message was deleted by admin" (admin/co-admin) depending on who deleted it. Messages deleted by their author within the grace window vanish entirely with no trace. Moderation deletions (mod/admin) always leave a tombstone regardless of timing.

---

## @Mention

A reference to a [[Competition]] member within a [[Competition Chat]] message, triggered by typing `@` followed by the member's [[Display Name]]. Renders as a highlighted, tappable name. Generates a push notification to the mentioned member (adjustable in user settings).

---

## Urgent Threshold

The time window before an event's `lock_time` during which unpicked or incomplete predictions trigger visual urgency indicators (pulsing pill, banner). Set to 36 hours. Not the same as "locked" — events remain pickable until `lock_time`, but the UI pressures the user to act within this window.

---

## Prediction Banner

A dismissible notification bar shown on the home dashboard, picks page, and landing page when a user has incomplete predictions for events within the [[Urgent Threshold]]. Displays the lock time in the user's local timezone. Persists until predictions are complete or the user dismisses it. Reappears if new events enter the urgent window.

---

## Open Entry

A temporary or permanent state where a [[Competition]] does not require an invite code to join — any authenticated user can join directly. Controlled by removing the invite-code gate at the join endpoint, not by changing `visibility`. Entry is still bounded by `entry_closes_at` on the competition.

---

## Sanctioned Competition

A [[Competition Instance]] backed by an official [[Tournament Blueprint]] with full API provider coverage. The [[Fixture Catalogue]] is predetermined, results are sourced and cross-validated automatically via the [[Provider Chain]], and the [[Competition Admin]] role is purely ceremonial — they create the competition by selecting a [[Preset]], invite members, and manage chat moderation. No manual result entry, no fixture authoring, no score overrides needed. The World Cup is the canonical example.
_Avoid_: Official competition, managed competition

---

## Custom Competition

A [[Competition Instance]] where the [[Competition Admin]] selects arbitrary sports and events, potentially across leagues with limited or no API provider coverage. The admin has an active operational role: creating fixtures, manually entering results for uncovered events, and overriding results when needed. The admin surface for Custom Competitions requires substantially more capability than for [[Sanctioned Competition]]s.
_Avoid_: Manual competition, user competition

---

## Admin Role Duality

The [[Competition Admin]] role has fundamentally different responsibilities depending on whether the competition is [[Sanctioned Competition|sanctioned]] or [[Custom Competition|custom]]. A sanctioned admin is a social organiser (invite friends, moderate chat). A custom admin is an operational manager (author fixtures, enter results, resolve disputes). The admin UI must serve both without overwhelming the sanctioned admin or under-serving the custom admin. This distinction is unresolved and requires dedicated design work.

---

## Tournament Blueprint

A Factory that produces [[Competition Instance]]s. Encapsulates the [[Fixture Catalogue]], stage topology, [[Classification]] definitions, scoring rule defaults, and bracket shape. Immutable once the tournament is live. A single Blueprint can produce many independent Instances. Stored across `sporting_tournaments`, `sporting_stages`, `bracket_templates`, and seed data.
_Avoid_: Template, configuration, competition (unqualified)

---

## Competition Instance

An independent Aggregate instantiated from a [[Tournament Blueprint]]. Owns its own members, predictions, standings, classification memberships, prediction groups, and chat. Multiple Instances of the same Blueprint run concurrently with no shared mutable state between them. Backed by a `competitions` row.
_Avoid_: Competition (unqualified), game, league

---

## Fixture Catalogue

The complete set of shared reference Entities (fixtures) owned by a [[Tournament Blueprint]]. Exists once regardless of how many [[Competition Instance]]s reference it. Fixtures are never duplicated per Instance. Results confirmed on a fixture are visible to all Instances by shared-state-by-reference (same row, no propagation needed).
_Avoid_: Event list, competition events

---

## Instance Type

The stage scope configuration of a [[Competition Instance]]. Determines which subset of the [[Fixture Catalogue]] the Instance participates in. Current types: `full` (all stages) and `knockout_only` (R32 onwards). Stored in competition config. Fixture queries filter by `tournament_id` + `sporting_stage_id`.
_Avoid_: Competition type, variant

---

## Auto-Provisioning

The fully automatic instantiation of a new [[Competition Instance]] from a [[Tournament Blueprint]] when all active Instances reach their entrant cap. No human approval gate. New Instance starts Active, inherits all Blueprint defaults, Super Administrator is notified. Joining user is placed into the new Instance in a single request.
_Avoid_: Clone, fork, spin-up

---

## Prediction Group

A mini-leaderboard of participants within a [[Format Classification]]. The standard group size is 4. Groups are drawn randomly when the draw window opens and are immutable once drawn — participants are never moved between existing groups. Late entrants are placed into the most recently created group or a new group. Group composition follows modular-4 arithmetic: `N mod 4` determines whether the final group has 0, 1, 2, or 3 remainder participants.
_Avoid_: Team, pod, pool

---

## Remainder

The count of participants (0, 1, 2, or 3) that do not fill a complete [[Prediction Group]] of 4 after dividing the total entrant count by 4. Formally: `N mod 4`. A remainder of 0 is ideal (all groups of 4). A remainder of 3 forms a viable group. A remainder of 1 or 2 produces an [[Undersized Group]] that requires [[Reconciliation]] at lock time. At most 1 group of 3 and at most 2 groups of 5 can exist after reconciliation.
_Avoid_: Dangler, leftover, overflow

---

## Undersized Group

A [[Prediction Group]] with fewer than 3 members at lock time. Not viable for competitive play — both members would auto-qualify with no elimination pressure. Dissolved during [[Reconciliation]]; its members are absorbed into the nearest viable groups.
_Avoid_: Incomplete group, short group

---

## Reconciliation

The automatic, one-time process that runs when the first [[Event]] in the competition locks. Resolves [[Undersized Group]]s by absorbing their members into the nearest viable [[Prediction Group]]s (highest group_number first, preserving earlier groups). A remainder of 1 produces one [[Expanded Group]]. A remainder of 2 produces two Expanded Groups. A remainder of 3 is left as a valid group of 3. Idempotent — stamps `groups_reconciled_at` in the classification config after execution.
_Avoid_: Rebalancing, redistribution, merge

---

## Expanded Group

A [[Prediction Group]] whose size changed from 4 to 5 after absorbing a [[Remainder]] participant during [[Reconciliation]]. Third place in an Expanded Group auto-qualifies for the next stage (instead of entering the best-third pool as in a standard group of 4).
_Avoid_: Oversized group, inflated group

---

## Rival Predictions

The feature surface where participants view other members' predictions for revealed events. Two manifestations: a **dashboard teaser** (group-scoped, single most-recent fixture, one row per [[Prediction Group]] rival) and a **leaderboard tab** (competition-scoped, all members' predictions for one browsable fixture at a time). Predictions are only visible after [[Pick Reveal]] time — never before.
_Avoid_: Community predictions (that term is used for aggregated poll-style data, not per-member views), other people's picks

---

## Pick Reveal

The moment after which other participants' predictions for an [[Event]] become visible. Computed as `pick_reveal_at` if explicitly set by an admin, otherwise `lock_time + 5 minutes`. This gap between lock and reveal prevents last-second gaming — a participant cannot see rivals' predictions immediately after their own submission window closes. Enforced at the database level via RLS on the `predictions` table; no application-level bypass exists.
_Avoid_: Unlock, unspoiler

---

## Result Notification

A two-part signal fired when an [[Event]] result is confirmed (whether by the auto-result cron or manual admin confirmation). Consists of: (1) a [[System Message]] in [[Competition Chat]] with the score ("France 2-1 Mexico — result confirmed"), and (2) a push notification to all [[Competition]] members ("France 2-1 Mexico" / "How did you do? Check your score."). Uses the `result_notifications` push category. Both paths (cron and admin) invoke the same shared notification function.
_Avoid_: Score alert, result update
