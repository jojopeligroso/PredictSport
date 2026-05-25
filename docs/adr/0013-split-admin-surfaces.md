# ADR 0013: Split Admin Surfaces by Role

**Status:** Accepted
**Date:** 2026-05-25

## Context

The existing admin UI is a single 10-tab panel (Events, Confirm Results, Add Event, Nominations, Windows, Standings, Finalise, Members, Settings) that serves both the Super Administrator and Competition Admin roles. Both roles see the same surface, with feature-level guards controlling what each can do.

The Super Administrator is a single platform operator (terminal-primary, technical) responsible for tournament truth: fixtures, results, round management, scoring. The Competition Admin is a non-technical, mobile-first user who owns a private league and needs only lightweight member and settings management.

## Decision

Split into two completely separate admin surfaces:

**Super Administrator surface:** The existing admin UI, kept as-is. Terminal-like, utilitarian, dense. Accessed only by the platform operator. Redesign deferred — it works and has one user.

**Competition Admin surface:** Two new pages replacing the tab bar for league owners:
1. **Settings page** — league identity, privacy mode, size cap, entry deadline, standings visibility, classification toggles, transfer ownership.
2. **Members page** — member list with count vs cap, invite flow (link + QR + native share), pending approval queue, overflow menu per member (promote/demote co-admin, kick).

Entry points: gear icon (Settings) and member count pill (Members) on the competition header, visible only to admin/co-admin roles. No tab bar, no ADMIN badge.

## Alternatives Considered

1. **Single unified admin with progressive disclosure** — hide tabs based on role. Rejected: still exposes the wrong mental model to Competition Admins. They don't need tabs at all.
2. **Settings drawer / bottom sheet** — fewer surfaces. Rejected: member management can involve 96+ members; needs a full page.

## Consequences

- Competition Admins get a dramatically simpler experience with no exposure to tournament-level concepts.
- Super Administrator surface can evolve independently toward a CLI-like density without worrying about non-technical users.
- Two codepaths to maintain, but they share almost no UI components — the overlap was already minimal.
