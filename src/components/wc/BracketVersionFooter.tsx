/**
 * BracketVersionFooter — small "v12 · submitted" chip rendered at the
 * bottom of bracket pages. Lives here so the page header can stay clean
 * and icon-led (see WcBrandedTitle). Quiet by design — version metadata,
 * not a status the user needs to act on.
 */
interface BracketVersionFooterProps {
  versionNumber: number;
  status: string;
  className?: string;
}

export function BracketVersionFooter({
  versionNumber,
  status,
  className = "",
}: BracketVersionFooterProps) {
  return (
    <div className={`mt-8 flex justify-center ${className}`}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ps-chip px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
        <span>v{versionNumber}</span>
        <span aria-hidden>·</span>
        <span>{status}</span>
      </span>
    </div>
  );
}
