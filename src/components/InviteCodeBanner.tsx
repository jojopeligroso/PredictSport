"use client";

import { useState, useCallback } from "react";

interface InviteCodeBannerProps {
  inviteCode: string;
  competitionName: string;
  joinUrl: string;
  memberCount?: number;
}

export function InviteCodeBanner({ inviteCode, competitionName, joinUrl, memberCount }: InviteCodeBannerProps) {
  const [copied, setCopied] = useState(false);

  const fullLink = `${joinUrl}?token=${encodeURIComponent(inviteCode)}`;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteCode]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      await navigator.share({
        title: `Join ${competitionName}`,
        text: `Join my prediction competition: ${competitionName}`,
        url: fullLink,
      });
    } else {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [competitionName, fullLink]);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-ps-border bg-ps-chip/50 px-3 py-2">
      <span className="text-xs text-ps-text-sec">Invite code:</span>
      {memberCount != null && memberCount > 0 && (
        <span className="rounded-full bg-ps-chip px-2 py-0.5 text-[10px] font-semibold text-ps-text-sec">
          {memberCount} {memberCount === 1 ? "player" : "players"}
        </span>
      )}
      <code className="font-mono text-xs font-semibold text-ps-text tracking-wide">
        {inviteCode}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="ml-auto min-h-[44px] rounded-md px-2 text-xs font-medium text-ps-text-sec transition-colors hover:bg-ps-chip hover:text-ps-text"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <button
        type="button"
        onClick={handleShare}
        className="min-h-[44px] rounded-md bg-ps-amber px-2.5 text-xs font-semibold text-ps-bg transition-opacity hover:opacity-90"
      >
        Share
      </button>
    </div>
  );
}
