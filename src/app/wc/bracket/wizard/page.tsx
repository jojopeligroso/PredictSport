import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { BracketWizard } from "@/components/tournament/bracket/BracketWizard";
import type { BracketSubmissionData } from "@/types/tournament";
import { WC2026_GROUPS } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { loadGroupDataAndEventMap } from "@/lib/tournament/bracket/adapters/predictions-to-group-data";

export const dynamic = "force-dynamic";

/**
 * /bracket/wizard?classificationId=X — Bracket prediction wizard.
 * Full bracket mode (groups → knockout → champion) or knockout-only.
 */
export default async function BracketWizardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const classificationId = typeof params.classificationId === "string"
    ? params.classificationId
    : undefined;

  if (!classificationId) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/wc/bracket/wizard?classificationId=${classificationId}`);
  }

  // Get classification
  const { data: classification } = await supabase
    .from("classifications")
    .select("id, classification_key, name, status, competition_id")
    .eq("id", classificationId)
    .single();

  if (!classification) {
    notFound();
  }

  if (classification.status !== "active") {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <h1 className="text-xl font-bold text-ps-text">Not Available</h1>
        <p className="mt-2 text-sm text-ps-text-sec">
          This bracket classification is not currently accepting submissions.
        </p>
        <Link href="/wc/bracket" className="mt-4 inline-block text-sm font-medium text-ps-amber hover:underline">
          Back to brackets
        </Link>
      </div>
    );
  }

  const isKnockout = classification.classification_key === "knockout_bracket";

  // Load existing draft if any
  const { data: existingSubmission } = await supabase
    .from("bracket_prediction_submissions")
    .select("id, bracket_data, status, version_number")
    .eq("classification_id", classificationId)
    .eq("user_id", user.id)
    .neq("status", "superseded")
    .maybeSingle();

  if (existingSubmission?.status === "locked") {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <h1 className="text-xl font-bold text-ps-text">Bracket Locked</h1>
        <p className="mt-2 text-sm text-ps-text-sec">
          Your bracket has been locked and cannot be modified.
        </p>
        <Link href="/wc/bracket" className="mt-4 inline-block text-sm font-medium text-ps-amber hover:underline">
          Back to brackets
        </Link>
      </div>
    );
  }

  // Source-of-truth load: group W/D/L and tiebreaker scores live in
  // `predictions`; this projection feeds the wizard's initial state and per-
  // tap writes. See docs/DESIGN-WC-UNIFIED-PREDICTIONS.md (Amendment 2026-05-23).
  const { groups: initialGroups, eventIdByMatchId } =
    await loadGroupDataAndEventMap(supabase, {
      userId: user.id,
      competitionId: classification.competition_id,
      groups: WC2026_GROUPS,
    });

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-5 pb-16">
      <Link
        href="/wc/bracket"
        className="inline-flex items-center gap-1 text-xs font-medium text-ps-text-sec hover:text-ps-text"
      >
        <span aria-hidden>←</span> Back to brackets
      </Link>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <h1 className="font-display text-xl font-extrabold leading-tight text-ps-text">
          {classification.name}
        </h1>
        {existingSubmission && (
          <span className="shrink-0 rounded-full bg-ps-chip px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-sec">
            v{existingSubmission.version_number} · {existingSubmission.status}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-ps-text-sec">
        {isKnockout
          ? "Pick the advancing team in each knockout match."
          : "Predict every group + knockout match before kickoff."}
      </p>

      <div className="mt-5">
        <BracketWizard
          classificationId={classificationId}
          competitionId={classification.competition_id}
          mode={isKnockout ? "knockout_only" : "full"}
          existingData={
            existingSubmission?.bracket_data as BracketSubmissionData | undefined
          }
          initialGroups={initialGroups}
          eventIdByMatchId={eventIdByMatchId}
        />
      </div>
    </div>
  );
}
