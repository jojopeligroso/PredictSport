"use client";

import { useT } from "@/lib/i18n";

interface OnboardingTooltipProps {
  title: string;
  description: string;
  onConfirm: () => void;
  confirmLabel?: string;
  showSkip?: boolean;
  onSkip?: () => void;
}

/**
 * OnboardingTooltip — reusable explainer card for the onboarding tour.
 *
 * Gold accent border, "Got it" pill button, optional "Skip tour" link.
 * Used at steps 2-5 to explain each dashboard section as it reveals.
 */
export function OnboardingTooltip({
  title,
  description,
  onConfirm,
  confirmLabel,
  showSkip,
  onSkip,
}: OnboardingTooltipProps) {
  const t = useT();
  const resolvedConfirmLabel = confirmLabel ?? t("onboarding.got_it");

  return (
    <div
      role="dialog"
      aria-label={title}
      className="mt-3 animate-in slide-in-from-bottom-2 duration-300 ease-out rounded-xl border-2 border-[var(--wc-gold,#d4af37)]/40 bg-ps-surface p-4 shadow-lg"
    >
      <h3 className="text-sm font-extrabold text-ps-text">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-ps-text-sec">
        {description}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-full bg-ps-amber px-4 py-2 text-xs font-semibold text-[#191512] transition-opacity hover:opacity-90 active:opacity-80"
        >
          {resolvedConfirmLabel}
        </button>
        {showSkip && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-ps-text-ter transition-colors hover:text-ps-text-sec"
          >
            {t("onboarding.skip_tour")}
          </button>
        )}
      </div>
    </div>
  );
}
