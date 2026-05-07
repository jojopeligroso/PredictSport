"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./CompetitionStatusBadge";
import type { Competition, CompetitionStatus } from "@/types/database";

interface SettingsSectionProps {
  competition: Competition;
}

const STATUS_TRANSITIONS: Record<CompetitionStatus, CompetitionStatus[]> = {
  draft: ["active"],
  active: ["completed"],
  completed: [],
};

export function SettingsSection({ competition }: SettingsSectionProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setIsUpdating(true);
    setError(null);

    try {
      // Use Supabase client directly since this is a simple status update
      // and we have RLS policies. In production you may want a dedicated API route.
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
        <h4 className="text-sm font-medium text-ps-text-sec mb-3">
          General
        </h4>
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
                      : "bg-ps-amber text-[#1a1208] hover:opacity-90"
                  }`}
                >
                  {isUpdating
                    ? "Updating..."
                    : nextStatus === "active"
                      ? "Activate Competition"
                      : "Complete Competition"}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ps-text-ter">
              {competition.status === "completed"
                ? "This competition is completed. No further status changes."
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
    </div>
  );
}
