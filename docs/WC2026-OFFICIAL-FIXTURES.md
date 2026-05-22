# FIFA World Cup 2026 — Official Group Stage Data

Source of truth for correcting the placeholder data. Verified 2026-05-22 against
two independent sources: NBC Sports (group draw) and Sky Sports (fixture list).
Draw held 5 December 2025, Washington D.C.

> ⚠️ The data currently in the codebase is WRONG — three inconsistent
> placeholder versions exist: the `bracket_templates` DB seed row, `WC2026_GROUPS`
> in `src/lib/bracket/adapters/fifa-world-cup-2026.ts`, and (via import) the
> bracket wizard. None match the real draw. See DESIGN-WC-UNIFIED-PREDICTIONS.md
> task U0.

## Official Groups (real draw)

| Group | Team 1 | Team 2 | Team 3 | Team 4 |
|-------|--------|--------|--------|--------|
| A | Mexico | South Korea | South Africa | Czechia |
| B | Canada | Switzerland | Qatar | Bosnia & Herzegovina |
| C | Brazil | Morocco | Scotland | Haiti |
| D | USA | Paraguay | Australia | Turkiye |
| E | Germany | Ecuador | Ivory Coast | Curacao |
| F | Netherlands | Japan | Tunisia | Sweden |
| G | Belgium | Iran | Egypt | New Zealand |
| H | Spain | Uruguay | Saudi Arabia | Cape Verde |
| I | France | Senegal | Norway | Iraq |
| J | Argentina | Austria | Algeria | Jordan |
| K | Portugal | Colombia | Uzbekistan | DR Congo |
| L | England | Croatia | Panama | Ghana |

## Group Stage Fixtures (72 matches, UK kick-off times)

Times below are **UK time** as published by Sky Sports. They MUST be converted
to UTC before being written to `events.start_time` (a `timestamptz`). In June,
UK = BST = UTC+1, so **UTC = UK time − 1 hour**. Several "early hours" UK times
are the previous US evening — keep the date as printed (it is the UK date).

### Group A
| MD | Match | Date | UK KO |
|----|-------|------|-------|
| 1 | Mexico vs South Africa | Thu 11 Jun | 20:00 |
| 1 | South Korea vs Czechia | Fri 12 Jun | 03:00 |
| 2 | Czechia vs South Africa | Thu 18 Jun | 17:00 |
| 2 | Mexico vs South Korea | Fri 19 Jun | 02:00 |
| 3 | South Africa vs South Korea | Thu 25 Jun | 02:00 |
| 3 | Czechia vs Mexico | Thu 25 Jun | 02:00 |

### Group B
| MD | Match | Date | UK KO |
|----|-------|------|-------|
| 1 | Canada vs Bosnia & Herzegovina | Fri 12 Jun | 20:00 |
| 1 | Qatar vs Switzerland | Sat 13 Jun | 20:00 |
| 2 | Switzerland vs Bosnia & Herzegovina | Thu 18 Jun | 20:00 |
| 2 | Canada vs Qatar | Thu 18 Jun | 23:00 |
| 3 | Switzerland vs Canada | Wed 24 Jun | 20:00 |
| 3 | Bosnia & Herzegovina vs Qatar | Wed 24 Jun | 20:00 |

### Group C
| MD | Match | Date | UK KO |
|----|-------|------|-------|
| 1 | Brazil vs Morocco | Sat 13 Jun | 23:00 |
| 1 | Haiti vs Scotland | Sun 14 Jun | 02:00 |
| 2 | Scotland vs Morocco | Fri 19 Jun | 23:00 |
| 2 | Brazil vs Haiti | Sat 20 Jun | 01:30 |
| 3 | Morocco vs Haiti | Wed 24 Jun | 23:00 |
| 3 | Scotland vs Brazil | Wed 24 Jun | 23:00 |

### Group D
| MD | Match | Date | UK KO |
|----|-------|------|-------|
| 1 | USA vs Paraguay | Sat 13 Jun | 02:00 |
| 1 | Australia vs Turkiye | Sun 14 Jun | 05:00 |
| 2 | USA vs Australia | Fri 19 Jun | 20:00 |
| 2 | Turkiye vs Paraguay | Sat 20 Jun | 04:00 |
| 3 | Turkiye vs USA | Fri 26 Jun | 03:00 |
| 3 | Paraguay vs Australia | Fri 26 Jun | 03:00 |

### Group E
| MD | Match | Date | UK KO |
|----|-------|------|-------|
| 1 | Germany vs Curacao | Sun 14 Jun | 18:00 |
| 1 | Ivory Coast vs Ecuador | Mon 15 Jun | 00:00 |
| 2 | Germany vs Ivory Coast | Sat 20 Jun | 21:00 |
| 2 | Ecuador vs Curacao | Sun 21 Jun | 01:00 |
| 3 | Curacao vs Ivory Coast | Thu 25 Jun | 21:00 |
| 3 | Ecuador vs Germany | Thu 25 Jun | 21:00 |

### Group F
| MD | Match | Date | UK KO |
|----|-------|------|-------|
| 1 | Netherlands vs Japan | Sun 14 Jun | 21:00 |
| 1 | Sweden vs Tunisia | Mon 15 Jun | 03:00 |
| 2 | Tunisia vs Japan | Sun 21 Jun | 05:00 |
| 2 | (Netherlands vs Sweden — MD2, time TBC: verify) | — | — |
| 3 | Tunisia vs Netherlands | Fri 26 Jun | 00:00 |
| 3 | Japan vs Sweden | Fri 26 Jun | 00:00 |

> ⚠️ Group F: the Sky source listed only 5 matches; the Netherlands vs Sweden
> matchday-2 fixture must be verified and added before seeding (a group has 6
> matches). Do not seed Group F until confirmed.

### Group G
| MD | Match | Date | UK KO |
|----|-------|------|-------|
| 1 | Belgium vs Egypt | Mon 15 Jun | 20:00 |
| 1 | Iran vs New Zealand | Tue 16 Jun | 02:00 |
| 2 | Belgium vs Iran | Sun 21 Jun | 20:00 |
| 2 | New Zealand vs Egypt | Mon 22 Jun | 02:00 |
| 3 | New Zealand vs Belgium | Sat 27 Jun | 04:00 |
| 3 | Egypt vs Iran | Sat 27 Jun | 04:00 |

### Group H
| MD | Match | Date | UK KO |
|----|-------|------|-------|
| 1 | Spain vs Cape Verde | Mon 15 Jun | 17:00 |
| 1 | Saudi Arabia vs Uruguay | Mon 15 Jun | 23:00 |
| 2 | Spain vs Saudi Arabia | Sun 21 Jun | 17:00 |
| 2 | Uruguay vs Cape Verde | Sun 21 Jun | 23:00 |
| 3 | Cape Verde vs Saudi Arabia | Sat 27 Jun | 01:00 |
| 3 | Uruguay vs Spain | Sat 27 Jun | 01:00 |

### Group I
| MD | Match | Date | UK KO |
|----|-------|------|-------|
| 1 | France vs Senegal | Tue 16 Jun | 20:00 |
| 1 | Iraq vs Norway | Tue 16 Jun | 23:00 |
| 2 | France vs Iraq | Mon 22 Jun | 22:00 |
| 2 | Norway vs Senegal | Tue 23 Jun | 01:00 |
| 3 | Norway vs France | Fri 26 Jun | 20:00 |
| 3 | Senegal vs Iraq | Fri 26 Jun | 20:00 |

### Group J
| MD | Match | Date | UK KO |
|----|-------|------|-------|
| 1 | Argentina vs Algeria | Wed 17 Jun | 02:00 |
| 1 | Austria vs Jordan | Wed 17 Jun | 05:00 |
| 2 | Argentina vs Austria | Mon 22 Jun | 18:00 |
| 2 | Jordan vs Algeria | Tue 23 Jun | 04:00 |
| 3 | Algeria vs Austria | Sun 28 Jun | 03:00 |
| 3 | Jordan vs Argentina | Sun 28 Jun | 03:00 |

### Group K
| MD | Match | Date | UK KO |
|----|-------|------|-------|
| 1 | Portugal vs DR Congo | Wed 17 Jun | 18:00 |
| 1 | Uzbekistan vs Colombia | Thu 18 Jun | 03:00 |
| 2 | Portugal vs Uzbekistan | Tue 23 Jun | 18:00 |
| 2 | Colombia vs DR Congo | Wed 24 Jun | 03:00 |
| 3 | Colombia vs Portugal | Sun 28 Jun | 00:30 |
| 3 | DR Congo vs Uzbekistan | Sun 28 Jun | 00:30 |

### Group L
| MD | Match | Date | UK KO |
|----|-------|------|-------|
| 1 | England vs Croatia | Wed 17 Jun | 21:00 |
| 1 | Ghana vs Panama | Thu 18 Jun | 00:00 |
| 2 | England vs Ghana | Tue 23 Jun | 21:00 |
| 2 | Panama vs Croatia | Wed 24 Jun | 00:00 |
| 3 | Panama vs England | Sat 27 Jun | 22:00 |
| 3 | Croatia vs Ghana | Sat 27 Jun | 22:00 |

## Notes for the implementer

- Total: should be **72 matches** (12 groups × 6). Group F currently lists 5 —
  resolve before seeding (see warning above).
- The "matchday" (MD 1/2/3) maps to prediction windows 1/2/3.
- Convert UK → UTC (−1h in June) for `events.start_time`.
- `events.lock_time` = `start_time` − 30 min (per the competition's
  `lock_default_minutes = 30`).
- `events.sport = 'soccer'`.
- These dates/times should be re-verified against fifa.com closer to the
  tournament; broadcasters occasionally adjust kick-off times.

## Sources
- NBC Sports — 2026 World Cup groups confirmed: https://www.nbcsports.com/soccer/news/2026-world-cup-groups-confirmed-full-draw-groups-details
- Sky Sports — World Cup 2026 fixture schedule: https://www.skysports.com/football/news/11095/13481245/
