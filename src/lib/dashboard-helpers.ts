/**
 * Pure helpers extracted from the dashboard for testability.
 */

export interface PredictionRow {
  event_id: string;
  events: { round_id: string | null };
}

export interface RoundRow {
  id: string;
  competition_id: string;
  name: string;
  round_number: number;
  status: string;
}

/**
 * Count unique events picked per round from raw prediction rows.
 * Each event can have multiple prediction rows (e.g. winner + exact_score),
 * but we count "matches picked", not "rows written".
 */
export function computePickCounts(
  preds: PredictionRow[],
): Record<string, number> {
  const eventsByRound = new Map<string, Set<string>>();
  for (const p of preds) {
    const rid = p.events?.round_id;
    if (!rid || !p.event_id) continue;
    let set = eventsByRound.get(rid);
    if (!set) {
      set = new Set<string>();
      eventsByRound.set(rid, set);
    }
    set.add(p.event_id);
  }
  const counts: Record<string, number> = {};
  for (const [rid, set] of eventsByRound) {
    counts[rid] = set.size;
  }
  return counts;
}

/**
 * Find the active round for a competition — the earliest (lowest round_number)
 * open or locked round.
 */
export function findActiveRound(
  rounds: RoundRow[],
  competitionId: string,
): RoundRow | undefined {
  return rounds
    .filter((r) => r.competition_id === competitionId)
    .sort((a, b) => a.round_number - b.round_number)[0];
}
