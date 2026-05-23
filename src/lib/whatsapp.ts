/**
 * Build a wa.me universal link for sharing to WhatsApp.
 * Opens native WhatsApp (or web) with pre-filled text.
 */
export function buildWaLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Default copy for sharing a pick to WhatsApp.
 */
export function psDefaultPickCopy({
  eventName,
  optionLabel,
  ownerName,
}: {
  eventName: string;
  optionLabel: string;
  ownerName: string;
}): string {
  return `${ownerName} picked ${optionLabel} for ${eventName}`;
}

/**
 * Default copy for sharing "my sheet is locked" to WhatsApp.
 */
export function psDefaultSheetCopy(_eventName: string): string {
  return `Sheet locked 🔒 Come at me.`;
}

/**
 * Default copy for sharing a result to WhatsApp.
 */
export function psDefaultResultCopy({
  eventName,
  state,
}: {
  eventName: string;
  state: 'correct' | 'wrong' | 'partial';
}): string {
  if (state === 'correct') return `${eventName}: called it. Easy. ✅`;
  if (state === 'wrong') return `${eventName}: f**ked it. 😩`;
  return `${eventName}: half marks, take it.`;
}

/**
 * Default copy for sharing a leaderboard position to WhatsApp.
 */
export function psDefaultLeaderboardCopy({
  name,
  points,
  movement,
}: {
  name: string;
  points: number;
  movement: number;
}): string {
  const dir = movement < 0 ? '⬇️' : movement > 0 ? '⬆️' : '➡️';
  return `Slag alert: ${name} on ${points}pts, sliding ${dir}`;
}
