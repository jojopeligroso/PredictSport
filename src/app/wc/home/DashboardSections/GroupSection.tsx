"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { GroupMiniTable } from "@/components/wc/GroupMiniTable";
import { OnboardingSection } from "@/components/wc/OnboardingFlow";

interface GroupSectionProps {
  isMember: boolean;
  classificationId: string | null;
  competitionId: string;
}

export function GroupSection({
  isMember,
  classificationId,
  competitionId,
}: GroupSectionProps) {
  return (
    <>
      {/* ── 6. Your Prediction Group (members only) ────────────────────── */}
      {isMember && (
        <OnboardingSection id="group">
          <section className="ps-panel mt-5">
            {classificationId ? (
              <GroupMiniTable
                classificationId={classificationId}
                competitionId={competitionId}
              />
            ) : (
              <MockGroupCard />
            )}
          </section>
        </OnboardingSection>
      )}
    </>
  );
}

/** Placeholder group table shown during onboarding when no classification exists. */
function MockGroupCard() {
  const t = useT();
  const mockRows = [
    { label: "You", pts: 0, isYou: true },
    { label: "Player 2", pts: 0, isYou: false },
    { label: "Player 3", pts: 0, isYou: false },
    { label: "Player 4", pts: 0, isYou: false },
  ];

  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-ps-text">{t('dash.your_group')}</h3>
        <Link
          href="/wc/leaderboard"
          className="text-body font-semibold text-ps-amber transition-opacity hover:opacity-80"
        >
          {t('dash.see_all_groups')}
        </Link>
      </div>
      <p className="mt-0.5 text-caption font-semibold uppercase tracking-wide text-ps-text-ter">
        {t('dash.group_x')}
      </p>
      <div className="mt-3 space-y-0 divide-y divide-ps-border">
        {mockRows.map((row, i) => (
          <div
            key={row.label}
            className={[
              "flex items-center gap-3 py-2",
              row.isYou ? "font-bold text-ps-amber" : "text-ps-text",
            ].join(" ")}
          >
            <span className="w-4 shrink-0 font-mono text-caption tabular-nums text-ps-text-ter">
              {i + 1}.
            </span>
            <span className="flex-1 text-sm">{row.label}</span>
            <span className="font-mono text-caption tabular-nums text-ps-text-sec">
              {row.pts} {t('common.pts')}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-ps-text-ter">
        {t('dash.groups_drawn_message')}
      </p>
    </div>
  );
}
