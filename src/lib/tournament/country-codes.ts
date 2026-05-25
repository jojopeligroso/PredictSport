/**
 * Country code lookup for WC 2026 nations.
 *
 * Maps team display names (as they appear in event_name strings and
 * BracketWizard data) to ISO 3166-1 alpha-2 codes. Returns `null` for
 * TBD/playoff placeholders and any unrecognised name.
 *
 * Codes are lowercase to match flagcdn.com URLs directly:
 *   https://flagcdn.com/<code>.svg
 *
 * England and Scotland use ISO 3166-2 subdivision codes (gb-eng, gb-sct)
 * — flagcdn supports these and renders the St George / Saltire crosses
 * rather than the Union Jack.
 */

const COUNTRY_CODES: Record<string, string> = {
  // UEFA (16)
  austria: 'at',
  belgium: 'be',
  'bosnia and herzegovina': 'ba',
  'bosnia & herzegovina': 'ba',
  bosnia: 'ba',
  croatia: 'hr',
  'czech republic': 'cz',
  czechia: 'cz',
  england: 'gb-eng',
  france: 'fr',
  germany: 'de',
  netherlands: 'nl',
  holland: 'nl',
  norway: 'no',
  portugal: 'pt',
  scotland: 'gb-sct',
  spain: 'es',
  sweden: 'se',
  switzerland: 'ch',
  turkey: 'tr',
  turkiye: 'tr',
  türkiye: 'tr',

  // AFC (9)
  australia: 'au',
  iran: 'ir',
  iraq: 'iq',
  japan: 'jp',
  jordan: 'jo',
  qatar: 'qa',
  'saudi arabia': 'sa',
  'south korea': 'kr',
  korea: 'kr',
  'korea republic': 'kr',
  uzbekistan: 'uz',

  // CAF (10)
  algeria: 'dz',
  'cape verde': 'cv',
  'cabo verde': 'cv',
  'dr congo': 'cd',
  'democratic republic of congo': 'cd',
  'democratic republic of the congo': 'cd',
  egypt: 'eg',
  ghana: 'gh',
  'ivory coast': 'ci',
  "cote d'ivoire": 'ci',
  "côte d'ivoire": 'ci',
  morocco: 'ma',
  senegal: 'sn',
  'south africa': 'za',
  tunisia: 'tn',

  // CONCACAF (6)
  canada: 'ca',
  'curacao': 'cw',
  'curaçao': 'cw',
  haiti: 'ht',
  mexico: 'mx',
  panama: 'pa',
  'united states': 'us',
  usa: 'us',
  'united states of america': 'us',

  // CONMEBOL (6)
  argentina: 'ar',
  brazil: 'br',
  colombia: 'co',
  ecuador: 'ec',
  paraguay: 'py',
  uruguay: 'uy',

  // OFC (1)
  'new zealand': 'nz',
};

const PLACEHOLDER_PATTERNS = [
  /^tbd$/i,
  /^playoff/i,
  /winner$/i,
  /^uefa /i,
  /^intercontinental/i,
  /^\?/,
];

export function flagCodeFor(name: string | null | undefined): string | null {
  if (!name) return null;
  const normalised = name.trim().toLowerCase();
  if (!normalised) return null;
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(normalised))) return null;
  return COUNTRY_CODES[normalised] ?? null;
}

export function flagUrl(code: string | null): string | null {
  return code ? `https://flagcdn.com/${code}.svg` : null;
}
