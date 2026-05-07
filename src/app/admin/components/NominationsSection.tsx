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
      <h3 className="text-lg font-semibold text-ps-text mb-4">
        Event Nominations
      </h3>

      {error && (
        <div className="mb-4 rounded-xl bg-ps-red-soft p-3 text-sm text-ps-red">
          {error}
        </div>
      )}

      {!competition.allow_nominations && (
        <div className="mb-4 rounded-xl bg-ps-amber-soft p-3 text-sm text-ps-amber-deep">
          Nominations are disabled for this competition.
        </div>
      )}

      {/* Pending nominations */}
      <div className="mb-8">
        <h4 className="text-sm font-medium text-ps-text-sec mb-3">
          Pending Review ({pendingNominations.length})
        </h4>

        {pendingNominations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ps-border p-6 text-center">
            <p className="text-ps-text-sec">
              No pending nominations
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingNominations.map((nom) => (
              <div
                key={nom.id}
                className="rounded-2xl border border-ps-border bg-ps-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h5 className="font-medium text-ps-text">
                      {nom.event_name}
                    </h5>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ps-text-ter">
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
                      className="rounded-xl bg-ps-green px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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
                      className="rounded-xl border border-ps-red px-3 py-1.5 text-xs font-medium text-ps-red transition-colors hover:bg-ps-red-soft disabled:opacity-50"
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
                      className="block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-1.5 text-sm text-ps-text"
                      autoFocus
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleReject(nom.id)}
                        disabled={processingId === nom.id}
                        className="rounded-xl bg-ps-red px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => {
                          setRejectNoteId(null);
                          setRejectNote("");
                        }}
                        className="rounded-xl border border-ps-border-strong bg-transparent px-3 py-1 text-xs text-ps-text-sec"
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
          <h4 className="text-sm font-medium text-ps-text-sec mb-3">
            Previously Reviewed
          </h4>
          <div className="space-y-2">
            {reviewedNominations.map((nom) => (
              <div
                key={nom.id}
                className="flex items-center justify-between rounded-xl border border-ps-border p-3"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={nom.status} type="nomination" />
                  <span className="text-sm text-ps-text">
                    {nom.event_name}
                  </span>
                  <span className="text-xs text-ps-text-ter capitalize">
                    {nom.sport.replace(/_/g, " ")}
                  </span>
                </div>
                {nom.admin_note && (
                  <span className="text-xs text-ps-text-ter italic">
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
