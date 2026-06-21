"use client";

import { OnboardingSection } from "@/components/wc/OnboardingFlow";
import { InviteCodeBanner } from "@/components/InviteCodeBanner";

interface InviteSectionProps {
  inviteCode: string | null;
  memberCount: number;
  appUrl: string;
}

export function InviteSection({
  inviteCode,
  memberCount,
  appUrl,
}: InviteSectionProps) {
  return (
    <OnboardingSection id="invite">
      {inviteCode && (
        <section className="ps-panel mt-5">
          <InviteCodeBanner
            inviteCode={inviteCode}
            competitionName="WC Predict"
            joinUrl={`${appUrl}/join`}
            memberCount={memberCount}
          />
        </section>
      )}
    </OnboardingSection>
  );
}
