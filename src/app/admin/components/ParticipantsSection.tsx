"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PersonaCallout, Avatar } from "@/components/ui";
import type { Competition, CompetitionMember, InviteToken, UserRole } from "@/types/database";

interface ParticipantsSectionProps {
  competition: Competition;
  members: (CompetitionMember & { user?: { display_name: string; email: string } })[];
  inviteTokens: InviteToken[];
  currentUserId: string;
}

export function ParticipantsSection({
  competition,
  members,
  inviteTokens,
  currentUserId,
}: ParticipantsSectionProps) {
  const router = useRouter();
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [editingCalloutId, setEditingCalloutId] = useState<string | null>(null);
  const [calloutDrafts, setCalloutDrafts] = useState<Record<string, string>>(
    () => {
      const drafts: Record<string, string> = {};
      for (const m of members ?? []) {
        drafts[m.user_id] = m.callout_label ?? `${m.user?.display_name ?? "Unknown"} reckons...`;
      }
      return drafts;
    }
  );
  const [savingCallout, setSavingCallout] = useState(false);

  const sortedMembers = [...(members ?? [])].sort((a, b) => {
    const roleOrder: Record<UserRole, number> = { admin: 0, co_admin: 1, participant: 2 };
    return (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
  });

  const handleRoleChange = async (memberUserId: string, newRole: UserRole) => {
    setUpdatingMemberId(memberUserId);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: competition.id,
          member_user_id: memberUserId,
          role: newRole,
        }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update role");
      }
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleSaveCallout = async (memberUserId: string) => {
    setSavingCallout(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: competition.id,
          member_user_id: memberUserId,
          callout_label: calloutDrafts[memberUserId] || null,
        }),
      });
      if (res.ok) {
        setEditingCalloutId(null);
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update callout label");
      }
    } finally {
      setSavingCallout(false);
    }
  };

  const handleGenerateInvite = async () => {
    setIsGeneratingInvite(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: competition.id,
          expires_in_hours: 168, // 7 days
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Failed to generate invite");
        return;
      }
      router.refresh();
    } catch {
      setInviteError("Network error");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const getInviteUrl = (token: string) => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/invite/${token}`;
  };

  const handleCopyInvite = async (token: string) => {
    try {
      await navigator.clipboard.writeText(getInviteUrl(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Fallback: select text
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-ps-text">
          Participants ({(members ?? []).length})
        </h3>
      </div>

      {/* Callout explainer */}
      <div
        className="mb-4 rounded-r-[10px] border-l-[3px] border-l-ps-amber px-3 py-2.5"
        style={{ background: "rgba(245,158,11,0.08)" }}
      >
        <p className="text-xs leading-relaxed text-ps-text">
          Each lad gets their own callout — it sits above the fun fact on every
          event card. Make &apos;em earn it.
        </p>
      </div>

      {/* Members list */}
      <div className="overflow-hidden rounded-[14px] border border-ps-border bg-ps-surface">
        {sortedMembers.map((member, i) => {
          const isCreator = member.user_id === competition.created_by;
          const isSelf = member.user_id === currentUserId;
          const isEditing = editingCalloutId === member.user_id;
          const displayName = member.user?.display_name ?? "Unknown";
          const initials = displayName.slice(0, 2).toUpperCase();

          return (
            <div
              key={member.id}
              className={`${i < sortedMembers.length - 1 ? "border-b border-ps-border" : ""} ${
                isEditing ? "bg-[rgba(245,158,11,0.05)]" : ""
              }`}
            >
              <button
                onClick={() => setEditingCalloutId(isEditing ? null : member.user_id)}
                className="flex w-full items-center gap-2.5 p-3 text-left"
              >
                <Avatar initials={initials} color="#f59e0b" size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13.5px] font-bold text-ps-text">
                      {displayName}
                    </span>
                    {member.role === "admin" && (
                      <span
                        className="rounded bg-ps-amber-soft px-1.5 py-px text-ps-amber-deep"
                        style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" as const }}
                      >
                        Admin
                      </span>
                    )}
                    {isSelf && (
                      <span className="text-xs text-ps-text-ter">(you)</span>
                    )}
                  </div>
                  {!isEditing && (
                    <p className="mt-0.5 truncate text-[11px] italic text-ps-text-sec">
                      {calloutDrafts[member.user_id] ?? `${displayName} reckons...`}
                    </p>
                  )}
                </div>
                {!isEditing && (
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ps-text-ter">
                    <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {isEditing && (
                <div className="px-3 pb-4">
                  <p
                    className="mb-1.5 text-ps-text-sec"
                    style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase" as const }}
                  >
                    Callout label
                  </p>
                  <input
                    type="text"
                    value={calloutDrafts[member.user_id] ?? ""}
                    onChange={(e) =>
                      setCalloutDrafts((d) => ({ ...d, [member.user_id]: e.target.value }))
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded-[10px] border-[1.5px] border-ps-amber bg-ps-surface p-2.5 text-[13px] italic text-ps-text outline-none"
                    placeholder={`${displayName} reckons...`}
                  />

                  {/* Live preview */}
                  <div className="mt-2.5">
                    <PersonaCallout
                      calloutLabel={calloutDrafts[member.user_id] || `${displayName} reckons...`}
                      fact="Arsenal have won 4 of their last 5 at the Emirates — and Saka's back from the knock."
                      variant="border"
                    />
                  </div>

                  {/* Role + actions */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveCallout(member.user_id);
                      }}
                      disabled={savingCallout}
                      className="rounded-[9px] bg-ps-amber px-4 py-2 text-[12.5px] font-extrabold text-[#1a1208] disabled:opacity-50"
                    >
                      {savingCallout ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCalloutId(null);
                      }}
                      className="rounded-[9px] border border-ps-border-strong bg-transparent px-3.5 py-2 text-xs font-bold text-ps-text"
                    >
                      Cancel
                    </button>
                    {!isSelf && !isCreator && (
                      <div className="ml-auto flex gap-1">
                        {member.role === "participant" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRoleChange(member.user_id, "co_admin");
                            }}
                            disabled={updatingMemberId === member.user_id}
                            className="rounded-xl px-2 py-1 text-xs font-medium text-ps-amber-deep hover:bg-ps-amber-soft disabled:opacity-50"
                          >
                            Promote
                          </button>
                        )}
                        {member.role === "co_admin" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRoleChange(member.user_id, "participant");
                            }}
                            disabled={updatingMemberId === member.user_id}
                            className="rounded-xl px-2 py-1 text-xs font-medium text-ps-text-sec hover:bg-ps-chip disabled:opacity-50"
                          >
                            Demote
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite links section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-semibold text-ps-text">
            Invite Links
          </h4>
          <button
            onClick={handleGenerateInvite}
            disabled={isGeneratingInvite}
            className="rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-3 py-1.5 text-sm font-medium text-[#1a1208] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isGeneratingInvite ? "Generating..." : "Generate Invite Link"}
          </button>
        </div>

        {inviteError && (
          <div className="mb-3 rounded-xl bg-ps-red-soft p-3 text-sm text-ps-red">
            {inviteError}
          </div>
        )}

        {/* Competition invite code */}
        <div className="mb-4 rounded-xl border border-ps-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ps-text">
                Competition Code
              </p>
              <p className="text-xs text-ps-text-ter">
                Share this code for quick join
              </p>
            </div>
            <code className="rounded-lg bg-ps-chip px-3 py-1 text-sm font-mono text-ps-text">
              {competition.invite_code}
            </code>
          </div>
        </div>

        {/* Generated invite tokens */}
        {(inviteTokens ?? []).length > 0 ? (
          <div className="space-y-2">
            {(inviteTokens ?? []).map((invite) => {
              const isExpired =
                invite.expires_at && new Date(invite.expires_at) < new Date();
              const isMaxed =
                invite.max_uses !== null && invite.use_count >= invite.max_uses;

              return (
                <div
                  key={invite.id}
                  className={`flex items-center justify-between rounded-xl border p-3 ${
                    isExpired || isMaxed
                      ? "border-ps-border bg-ps-bg opacity-60"
                      : "border-ps-border"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-ps-text-sec truncate">
                        {getInviteUrl(invite.token)}
                      </code>
                      {isExpired && (
                        <span className="shrink-0 text-xs text-ps-red">Expired</span>
                      )}
                      {isMaxed && (
                        <span className="shrink-0 text-xs text-ps-amber-deep">Max uses reached</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-ps-text-ter">
                      Uses: {invite.use_count}
                      {invite.max_uses !== null ? `/${invite.max_uses}` : ""}
                      {invite.expires_at &&
                        ` | Expires: ${new Date(invite.expires_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  {!isExpired && !isMaxed && (
                    <button
                      onClick={() => handleCopyInvite(invite.token)}
                      className="ml-3 shrink-0 rounded-xl border border-ps-border-strong bg-transparent px-2.5 py-1 text-xs font-medium text-ps-text transition-colors hover:bg-ps-chip"
                    >
                      {copiedToken === invite.token ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-ps-text-ter">
            No invite links generated yet. Create one to share with others.
          </p>
        )}
      </div>
    </div>
  );
}
