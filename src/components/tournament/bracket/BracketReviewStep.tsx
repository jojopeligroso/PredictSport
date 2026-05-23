"use client";

/**
 * BracketReviewStep — final pre-submit pass.
 *
 * Shows the user a compact, scannable summary of their entire bracket:
 * group rankings, qualifying thirds, champion path, knockout picks, and
 * R32 team list (the source for the R32 classification). Includes
 * step-jump shortcuts so any branch can be edited without restarting.
 */

import type { PickColor } from "./bracket-types";
import { WC2026_KNOCKOUT_ROUNDS } from "@/lib/bracket/adapters/fifa-world-cup-2026";

interface BracketReviewStepProps {
  groupRankings: Record<string, string[]>;
  qualifyingThirds: string[]; // group IDs of best-8 thirds
  knockoutPicks: Record<string, { winner: string }>;
  allMatchups?: Record<string, { home: string; away: string }>;
  champion: string;
  thirdPlace: string;
  pickColor?: PickColor;
  onJumpToStep: (
    step: "groups" | "third_place" | "r32" | "r16" | "qf" | "sf" | "final",
  ) => void;
}

export default function BracketReviewStep({
  groupRankings,
  qualifyingThirds,
  knockoutPicks,
  allMatchups = {},
  champion,
  thirdPlace,
  pickColor = "green",
  onJumpToStep,
}: BracketReviewStepProps) {
  // R32 team list = 12 winners + 12 runners-up + 8 qualifying thirds
  const r32Teams = buildR32TeamList(groupRankings, qualifyingThirds);
  const championPath = buildChampionPath(knockoutPicks, champion, allMatchups);

  const accent = pickColor === "amber" ? "text-ps-amber" : "text-ps-green";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
          Step 8 of 8
        </p>
        <h2 className="mt-1 text-lg font-extrabold text-ps-text">Review your bracket</h2>
        <p className="mt-1 text-xs text-ps-text-sec">
          One last look. Hit any section to edit it. Submitting locks it in until kickoff.
        </p>
      </div>

      {/* Champion hero */}
      {champion && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-ps-amber/40 bg-gradient-to-br from-ps-amber/10 to-ps-amber/5 p-5 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ps-amber/15 blur-3xl"
          />
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-amber">
            Your World Cup champion
          </p>
          <p className="mt-2 font-display text-3xl font-extrabold text-ps-text">
            {champion}
          </p>
          {thirdPlace && (
            <p className="mt-2 font-mono text-[11px] text-ps-text-sec">
              3rd place: <span className="font-semibold text-ps-text">{thirdPlace}</span>
            </p>
          )}
        </div>
      )}

      {/* Champion path */}
      {championPath.length > 0 && (
        <Section
          title="Champion's path"
          editLabel="Edit"
          onEdit={() => onJumpToStep("r32")}
        >
          <ol className="space-y-1.5">
            {championPath.map((step) => (
              <li
                key={step.slotId}
                className="flex items-center gap-2 rounded-md bg-ps-bg px-2 py-1.5"
              >
                <span className="font-mono text-[10px] font-bold uppercase text-ps-text-ter">
                  {step.roundLabel}
                </span>
                <span className="ml-auto text-xs">
                  <span className="font-semibold text-ps-text">{step.winner}</span>{" "}
                  <span className="text-ps-text-ter">d.</span>{" "}
                  <span className="text-ps-text-sec">{step.loser}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Groups */}
      <Section
        title="Group rankings"
        editLabel="Edit groups"
        onEdit={() => onJumpToStep("groups")}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.keys(groupRankings)
            .sort()
            .map((groupId) => (
              <div
                key={groupId}
                className="rounded-md border border-ps-border bg-ps-bg p-2"
              >
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
                  Group {groupId}
                </p>
                <ol className="mt-1 space-y-0.5 text-[11px]">
                  {groupRankings[groupId].slice(0, 3).map((team, i) => (
                    <li
                      key={team}
                      className={`flex items-center gap-1 ${
                        i < 2 ? `font-semibold ${accent}` : "text-ps-amber"
                      }`}
                    >
                      <span className="font-mono">{i + 1}.</span>
                      <span className="truncate">{team}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
        </div>
      </Section>

      {/* Best thirds */}
      <Section
        title="Best thirds advancing"
        editLabel="Edit"
        onEdit={() => onJumpToStep("third_place")}
      >
        <div className="flex flex-wrap gap-1.5">
          {qualifyingThirds.map((groupId) => {
            const teamName = groupRankings[groupId]?.[2] ?? "?";
            return (
              <span
                key={groupId}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  pickColor === "amber"
                    ? "bg-ps-amber/15 text-ps-amber"
                    : "bg-ps-green/15 text-ps-green"
                }`}
              >
                {teamName}{" "}
                <span className="font-mono opacity-70">({groupId})</span>
              </span>
            );
          })}
        </div>
      </Section>

      {/* R32 team list (R32 classification target) */}
      <Section
        title={`Your Round of 32 (${r32Teams.length}/32)`}
        editLabel="Edit"
        onEdit={() => onJumpToStep("r32")}
      >
        <p className="mb-2 text-[10px] text-ps-text-ter">
          Score: 1 point per correct team in the R32 Pick classification.
        </p>
        <div className="flex flex-wrap gap-1">
          {r32Teams.map((team) => (
            <span
              key={team}
              className="rounded-md bg-ps-bg px-2 py-0.5 text-[11px] font-semibold text-ps-text"
            >
              {team}
            </span>
          ))}
        </div>
      </Section>

      {/* Knockout summary */}
      <Section
        title="Knockout picks"
        editLabel="Edit"
        onEdit={() => onJumpToStep("r32")}
      >
        <div className="space-y-2">
          {WC2026_KNOCKOUT_ROUNDS.map((round) => {
            const picks = round.slotIds.map((s) => knockoutPicks[s]?.winner ?? "?");
            const done = round.slotIds.every((s) => knockoutPicks[s]?.winner);
            return (
              <div
                key={round.roundKey}
                className="rounded-md border border-ps-border bg-ps-bg p-2"
              >
                <div className="flex items-baseline justify-between">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
                    {round.name}
                  </p>
                  <span
                    className={`font-mono text-[10px] font-bold ${
                      done ? accent : "text-ps-amber"
                    }`}
                  >
                    {round.slotIds.filter((s) => knockoutPicks[s]?.winner).length}/
                    {round.slotIds.length}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ps-text-sec">
                  {picks.filter((p) => p !== "?").slice(0, 8).join(" · ")}
                  {picks.length > 8 && " …"}
                </p>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-ps-border bg-ps-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ps-text">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md px-2 py-0.5 text-[11px] font-bold text-ps-amber transition-colors hover:bg-ps-amber/10"
        >
          {editLabel}
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function buildR32TeamList(
  groupRankings: Record<string, string[]>,
  qualifyingThirds: string[],
): string[] {
  const teams: string[] = [];
  for (const groupId of Object.keys(groupRankings).sort()) {
    const ranking = groupRankings[groupId];
    if (ranking[0]) teams.push(ranking[0]);
    if (ranking[1]) teams.push(ranking[1]);
  }
  for (const groupId of qualifyingThirds) {
    const third = groupRankings[groupId]?.[2];
    if (third) teams.push(third);
  }
  return teams;
}

function buildChampionPath(
  knockoutPicks: Record<string, { winner: string }>,
  champion: string,
  allMatchups: Record<string, { home: string; away: string }>,
): Array<{ slotId: string; roundLabel: string; winner: string; loser: string }> {
  if (!champion) return [];

  const path: Array<{ slotId: string; roundLabel: string; winner: string; loser: string }> = [];
  const reverseRounds: Array<{
    label: string;
    slots: string[];
  }> = [
    {
      label: "R32",
      slots: [
        "r32_m1","r32_m2","r32_m3","r32_m4","r32_m5","r32_m6","r32_m7","r32_m8",
        "r32_m9","r32_m10","r32_m11","r32_m12","r32_m13","r32_m14","r32_m15","r32_m16",
      ],
    },
    {
      label: "R16",
      slots: ["r16_m1","r16_m2","r16_m3","r16_m4","r16_m5","r16_m6","r16_m7","r16_m8"],
    },
    { label: "QF", slots: ["qf_m1","qf_m2","qf_m3","qf_m4"] },
    { label: "Semi", slots: ["sf_m1","sf_m2"] },
    { label: "Final", slots: ["final"] },
  ];

  for (const round of reverseRounds) {
    const slot = round.slots.find((s) => knockoutPicks[s]?.winner === champion);
    if (!slot) continue;
    const matchup = allMatchups[slot];
    let opponent = "?";
    if (matchup) {
      if (matchup.home && matchup.home !== champion) opponent = matchup.home;
      else if (matchup.away && matchup.away !== champion) opponent = matchup.away;
    } else {
      // Fallback: derive from feeders' winners.
      const feeders = feedersFor(slot);
      opponent =
        feeders.map((f) => knockoutPicks[f]?.winner).find((w) => w && w !== champion) ?? "?";
    }
    path.push({
      slotId: slot,
      roundLabel: round.label,
      winner: champion,
      loser: opponent,
    });
  }

  return path;
}

function feedersFor(slotId: string): string[] {
  const m = slotId.match(/^(r16|qf|sf|final)_?m?(\d*)$/);
  if (!m) return [];
  const [, round, numStr] = m;
  const num = parseInt(numStr || "1", 10);
  if (round === "r16") return [`r32_m${2 * num - 1}`, `r32_m${2 * num}`];
  if (round === "qf") return [`r16_m${2 * num - 1}`, `r16_m${2 * num}`];
  if (round === "sf") return [`qf_m${2 * num - 1}`, `qf_m${2 * num}`];
  if (round === "final") return ["sf_m1", "sf_m2"];
  return [];
}
