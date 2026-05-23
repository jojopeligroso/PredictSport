import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { BracketSubmissionData } from "@/types/tournament";

export const dynamic = "force-dynamic";

function describeDraftProgress(data: BracketSubmissionData | null): {
  pct: number;
  label: string;
} {
  if (!data) return { pct: 0, label: "Not started" };
  const groups = data.groupsV2 ?? [];
  const groupTotal = 72;
  const groupDone = groups.reduce(
    (sum, g) => sum + g.matches.filter((m) => m.result !== null).length,
    0,
  );
  const thirdsDone = (data.bestThirdPicks ?? []).length === 8;
  const koSlots = [
    "r32_m1","r32_m2","r32_m3","r32_m4","r32_m5","r32_m6","r32_m7","r32_m8",
    "r32_m9","r32_m10","r32_m11","r32_m12","r32_m13","r32_m14","r32_m15","r32_m16",
    "r16_m1","r16_m2","r16_m3","r16_m4","r16_m5","r16_m6","r16_m7","r16_m8",
    "qf_m1","qf_m2","qf_m3","qf_m4",
    "sf_m1","sf_m2",
    "final",
  ];
  const koDone = koSlots.filter(
    (s) => data.knockoutPicks?.[s]?.winner,
  ).length;
  const finalDone = Boolean(data.champion) && Boolean(data.thirdPlace);

  const total = groupTotal + 1 + koSlots.length + 1; // groups + thirds + KO + final
  const done = groupDone + (thirdsDone ? 1 : 0) + koDone + (finalDone ? 1 : 0);
  const pct = Math.min(100, Math.round((done / total) * 100));

  // Pick a friendly label for the deepest step they've reached.
  let label = "Groups in progress";
  if (groupDone === groupTotal) label = "Best thirds";
  if (thirdsDone) label = "Round of 32";
  if (koDone >= 16) label = "Round of 16";
  if (koDone >= 24) label = "Quarter-finals";
  if (koDone >= 28) label = "Semi-finals";
  if (koDone >= 30) label = "Final";
  if (finalDone) label = "Ready to submit";

  return { pct, label };
}

/**
 * /bracket — Bracket wizard entry point.
 * Shows status of user's bracket submissions (full and knockout).
 */
export default async function BracketPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wc/bracket");
  }

  // Find WC competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft", "completed"])
    .limit(1)
    .maybeSingle();

  if (!competition) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <h1 className="text-xl font-bold text-ps-text">No competition found</h1>
      </div>
    );
  }

  // Get bracket classifications
  const { data: classifications } = await supabase
    .from("classifications")
    .select("id, classification_key, name, status, config")
    .eq("competition_id", competition.id)
    .eq("classification_type", "bracket_survivor");

  // Get user's bracket submissions
  const { data: submissions } = await supabase
    .from("bracket_prediction_submissions")
    .select("id, classification_id, status, version_number, submitted_at, locked_at, bracket_data")
    .eq("competition_id", competition.id)
    .eq("user_id", user.id)
    .neq("status", "superseded");

  const submissionMap = new Map(
    (submissions ?? []).map(
      (s: {
        classification_id: string;
        id: string;
        status: string;
        version_number: number;
        submitted_at: string | null;
        locked_at: string | null;
        bracket_data: BracketSubmissionData | null;
      }) => [s.classification_id, s],
    ),
  );

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <h1 className="font-display text-2xl uppercase tracking-tight text-ps-text">Bracket Predictions</h1>
      <p className="mt-1 text-sm text-ps-text-sec">
        Predict the entire tournament bracket. One wrong pick and you&apos;re out.
      </p>

      <div className="mt-6 space-y-4">
        {(classifications ?? []).map((cls: {
          id: string;
          classification_key: string;
          name: string;
          status: string;
          config: Record<string, unknown>;
        }) => {
          const submission = submissionMap.get(cls.id);
          const isAvailable = cls.status === "active";
          const isKnockout = cls.classification_key === "knockout_bracket";

          return (
            <div
              key={cls.id}
              className="rounded-xl border border-ps-border bg-ps-surface p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-ps-text">{cls.name}</h2>
                  <p className="mt-0.5 text-xs text-ps-text-sec">
                    {isKnockout
                      ? "Knockout rounds only. Opens after group stage."
                      : "Full tournament bracket from groups to final."}
                  </p>
                </div>
                <StatusBadge
                  classificationStatus={cls.status}
                  submissionStatus={submission?.status}
                />
              </div>

              {isAvailable && !submission && (
                <Link
                  href={`/wc/bracket/wizard?classificationId=${cls.id}`}
                  className="mt-4 block w-full rounded-lg bg-ps-text px-4 py-2.5 text-center text-sm font-semibold text-ps-bg transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  Start bracket
                </Link>
              )}

              {submission && (() => {
                const progress = describeDraftProgress(submission.bracket_data);
                return (
                  <div className="mt-3 space-y-2 rounded-lg bg-ps-bg px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-sec">
                        Up to: {progress.label}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-ps-amber">
                        {progress.pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ps-chip">
                      <div
                        className="h-full bg-ps-amber transition-all duration-300"
                        style={{ width: `${progress.pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-ps-text-ter">
                        v{submission.version_number}
                        {submission.submitted_at && (
                          <>
                            {" · "}
                            {new Date(submission.submitted_at).toLocaleDateString("en-GB")}
                          </>
                        )}
                      </span>
                      {submission.status !== "locked" && (
                        <Link
                          href={`/wc/bracket/wizard?classificationId=${cls.id}`}
                          className="text-xs font-bold text-ps-amber hover:underline"
                        >
                          {progress.pct === 100 ? "Review & submit →" : "Continue →"}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })()}

              {!isAvailable && !submission && (
                <p className="mt-3 text-xs text-ps-text-ter">
                  {isKnockout
                    ? "Opens when the group stage is finalised."
                    : "Not yet available."}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({
  classificationStatus,
  submissionStatus,
}: {
  classificationStatus: string;
  submissionStatus?: string;
}) {
  if (submissionStatus === "locked") {
    return (
      <span className="rounded-full bg-ps-green/15 px-2 py-0.5 text-xs font-semibold text-ps-green">
        Locked
      </span>
    );
  }
  if (submissionStatus === "submitted") {
    return (
      <span className="rounded-full bg-ps-amber/15 px-2 py-0.5 text-xs font-semibold text-ps-amber">
        Submitted
      </span>
    );
  }
  if (submissionStatus === "draft") {
    return (
      <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-sec">
        Draft
      </span>
    );
  }
  if (classificationStatus === "draft") {
    return (
      <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-ter">
        Coming soon
      </span>
    );
  }
  return null;
}
