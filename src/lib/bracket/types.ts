// Additional bracket types not covered by @/types/tournament

export interface BracketValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BracketScoringResult {
  status: 'live' | 'dead';
  correctPicks: number;
  totalResolved: number;
  deadAtRound?: string;
  details: {
    slotId: string;
    predicted: string;
    actual: string | null;
    correct: boolean | null;
  }[];
}

export interface OfficialBracketResults {
  groupRankings: Record<string, string[]>;
  qualifyingThirdGroups: string[];
  knockoutResults: Record<string, { winner: string }>;
  champion?: string;
  thirdPlace?: string;
}
