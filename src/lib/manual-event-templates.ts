export type PredictionTypeName =
  | "winner"
  | "yes_no"
  | "margin"
  | "over_under"
  | "head_to_head"
  | "top_n"
  | "handicap"
  | "progression"
  | "final_standings";

export interface EventTemplate {
  id: string;
  sport: string;
  name: string;
  description: string;
  participantCount: 2 | "multi";
  defaultPredictionTypes: PredictionTypeName[];
  allowDraw: boolean;
  defaultConfig?: Record<string, unknown>;
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: "gaa_match",
    sport: "gaa",
    name: "GAA Match",
    description: "Hurling or Gaelic Football county/club match",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "margin"],
    allowDraw: false,
  },
  {
    id: "soccer_match",
    sport: "soccer",
    name: "Soccer Match",
    description: "Football match (draw possible)",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "over_under"],
    allowDraw: true,
    defaultConfig: { over_under: { line: 2.5, stat: "total_goals" } },
  },
  {
    id: "rugby_match",
    sport: "rugby",
    name: "Rugby Union Match",
    description: "Rugby Union match — no draw in knockout",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "margin"],
    allowDraw: false,
  },
  {
    id: "rugby_league_match",
    sport: "rugby_league",
    name: "Rugby League Match",
    description: "Rugby League match",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "margin"],
    allowDraw: false,
  },
  {
    id: "snooker_match",
    sport: "snooker",
    name: "Snooker Match",
    description: "Best-of-X frames",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head"],
    allowDraw: false,
  },
  {
    id: "tennis_match",
    sport: "tennis",
    name: "Tennis Match",
    description: "Singles or doubles",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head"],
    allowDraw: false,
  },
  {
    id: "cricket_match",
    sport: "cricket",
    name: "Cricket Match",
    description: "T20, ODI, or Test match (Tests can draw)",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head"],
    allowDraw: true,
  },
  {
    id: "golf_tournament",
    sport: "golf",
    name: "Golf Tournament",
    description: "Multi-player stroke play event",
    participantCount: "multi",
    defaultPredictionTypes: ["winner", "top_n"],
    allowDraw: false,
  },
  {
    id: "f1_race",
    sport: "formula_1",
    name: "F1 Race",
    description: "Formula 1 grand prix or sprint",
    participantCount: "multi",
    defaultPredictionTypes: ["winner", "top_n"],
    allowDraw: false,
  },
  {
    id: "horse_race",
    sport: "horse_racing",
    name: "Horse Race",
    description: "Single race with multiple runners",
    participantCount: "multi",
    defaultPredictionTypes: ["winner", "top_n"],
    allowDraw: false,
  },
  {
    id: "athletics_event",
    sport: "athletics",
    name: "Athletics Event",
    description: "Track or field event",
    participantCount: "multi",
    defaultPredictionTypes: ["winner", "top_n"],
    allowDraw: false,
  },
  {
    id: "nfl_game",
    sport: "nfl",
    name: "NFL Game",
    description: "American football game — no draws",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "over_under", "handicap"],
    allowDraw: false,
    defaultConfig: { over_under: { line: 46.5, stat: "total_points" } },
  },
  {
    id: "nba_game",
    sport: "nba",
    name: "NBA Game",
    description: "Basketball game",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "over_under"],
    allowDraw: false,
    defaultConfig: { over_under: { line: 220.5, stat: "total_points" } },
  },
  {
    id: "nhl_game",
    sport: "nhl",
    name: "NHL Game",
    description: "Ice hockey game",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "over_under"],
    allowDraw: false,
    defaultConfig: { over_under: { line: 5.5, stat: "total_goals" } },
  },
  {
    id: "mlb_game",
    sport: "mlb",
    name: "MLB Game",
    description: "Baseball game",
    participantCount: 2,
    defaultPredictionTypes: ["head_to_head", "over_under"],
    allowDraw: false,
    defaultConfig: { over_under: { line: 8.5, stat: "total_runs" } },
  },
];

export function getTemplateForSport(sport: string): EventTemplate | undefined {
  return EVENT_TEMPLATES.find((t) => t.sport === sport);
}
