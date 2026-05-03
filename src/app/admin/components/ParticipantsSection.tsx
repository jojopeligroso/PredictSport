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
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Participants ({(members ?? []).length})
        </h3>
      </div>

      {/* Members list */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                Name
              </th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">
                Role
              </th>
              <th className="hidden px-4 py-2 text-left font-medium text-zinc-600 sm:table-cell dark:text-zinc-400">
                Joined
              </th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">
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
                  className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {member.user?.display_name ?? "Unknown"}
                      {isSelf && (
                        <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                          (you)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {member.user?.email ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        member.role === "admin"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : member.role === "co_admin"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {member.role.replace("_", " ")}
                    </span>
                    {isCreator && (
                      <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500">
                        (creator)
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-500 sm:table-cell dark:text-zinc-400">
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
                            className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
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
                            className="rounded-md px-2 py-1 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
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
          <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Invite Links
          </h4>
          <button
            onClick={handleGenerateInvite}
            disabled={isGeneratingInvite}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isGeneratingInvite ? "Generating..." : "Generate Invite Link"}
          </button>
        </div>

        {inviteError && (
          <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {inviteError}
          </div>
        )}

        {/* Competition invite code */}
        <div className="mb-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Competition Code
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Share this code for quick join
              </p>
            </div>
            <code className="rounded bg-zinc-100 px-3 py-1 text-sm font-mono text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
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
                  className={`flex items-center justify-between rounded-md border p-3 ${
                    isExpired || isMaxed
                      ? "border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
                      : "border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate">
                        {getInviteUrl(invite.token)}
                      </code>
                      {isExpired && (
                        <span className="shrink-0 text-xs text-red-500">Expired</span>
                      )}
                      {isMaxed && (
                        <span className="shrink-0 text-xs text-amber-500">Max uses reached</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                      Uses: {invite.use_count}
                      {invite.max_uses !== null ? `/${invite.max_uses}` : ""}
                      {invite.expires_at &&
                        ` | Expires: ${new Date(invite.expires_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  {!isExpired && !isMaxed && (
                    <button
                      onClick={() => handleCopyInvite(invite.token)}
                      className="ml-3 shrink-0 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {copiedToken === invite.token ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No invite links generated yet. Create one to share with others.
          </p>
        )}
      </div>
    </div>
  );
}
