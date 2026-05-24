---
Status: accepted
---

# Per-classification display visibility (anon on public leaderboard)

## Context

The shell hosts exactly one World Cup Prediction Game (ADR 0006, SPEC §16.9).
Every member is enrolled in all five classifications: Overall, Format, Full
Bracket, Knockout Bracket, Last 32. The public leaderboard therefore exposes
each member's `users.display_name` against their points in all five.

Some users want to compete fully but not appear by name on the public board —
either because they're a known administrator and don't want to skew the
social dynamic, or because they'd rather lurk. They still want to:

- earn points and movement
- see their own real name + rank when signed in
- have their friends not see them on public standings

Format is a special case: it is the survival-ladder classification with
algorithmically-allocated Prediction Groups (SPEC §16.8). Anonymity there
defeats the social structure that makes the format work — you have to be able
to see who you're surviving against.

## Decision

Add a per-(user, classification) `display_visibility` flag to
`classification_memberships`. Default `public`. When `private` and the viewer
is not the entrant themselves, the standings layer substitutes a stable
**Mystery {Animal}** pseudonym for the display name. The Format classification
ignores the flag — always public.

The pseudonym is generated and stored at write time on the same row, not
derived at query time. This locks the pseudonym to the user for the duration
of the competition; toggling public → private → public yields the same handle.

Switching is **retroactive**: snapshots produced before the toggle still render
through the same substitution path on read, so flipping to private hides the
user across all historical and live views simultaneously. There is no
"forward-only" mode — the moment-of-switch would otherwise be trivially
deducible.

## Considered Options

- **Per-competition flag on `competition_members`** — rejected: user said
  explicitly they want per-classification granularity ("public in Overall,
  private in Full Bracket"). Cheaper but loses that.
- **Pseudonym derived at query time from `hash(user_id||classification_id)`**
  — rejected: the curated animal word list is expected to grow, which would
  retroactively rename existing pseudonyms. Storing the chosen handle is
  durable.
- **Forward-only visibility (past snapshots keep real name)** — rejected: the
  switch creates an obvious before/after pair in stage-over-stage views,
  defeating the privacy promise.
- **Cryptographic anonymity** — out of scope: this is presentational
  pseudonymity, not unlinkability. Friends asking "are you Mystery Otter?"
  is not in the threat model; the doc calls this out.

## Consequences

- **Format integrity preserved.** The Format leaderboard and Prediction Group
  views always render real names; the substitution helper takes the
  classification's `classification_type` and short-circuits on
  `format_elimination`.
- **Single substitution chokepoint.** Both the live-computed path and the
  cached/snapshot path in `/api/tournament/standings` must run rows through
  one `applyVisibility()` helper. The helper is the only place that knows
  about pseudonyms — adding a sixth classification later inherits the
  behaviour for free.
- **Pseudonyms survive opt-out cycles.** Because the handle is written once
  and reused, a user who toggles off and back on returns as the same Mystery
  Otter, not a new animal. This matches the user mental model (privacy as a
  curtain, not a costume change).
- **Self-view is unaffected.** The standings UI already special-cases
  `user_id === currentUserId` for the "YOU" chip; the substitution helper
  respects that and returns the real name to self.
- **Toggle is an inline `/wc/leaderboard` affordance**, not a settings page.
  This fits the "no dedicated settings UI" instinct and keeps the toggle
  next to the thing it affects.
- **Animal list versioning is a non-issue.** Because pseudonyms are
  persisted, a later expansion of the curated word list only affects users
  who toggle private for the first time after the change. Existing Mystery
  Otters stay Mystery Otters.
