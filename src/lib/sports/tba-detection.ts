/**
 * Detects TBA/TBC (To Be Announced/Confirmed) participants in fixture data.
 * Used to prevent predictions on fixtures with unknown participants.
 */

const TBA_PATTERNS = [
  "tba",
  "tbc",
  "tbd",
  "to be announced",
  "to be confirmed",
  "to be determined",
];

/**
 * Returns true if any participant name is a TBA/TBC placeholder or empty.
 */
export function hasTBAParticipant(participants: string[]): boolean {
  return participants.some(
    (p) => !p.trim() || TBA_PATTERNS.includes(p.trim().toLowerCase())
  );
}
