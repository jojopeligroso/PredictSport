import { CountryFlag } from "@/components/CountryFlag";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";

interface FifaGroupCardProps {
  groupId: string;
  teams: string[];
}

export function FifaGroupCard({ groupId, teams }: FifaGroupCardProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-ps-border bg-ps-surface">
      <div className="border-b border-ps-border px-2.5 py-1.5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ps-text-ter">
          Group {groupId}
        </p>
      </div>
      <div className="divide-y divide-ps-border/50">
        {teams.map((team) => (
          <div
            key={team}
            className="flex items-center gap-1.5 px-2.5 py-1.5"
          >
            <CountryFlag name={team} size={16} shape="circle" />
            <span className="font-mono text-[11px] text-ps-text">
              {fifaTrigram(team) ?? team.slice(0, 3).toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
