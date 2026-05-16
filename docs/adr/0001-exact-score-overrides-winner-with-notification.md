# ADR 0001: Exact score submission overrides winner prediction with inline notification

**Status:** Accepted
**Date:** 2026-05-16

## Context

When a participant submits an exact score prediction that contradicts their current winner pick (e.g., they picked "Home wins" but enter "1–1"), the system must reconcile the two. The exact score is the more specific prediction and implies a winner, so the winner prediction must be updated to stay consistent.

Two approaches were considered:

**Option B — Silent override with notification:** The winner prediction is automatically updated to match the score. An inline notification confirms the change ("Your winner pick has been updated to Draw"). No user action required.

**Option D — Confirmation prompt:** Before updating, the system surfaces a prompt: "This score means Away wins, but you picked Home. Update your winner pick?" The user must explicitly confirm.

## Decision

**Option B** — silent override with inline notification.

## Rationale

The exact score is always the more specific prediction. A score of "2–1" unambiguously means Home wins; there is no scenario where a user intends a contradiction. An inline notification provides sufficient transparency without adding friction to a casual prediction flow.

A confirmation prompt (Option D) was seriously considered and may serve better in future — particularly for high-stakes competitions where an accidental card flip could silently change a deliberate winner pick. If user research shows confusion, revisit Option D.

## Consequences

- Participants cannot hold contradictory winner and exact score predictions.
- The winner prediction row is updated server-side when an exact score is submitted that implies a different winner.
- The front of the prediction card always reflects the current derived winner (not the original manual pick) once a score is submitted.
- If the system ever adds high-stakes or locked-review flows, reconsider whether a confirmation prompt is more appropriate there.
