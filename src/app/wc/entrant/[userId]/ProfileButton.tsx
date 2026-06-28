import Link from "next/link";

interface ProfileButtonProps {
  userId: string;
  displayName: string;
  from?: string;
}

/**
 * Person-silhouette icon linking to the entrant profile page.
 *
 * Renders as a Link with 44px min touch target. Uses inline SVG matching
 * the TabBar icon style (24x24, strokeWidth 1.75, round caps/joins).
 *
 * stopPropagation prevents intercepting the FlipRow tap.
 */
export function ProfileButton({ userId, displayName, from }: ProfileButtonProps) {
  return (
    <Link
      href={`/wc/entrant/${userId}${from ? `?from=${from}` : ""}`}
      aria-label={`View profile for ${displayName}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-ps-text-ter hover:text-ps-amber-deep transition-colors"
    >
      <svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx={12} cy={8} r={4} />
        <path d="M20 21a8 8 0 1 0-16 0" />
      </svg>
    </Link>
  );
}
