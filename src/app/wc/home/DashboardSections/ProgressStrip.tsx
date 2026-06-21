"use client";

import { useT } from "@/lib/i18n";
import { OnboardingSection } from "@/components/wc/OnboardingFlow";
import { DashboardDatePills } from "./DashboardDatePills";
import type { DatePillSummary } from "../fetchDashboardData";

interface ProgressStripProps {
  total: number;
  picked: number;
  datePills: DatePillSummary[];
  now: Date | null;
  selectedDate: string | null;
  onSelectDate: (iso: string) => void;
}

export function ProgressStrip({
  total,
  picked,
  datePills,
  now,
  selectedDate,
  onSelectDate,
}: ProgressStripProps) {
  const t = useT();

  return (
    <OnboardingSection id="other">
      {total > 0 && (
        <div className="ps-panel mt-5 text-center">
          {datePills.length > 0 && (
            <DashboardDatePills
              pills={datePills}
              now={now}
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
            />
          )}
          <p className="mt-1 text-caption font-semibold uppercase tracking-wide text-ps-text-sec">
            {t('dash.picks_progress', { picked, total })}
          </p>
          <div className="mx-auto mt-1.5 h-1 max-w-[200px] overflow-hidden rounded-full bg-ps-border">
            <div
              className="h-full rounded-full bg-ps-amber transition-all"
              style={{ width: `${total > 0 ? (picked / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </OnboardingSection>
  );
}
