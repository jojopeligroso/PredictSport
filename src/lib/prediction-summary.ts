type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function getPredictionSummary(
  predictionType: string,
  predictionData: Record<string, unknown>,
  homeTeam: string,
  awayTeam: string,
  t?: TFn,
): string | null {
  if (predictionType === "exact_score") {
    const home = predictionData.home as number;
    const away = predictionData.away as number;
    if (home == null || away == null) return null;
    if (t) {
      if (home > away) return t('prediction.you_predicted_win', { team: homeTeam, score: `${home}-${away}` });
      if (away > home) return t('prediction.you_predicted_win', { team: awayTeam, score: `${away}-${home}` });
      return t('prediction.you_predicted_draw', { homeTeam, awayTeam, score: `${home}-${away}` });
    }
    if (home > away) return `You predicted ${homeTeam} to win ${home}-${away}`;
    if (away > home) return `You predicted ${awayTeam} to win ${away}-${home}`;
    return `You predicted ${homeTeam} and ${awayTeam} to draw ${home}-${away}`;
  }

  if (predictionType === "winner") {
    const value = predictionData.value as string;
    const winner = predictionData.winner as string;
    if (winner === "draw") return t ? t('prediction.you_predicted_draw_simple') : "You predicted a draw";
    if (value) return t ? t('prediction.you_predicted', { value }) : `You predicted ${value}`;
    return null;
  }

  if (predictionType === "yes_no") {
    const sel = String(predictionData.selection);
    return t ? t('prediction.you_predicted', { value: sel }) : `You predicted ${sel}`;
  }

  return null;
}
