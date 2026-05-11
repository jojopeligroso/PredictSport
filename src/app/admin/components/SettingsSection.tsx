"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./CompetitionStatusBadge";
import type { Competition, CompetitionStatus, UserRole } from "@/types/database";

interface SettingsSectionProps {
  competition: Competition;
  userRole?: UserRole;
}

const STATUS_TRANSITIONS: Record<CompetitionStatus, CompetitionStatus[]> = {
  draft: ["active"],
  active: ["completed"],
  completed: ["archived"],
  archived: [],
};

export function SettingsSection({ competition, userRole = "admin" }: SettingsSectionProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState(competition.name);
  const [editDescription, setEditDescription] = useState(competition.description ?? "");
  const [editVisibility, setEditVisibility] = useState(competition.visibility);
  const [editAllowNominations, setEditAllowNominations] = useState(competition.allow_nominations);
  const [editLockMinutes, setEditLockMinutes] = useState(competition.lock_default_minutes);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isDraft = competition.status === "draft";
  const isAdmin = userRole === "admin";
  const allowedTransitions = STATUS_TRANSITIONS[competition.status] ?? [];
  const scoringRules = competition.scoring_rules as Record<string, unknown>;
  const presetName = typeof scoringRules.preset === "string" ? scoringRules.preset : null;
  const pointsMap = scoringRules.points && typeof scoringRules.points === "object"
    ? (scoringRules.points as Record<string, number>)
    : null;
  const partialPointsMap = scoringRules.partial_points && typeof scoringRules.partial_points === "object"
    ? (scoringRules.partial_points as Record<string, number>)
    : null;

  const handleStatusChange = async (newStatus: CompetitionStatus) => {
    if (
      newStatus === "active" &&
      !confirm(
        "Activating the competition will lock scoring rules. Are you sure?"
      )
    ) {
      return;
    }

    if (
      newStatus === "completed" &&
      !confirm(
        "Completing the competition will prevent further predictions. Are you sure?"
      )
    ) {
      return;
    }

    if (
      newStatus === "archived" &&
      !confirm(
        "Archiving will move this competition to historical records. Are you sure?"
      )
    ) {
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/competitions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: competition.id,
          status: newStatus,
        }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update status");
      }
    } catch {
      setError("Network error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartEditing = () => {
    setEditName(competition.name);
    setEditDescription(competition.description ?? "");
    setEditVisibility(competition.visibility);
    setEditAllowNominations(competition.allow_nominations);
    setEditLockMinutes(competition.lock_default_minutes);
    setSaveError(null);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      setSaveError("Name is required");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/admin/competitions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: competition.id,
          name: editName.trim(),
          description: editDescription.trim() || null,
          visibility: editVisibility,
          allow_nominations: editAllowNominations,
          lock_default_minutes: editLockMinutes,
        }),
      });

      if (res.ok) {
        setIsEditing(false);
        router.refresh();
      } else {
        const data = await res.json();
        setSaveError(data.error || "Failed to save changes");
      }
    } catch {
      setSaveError("Network error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${competition.name}"? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/admin/competitions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competition_id: competition.id }),
      });

      if (res.ok) {
        router.push("/competitions");
      } else {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete competition");
      }
    } catch {
      setDeleteError("Network error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <h3 className="text-lg font-semibold text-ps-text">
        Competition Settings
      </h3>

      {error && (
        <div className="rounded-xl bg-ps-red-soft p-3 text-sm text-ps-red">
          {error}
        </div>
      )}

      {/* General Info */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-ps-text-sec">
            General
          </h4>
          {isDraft && isAdmin && !isEditing && (
            <button
              onClick={handleStartEditing}
              className="rounded-lg border border-ps-border px-2.5 py-1 text-xs font-semibold text-ps-text-sec hover:bg-ps-chip"
            >
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="rounded-2xl border border-ps-border bg-ps-surface p-4 space-y-4">
            {saveError && (
              <div className="rounded-xl bg-ps-red-soft p-3 text-sm text-ps-red">
                {saveError}
              </div>
            )}

            <div>
              <label className="block text-sm text-ps-text-sec mb-1">Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text w-full focus:outline-none focus:ring-1 focus:ring-ps-amber"
              />
            </div>

            <div>
              <label className="block text-sm text-ps-text-sec mb-1">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text w-full focus:outline-none focus:ring-1 focus:ring-ps-amber"
              />
            </div>

            <div>
              <label className="block text-sm text-ps-text-sec mb-1">Visibility</label>
              <select
                value={editVisibility}
                onChange={(e) => setEditVisibility(e.target.value as "private" | "public")}
                className="rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text w-full focus:outline-none focus:ring-1 focus:ring-ps-amber"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-ps-text-sec">Allow Nominations</label>
              <button
                type="button"
                onClick={() => setEditAllowNominations(!editAllowNominations)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  editAllowNominations ? "bg-ps-amber" : "bg-ps-border"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editAllowNominations ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm text-ps-text-sec mb-1">Lock Default (minutes)</label>
              <input
                type="number"
                value={editLockMinutes}
                onChange={(e) => setEditLockMinutes(Number(e.target.value))}
                min={0}
                className="rounded-xl border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text w-full focus:outline-none focus:ring-1 focus:ring-ps-amber"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-xl bg-ps-amber text-[#1a1208] px-4 py-2 text-sm font-bold hover:opacity-90 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancelEditing}
                disabled={isSaving}
                className="rounded-xl border border-ps-border px-4 py-2 text-sm font-medium text-ps-text-sec hover:bg-ps-chip"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-ps-border bg-ps-surface">
            <dl className="divide-y divide-ps-border">
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-ps-text-sec">Name</dt>
                <dd className="text-sm font-medium text-ps-text">
                  {competition.name}
                </dd>
              </div>
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-ps-text-sec">
                  Description
                </dt>
                <dd className="text-sm text-ps-text">
                  {competition.description || "No description"}
                </dd>
              </div>
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-ps-text-sec">Type</dt>
                <dd className="text-sm font-medium text-ps-text capitalize">
                  {competition.type}
                </dd>
              </div>
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-ps-text-sec">
                  Visibility
                </dt>
                <dd className="text-sm font-medium text-ps-text capitalize">
                  {competition.visibility}
                </dd>
              </div>
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-ps-text-sec">
                  Lock Default
                </dt>
                <dd className="text-sm text-ps-text">
                  {competition.lock_default_minutes} minutes before start
                </dd>
              </div>
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-ps-text-sec">
                  Nominations
                </dt>
                <dd className="text-sm text-ps-text">
                  {competition.allow_nominations ? "Enabled" : "Disabled"}
                </dd>
              </div>
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-ps-text-sec">
                  Invite Code
                </dt>
                <dd>
                  <code className="rounded-lg bg-ps-chip px-2 py-0.5 text-xs font-mono text-ps-text">
                    {competition.invite_code}
                  </code>
                </dd>
              </div>
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-ps-text-sec">
                  Created
                </dt>
                <dd className="text-sm text-ps-text">
                  {new Date(competition.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </section>

      {/* Status Management */}
      <section>
        <h4 className="text-sm font-medium text-ps-text-sec mb-3">
          Status
        </h4>
        <div className="rounded-2xl border border-ps-border bg-ps-surface p-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-ps-text-sec">
              Current:
            </span>
            <StatusBadge status={competition.status} type="competition" />
          </div>

          {allowedTransitions.length > 0 ? (
            <div className="flex gap-2">
              {allowedTransitions.map((nextStatus) => (
                <button
                  key={nextStatus}
                  onClick={() => handleStatusChange(nextStatus)}
                  disabled={isUpdating}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50 ${
                    nextStatus === "active"
                      ? "bg-ps-green text-white hover:opacity-90"
                      : nextStatus === "archived"
                        ? "border border-ps-border bg-transparent text-ps-text-sec hover:bg-ps-chip"
                        : "bg-ps-amber text-[#1a1208] hover:opacity-90"
                  }`}
                >
                  {isUpdating
                    ? "Updating..."
                    : nextStatus === "active"
                      ? "Activate Competition"
                      : nextStatus === "completed"
                        ? "Complete Competition"
                        : "Archive Competition"}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ps-text-ter">
              {competition.status === "archived"
                ? "This competition is archived."
                : "No status changes available."}
            </p>
          )}

          {competition.status === "draft" && (
            <p className="mt-3 text-xs text-ps-text-ter">
              Activating will lock scoring rules and competition type. Make sure
              everything is configured correctly first.
            </p>
          )}
        </div>
      </section>

      {/* Scoring Rules */}
      <section>
        <h4 className="text-sm font-medium text-ps-text-sec mb-3">
          Scoring Rules
          {competition.status !== "draft" && (
            <span className="ml-2 text-xs text-ps-amber-deep">
              (locked)
            </span>
          )}
        </h4>
        <div className="rounded-2xl border border-ps-border bg-ps-surface p-4">
          {presetName && (
            <p className="text-sm text-ps-text mb-3">
              Preset:{" "}
              <span className="font-medium capitalize">
                {presetName.replace(/_/g, " ")}
              </span>
            </p>
          )}

          {pointsMap && (
            <div className="mb-3">
              <p className="text-xs font-medium text-ps-text-ter mb-2">
                Points per Type
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(pointsMap).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex justify-between rounded-xl bg-ps-bg px-3 py-1.5 text-sm"
                  >
                    <span className="text-ps-text-sec capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium text-ps-text">
                      {Number(val)}pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-sm text-ps-text-sec">
            Partial credit:{" "}
            <span className="font-medium">
              {scoringRules.partial_credit !== false ? "Enabled" : "Disabled"}
            </span>
          </div>

          {scoringRules.partial_credit !== false && partialPointsMap && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(partialPointsMap).map(([key, val]) => (
                <div
                  key={key}
                  className="flex justify-between rounded-xl bg-ps-bg px-3 py-1.5 text-xs"
                >
                  <span className="text-ps-text-ter capitalize">
                    {key.replace(/_/g, " ")} (partial)
                  </span>
                  <span className="font-medium text-ps-text-sec">
                    {Number(val)}pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Danger Zone — draft only */}
      {isDraft && isAdmin && (
        <section>
          <h4 className="text-sm font-medium text-ps-text-sec mb-3">
            Danger Zone
          </h4>
          <div className="rounded-2xl border border-ps-red/30 bg-ps-red-soft p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ps-text">Delete Competition</p>
                <p className="text-xs text-ps-text-ter mt-0.5">Permanently removes this competition and all its data.</p>
              </div>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-xl bg-ps-red px-3 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
            {deleteError && <p className="mt-2 text-xs text-ps-red">{deleteError}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
