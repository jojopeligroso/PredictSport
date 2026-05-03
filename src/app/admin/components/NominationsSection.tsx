"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./CompetitionStatusBadge";
import type { Competition, EventNomination } from "@/types/database";

interface NominationsSectionProps {
  competition: Competition;
  nominations: (EventNomination & { nominator?: { display_name: string } })[];
}

export function NominationsSection({
  competition,
  nominations,
}: NominationsSectionProps) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectNoteId, setRejectNoteId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pendingNominations = (nominations ?? []).filter(
    (n) => n.status === "pending"
  );
  const reviewedNominations = (nominations ?? []).filter(
    (n) => n.status !== "pending"
  );

  const handleApprove = async (nominationId: string) => {
    setProcessingId(nominationId);
    setError(null);

    try {
      const res = await fetch("/api/admin/nominations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomination_id: nominationId,
          competition_id: competition.id,
          action: "approved",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to approve nomination");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (nominationId: string) => {
    setProcessingId(nominationId);
    setError(null);

    try {
      const res = await fetch("/api/admin/nominations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomination_id: nominationId,
          competition_id: competition.id,
          action: "rejected",
          admin_note: rejectNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reject nomination");
        return;
      }

      setRejectNoteId(null);
      setRejectNote("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
        Event Nominations
      </h3>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {!competition.allow_nominations && (
        <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          Nominations are disabled for this competition.
        </div>
      )}

      {/* Pending nominations */}
      <div className="mb-8">
        <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">
          Pending Review ({pendingNominations.length})
        </h4>

        {pendingNominations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
            <p className="text-zinc-500 dark:text-zinc-400">
              No pending nominations
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingNominations.map((nom) => (
              <div
                key={nom.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h5 className="font-medium text-zinc-900 dark:text-zinc-50">
                      {nom.event_name}
                    </h5>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="capitalize">
                        {nom.sport.replace(/_/g, " ")}
                      </span>
                      <span>
                        Proposed: {new Date(nom.proposed_date).toLocaleDateString()}
                      </span>
                      {nom.proposed_prediction_type && (
                        <span className="capitalize">
                          Type: {nom.proposed_prediction_type.replace(/_/g, " ")}
                        </span>
                      )}
                      <span>
                        By: {nom.nominator?.display_name ?? "Unknown"}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => handleApprove(nom.id)}
                      disabled={processingId === nom.id}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                      {processingId === nom.id ? "..." : "Approve"}
                    </button>
                    <button
                      onClick={() => {
                        if (rejectNoteId === nom.id) {
                          handleReject(nom.id);
                        } else {
                          setRejectNoteId(nom.id);
                        }
                      }}
                      disabled={processingId === nom.id}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {/* Reject note input */}
                {rejectNoteId === nom.id && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Optional reason for rejection..."
                      className="block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      autoFocus
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleReject(nom.id)}
                        disabled={processingId === nom.id}
                        className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => {
                          setRejectNoteId(null);
                          setRejectNote("");
                        }}
                        className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviewed nominations */}
      {reviewedNominations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">
            Previously Reviewed
          </h4>
          <div className="space-y-2">
            {reviewedNominations.map((nom) => (
              <div
                key={nom.id}
                className="flex items-center justify-between rounded-md border border-zinc-100 p-3 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={nom.status} type="nomination" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {nom.event_name}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 capitalize">
                    {nom.sport.replace(/_/g, " ")}
                  </span>
                </div>
                {nom.admin_note && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                    {nom.admin_note}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
