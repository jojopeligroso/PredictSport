/**
 * WcBrandedTitle — icon-anchored page header for WC competition surfaces.
 *
 * Renders the official FIFA WC 2026 mark in the top-left, with the page
 * title to its right (subtitle flows beneath the title, hugging the icon).
 * See `design/DESIGN-RULES.md` § "WC Branded Title" for the rule this
 * encodes; do not change the layout without updating that doc.
 *
 * Rule summary:
 *  - Icon top-left, fixed 44px tall (per current title scale of ~1.25rem).
 *  - Title block sits to the icon's right with `margin-top: -4px` so the
 *    title's cap-height aligns with the icon's top edge.
 *  - Subtitle is supporting copy — stays inside the title block (no
 *    secondary indent reset).
 *  - Only used under /wc/** routes. Do not roll out app-wide.
 */
import Link from "next/link";

interface WcBrandedTitleProps {
  title: string;
  subtitle?: string;
  /** Optional "← Back to X" link rendered above the title row. */
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function WcBrandedTitle({
  title,
  subtitle,
  backHref,
  backLabel,
  className = "",
}: WcBrandedTitleProps) {
  return (
    <div className={className}>
      {backHref && backLabel && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-ps-text-sec hover:text-ps-text"
        >
          <span aria-hidden>←</span> {backLabel}
        </Link>
      )}
      <div className={`flex items-start gap-3 ${backHref ? "mt-3" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/wc/fifa-wc2026-mark.svg"
          alt="FIFA World Cup 2026"
          width={44}
          height={44}
          className="h-11 w-auto shrink-0"
        />
        <div className="-mt-1 flex-1">
          <h1 className="font-display text-xl font-extrabold leading-tight text-ps-text">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-xs text-ps-text-sec">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
