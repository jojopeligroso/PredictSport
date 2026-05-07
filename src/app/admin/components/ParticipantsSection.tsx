"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

      {/* Members list */}
      <div className="overflow-x-auto rounded-2xl border border-ps-border">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-ps-border bg-ps-bg">
              <th className="px-4 py-2 text-left font-medium text-ps-text-sec">
                Name
              </th>
              <th className="px-4 py-2 text-left font-medium text-ps-text-sec">
                Role
              </th>
              <th className="hidden px-4 py-2 text-left font-medium text-ps-text-sec sm:table-cell">
                Joined
              </th>
              <th className="px-4 py-2 text-right font-medium text-ps-text-sec">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((member) => {
              const isCreator = member.user_id === competition.created_by;
              const isSelf = member.user_id === currentUserId;

              return (
                <tr
                  key={member.id}
                  className="border-b border-ps-border last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-ps-text">
                      {member.user?.display_name ?? "Unknown"}
                      {isSelf && (
                        <span className="ml-2 text-xs text-ps-text-ter">
                          (you)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ps-text-ter">
                      {member.user?.email ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        member.role === "admin"
                          ? "bg-ps-violet text-white"
                          : member.role === "co_admin"
                            ? "bg-ps-amber-soft text-ps-amber-deep"
                            : "bg-ps-chip text-ps-text-sec"
                      }`}
                    >
                      {member.role.replace("_", " ")}
                    </span>
                    {isCreator && (
                      <span className="ml-1 text-xs text-ps-text-ter">
                        (creator)
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-ps-text-ter sm:table-cell">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && !isCreator && (
                      <div className="flex justify-end gap-1">
                        {member.role === "participant" && (
                          <button
                            onClick={() =>
                              handleRoleChange(member.user_id, "co_admin")
                            }
                            disabled={updatingMemberId === member.user_id}
                            className="rounded-xl px-2 py-1 text-xs font-medium text-ps-amber-deep transition-colors hover:bg-ps-amber-soft disabled:opacity-50"
                          >
                            Promote
                          </button>
                        )}
                        {member.role === "co_admin" && (
                          <button
                            onClick={() =>
                              handleRoleChange(member.user_id, "participant")
                            }
                            disabled={updatingMemberId === member.user_id}
                            className="rounded-xl px-2 py-1 text-xs font-medium text-ps-text-sec transition-colors hover:bg-ps-chip disabled:opacity-50"
                          >
                            Demote
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
