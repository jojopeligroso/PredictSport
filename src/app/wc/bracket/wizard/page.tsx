import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { BracketWizard } from "@/components/tournament/bracket/BracketWizard";
import { WcBrandedTitle } from "@/components/wc/WcBrandedTitle";
import { BracketVersionFooter } from "@/components/wc/BracketVersionFooter";
import type { BracketSubmissionData } from "@/types/tournament";
import { WC2026_GROUPS } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { loadGroupDataAndEventMap } from "@/lib/tournament/bracket/adapters/predictions-to-group-data";
import { getServerT } from "@/lib/i18n/server";

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
  const t = await getServerT();
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
        <h1 className="text-xl font-bold text-ps-text">{t('bracket.not_available_title')}</h1>
        <p className="mt-2 text-sm text-ps-text-sec">
          {t('bracket.not_accepting')}
        </p>
        <Link href="/wc/bracket" className="mt-4 inline-block text-sm font-medium text-ps-amber hover:underline">
          {t('bracket.back')}
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
        <h1 className="text-xl font-bold text-ps-text">{t('bracket.locked_title')}</h1>
        <p className="mt-2 text-sm text-ps-text-sec">
          {t('bracket.locked_desc')}
        </p>
        <Link href="/wc/bracket" className="mt-4 inline-block text-sm font-medium text-ps-amber hover:underline">
          {t('bracket.back')}
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
      <WcBrandedTitle
        title={classification.name}
        subtitle={
          isKnockout
            ? t('bracket.ko_wizard_desc')
            : t('bracket.full_wizard_desc')
        }
        backHref="/wc/bracket"
        backLabel={t('bracket.back')}
      />

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

      {existingSubmission && (
        <BracketVersionFooter
          versionNumber={existingSubmission.version_number}
          status={existingSubmission.status}
        />
      )}
    </div>
  );
}
