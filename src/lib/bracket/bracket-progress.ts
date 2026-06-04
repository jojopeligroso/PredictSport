import type { BracketSubmissionData } from "@/types/tournament";

export function describeDraftProgress(
  data: BracketSubmissionData | null,
  groupPicksCount: number,
): {
  pct: number;
  label: string;
} {
  if (!data && groupPicksCount === 0) return { pct: 0, label: "Not started" };
  const groupTotal = 72;
  const groupDone = Math.min(groupTotal, groupPicksCount);
  const thirdsDone = (data?.bestThirdPicks ?? []).length === 8;
  const koSlots = [
    "r32_m1","r32_m2","r32_m3","r32_m4","r32_m5","r32_m6","r32_m7","r32_m8",
    "r32_m9","r32_m10","r32_m11","r32_m12","r32_m13","r32_m14","r32_m15","r32_m16",
    "r16_m1","r16_m2","r16_m3","r16_m4","r16_m5","r16_m6","r16_m7","r16_m8",
    "qf_m1","qf_m2","qf_m3","qf_m4",
    "sf_m1","sf_m2",
    "final",
  ];
  const koDone = koSlots.filter(
    (s) => data?.knockoutPicks?.[s]?.winner,
  ).length;
  const finalDone = Boolean(data?.champion) && Boolean(data?.thirdPlace);

  const total = groupTotal + 1 + koSlots.length + 1; // groups + thirds + KO + final
  const done = groupDone + (thirdsDone ? 1 : 0) + koDone + (finalDone ? 1 : 0);
  const pct = Math.min(100, Math.round((done / total) * 100));

  // Pick a friendly label for the deepest step they've reached.
  let label = "Groups in progress";
  if (groupDone === groupTotal) label = "Best thirds";
  if (thirdsDone) label = "Round of 32";
  if (koDone >= 16) label = "Round of 16";
  if (koDone >= 24) label = "Quarter-finals";
  if (koDone >= 28) label = "Semi-finals";
  if (koDone >= 30) label = "Final";
  if (finalDone) label = "Ready to submit";

  return { pct, label };
}
