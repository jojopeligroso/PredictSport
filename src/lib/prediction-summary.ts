export function getPredictionSummary(
  predictionType: string,
  predictionData: Record<string, unknown>,
  homeTeam: string,
  awayTeam: string,
): string | null {
  if (predictionType === "exact_score") {
    const home = predictionData.home as number;
    const away = predictionData.away as number;
    if (home == null || away == null) return null;
    if (home > away) return `You predicted ${homeTeam} to win ${home}-${away}`;
    if (away > home) return `You predicted ${homeTeam} to lose ${home}-${away}`;
    return `You predicted ${homeTeam} and ${awayTeam} to draw ${home}-${away}`;
  }

  if (predictionType === "winner") {
    const value = predictionData.value as string;
    const winner = predictionData.winner as string;
    if (winner === "draw") return "You predicted a draw";
    if (value) return `You predicted ${value}`;
    return null;
  }

  if (predictionType === "yes_no") {
    return `You predicted ${predictionData.selection}`;
  }

  return null;
}
