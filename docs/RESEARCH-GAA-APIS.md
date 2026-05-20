# GAA Data Sources Research

Date: 2026-05-20

## Current Setup

Foireann provider (`src/lib/sports/providers/foireann.ts`) is fully built but disabled — needs `FOIREANN_API_KEY`. Fallback is manual entry only.

## Sources Evaluated

| Source | Has Data | Has API | Accessible | Inter-County | Verdict |
|--------|----------|---------|------------|--------------|---------|
| **Foireann** | Yes | REST (OpenAPI 3.0) | Need API key | Yes | **Primary — get the key** |
| GAA GMS (county sites) | Yes | Yes (legacy) | No (IP whitelist) | Yes | Not accessible |
| ClubZap | Yes | Yes | Maybe | No (clubs only) | Wrong scope |
| GAA.ie | Yes | No | Scraping only | Yes | Not viable |
| HoganStand | Yes | No | Scraping only | Yes | Fragile fallback |
| RTE Sport | Yes | No | Scraping only | Yes | Not viable |
| BBC/Sky/ESPN | Minimal | No | N/A | No | Not relevant |
| RapidAPI etc. | No | No | N/A | N/A | Nothing exists |

## Key Findings

**Foireann is the only viable option.** It's the canonical GAA data source with a proper REST API (`api.foireann.ie/open-data/`), Swagger docs, and coverage of all GAA/LGFA/Camogie fixtures from 2013+. The provider code is already fully implemented.

**No third-party GAA API exists.** GAA is too niche for global sports data providers (no coverage on RapidAPI, ESPN, or any sports API marketplace).

**Scraping is not viable.** GAA.ie, HoganStand, and RTE have data but no structured endpoints. Legal risk + fragility make scraping unsuitable.

**Consumer apps (Gaelsport, IrishScores) exist** but offer no developer access.

## Recommended Action

1. **Request Foireann API key** via Foireann Support. Frame as non-commercial community prediction app. The API is explicitly designed for third-party data consumption.
2. **Manual entry remains the only fallback** until key is obtained.
3. **No scraping** — every alternative lacks structured data or raises legal concerns.
