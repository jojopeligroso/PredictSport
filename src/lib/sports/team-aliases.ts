/**
 * Canonical team name aliases used across the scoring and auto-result
 * pipelines. Shared module to avoid circular dependencies.
 *
 * Keys MUST be lowercase. Values are the alternate canonical form.
 * applyTeamAliases normalises a string so that different provider
 * spellings (e.g. "Congo DR" vs "DR Congo") compare equal.
 */

export const TEAM_ALIASES: Record<string, string> = {
  "usa": "united states",
  "u.s.a.": "united states",
  "us": "united states",
  "czechia": "czech republic",
  "turkiye": "turkey",
  "türkiye": "turkey",
  "curacao": "curaçao",
  "curaçao": "curacao",
  "bosnia & herzegovina": "bosnia herzegovina",
  "bosnia and herzegovina": "bosnia herzegovina",
  "bosnia-herzegovina": "bosnia herzegovina",
  "dr congo": "congo dr",
  "congo dr": "dr congo",
  "ivory coast": "cote divoire",
  "cote d'ivoire": "ivory coast",
  "côte d'ivoire": "ivory coast",
  "korea republic": "south korea",
  "republic of korea": "south korea",
  "iran": "ir iran",
  "ir iran": "iran",
};

/** Strip diacritics (é→e, ü→u, ç→c etc.) for uniform comparison. */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Apply team name aliases to a lowercased string. Used before
 * tokenization (Jaccard search) and before team name comparison
 * (penalty tiebreaker scoring).
 */
export function applyTeamAliases(s: string): string {
  let result = s;
  for (const [alias, canonical] of Object.entries(TEAM_ALIASES)) {
    const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    result = result.replace(pattern, canonical);
  }
  return result;
}

/**
 * Normalise a team name for comparison: lowercase, strip diacritics,
 * then apply team aliases so provider variants resolve to the same form.
 */
export function normalizeTeamName(val: unknown): string {
  const s = stripDiacritics(String(val ?? "").trim().toLowerCase());
  return applyTeamAliases(s);
}
