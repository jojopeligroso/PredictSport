"use client";

import { useT } from "@/lib/i18n";
import { OnboardingSection } from "@/components/wc/OnboardingFlow";
import { LiveModeToggle } from "@/components/wc/LiveModeToggle";
import { LiveChatDrawer } from "@/components/wc/LiveChatDrawer";
import { CommunityPicksCard } from "@/components/wc/CommunityPicksCard";
import { StatsCard } from "@/components/wc/StatsCard";
import type { LastChatMessage } from "../fetchDashboardData";

interface LiveSectionProps {
  liveEventExists: boolean;
  liveEnabled: boolean;
  liveMode: boolean;
  toggle: () => void;
  showPrompt: boolean;
  acceptAlwaysOff: () => void;
  declinePrompt: () => void;
  competitionId: string;
  classificationId: string | null;
  currentUserId: string | null;
  chatEnabled: boolean;
  isMember: boolean;
  memberRole: string;
  memberCount: number;
  lastChatMessage: LastChatMessage | null;
}

export function LiveSection({
  liveEventExists,
  liveEnabled,
  liveMode,
  toggle,
  showPrompt,
  acceptAlwaysOff,
  declinePrompt,
  competitionId,
  classificationId,
  currentUserId,
  chatEnabled,
  isMember,
  memberRole,
  memberCount,
  lastChatMessage,
}: LiveSectionProps) {
  const t = useT();

  return (
    <>
      {/* ── Live-mode toggle — only while a match is live ──────────────── */}
      {liveEventExists && (
        <LiveModeToggle
          liveEnabled={liveEnabled}
          onToggle={toggle}
          showPrompt={showPrompt}
          onAcceptAlwaysOff={acceptAlwaysOff}
          onDeclinePrompt={declinePrompt}
        />
      )}

      {/* ── 4. At a Glance / The Field (live state swaps content) ──── */}
      <OnboardingSection id="other">
        {liveMode ? (
          /* Live: island with community picks (THE FIELD) */
          <section className="ps-island mt-5">
            <p className="mb-1.5 flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-ps-text-ter">
              {t('dash.the_field')}
              <span className="inline-flex items-center gap-1 rounded-full bg-ps-red/90 px-1.5 py-0.5 text-micro font-bold normal-case text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" style={{ animation: "pulse-live 2s infinite" }} />
                {t('picks.live')}
              </span>
            </p>
            <CommunityPicksCard competitionId={competitionId} island />
          </section>
        ) : (
          /* Idle: stats panel */
          <section className="ps-panel mt-5">
            <p className="mb-1.5 text-caption font-semibold uppercase tracking-wide text-ps-text-ter">
              {t('dash.at_a_glance')}
            </p>
            {classificationId && currentUserId ? (
              <StatsCard
                classificationId={classificationId}
                currentUserId={currentUserId}
                competitionId={competitionId}
              />
            ) : (
              <div className="rounded-xl border border-ps-border bg-ps-surface px-4 py-5 text-center">
                <p className="text-xs text-ps-text-ter">
                  {t('dash.stats_placeholder')}
                </p>
              </div>
            )}
          </section>
        )}
      </OnboardingSection>

      {/* ── 4a. Live Chat Drawer (live mode only, position 2) ─────── */}
      {liveMode && chatEnabled && isMember && currentUserId && (
        <section className="mt-5">
          <LiveChatDrawer
            competitionId={competitionId}
            currentUserId={currentUserId}
            currentUserRole={memberRole}
            memberCount={memberCount}
            lastMessage={lastChatMessage}
          />
        </section>
      )}

      {/* ── 4b. Community Picks (hidden during live — merged into island) */}
      {isMember && !liveMode && (
        <OnboardingSection id="other">
          <div className="ps-panel mt-5">
            <CommunityPicksCard competitionId={competitionId} />
          </div>
        </OnboardingSection>
      )}
    </>
  );
}
