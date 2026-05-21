/**
 * FIFA tiebreaker rules for World Cup group stage
 *
 * Based on FIFA World Cup regulations:
 * https://digitalhub.fifa.com/m/6f7f00a0f67b70a3/original/FIFA-World-Cup-2026-Regulations.pdf
 *
 * Tiebreaker hierarchy:
 * 1. Head-to-head points (for 3+ teams)
 * 2. Head-to-head goal difference (for 3+ teams)
 * 3. Head-to-head goals scored (for 3+ teams)
 * 4. Overall goal difference
 * 5. Overall goals scored
 * 6. Fair play score (Phase 2 - requires card tracking)
 * 7. FIFA ranking (Phase 2 - requires ranking dataset)
 * 8. Random (Phase 1 fallback)
 */

import { TiebreakerRule } from '../types'

export const FIFA_TIEBREAKERS: TiebreakerRule[] = [
  {
    type: 'head_to_head_points',
  },
  {
    type: 'head_to_head_gd',
  },
  {
    type: 'head_to_head_gs',
  },
  {
    type: 'overall_gd',
  },
  {
    type: 'overall_gs',
  },
  {
    type: 'random',
    config: {
      uiMessage:
        '⚠️ Your predictions created an exact tie. FIFA would use fair play scores to decide this, but for now we've randomly placed teams. Phase 2 will add fair play tracking.\n\n💡 Tip: Predict different scores to avoid ties in your bracket!',
    },
  },
]

/**
 * FIFA tiebreaker labels for UI display
 */
export const FIFA_TIEBREAKER_LABELS: Record<string, string> = {
  head_to_head_points: 'Head-to-head points',
  head_to_head_gd: 'Head-to-head goal difference',
  head_to_head_gs: 'Head-to-head goals scored',
  overall_gd: 'Overall goal difference',
  overall_gs: 'Overall goals scored',
  fair_play: 'Fair play score (yellow/red cards)',
  ranking: 'FIFA world ranking',
  random: 'Random selection',
}
