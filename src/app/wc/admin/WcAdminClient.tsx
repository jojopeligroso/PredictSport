"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, avatarColor } from "@/components/ui/Avatar";
import { useT } from "@/lib/i18n";

// --- Types ---

interface MemberData {
  id: string;
  user_id: string;
  role: "admin" | "co_admin" | "mod" | "participant";
  joined_at: string;
  display_name: string;
  email: string;
}

interface ClassificationData {
  id: string;
  key: string;
  name: string;
  status: string;
  type: string;
}

interface InviteTokenData {
  id: string;
  token: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
}

type WcAdminProps =
  | { mode: "create" }
  | {
      mode: "dashboard";
      competition: {
        id: string;
        name: string;
        status: string;
        invite_code: string;
        created_by: string;
      };
      members: MemberData[];
      classifications: ClassificationData[];
      inviteTokens: InviteTokenData[];
      pw1Locked: boolean;
      currentUserId: string;
    };

// --- Classification definitions ---

const CLASSIFICATION_OPTIONS = [
  {
    key: "overall",
    label: "Overall",
    description: "Cumulative points across all matches",
    alwaysOn: true,
  },
  {
    key: "format",
    label: "Format",
    description: "Elimination groups with stage-local scoring",
  },
  {
    key: "full_bracket",
    label: "Full Bracket",
    description: "Predict entire bracket from group stage. Includes R32 Classification automatically.",
  },
  {
    key: "knockout_bracket",
    label: "Knockout Bracket",
    description: "Predict knockout rounds after group stage completes",
  },
] as const;

// --- Component ---

export function WcAdminClient(props: WcAdminProps) {
  if (props.mode === "create") {
    return <CreateForm />;
  }
  return <Dashboard {...props} />;
}

// ========== CREATE FORM ==========

function CreateForm() {
  const router = useRouter();
  const [name, setName] = useState("World Cup 2026");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [selectedClassifications, setSelectedClassifications] = useState<string[]>([
    "overall",
    "format",
    "full_bracket",
    "knockout_bracket",
  ]);
  const [groupDrawHours, setGroupDrawHours] = useState(24);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleClassification = (key: string) => {
    if (key === "overall") return; // always on
    setSelectedClassifications((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/wc/admin/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          visibility,
          enabledClassifications: selectedClassifications,
          groupDrawHoursBefore: groupDrawHours,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create competition");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <h2 className="text-sm font-bold text-ps-text">Create Competition</h2>

        {/* Name */}
        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wider text-ps-text-ter">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text outline-none focus:border-ps-amber"
          />
        </label>

        {/* Visibility */}
        <fieldset className="mt-4">
          <legend className="text-xs font-bold uppercase tracking-wider text-ps-text-ter">
            Visibility
          </legend>
          <div className="mt-1.5 flex gap-2">
            {(["private", "public"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  visibility === v
                    ? "bg-ps-text text-ps-bg"
                    : "border border-ps-border bg-transparent text-ps-text-sec hover:bg-ps-chip"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Classifications */}
        <fieldset className="mt-4">
          <legend className="text-xs font-bold uppercase tracking-wider text-ps-text-ter">
            Classifications
          </legend>
          <div className="mt-2 space-y-2">
            {CLASSIFICATION_OPTIONS.map((cls) => {
              const checked = selectedClassifications.includes(cls.key);
              const disabled = "alwaysOn" in cls && cls.alwaysOn;
              return (
                <label
                  key={cls.key}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    checked
                      ? "border-ps-amber bg-[rgba(245,158,11,0.06)]"
                      : "border-ps-border bg-ps-surface"
                  } ${disabled ? "opacity-70" : "cursor-pointer hover:border-ps-border-strong"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleClassification(cls.key)}
                    className="mt-0.5 accent-[#f59e0b]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-ps-text">
                      {cls.label}
                    </span>
                    <p className="mt-0.5 text-xs text-ps-text-sec">
                      {cls.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Group draw timing */}
        {selectedClassifications.includes("format") && (
          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wider text-ps-text-ter">
              Draw groups (hours before first match)
            </span>
            <input
              type="number"
              value={groupDrawHours}
              onChange={(e) => setGroupDrawHours(Math.max(1, Number(e.target.value) || 24))}
              min={1}
              max={168}
              className="mt-1 block w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text outline-none focus:border-ps-amber"
            />
            <p className="mt-1 text-caption text-ps-text-ter">
              Groups are drawn automatically this many hours before the first match of each stage.
            </p>
          </label>
        )}

        {error && (
          <p className="mt-3 text-sm font-medium text-ps-red">{error}</p>
        )}

        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="mt-5 w-full rounded-lg bg-ps-amber px-4 py-2.5 text-sm font-bold text-[#1a1208] transition-opacity disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Competition"}
        </button>
      </div>
    </div>
  );
}

// ========== DASHBOARD ==========

function Dashboard({
  competition,
  members,
  classifications,
  inviteTokens,
  pw1Locked,
  currentUserId,
}: Extract<WcAdminProps, { mode: "dashboard" }>) {
  const t = useT();
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const handleRemove = async (memberUserId: string, displayName: string) => {
    if (!confirm(`Remove ${displayName} from the competition?`)) return;
    setRemovingId(memberUserId);

    try {
      const res = await fetch("/api/admin/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: competition.id,
          member_user_id: memberUserId,
        }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to remove member");
      }
    } finally {
      setRemovingId(null);
    }
  };

  const copyInviteLink = async () => {
    const url = `${window.location.origin}/wc/join?code=${competition.invite_code}`;
    await navigator.clipboard.writeText(url);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const [promotingId, setPromotingId] = useState<string | null>(null);

  const roleOrder = { admin: 0, co_admin: 1, mod: 2, participant: 3 };
  const sortedMembers = [...members].sort(
    (a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3)
  );

  const handleRoleChange = async (
    memberUserId: string,
    newRole: "mod" | "participant",
    displayName: string
  ) => {
    const action = newRole === "mod" ? "Promote" : "Demote";
    if (!confirm(`${action} ${displayName} to ${newRole}?`)) return;
    setPromotingId(memberUserId);

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
        alert(data.error || `Failed to ${action.toLowerCase()}`);
      }
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      {/* Header card */}
      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <h2 className="text-sm font-bold text-ps-text">{competition.name}</h2>
        <div className="mt-2 flex items-center gap-3">
          <StatusBadge status={competition.status} />
          <span className="font-mono text-xs text-ps-text-ter">
            {t("admin.entrants_count", { count: members.length })}
          </span>
        </div>
      </div>

      {/* Invite & share */}
      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ps-text-ter">
          {t("admin.invite_link")}
        </h3>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-ps-bg px-3 py-2 font-mono text-xs text-ps-text-sec">
            {competition.invite_code}
          </code>
          <button
            type="button"
            onClick={copyInviteLink}
            className="shrink-0 rounded-lg bg-ps-amber px-3.5 py-2.5 text-xs font-bold text-[#1a1208] transition-opacity hover:opacity-90"
          >
            {copiedInvite ? t("admin.copied") : t("admin.copy_link")}
          </button>
        </div>
      </div>

      {/* Entrants */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-ps-text-ter">
          {t("admin.entrants")}
        </h3>
        <div className="mt-2 overflow-hidden rounded-xl border border-ps-border bg-ps-surface">
          {sortedMembers.map((m, i) => {
            const initials = m.display_name
              .split(" ")
              .map((w) => Array.from(w)[0] ?? "")
              .join("")
              .slice(0, 2);
            const isCreator = m.user_id === competition.created_by;
            const isSelf = m.user_id === currentUserId;
            const canRemove =
              !pw1Locked && !isCreator && !isSelf && (m.role === "participant" || m.role === "mod");
            const canPromoteToMod = !isCreator && !isSelf && m.role === "participant";
            const canDemoteFromMod = !isCreator && !isSelf && m.role === "mod";

            return (
              <div
                key={m.user_id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-ps-border" : ""
                }`}
              >
                <Avatar
                  initials={initials}
                  color={avatarColor(m.user_id)}
                  size={34}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ps-text">
                      {m.display_name}
                    </span>
                    {(m.role === "admin" || m.role === "co_admin") && (
                      <span className="rounded-full bg-[rgba(245,158,11,0.15)] px-1.5 py-px text-micro font-extrabold uppercase tracking-wide text-ps-amber">
                        {m.role === "admin" ? "Admin" : "Co-admin"}
                      </span>
                    )}
                    {m.role === "mod" && (
                      <span className="rounded-full bg-[rgba(59,130,246,0.12)] px-1.5 py-px text-micro font-extrabold uppercase tracking-wide text-[#3b82f6]">
                        Mod
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-caption text-ps-text-ter">
                    {t("admin.joined")} {new Date(m.joined_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {canPromoteToMod && (
                    <button
                      type="button"
                      onClick={() => handleRoleChange(m.user_id, "mod", m.display_name)}
                      disabled={promotingId === m.user_id}
                      className="rounded-lg border border-ps-border px-2.5 py-1.5 text-caption font-semibold text-[#3b82f6] transition-colors hover:border-[#3b82f6] disabled:opacity-50"
                    >
                      {promotingId === m.user_id ? "..." : t("admin.make_mod")}
                    </button>
                  )}
                  {canDemoteFromMod && (
                    <button
                      type="button"
                      onClick={() => handleRoleChange(m.user_id, "participant", m.display_name)}
                      disabled={promotingId === m.user_id}
                      className="rounded-lg border border-ps-border px-2.5 py-1.5 text-caption font-semibold text-ps-text-ter transition-colors hover:border-ps-text-sec disabled:opacity-50"
                    >
                      {promotingId === m.user_id ? "..." : t("admin.remove_mod")}
                    </button>
                  )}
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => handleRemove(m.user_id, m.display_name)}
                      disabled={removingId === m.user_id}
                      className="rounded-lg border border-ps-border px-2.5 py-1.5 text-caption font-semibold text-ps-text-sec transition-colors hover:border-ps-red hover:text-ps-red disabled:opacity-50"
                    >
                      {removingId === m.user_id ? "..." : t("admin.remove")}
                    </button>
                  )}
                  {pw1Locked && !isCreator && !isSelf && (m.role === "participant" || m.role === "mod") && !canRemove && (
                    <span className="text-micro font-medium text-ps-text-ter">
                      {t("admin.locked")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {sortedMembers.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ps-text-sec">
              {t("admin.no_entrants")}
            </p>
          )}
        </div>
      </div>

      {/* Classifications */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-ps-text-ter">
          Classifications
        </h3>
        <div className="mt-2 space-y-1.5">
          {classifications.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-ps-border bg-ps-surface px-4 py-2.5"
            >
              <div>
                <span className="text-sm font-semibold text-ps-text">
                  {c.name}
                </span>
                <span className="ml-2 font-mono text-caption text-ps-text-ter">
                  {c.type}
                </span>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== Shared UI ==========

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-ps-chip text-ps-text-sec",
    active: "bg-[rgba(10,168,109,0.12)] text-[#0aa86d]",
    completed: "bg-[rgba(59,130,246,0.12)] text-[#3b82f6]",
    archived: "bg-ps-chip text-ps-text-ter",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-micro font-bold uppercase tracking-wide ${
        colors[status] ?? colors.draft
      }`}
    >
      {status}
    </span>
  );
}
