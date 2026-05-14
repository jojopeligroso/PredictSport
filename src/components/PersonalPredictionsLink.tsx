import Link from "next/link";

export function PersonalPredictionsLink({ className }: { className?: string }) {
  return (
    <Link
      href="/competitions/personal"
      className={`flex items-center justify-between rounded-xl border border-ps-border bg-ps-surface px-4 py-3 transition-all duration-150 active:scale-[0.98] ${className ?? ""}`}
    >
      <div>
        <p className="text-sm font-semibold text-ps-text">My Personal Predictions</p>
        <p className="mt-0.5 text-xs text-ps-text-ter">Pick any fixture, no competition required</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-ps-text-ter">
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
