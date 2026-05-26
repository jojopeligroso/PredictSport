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
import { WC2026_GROUPS, WC2026_KNOCKOUT_ROUNDS } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { ChampionFlagFountain } from "./ChampionFlagFountain";
import { CountryFlag } from "@/components/CountryFlag";
import { FoldedBracket } from "./FoldedBracket";

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
  // Eliminated = 4 non-qualifying thirds + 12 fourth-place teams = 16 teams.
  // Derived from the full group rosters so we don't depend on the ranking
  // having all 4 slots filled (defensive: rankings can be partial mid-edit).
  const eliminatedTeams = buildEliminatedTeams(groupRankings, qualifyingThirds);
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
          One last look. Hit any section to edit it. You can keep editing and
          resubmitting right up until the day before kick-off.
        </p>
      </div>

      <FoldedBracket
        submission={{
          bestThirdPicks: qualifyingThirds,
          knockoutPicks,
          champion,
          thirdPlace,
        }}
        groupRankings={groupRankings}
        matchups={allMatchups}
      />

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
          <ChampionFlagFountain champion={champion} teams={r32Teams} />
          <p className="mt-2 font-display text-3xl font-extrabold text-ps-text">
            {champion}
          </p>
          {(() => {
            const ru = [knockoutPicks?.sf_m1?.winner, knockoutPicks?.sf_m2?.winner]
              .find((t) => t && t !== champion);
            return ru ? (
              <p className="mt-2 font-mono text-[11px] text-ps-text-sec">
                Runner-up: <span className="font-semibold text-ps-text">{ru}</span>
              </p>
            ) : null;
          })()}
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
                <span className="ml-auto inline-flex items-center gap-1 text-xs">
                  <CountryFlag shape="pill" name={step.winner} size={14} />
                  <span className="font-semibold text-ps-text">{step.winner}</span>
                  <span className="text-ps-text-ter">d.</span>
                  <CountryFlag shape="pill" name={step.loser} size={14} />
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
        <div className="grid grid-cols-2 gap-2">
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
                  {groupRankings[groupId].slice(0, 4).map((team, i) => (
                    <li
                      key={team}
                      className={`flex items-center gap-1 ${
                        i < 2
                          ? `font-semibold ${accent}`
                          : i === 2
                          ? "text-ps-amber"
                          : "text-ps-text-ter line-through decoration-ps-text-ter/60"
                      }`}
                    >
                      <span className="font-mono">{i + 1}.</span>
                      <CountryFlag shape="pill" name={team} size={12} />
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
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  pickColor === "amber"
                    ? "bg-ps-amber/15 text-ps-amber"
                    : "bg-ps-green/15 text-ps-green"
                }`}
              >
                <CountryFlag shape="pill" name={teamName} size={12} />
                <span>{teamName}</span>
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
          Score: 1 point per correct team in the Last 32 classification.
        </p>
        <div className="flex flex-wrap gap-1">
          {r32Teams.map((team) => (
            <span
              key={team}
              className="inline-flex items-center gap-1 rounded-md bg-ps-bg px-2 py-0.5 text-[11px] font-semibold text-ps-text"
            >
              <CountryFlag shape="pill" name={team} size={12} />
              <span>{team}</span>
            </span>
          ))}
        </div>

        {/* Eliminated teams — fast scan of who you DIDN'T put through.
            Helps the user spot a missing favourite before submitting. */}
        {eliminatedTeams.length > 0 && (
          <div className="mt-4 border-t border-ps-border pt-3">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
              Eliminated teams ({eliminatedTeams.length}/16)
            </p>
            <div className="flex flex-wrap gap-1">
              {eliminatedTeams.map((team) => (
                <span
                  key={team}
                  className="inline-flex items-center gap-1 rounded-md border border-ps-border bg-ps-chip px-2 py-0.5 text-[11px] font-medium text-ps-text-sec"
                >
                  <CountryFlag shape="pill" name={team} size={12} className="opacity-60" />
                  <span className="line-through decoration-ps-text-ter/60">{team}</span>
                </span>
              ))}
            </div>
          </div>
        )}

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

      {/* Soft deadline reminder — last beat of the review so it's the parting
          thought before the submit CTA. Actual operator lock fires ~1h before
          kickoff, but we promise users "day before" so there's always a buffer. */}
      <p className="rounded-md bg-ps-amber-soft px-3 py-2 text-center text-[11px] text-ps-amber-deep">
        <span className="font-semibold">Don&apos;t worry</span> — you can keep
        editing and resubmitting until the day before kick-off.
      </p>
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

/**
 * Returns teams the user has knocked out at the group stage:
 *   - every 4th-place team (12 total)
 *   - every 3rd-place team whose group is NOT in qualifyingThirds (4 total)
 *
 * Order: by group A..L, then 3rd-place before 4th within the same group, so
 * the list reads in the same flow as the rankings step.
 */
function buildEliminatedTeams(
  groupRankings: Record<string, string[]>,
  qualifyingThirds: string[],
): string[] {
  const qualifyingThirdSet = new Set(qualifyingThirds);
  const teams: string[] = [];
  for (const group of WC2026_GROUPS) {
    const ranking = groupRankings[group.groupId] ?? [];
    const third = ranking[2];
    const fourth = ranking[3];
    if (third && !qualifyingThirdSet.has(group.groupId)) {
      teams.push(third);
    }
    if (fourth) teams.push(fourth);
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
