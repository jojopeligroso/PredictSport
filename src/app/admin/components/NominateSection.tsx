"use client";

import { useState, useEffect } from "react";
import { SPORT_CONFIG, type SportKey } from "@/components/ui/sport-config";
import type { Competition, NominationStatus } from "@/types/database";

interface NominateSectionProps {
  competition: Competition;
  currentUserId: string;
}

interface NominationRow {
  id: string;
  event_name: string;
  sport: string;
  proposed_date: string;
  proposed_prediction_type: string | null;
  status: NominationStatus;
  admin_note: string | null;
  nominated_by: string;
  created_at: string;
  nominator?: { display_name: string } | null;
}

const sportKeys = Object.keys(SPORT_CONFIG) as SportKey[];

export function NominateSection({ competition, currentUserId }: NominateSectionProps) {
  const [eventName, setEventName] = useState("");
  const [sport, setSport] = useState<string>(sportKeys[0]);
  const [proposedDate, setProposedDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [nominations, setNominations] = useState<NominationRow[]>([]);
  const [loadingNoms, setLoadingNoms] = useState(true);

  useEffect(() => {
    fetch(`/api/nominations?competition_id=${competition.id}`)
      .then((r) => r.json())
      .then((data) => setNominations(data.nominations ?? []))
      .catch(() => {})
      .finally(() => setLoadingNoms(false));
  }, [competition.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventName.trim() || !proposedDate) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await fetch("/api/nominations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: competition.id,
          event_name: eventName.trim(),
          sport,
          proposed_date: proposedDate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSubmitResult({ ok: true, message: "Nomination submitted!" });
        setNominations((prev) => [{ ...data.nomination, nominator: null }, ...prev]);
        setEventName("");
        setProposedDate("");
      } else {
        const data = await res.json();
        setSubmitResult({ ok: false, message: data.error ?? "Failed to submit" });
      }
    } catch {
      setSubmitResult({ ok: false, message: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  const myNominations = nominations.filter((n) => n.nominated_by === currentUserId);
  const otherNominations = nominations.filter((n) => n.nominated_by !== currentUserId);

  return (
    <div className="flex flex-col gap-6">
      {/* Submission form */}
      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <p className="mb-3 text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
          Suggest an event
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ps-text-sec">
              Event name
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEventName(e.target.value)}
              placeholder="e.g. Liverpool vs Arsenal"
              className="w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ps-text-sec">
              Sport
            </label>
            <div className="flex flex-wrap gap-1.5">
              {sportKeys.map((key) => {
                const cfg = SPORT_CONFIG[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSport(key)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      key === sport
                        ? "bg-ps-amber text-ps-ink"
                        : "bg-ps-ink/5 text-ps-text-sec hover:bg-ps-ink/10"
                    }`}
                  >
                    {cfg.emoji} {cfg.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ps-text-sec">
              Proposed date
            </label>
            <input
              type="date"
              value={proposedDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProposedDate(e.target.value)}
              className="w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text focus:border-ps-amber focus:outline-none"
              required
            />
          </div>

          {submitResult && (
            <p className={`text-xs font-semibold ${submitResult.ok ? "text-ps-green" : "text-ps-red"}`}>
              {submitResult.message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !eventName.trim() || !proposedDate}
            className="rounded-xl bg-ps-amber py-2.5 text-xs font-bold text-ps-ink transition-colors hover:bg-ps-amber/90 disabled:opacity-40"
          >
            {submitting ? "Submitting..." : "Submit Nomination"}
          </button>
        </form>
      </div>

      {/* My nominations */}
      {myNominations.length > 0 && (
        <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
          <p className="mb-3 text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
            Your nominations
          </p>
          <div className="flex flex-col gap-2">
            {myNominations.map((n) => (
              <NominationCard key={n.id} nomination={n} />
            ))}
          </div>
        </div>
      )}

      {/* All nominations */}
      {otherNominations.length > 0 && (
        <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
          <p className="mb-3 text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
            All nominations
          </p>
          <div className="flex flex-col gap-2">
            {otherNominations.map((n) => (
              <NominationCard key={n.id} nomination={n} showNominator />
            ))}
          </div>
        </div>
      )}

      {loadingNoms && (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-ps-amber border-t-transparent" />
        </div>
      )}

      {!loadingNoms && nominations.length === 0 && (
        <p className="py-8 text-center text-xs text-ps-text-ter">
          No nominations yet. Be the first to suggest an event!
        </p>
      )}
    </div>
  );
}

function NominationCard({ nomination, showNominator }: { nomination: NominationRow; showNominator?: boolean }) {
  const cfg = SPORT_CONFIG[nomination.sport as SportKey];
  const statusColors: Record<NominationStatus, string> = {
    pending: "bg-ps-amber/15 text-ps-amber",
    approved: "bg-ps-green/15 text-ps-green",
    rejected: "bg-ps-red/15 text-ps-red",
  };

  return (
    <div className="flex items-start gap-3 rounded-lg bg-ps-bg px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ps-text">{nomination.event_name}</p>
        <p className="mt-0.5 text-[10px] text-ps-text-ter">
          {cfg?.emoji ?? ""} {cfg?.name ?? nomination.sport} &middot; {nomination.proposed_date}
          {showNominator && nomination.nominator?.display_name && (
            <> &middot; {nomination.nominator.display_name}</>
          )}
        </p>
        {nomination.admin_note && (
          <p className="mt-1 text-[10px] italic text-ps-text-sec">{nomination.admin_note}</p>
        )}
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${statusColors[nomination.status]}`}>
        {nomination.status}
      </span>
    </div>
  );
}
