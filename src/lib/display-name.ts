/**
 * Shared display-name utilities.
 *
 * Single source of truth for how user names are resolved, rendered as
 * initials, and validated. Every component/API route that shows a user
 * name should use these rather than rolling ad-hoc fallback logic.
 */

/** Fallback when display_name is empty or missing. */
const FALLBACK_NAME = "Unknown";

/**
 * Resolve a display name to a guaranteed non-empty string.
 *
 * Returns the trimmed name if non-empty, otherwise falls back through
 * the provided alternatives or the static fallback.
 */
export function resolveDisplayName(
  ...candidates: (string | null | undefined)[]
): string {
  for (const c of candidates) {
    const trimmed = c?.trim();
    if (trimmed) return trimmed;
  }
  return FALLBACK_NAME;
}

/**
 * Extract 1-2 letter initials from a display name.
 *
 * - "Eoin Malone"  → "EM"
 * - "The Oracle"   → "TO"
 * - "malonemi"     → "MA"
 * - "" / null      → "?"
 */
export function getInitials(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/** Minimum / maximum length for display_name. */
export const DISPLAY_NAME_MIN = 1;
export const DISPLAY_NAME_MAX = 50;

/**
 * Validate a candidate display name.
 * Returns null if valid, or an error message string.
 */
export function validateDisplayName(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < DISPLAY_NAME_MIN) {
    return "display_name.error_empty";
  }
  if (trimmed.length > DISPLAY_NAME_MAX) {
    return "display_name.error_too_long";
  }
  return null;
}
