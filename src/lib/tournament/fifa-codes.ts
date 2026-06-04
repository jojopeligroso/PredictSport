/**
 * FIFA three-letter country codes (trigrams) for WC 2026 nations.
 *
 * Maps team display names (lowercase) to official FIFA trigrams. Used on the
 * dashboard condensed pick rows and anywhere a compact country identifier is
 * needed. Lookup is case-insensitive via `fifaTrigram()`.
 *
 * Source: FIFA.com official tournament pages.
 */

const FIFA_CODES: Record<string, string> = {
  // UEFA (16)
  austria: 'AUT',
  belgium: 'BEL',
  'bosnia and herzegovina': 'BIH',
  'bosnia & herzegovina': 'BIH',
  bosnia: 'BIH',
  croatia: 'CRO',
  'czech republic': 'CZE',
  czechia: 'CZE',
  england: 'ENG',
  france: 'FRA',
  germany: 'GER',
  netherlands: 'NED',
  holland: 'NED',
  norway: 'NOR',
  portugal: 'POR',
  scotland: 'SCO',
  spain: 'ESP',
  sweden: 'SWE',
  switzerland: 'SUI',
  turkey: 'TUR',
  turkiye: 'TUR',
  'türkiye': 'TUR',

  // AFC (9)
  australia: 'AUS',
  iran: 'IRN',
  iraq: 'IRQ',
  japan: 'JPN',
  jordan: 'JOR',
  qatar: 'QAT',
  'saudi arabia': 'KSA',
  'south korea': 'KOR',
  korea: 'KOR',
  'korea republic': 'KOR',
  uzbekistan: 'UZB',

  // CAF (10)
  algeria: 'ALG',
  'cape verde': 'CPV',
  'cabo verde': 'CPV',
  'dr congo': 'COD',
  'democratic republic of congo': 'COD',
  'democratic republic of the congo': 'COD',
  egypt: 'EGY',
  ghana: 'GHA',
  'ivory coast': 'CIV',
  "cote d'ivoire": 'CIV',
  "côte d'ivoire": 'CIV',
  morocco: 'MAR',
  senegal: 'SEN',
  'south africa': 'RSA',
  tunisia: 'TUN',

  // CONCACAF (6)
  canada: 'CAN',
  curacao: 'CUW',
  'curaçao': 'CUW',
  haiti: 'HAI',
  mexico: 'MEX',
  panama: 'PAN',
  'united states': 'USA',
  usa: 'USA',
  'united states of america': 'USA',

  // CONMEBOL (6)
  argentina: 'ARG',
  brazil: 'BRA',
  colombia: 'COL',
  ecuador: 'ECU',
  paraguay: 'PAR',
  uruguay: 'URU',

  // OFC (1)
  'new zealand': 'NZL',
};

/**
 * Look up a country's FIFA three-letter code. Returns the trigram in
 * uppercase or `null` for unrecognised / TBD names.
 */
export function fifaTrigram(name: string | null | undefined): string | null {
  if (!name) return null;
  const normalised = name.trim().toLowerCase();
  if (!normalised) return null;
  return FIFA_CODES[normalised] ?? null;
}
