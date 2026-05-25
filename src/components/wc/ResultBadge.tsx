interface ResultBadgeProps {
  status: "final" | "provisional";
  className?: string;
}

export function ResultBadge({ status, className = "" }: ResultBadgeProps) {
  const baseClasses =
    "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest";

  const variantClasses =
    status === "final"
      ? "bg-ps-chip text-ps-ink"
      : "bg-ps-amber/15 text-ps-amber";

  return (
    <span className={`${baseClasses} ${variantClasses} ${className}`}>
      {status === "final" ? "Final" : "Provisional"}
    </span>
  );
}
