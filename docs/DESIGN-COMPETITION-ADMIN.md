# Design Brief: Competition Admin Surface

**Date:** 2026-05-25
**ADR:** 0013-split-admin-surfaces.md
**Scope:** Phase 1 — /wc Competition Admin only

---

## Overview

The Competition Admin surface replaces the existing 10-tab admin panel for league owners. Two separate pages accessed via subtle entry points on the competition header. No tab bar, no ADMIN badge.

---

## Entry Points

- **Gear icon** on competition header → Settings page
- **Member count pill** (e.g., "12 / 48") on competition header → Members page
- Both visible only to admin and co-admin roles

---

## Settings Page

Single scrollable page with collapsible sections.

### League Identity
- **League name** — text input
- **Description / tagline** — text input
- **Privacy mode** — segmented toggle: Open / Link-only / Approval
  - Open: discoverable, instant join
  - Link-only: need invite link, link = instant join
  - Approval: need invite link, admin approves from queue

### Entry
- **League size cap** — number stepper
- **Entry deadline** — date picker
  - Helper text: "Auto-closes when Matchday 1 locks if not set earlier"
  - Admin can only set it *before* prediction window 1, not after

### Standings
- **Standings visibility** — toggle: Public / Members-only
  - Helper text: "Members-only leagues are hidden from non-member profiles"
- **Show/hide classifications** — toggle per classification

### Sharing
- **Social share card** — preview of OG card (league name, member count, CTA)
- **Shareable standings snapshot** — button to generate PNG image
  - Shows all members, no filtering
  - Members who opted out of visibility are anonymised ("Player 3" etc.)

### Danger Zone *(collapsed by default)*
- **Transfer ownership** — select a member, confirm

---

## Members Page

Dedicated full page.

### Header
- **Member count** — "12 / 48 members" (current vs cap)
- **Invite button** — opens invite sheet

### Invite Sheet (modal or bottom sheet)
- **Invite link** — displayed truncated, Copy button
- **QR code** — auto-generated from invite link
- **Share buttons** — native share sheet on mobile; explicit WhatsApp / Copy on desktop

### Pending Requests *(only visible in Approval mode when requests exist)*
- List of pending users with Approve / Reject actions per row

### Member List
- Each row: avatar, display name, role badge (Admin / Co-admin / Member)
- **Overflow menu** (three dots) per row:
  - Promote to co-admin
  - Demote to member
  - Kick from league
- Admin's own row has no overflow menu

---

## User Visibility Opt-Out

- Users opt out of shared standings visibility during onboarding
- Default: visible (opt-out, not opt-in)
- Opted-out users appear anonymised on exported standings snapshots
- No effect within the league itself — all members see all members

---

## Phase 2 Deferred

- League avatar / colour accent
- Scoring preset variants
- Tiebreaker rule selection
- House rules text
- Communication (announcements, pinned messages, notifications)
- Stakes tracking + Treasurer role (96-member cap)
- Global Classification (platform-wide leaderboard, >2k users, same scores)
- Email allowlists (layer on Approval mode)
- Public user profiles
- Pause / archive / delete league on /wc
- Custom classifications (side-bets, admin-defined groups)
- Super Admin surface redesign (terminal-like density)
