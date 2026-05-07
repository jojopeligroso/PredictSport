import type { CompetitionStatus, EventStatus, NominationStatus } from "@/types/database";

const COMPETITION_STATUS_STYLES: Record<CompetitionStatus, string> = {
  draft: "bg-ps-chip text-ps-text-sec",
  active: "bg-ps-green-soft text-ps-green",
  completed: "bg-ps-amber-soft text-ps-amber-deep",
};

const EVENT_STATUS_STYLES: Record<EventStatus, string> = {
  upcoming: "bg-ps-chip text-ps-text-sec",
  locked: "bg-ps-amber-soft text-ps-amber-deep",
  resulted: "bg-ps-green-soft text-ps-green",
  postponed: "bg-ps-amber-soft text-ps-amber-deep",
  cancelled: "bg-ps-red-soft text-ps-red",
};

const NOMINATION_STATUS_STYLES: Record<NominationStatus, string> = {
  pending: "bg-ps-amber-soft text-ps-amber-deep",
  approved: "bg-ps-green-soft text-ps-green",
  rejected: "bg-ps-red-soft text-ps-red",
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
