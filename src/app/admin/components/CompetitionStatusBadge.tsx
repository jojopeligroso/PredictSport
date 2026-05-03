import type { CompetitionStatus, EventStatus, NominationStatus } from "@/types/database";

const COMPETITION_STATUS_STYLES: Record<CompetitionStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const EVENT_STATUS_STYLES: Record<EventStatus, string> = {
  upcoming: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  locked: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  resulted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  postponed: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const NOMINATION_STATUS_STYLES: Record<NominationStatus, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

interface StatusBadgeProps {
  status: string;
  type: "competition" | "event" | "nomination";
}

export function StatusBadge({ status, type }: StatusBadgeProps) {
  let styles: string;
  if (type === "competition") {
    styles = COMPETITION_STATUS_STYLES[status as CompetitionStatus] ?? COMPETITION_STATUS_STYLES.draft;
  } else if (type === "event") {
    styles = EVENT_STATUS_STYLES[status as EventStatus] ?? EVENT_STATUS_STYLES.upcoming;
  } else {
    styles = NOMINATION_STATUS_STYLES[status as NominationStatus] ?? NOMINATION_STATUS_STYLES.pending;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles}`}
    >
      {status}
    </span>
  );
}
