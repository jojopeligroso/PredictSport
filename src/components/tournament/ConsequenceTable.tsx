"use client";

import type { CurveStep } from "@/lib/tournament/format/curve-generator";
import type { GroupComposition } from "@/lib/tournament/format/group-allocation";
import type { ConsequenceRow } from "@/lib/tournament/format/elimination";

interface ConsequenceTableProps {
  curve: CurveStep[];
  consequenceTable: { initial_entrants: number; rows: ConsequenceRow[] };
  groupComposition: GroupComposition | null;
  finalistCount: number;
  entrantCount: number;
}

const STAGE_LABELS: Record<string, string> = {
  group_stage: "After Group Stage",
  round_of_32: "After Round of 32",
  round_of_16: "After Round of 16",
  quarter_finals: "After Quarter-Finals",
  semi_finals: "After Semi-Finals",
  final: "Champion",
};

export default function ConsequenceTable({
  consequenceTable,
  groupComposition,
  finalistCount,
  entrantCount,
}: ConsequenceTableProps) {
  return (
    <div className="space-y-6">
      {/* Elimination curve table */}
      <div>
        <h3 className="font-display font-extrabold text-ps-ink mb-3">
          Elimination Curve
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ps-ink/10">
                <th className="text-left py-2 pr-4 font-semibold">Stage</th>
                <th className="text-right py-2 px-2 font-semibold">Before</th>
                <th className="text-right py-2 px-2 font-semibold text-ps-red">Out</th>
                <th className="text-right py-2 pl-2 font-semibold text-ps-green">Survive</th>
              </tr>
            </thead>
            <tbody>
              {consequenceTable.rows.map((row) => (
                <tr key={row.stage_key} className="border-b border-ps-ink/5">
                  <td className="py-2 pr-4">
                    {STAGE_LABELS[row.stage_key] ?? row.stage_key}
                  </td>
                  <td className="text-right py-2 px-2 font-mono text-ps-ink/70">
                    {row.entrants_before}
                  </td>
                  <td className="text-right py-2 px-2 font-mono text-ps-red">
                    {row.eliminated_count > 0 ? `-${row.eliminated_count}` : "0"}
                  </td>
                  <td className="text-right py-2 pl-2 font-mono font-semibold">
                    {row.survivors_after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Group allocation breakdown */}
      {groupComposition && (
        <div>
          <h3 className="font-display font-extrabold text-ps-ink mb-3">
            Group Allocation
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-ps-ink/5 rounded-lg p-3">
              <div className="font-mono text-item-label font-bold">{groupComposition.totalGroups}</div>
              <div className="text-ps-ink/60">Total groups</div>
            </div>
            {groupComposition.groups4 > 0 && (
              <div className="bg-ps-ink/5 rounded-lg p-3">
                <div className="font-mono text-item-label font-bold">{groupComposition.groups4}</div>
                <div className="text-ps-ink/60">Groups of 4</div>
              </div>
            )}
            {groupComposition.groups5 > 0 && (
              <div className="bg-ps-ink/5 rounded-lg p-3">
                <div className="font-mono text-item-label font-bold">{groupComposition.groups5}</div>
                <div className="text-ps-ink/60">Groups of 5</div>
              </div>
            )}
            {groupComposition.groups3 > 0 && (
              <div className="bg-ps-ink/5 rounded-lg p-3">
                <div className="font-mono text-item-label font-bold">{groupComposition.groups3}</div>
                <div className="text-ps-ink/60">Groups of 3</div>
              </div>
            )}
          </div>

          <div className="mt-3 text-sm text-ps-ink/70 space-y-1">
            <p>
              <span className="font-semibold">{groupComposition.autoQualifiers}</span> auto-qualify
              (top 2 from each group{groupComposition.groups5 > 0 ? " + 3rd from groups of 5" : ""})
            </p>
            {groupComposition.bestThirdSlots > 0 && (
              <p>
                <span className="font-semibold">{groupComposition.bestThirdSlots}</span> best
                third-place finishers from groups of 4 also qualify
              </p>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-ps-amber/10 border border-ps-amber/30 rounded-lg p-4 text-sm">
        <p className="font-semibold text-ps-ink mb-1">
          {entrantCount} entrants → {finalistCount} finalist{finalistCount !== 1 ? "s" : ""}
        </p>
        <p className="text-ps-ink/70">
          Groups and the elimination curve lock when the first prediction window opens.
          After that, late entrants are added to the smallest group.
        </p>
      </div>
    </div>
  );
}
