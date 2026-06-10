import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { BracketSubmissionData } from "@/types/tournament";
import { FoldedBracket } from "@/components/tournament/bracket/FoldedBracket";
import { WcBrandedTitle } from "@/components/wc/WcBrandedTitle";
import { loadGroupDataAndEventMap } from "@/lib/tournament/bracket/adapters/predictions-to-group-data";
import { groupDataToRankings } from "@/lib/tournament/bracket/group-ranking";
import {
  generateWC2026R32Matchups,
  WC2026_GROUPS,
} from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { describeDraftProgress } from "@/lib/bracket/bracket-progress";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * /bracket — Bracket wizard entry point.
 * Shows status of user's bracket submissions (full and knockout).
 */
export default async function BracketPage() {
  const supabase = await createClient();
  const t = await getServerT();
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
        <h1 className="text-xl font-bold text-ps-text">{t('leaderboard.no_competition')}</h1>
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

  // Group-stage progress now comes from `predictions` rows (per the 2026-05-23
  // unified-predictions amendment), not from `bracket_data.groupsV2`. One
  // count is enough for both bracket classifications shown on this page.
  const { count: groupPicksCount } = await supabase
    .from("predictions")
    .select("event_id, events!inner(competition_id, external_event_id)", {
      count: "exact",
      head: true,
    })
    .eq("user_id", user.id)
    .eq("prediction_type", "winner")
    .eq("events.competition_id", competition.id)
    .like("events.external_event_id", "manual:wc2026-grp-%");

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

  // ---- Folded bracket poster -------------------------------------------
  // Show the poster the moment the user has any progress (a draft submission
  // or at least one group pick). Prefer the full_bracket classification's
  // blob because it carries the user's bestThirdPicks; fall back to knockout.
  const fullBracketCls = (classifications ?? []).find(
    (c: { classification_key: string }) => c.classification_key === "full_bracket",
  );
  const knockoutCls = (classifications ?? []).find(
    (c: { classification_key: string }) => c.classification_key === "knockout_bracket",
  );
  const posterSubmission =
    (fullBracketCls && submissionMap.get(fullBracketCls.id)) ??
    (knockoutCls && submissionMap.get(knockoutCls.id)) ??
    null;

  const hasAnyProgress = Boolean(posterSubmission) || (groupPicksCount ?? 0) > 0;

  let posterRankings: Record<string, string[]> = {};
  let posterMatchups: Record<string, { home: string; away: string }> = {};
  let posterData: BracketSubmissionData | null = null;
  if (hasAnyProgress) {
    // Build live rankings from `predictions` (source of truth post 2026-05-23).
    const { groups: groupData } = await loadGroupDataAndEventMap(supabase, {
      userId: user.id,
      competitionId: competition.id,
      groups: WC2026_GROUPS,
    });
    posterRankings = groupDataToRankings(groupData);

    posterData = posterSubmission?.bracket_data ?? {
      bestThirdPicks: [],
      knockoutPicks: {},
      champion: "",
    };

    // Generate R32 matchups so empty knockout slots can still show "Home v Away".
    if (
      Object.keys(posterRankings).length === 12 &&
      (posterData.bestThirdPicks?.length ?? 0) === 8
    ) {
      posterMatchups = generateWC2026R32Matchups(
        posterRankings,
        posterData.bestThirdPicks,
      );
    }
  }
  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <WcBrandedTitle
        title={t('bracket.title')}
        subtitle={t('bracket.subtitle')}
      />

      {hasAnyProgress && posterData && (
        <div className="mt-6">
          <FoldedBracket
            submission={posterData}
            groupRankings={posterRankings}
            matchups={posterMatchups}
          />
        </div>
      )}

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
                      ? t('bracket.ko_desc')
                      : t('bracket.full_desc')}
                  </p>
                </div>
                <StatusBadge
                  classificationStatus={cls.status}
                  submissionStatus={submission?.status}
                  t={t}
                />
              </div>

              {isAvailable && !submission && (
                <Link
                  href={`/wc/bracket/wizard?classificationId=${cls.id}`}
                  className="mt-4 block w-full rounded-lg bg-ps-text px-4 py-2.5 text-center text-sm font-semibold text-ps-bg transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  {t('bracket.start')}
                </Link>
              )}

              {submission && (() => {
                const progress = describeDraftProgress(
                  submission.bracket_data,
                  groupPicksCount ?? 0,
                );
                return (
                  <div className="mt-3 space-y-2 rounded-lg bg-ps-bg px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-sec">
                        {t('bracket.up_to', { label: progress.label })}
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
                          {progress.pct === 100 ? t('bracket.review_submit') : t('bracket.continue')}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })()}

              {!isAvailable && !submission && (
                <p className="mt-3 text-xs text-ps-text-ter">
                  {isKnockout
                    ? t('bracket.opens_after_groups')
                    : t('bracket.not_available_msg')}
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
  t,
}: {
  classificationStatus: string;
  submissionStatus?: string;
  t: (key: string) => string;
}) {
  if (submissionStatus === "locked") {
    return (
      <span className="rounded-full bg-ps-green/15 px-2 py-0.5 text-xs font-semibold text-ps-green">
        {t('bracket.status_locked')}
      </span>
    );
  }
  if (submissionStatus === "submitted") {
    return (
      <span className="rounded-full bg-ps-amber/15 px-2 py-0.5 text-xs font-semibold text-ps-amber">
        {t('bracket.status_submitted')}
      </span>
    );
  }
  if (submissionStatus === "draft") {
    return (
      <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-sec">
        {t('bracket.status_draft')}
      </span>
    );
  }
  if (classificationStatus === "draft") {
    return (
      <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-ter">
        {t('common.coming_soon')}
      </span>
    );
  }
  return null;
}
