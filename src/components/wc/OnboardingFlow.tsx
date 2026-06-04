"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import { useTheme, type ResolvedTheme } from "@/components/ThemeProvider";
import { validateDisplayName, DISPLAY_NAME_MAX } from "@/lib/display-name";
import { OnboardingTooltip } from "./OnboardingTooltip";

// ── Constants ──────────────────────────────────────────────────────

const LS_COMPLETE = "wc-onboarding-complete";

export type OnboardingSectionId = "picks" | "group" | "invite";

const SECTION_STEP: Record<OnboardingSectionId, number> = {
  picks: 2,
  group: 3,
  invite: 4,
};

const SECTION_TOOLTIP: Record<
  OnboardingSectionId,
  { title: string; description: string }
> = {
  picks: {
    title: "Your Picks",
    description:
      "Pick who wins each match, then guess the exact score for bonus points.",
  },
  group: {
    title: "Your Group",
    description:
      "See where you stand. Climb the table by picking better than your mates.",
  },
  invite: {
    title: "Invite Friends",
    description:
      "Share your invite code. More players means more bragging rights.",
  },
};

// ── Context ────────────────────────────────────────────────────────

interface OnboardingCtx {
  /** Current step (-1 = inactive, 0-4 = active on dashboard). */
  step: number;
  /** Whether a given section should be at full opacity. */
  isRevealed: (section: OnboardingSectionId) => boolean;
  /** Advance to the next step. */
  advance: () => void;
  /** Skip remaining tour → step 5 redirect. */
  skip: () => void;
}

const OnboardingContext = createContext<OnboardingCtx>({
  step: -1,
  isRevealed: () => true,
  advance: () => {},
  skip: () => {},
});

export function useOnboarding() {
  return useContext(OnboardingContext);
}

// ── OnboardingSection ──────────────────────────────────────────────

/**
 * Wraps a dashboard section to control its reveal state during onboarding.
 *
 * - `id` = "picks" | "group" | "invite" — tracked sections
 * - `id` = "other" — always dimmed during onboarding steps 2-4
 */
export function OnboardingSection({
  id,
  children,
}: {
  id: OnboardingSectionId | "other";
  children: React.ReactNode;
}) {
  const { step, isRevealed, advance, skip } = useOnboarding();

  // Not in onboarding mode — render normally
  if (step === -1) return <>{children}</>;

  // Steps 0-1 are full-screen modals — dashboard hidden
  if (step < 2) return null;

  // "other" sections stay dimmed during the tour
  if (id === "other") {
    return (
      <div className="pointer-events-none opacity-30 transition-opacity duration-500">
        {children}
      </div>
    );
  }

  const revealed = isRevealed(id);
  const isActiveStep = step === SECTION_STEP[id];
  const tooltip = SECTION_TOOLTIP[id];

  if (!revealed) {
    return (
      <div className="pointer-events-none opacity-30 transition-opacity duration-500">
        {children}
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500 ease-out">
      {children}
      {isActiveStep && (
        <OnboardingTooltip
          title={tooltip.title}
          description={tooltip.description}
          onConfirm={advance}
          showSkip
          onSkip={skip}
        />
      )}
    </div>
  );
}

// ── OnboardingFlow ─────────────────────────────────────────────────

interface OnboardingFlowProps {
  children: React.ReactNode;
}

/**
 * Wraps the DashboardClient to run the onboarding sequence.
 *
 * - Step 0: Theme toggle (full-screen card)
 * - Step 1: Display name (full-screen card)
 * - Steps 2-4: Progressive dashboard reveal with tooltips
 * - After step 4 → redirects to /wc?onboarding=step5 for the home spotlight
 */
export function OnboardingFlow({ children }: OnboardingFlowProps) {
  const router = useRouter();
  const { resolved, setTheme } = useTheme();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(LS_COMPLETE) === "true") {
      setStep(-1);
    }
    setMounted(true);
  }, []);

  const goToStep5 = useCallback(() => {
    localStorage.setItem(LS_COMPLETE, "true");
    router.push("/wc?onboarding=step5");
  }, [router]);

  const advance = useCallback(() => {
    setStep((prev) => {
      if (prev >= 4) {
        goToStep5();
        return prev;
      }
      return prev + 1;
    });
  }, [goToStep5]);

  const skip = useCallback(() => {
    goToStep5();
  }, [goToStep5]);

  const isRevealed = useCallback(
    (section: OnboardingSectionId) => {
      if (step < 2) return false;
      return step >= SECTION_STEP[section];
    },
    [step],
  );

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    const err = validateDisplayName(trimmed);
    if (err) {
      setNameError(err);
      return;
    }

    setSubmitting(true);
    setNameError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setNameError(data?.error || "Something went wrong.");
        setSubmitting(false);
        return;
      }
      setStep(2);
    } catch {
      setNameError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  // Don't render until we check localStorage
  if (!mounted) return null;

  // Already completed — render dashboard normally
  if (step === -1) return <>{children}</>;

  return (
    <OnboardingContext.Provider value={{ step, isRevealed, advance, skip }}>
      {/* Step 0: Theme toggle */}
      {step === 0 && (
        <FullScreenCard>
          <StepIcon>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-ps-amber-deep"
            >
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </StepIcon>
          <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-ps-text">
            How do you like it?
          </h2>
          <p className="mt-1.5 text-sm text-ps-text-sec">
            Pick your vibe. You can change this anytime in settings.
          </p>
          <div className="mt-6 flex gap-3">
            <ThemeOption
              label="Light"
              active={resolved === "light"}
              onClick={() => setTheme("light")}
              preview="light"
            />
            <ThemeOption
              label="Dark"
              active={resolved === "dark"}
              onClick={() => setTheme("dark")}
              preview="dark"
            />
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mt-6 w-full rounded-xl bg-ps-amber px-4 py-3 text-sm font-semibold text-[#191512] transition-opacity hover:opacity-90"
          >
            Next
          </button>
        </FullScreenCard>
      )}

      {/* Step 1: Display name */}
      {step === 1 && (
        <FullScreenCard>
          <StepIcon>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-ps-amber-deep"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </StepIcon>
          <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-ps-text">
            What should we call you?
          </h2>
          <p className="mt-1.5 text-sm text-ps-text-sec">
            This is how you&apos;ll appear on the leaderboard.
          </p>
          <form onSubmit={handleNameSubmit} className="mt-5">
            <label htmlFor="onboarding-display-name" className="sr-only">
              Display name
            </label>
            <input
              id="onboarding-display-name"
              type="text"
              value={displayName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setDisplayName(e.target.value);
                if (nameError) setNameError("");
              }}
              placeholder="e.g. Gerry Ramos"
              maxLength={DISPLAY_NAME_MAX}
              autoComplete="off"
              autoFocus
              className={[
                "w-full rounded-xl border bg-ps-bg px-4 py-3 text-sm text-ps-text",
                "placeholder:text-ps-text-ter",
                "focus:outline-none focus:ring-2 focus:ring-ps-amber focus:ring-offset-1",
                nameError ? "border-ps-red" : "border-ps-border",
              ].join(" ")}
            />
            {nameError && (
              <p className="mt-1.5 text-xs text-ps-red">{nameError}</p>
            )}
            <button
              type="submit"
              disabled={submitting || displayName.trim().length === 0}
              className="mt-4 w-full rounded-xl bg-ps-amber px-4 py-3 text-sm font-semibold text-[#191512] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving\u2026" : "Continue"}
            </button>
          </form>
        </FullScreenCard>
      )}

      {/* Steps 2-4: Dashboard with progressive reveal */}
      {step >= 2 && children}
    </OnboardingContext.Provider>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function FullScreenCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ps-bg/80 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[420px] animate-in slide-in-from-bottom-4 duration-300 ease-out rounded-2xl border-2 border-ps-amber/30 bg-ps-surface p-6 shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}

function StepIcon({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-ps-amber-soft"
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

function ThemeOption({
  label,
  active,
  onClick,
  preview,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  preview: "light" | "dark";
}) {
  const bg = preview === "light" ? "bg-[#efe9de]" : "bg-[#191512]";
  const text = preview === "light" ? "text-[#191512]" : "text-[#efe9de]";
  const border = active
    ? "border-ps-amber ring-2 ring-ps-amber/30"
    : "border-ps-border";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border-2 ${border} ${bg} p-4 text-center transition-all`}
    >
      <span className={`text-sm font-semibold ${text}`}>{label}</span>
      {active && (
        <span className="mt-2 block text-xs font-medium text-ps-amber">
          Selected
        </span>
      )}
    </button>
  );
}

// ── Step 5: Home spotlight (used on /wc page) ──────────────────────

/**
 * Renders a spotlight overlay on the /wc page pointing users to the
 * "Home" nav link. Shown once after steps 0-4 complete.
 */
export function OnboardingHomeSpotlight() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if we arrived via the onboarding redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") !== "step5") return;

    // Small delay so the page settles before showing the spotlight
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setVisible(false);
    // Clean up the URL param
    const url = new URL(window.location.href);
    url.searchParams.delete("onboarding");
    window.history.replaceState(null, "", url.toString());
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        aria-hidden="true"
        onClick={dismiss}
      />

      {/* Highlight the Home link — position near the top nav */}
      <div className="fixed left-1/2 top-16 z-50 w-full max-w-[340px] -translate-x-1/2 px-4">
        {/* Arrow pointing up */}
        <div className="flex justify-center">
          <div className="h-0 w-0 border-x-8 border-b-8 border-x-transparent border-b-ps-surface" />
        </div>
        <div
          role="dialog"
          aria-label="Dashboard shortcut"
          className="animate-in slide-in-from-top-2 duration-300 ease-out rounded-xl border-2 border-ps-amber/40 bg-ps-surface p-4 shadow-lg"
        >
          <h3 className="text-sm font-extrabold text-ps-text">
            Your Dashboard
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ps-text-sec">
            Tap <span className="font-semibold text-ps-text">Home</span> in the
            nav to return to your dashboard anytime.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full bg-ps-amber px-4 py-1.5 text-xs font-semibold text-[#191512] transition-opacity hover:opacity-90 active:opacity-80"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
