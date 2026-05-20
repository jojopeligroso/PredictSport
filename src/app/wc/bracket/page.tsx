import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

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
    .select("id, classification_id, status, version_number, submitted_at, locked_at")
    .eq("competition_id", competition.id)
    .eq("user_id", user.id)
    .neq("status", "superseded");

  const submissionMap = new Map(
    (submissions ?? []).map((s: { classification_id: string; id: string; status: string; version_number: number; submitted_at: string | null; locked_at: string | null }) => [s.classification_id, s])
  );

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <h1 className="text-xl font-extrabold text-ps-text">Bracket Predictions</h1>
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

              {submission && (
                <div className="mt-3 rounded-lg bg-ps-bg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ps-text-sec">
                      Version {submission.version_number}
                    </span>
                    {submission.submitted_at && (
                      <span className="font-mono text-xs text-ps-text-ter">
                        {new Date(submission.submitted_at).toLocaleDateString("en-GB")}
                      </span>
                    )}
                  </div>
                  {submission.status !== "locked" && (
                    <Link
                      href={`/wc/bracket/wizard?classificationId=${cls.id}`}
                      className="mt-2 block text-center text-xs font-semibold text-ps-amber hover:underline"
                    >
                      Edit bracket
                    </Link>
                  )}
                </div>
              )}

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
