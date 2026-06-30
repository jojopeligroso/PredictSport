"use client";

import Link from "next/link";
import { ChatPreview } from "@/components/chat/ChatPreview";

interface StandingRow {
  rank: number;
  user_id: string;
  display_name: string;
  points: number;
}

interface FormatGroup {
  group_name: string;
  members: Array<{ display_name: string; points: number }>;
}

export function ShowcaseClient({
  competitionName,
  memberCount,
  confirmedEvents,
  overallStandings,
  formatGroups,
}: {
  competitionName: string;
  memberCount: number;
  confirmedEvents: number;
  overallStandings: StandingRow[];
  formatGroups: FormatGroup[];
}) {
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-6 pb-24">
      {/* Header */}
      <div className="text-center">
        <h1 className="font-display text-2xl font-extrabold text-ps-text">
          <span>sports</span>
          <span className="text-ps-amber">predict.</span>
        </h1>
        <p className="mt-1 font-serif text-sm italic text-ps-text-sec">
          {competitionName}
        </p>
      </div>

      {/* Stats bar */}
      <div className="mt-6 flex justify-center gap-6">
        <Stat label="Players" value={memberCount} />
        <Stat label="Matches scored" value={confirmedEvents} />
      </div>

      {/* Overall leaderboard */}
      {overallStandings.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold text-ps-text">Overall</h2>
          <p className="mt-0.5 text-xs text-ps-text-ter">
            Cumulative points across all matches
          </p>
          <div className="mt-3 divide-y divide-ps-border rounded-xl border border-ps-border bg-ps-surface">
            <div className="flex items-center px-3 py-2 text-xs font-semibold text-ps-text-ter">
              <span className="w-8 text-center">#</span>
              <span className="flex-1 pl-2">Player</span>
              <span className="w-16 text-right">Pts</span>
            </div>
            {overallStandings.slice(0, 15).map((row) => (
              <div
                key={row.user_id}
                className="flex items-center px-3 py-2.5"
              >
                <span className="w-8 shrink-0 text-center font-mono text-xs font-bold text-ps-text-ter">
                  {row.rank}
                </span>
                <span className="flex-1 truncate pl-2 text-sm text-ps-text">
                  {row.display_name}
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-sm font-bold text-ps-text">
                  {row.points}
                </span>
              </div>
            ))}
            {overallStandings.length > 15 && (
              <div className="px-3 py-2 text-center text-xs text-ps-text-ter">
                +{overallStandings.length - 15} more players
              </div>
            )}
          </div>
        </section>
      )}

      {/* Format groups */}
      {formatGroups.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold text-ps-text">Format</h2>
          <p className="mt-0.5 text-xs text-ps-text-ter">
            Survivor elimination — bottom players knocked out each stage
          </p>
          <div className="mt-3 space-y-3">
            {formatGroups.slice(0, 4).map((group) => (
              <div
                key={group.group_name}
                className="rounded-xl border border-ps-border bg-ps-surface"
              >
                <div className="px-3 py-2">
                  <h3 className="text-xs font-bold text-ps-text">
                    {group.group_name}
                  </h3>
                </div>
                <div className="divide-y divide-ps-border">
                  {group.members.map((m, i) => (
                    <div
                      key={`${group.group_name}-${i}`}
                      className="flex items-center px-3 py-2"
                    >
                      <span className="w-6 text-center font-mono text-xs font-bold text-ps-text-ter">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate pl-2 text-sm text-ps-text">
                        {m.display_name}
                      </span>
                      <span className="w-14 text-right font-mono text-sm font-bold text-ps-text">
                        {m.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {formatGroups.length > 4 && (
              <p className="text-center text-xs text-ps-text-ter">
                +{formatGroups.length - 4} more groups
              </p>
            )}
          </div>
        </section>
      )}

      {/* Chat preview */}
      <section className="mt-8">
        <h2 className="text-sm font-bold text-ps-text">Chat</h2>
        <p className="mt-0.5 text-xs text-ps-text-ter">
          Talk tactics with your rivals
        </p>
        <div className="mt-3">
          <ChatPreview />
        </div>
      </section>

      {/* CTA */}
      <div className="mt-10 text-center">
        <Link
          href="/wc/home"
          className="inline-flex items-center rounded-xl bg-ps-amber px-6 py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Join the competition
        </Link>
        <p className="mt-2 text-xs text-ps-text-ter">
          Free to play. Bragging rights only.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <span className="font-mono text-2xl font-extrabold text-ps-text">
        {value}
      </span>
      <p className="text-micro font-medium text-ps-text-ter">{label}</p>
    </div>
  );
}
