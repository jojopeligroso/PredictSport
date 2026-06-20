/**
 * Deterministic verdict quips for post-match payoff messages.
 *
 * Each result state has a pool of quips. The seed (typically event ID or
 * event name) is hashed to a stable index so every render shows the same
 * quip for the same fixture.
 */

export type VerdictState = "correct" | "wrong" | "partial" | "exact";

const POOLS: Record<VerdictState, readonly string[]> = {
  correct: [
    "Well played \u2014 banker landed.",
    "Called it. Easy money.",
    "Nailed it. Take a bow.",
    "Right on the money.",
    "Clean as you like.",
  ],
  wrong: [
    "Ah sure look \u2014 that one got away.",
    "Swing and a miss. It happens.",
    "That\u2019s one for the bin.",
    "Not your finest hour.",
    "Better luck next time.",
  ],
  partial: [
    "Half marks \u2014 right idea, soft execution.",
    "Close enough. Take what you can get.",
    "Near enough is good enough.",
    "Right track, wrong carriage.",
    "Almost had it.",
  ],
  exact: [
    "Exact score. You absolute wizard.",
    "Jackpot. Nailed it to the last digit.",
    "Surgeon\u2019s precision. Fair play.",
    "Perfection. Nothing else to say.",
    "Dead cert delivered. Take a bow.",
  ],
};

/**
 * Simple string hash that produces a stable positive integer for seeding.
 * Not cryptographic \u2014 just needs to be deterministic and well-distributed.
 */
function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Return a deterministic verdict quip for the given result state.
 *
 * @param state  - "correct" | "wrong" | "partial" | "exact"
 * @param seed   - A stable string per event (event ID, event name, etc.)
 */
export function getVerdict(state: VerdictState, seed: string): string {
  const pool = POOLS[state];
  return pool[stableHash(seed) % pool.length]!;
}
