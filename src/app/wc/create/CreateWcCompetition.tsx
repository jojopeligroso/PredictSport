"use client";

/**
 * CreateWcCompetition — client form for /wc/create.
 *
 * Lets the user pick max participants and classifications, then POSTs to
 * /api/admin/competitions/template to create a World Cup 2026 competition.
 * On success, shows the invite code and a link back to /wc.
 *
 * Usage:
 *   <CreateWcCompetition />
 */

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreatedCompetition {
  id: string;
  name: string;
  invite_code: string;
}

interface ApiSuccessResponse {
  competition: CreatedCompetition;
  rounds: number;
  events: number;
  prediction_types: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PARTICIPANT_OPTIONS = [8, 12, 16, 24, 32, 48] as const;
type ParticipantOption = (typeof PARTICIPANT_OPTIONS)[number];

interface Classification {
  id: string;
  labelKey: string;
  descKey: string;
  defaultChecked: boolean;
  required: boolean;
}

const CLASSIFICATIONS: Classification[] = [
  {
    id: "overall",
    labelKey: "create.class_overall",
    descKey: "create.class_overall_desc",
    defaultChecked: true,
    required: true,
  },
  {
    id: "format",
    labelKey: "create.class_format",
    descKey: "create.class_format_desc",
    defaultChecked: true,
    required: false,
  },
  {
    id: "full_bracket",
    labelKey: "create.class_bracket",
    descKey: "create.class_bracket_desc",
    defaultChecked: false,
    required: false,
  },
  {
    id: "ko_bracket",
    labelKey: "create.class_ko_bracket",
    descKey: "create.class_ko_bracket_desc",
    defaultChecked: false,
    required: false,
  },
];

// ---------------------------------------------------------------------------
// InviteCodeBlock (mirrored from ClassificationTabs.tsx)
// ---------------------------------------------------------------------------

function InviteCodeBlock({ code }: { code: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleCopy = async () => {
    setError(false);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const el = document.createElement("textarea");
        el.value = code;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(true);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy competition code ${code}`}
        className="group flex items-center gap-2 rounded-lg border border-ps-border bg-ps-bg px-4 py-2 transition-colors hover:border-ps-amber/40"
      >
        <span className="font-mono text-base font-bold tracking-wider text-ps-text">
          {code}
        </span>
        <span
          aria-hidden="true"
          className="text-xs font-semibold text-ps-text-ter transition-colors group-hover:text-ps-amber-deep"
        >
          {copied ? t("create.copied") : t("create.copy")}
        </span>
      </button>
      {error && (
        <p className="text-xs text-ps-red">
          {t("create.copy_error")}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success state
// ---------------------------------------------------------------------------

function SuccessPanel({ competition }: { competition: CreatedCompetition }) {
  const t = useT();
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-ps-border bg-ps-surface px-5 py-6 text-center"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-ps-amber">
        {t("create.success_label")}
      </p>
      <h2 className="mt-2 font-display text-lg font-extrabold text-ps-text">
        {competition.name}
      </h2>
      <p className="mt-1 text-xs text-ps-text-sec">
        {t("create.share_message")}
      </p>

      <div className="mt-5 border-t border-ps-border pt-5">
        <InviteCodeBlock code={competition.invite_code} />
      </div>

      <Link
        href="/wc"
        className="mt-6 inline-block w-full rounded-xl bg-ps-amber px-4 py-3 text-sm font-semibold text-ps-bg transition-colors hover:bg-ps-amber/90"
      >
        {t("create.go_to_comp")}
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function CreateWcCompetition() {
  const t = useT();
  const [maxParticipants, setMaxParticipants] =
    useState<ParticipantOption>(16);
  const [checkedClassifications, setCheckedClassifications] = useState<
    Set<string>
  >(
    new Set(
      CLASSIFICATIONS.filter((c) => c.defaultChecked).map((c) => c.id),
    ),
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdCompetition, setCreatedCompetition] =
    useState<CreatedCompetition | null>(null);

  const toggleClassification = (id: string, required: boolean) => {
    if (required) return;
    setCheckedClassifications((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/admin/competitions/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "world_cup_2026" }),
      });

      if (!res.ok) {
        let message = t("create.error_generic");
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // ignore parse error
        }
        setSubmitError(message);
        return;
      }

      const data = (await res.json()) as ApiSuccessResponse;
      setCreatedCompetition(data.competition);
    } catch {
      setSubmitError(t("create.error_network"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdCompetition) {
    return <SuccessPanel competition={createdCompetition} />;
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Max participants */}
      <fieldset>
        <legend className="text-sm font-semibold text-ps-text">
          {t("create.max_participants")}
        </legend>
        <div
          role="group"
          aria-label={t("create.max_participants")}
          className="mt-3 flex flex-wrap gap-2"
        >
          {PARTICIPANT_OPTIONS.map((n) => {
            const selected = maxParticipants === n;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={selected}
                onClick={() => setMaxParticipants(n)}
                className={[
                  "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber/50",
                  selected
                    ? "bg-ps-amber text-ps-bg"
                    : "border border-ps-border bg-ps-surface text-ps-text-sec hover:border-ps-amber/40 hover:text-ps-text",
                ].join(" ")}
              >
                {n}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Classifications */}
      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ps-text">
          {t("create.classifications_heading")}
        </legend>
        <p className="mt-0.5 text-xs text-ps-text-sec">
          {t("create.classifications_helper")}
        </p>
        <div className="mt-3 space-y-2">
          {CLASSIFICATIONS.map((cls) => {
            const checked = checkedClassifications.has(cls.id);
            return (
              <label
                key={cls.id}
                className={[
                  "flex cursor-pointer items-start gap-3 rounded-lg border border-ps-border bg-ps-surface px-3.5 py-3 transition-colors",
                  cls.required
                    ? "cursor-default opacity-80"
                    : "hover:border-ps-amber/30",
                  checked && !cls.required ? "border-ps-amber/40" : "",
                ].join(" ")}
              >
                {/* Custom checkbox */}
                <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={cls.required}
                    onChange={() => toggleClassification(cls.id, cls.required)}
                    aria-label={t(cls.labelKey)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={[
                      "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                      checked
                        ? "border-ps-amber bg-ps-amber"
                        : "border-ps-border bg-ps-bg",
                    ].join(" ")}
                  >
                    {checked && (
                      <svg
                        viewBox="0 0 10 8"
                        fill="none"
                        className="h-2.5 w-2.5"
                        aria-hidden="true"
                      >
                        <path
                          d="M1 4l2.5 2.5L9 1"
                          stroke="#191512"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                </span>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ps-text">
                      {t(cls.labelKey)}
                    </span>
                    {cls.required && (
                      <span className="rounded-full bg-ps-chip px-1.5 py-0.5 text-[10px] font-semibold text-ps-text-ter">
                        {t("create.required")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-ps-text-sec">
                    {t(cls.descKey)}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Error */}
      {submitError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-ps-red/30 bg-ps-red/10 px-3.5 py-2.5 text-xs text-ps-red"
        >
          {submitError}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 w-full rounded-xl bg-ps-amber px-4 py-3 text-sm font-semibold text-ps-bg transition-colors hover:bg-ps-amber/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber/50"
      >
        {isSubmitting ? t("create.button_loading") : t("create.button")}
      </button>

      {/* Cross-link */}
      <p className="mt-6 text-center text-xs text-ps-text-sec">
        <Link
          href="/wc/join"
          className="font-semibold text-ps-text underline-offset-2 hover:underline"
        >
          {t("create.have_code_link")}
        </Link>
      </p>
    </form>
  );
}
