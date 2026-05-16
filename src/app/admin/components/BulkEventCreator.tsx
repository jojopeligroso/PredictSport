"use client";

import React, { useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BulkEventCreatorProps {
  competitionId: string;
  roundId?: string;
  lockDefaultMinutes: number;
  onSuccess: (count: number) => void;
  onCancel: () => void;
}

interface EventRow {
  id: string;
  event_name: string;
  sport: string;
  start_date: string;
  start_time: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPORTS: { value: string; label: string }[] = [
  { value: "", label: "Select sport..." },
  { value: "gaa", label: "GAA" },
  { value: "soccer", label: "Soccer" },
  { value: "rugby", label: "Rugby" },
  { value: "rugby_league", label: "Rugby League" },
  { value: "cricket", label: "Cricket" },
  { value: "snooker", label: "Snooker" },
  { value: "tennis", label: "Tennis" },
  { value: "golf", label: "Golf" },
  { value: "formula_1", label: "Formula 1" },
  { value: "horse_racing", label: "Horse Racing" },
  { value: "athletics", label: "Athletics" },
  { value: "nfl", label: "Am. Football" },
  { value: "nba", label: "Basketball" },
  { value: "nhl", label: "Ice Hockey" },
  { value: "mlb", label: "Baseball" },
];

const EXAMPLE_CSV = `event_name,sport,start_date,start_time
Wexford vs Kilkenny,gaa,2026-06-01,15:00
Cork vs Limerick,gaa,2026-06-01,17:30
Liverpool vs Man City,soccer,2026-06-02,12:30`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyRow(): EventRow {
  return {
    id: crypto.randomUUID(),
    event_name: "",
    sport: "",
    start_date: "",
    start_time: "15:00",
  };
}

function validateRows(rows: EventRow[]): EventRow[] {
  return rows.map((row) => {
    // Skip entirely empty rows
    const isEmpty =
      !row.event_name.trim() && !row.sport && !row.start_date;
    if (isEmpty) return { ...row, error: undefined };

    if (!row.event_name.trim()) {
      return { ...row, error: "Event name is required." };
    }
    if (!row.sport) {
      return { ...row, error: "Sport is required." };
    }
    if (!row.start_date) {
      return { ...row, error: "Start date is required." };
    }
    return { ...row, error: undefined };
  });
}

function parseCSV(text: string): { rows: EventRow[]; errors: string[] } {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], errors: ["CSV must have a header row and at least one data row."] };
  }

  const errors: string[] = [];
  const rows: EventRow[] = [];

  // Skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < 4) {
      errors.push(`Row ${i}: expected 4 columns (event_name,sport,start_date,start_time), got ${cols.length}.`);
      continue;
    }

    const [event_name, sport, start_date, start_time] = cols;

    // Basic date format check YYYY-MM-DD
    if (start_date && !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
      errors.push(`Row ${i}: start_date "${start_date}" must be YYYY-MM-DD.`);
      continue;
    }

    // Basic time format check HH:MM
    if (start_time && !/^\d{2}:\d{2}$/.test(start_time)) {
      errors.push(`Row ${i}: start_time "${start_time}" must be HH:MM.`);
      continue;
    }

    rows.push({
      id: crypto.randomUUID(),
      event_name: event_name ?? "",
      sport: sport ?? "",
      start_date: start_date ?? "",
      start_time: start_time ?? "15:00",
    });
  }

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabSwitcher({
  mode,
  onChange,
}: {
  mode: "rows" | "csv";
  onChange: (m: "rows" | "csv") => void;
}) {
  return (
    <div className="flex rounded-xl border border-ps-border text-sm overflow-hidden">
      {(["rows", "csv"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 transition-colors ${
            mode === m
              ? "bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#1a1208] font-medium"
              : "text-ps-text-sec hover:bg-ps-chip"
          }`}
        >
          {m === "rows" ? "Multi-Row" : "CSV Upload"}
        </button>
      ))}
    </div>
  );
}

function RowTable({
  rows,
  onChange,
  onDelete,
  readonly,
}: {
  rows: EventRow[];
  onChange?: (id: string, field: keyof EventRow, value: string) => void;
  onDelete?: (id: string) => void;
  readonly?: boolean;
}) {
  const inputClass =
    "block w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1.5 text-sm text-ps-text focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber disabled:opacity-60";

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-ps-border">
            <th className="pb-2 pr-2 text-left text-xs font-medium text-ps-text-ter w-[34%]">
              Event Name
            </th>
            <th className="pb-2 pr-2 text-left text-xs font-medium text-ps-text-ter w-[18%]">
              Sport
            </th>
            <th className="pb-2 pr-2 text-left text-xs font-medium text-ps-text-ter w-[22%]">
              Date
            </th>
            <th className="pb-2 pr-2 text-left text-xs font-medium text-ps-text-ter w-[18%]">
              Time
            </th>
            {!readonly && (
              <th className="pb-2 text-left text-xs font-medium text-ps-text-ter w-[8%]" />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <React.Fragment key={row.id}>
              <tr
                className={row.error ? "bg-ps-red-soft/30" : ""}
              >
                <td className="py-1 pr-2">
                  <input
                    type="text"
                    value={row.event_name}
                    placeholder="e.g. Wexford vs Kilkenny"
                    disabled={readonly}
                    onChange={(e) => onChange?.(row.id, "event_name", e.target.value)}
                    aria-label={`Event name row ${idx + 1}`}
                    className={`${inputClass} ${row.error ? "border-ps-red" : ""}`}
                  />
                </td>
                <td className="py-1 pr-2">
                  <select
                    value={row.sport}
                    disabled={readonly}
                    onChange={(e) => onChange?.(row.id, "sport", e.target.value)}
                    aria-label={`Sport row ${idx + 1}`}
                    className={`${inputClass} ${row.error ? "border-ps-red" : ""}`}
                  >
                    {SPORTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="date"
                    value={row.start_date}
                    disabled={readonly}
                    onChange={(e) => onChange?.(row.id, "start_date", e.target.value)}
                    aria-label={`Start date row ${idx + 1}`}
                    className={`${inputClass} ${row.error ? "border-ps-red" : ""}`}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="time"
                    value={row.start_time}
                    disabled={readonly}
                    onChange={(e) => onChange?.(row.id, "start_time", e.target.value)}
                    aria-label={`Start time row ${idx + 1}`}
                    className={inputClass}
                  />
                </td>
                {!readonly && (
                  <td className="py-1">
                    <button
                      type="button"
                      onClick={() => onDelete?.(row.id)}
                      disabled={rows.length === 1}
                      aria-label={`Remove row ${idx + 1}`}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-ps-text-ter transition-colors hover:bg-ps-red-soft hover:text-ps-red disabled:opacity-30"
                    >
                      &times;
                    </button>
                  </td>
                )}
              </tr>
              {row.error && (
                <tr key={`${row.id}-err`}>
                  <td
                    colSpan={readonly ? 4 : 5}
                    className="pb-1 pt-0 text-xs text-ps-red"
                  >
                    {row.error}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BulkEventCreator({
  competitionId,
  roundId,
  lockDefaultMinutes,
  onSuccess,
  onCancel,
}: BulkEventCreatorProps) {
  const [mode, setMode] = useState<"rows" | "csv">("rows");
  const [rows, setRows] = useState<EventRow[]>([
    emptyRow(),
    emptyRow(),
    emptyRow(),
  ]);
  const [csvRows, setCsvRows] = useState<EventRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvParsed, setCsvParsed] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addRowRef = useRef<HTMLTableRowElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // -------------------------------------------------------------------------
  // Row editing
  // -------------------------------------------------------------------------

  const handleRowChange = (id: string, field: keyof EventRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value, error: undefined } : r))
    );
  };

  const handleDeleteRow = (id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const handleAddRow = () => {
    const newRow = emptyRow();
    setRows((prev) => [...prev, newRow]);
    // Scroll to new row after render
    requestAnimationFrame(() => {
      addRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  // -------------------------------------------------------------------------
  // CSV parsing
  // -------------------------------------------------------------------------

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") return;
      const { rows: parsed, errors } = parseCSV(text);
      setCsvRows(parsed);
      setCsvErrors(errors);
      setCsvParsed(true);
    };
    reader.readAsText(file);
  };

  const handleCsvRowChange = (id: string, field: keyof EventRow, value: string) => {
    setCsvRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value, error: undefined } : r))
    );
  };

  const handleCsvDeleteRow = (id: string) => {
    setCsvRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const activeRows = mode === "rows" ? rows : csvRows;

  const validRowsForSubmit = activeRows.filter(
    (r) => r.event_name.trim() && r.sport && r.start_date
  );

  const buildPayload = (row: EventRow) => {
    const startISO = new Date(`${row.start_date}T${row.start_time}`).toISOString();
    const lockDate = new Date(
      new Date(startISO).getTime() - lockDefaultMinutes * 60000
    );
    return {
      competition_id: competitionId,
      round_id: roundId ?? undefined,
      event_name: row.event_name.trim(),
      sport: row.sport,
      start_time: startISO,
      lock_time: lockDate.toISOString(),
      prediction_type_configs: [
        { prediction_type: "head_to_head", points: 10 },
      ],
      status: "upcoming",
    };
  };

  const handleSubmit = async () => {
    setError(null);
    setResult(null);

    // Validate the active rows
    let validated: EventRow[];
    if (mode === "rows") {
      validated = validateRows(rows);
      setRows(validated);
    } else {
      validated = validateRows(csvRows);
      setCsvRows(validated);
    }

    const hasErrors = validated.some(
      (r) =>
        r.error &&
        // only rows that had content — empty rows validated as undefined
        (r.event_name.trim() || r.sport || r.start_date)
    );
    if (hasErrors) {
      setError("Fix the highlighted rows before creating events.");
      return;
    }

    const toSubmit = validated.filter(
      (r) => r.event_name.trim() && r.sport && r.start_date
    );

    if (toSubmit.length === 0) {
      setError("No valid rows to create. Fill in at least one event.");
      return;
    }

    setIsSubmitting(true);
    setProgress({ done: 0, total: toSubmit.length });

    let successCount = 0;
    let failedCount = 0;

    // Fire all requests with allSettled for per-row failure tracking
    const promises = toSubmit.map(async (row, index) => {
      try {
        const res = await fetch("/api/admin/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(row)),
        });
        const data = await res.json() as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        successCount++;
      } catch {
        failedCount++;
      } finally {
        setProgress((prev) =>
          prev ? { done: prev.done + 1, total: prev.total } : null
        );
      }
      // index used only to stagger slightly and avoid hammering the API
      void index;
    });

    await Promise.allSettled(promises);

    setIsSubmitting(false);
    setProgress(null);
    setResult({ success: successCount, failed: failedCount });

    if (successCount > 0) {
      setTimeout(() => {
        onSuccess(successCount);
      }, 1500);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const submitLabel = (() => {
    if (isSubmitting && progress) {
      return `Creating... ${progress.done}/${progress.total} done`;
    }
    const count = validRowsForSubmit.length;
    return count > 0 ? `Create ${count} Event${count !== 1 ? "s" : ""}` : "Create Events";
  })();

  return (
    <div className="rounded-2xl border border-ps-border bg-ps-surface">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ps-border px-5 py-4">
        <h4 className="text-base font-semibold text-ps-text">Bulk Add Events</h4>
        <TabSwitcher mode={mode} onChange={setMode} />
      </div>

      <div className="p-5">
        {/* Result banner */}
        {result && (
          <div
            className={`mb-4 rounded-xl px-4 py-3 text-sm ${
              result.failed === 0
                ? "bg-ps-green-soft text-ps-green"
                : result.success === 0
                ? "bg-ps-red-soft text-ps-red"
                : "bg-ps-amber-soft text-ps-amber-deep"
            }`}
            role="status"
            aria-live="polite"
          >
            {result.success > 0 && (
              <span>
                {result.success} event{result.success !== 1 ? "s" : ""} created successfully.{" "}
              </span>
            )}
            {result.failed > 0 && (
              <span>
                {result.failed} event{result.failed !== 1 ? "s" : ""} failed to create.
              </span>
            )}
          </div>
        )}

        {/* Global error */}
        {error && (
          <div
            className="mb-4 rounded-xl bg-ps-red-soft px-4 py-3 text-sm text-ps-red"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Multi-Row mode                                                   */}
        {/* ---------------------------------------------------------------- */}
        {mode === "rows" && (
          <div>
            <RowTable
              rows={rows}
              onChange={handleRowChange}
              onDelete={handleDeleteRow}
            />

            {/* Invisible scroll target for new rows */}
            <div ref={addRowRef} aria-hidden="true" />

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 rounded-xl border border-ps-border px-3 py-1.5 text-sm font-medium text-ps-text-sec transition-colors hover:bg-ps-chip"
              >
                <span aria-hidden="true" className="text-lg leading-none">+</span>
                Add Row
              </button>

              <p className="text-xs text-ps-text-ter">
                Empty rows are ignored on submit.
              </p>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* CSV Upload mode                                                  */}
        {/* ---------------------------------------------------------------- */}
        {mode === "csv" && (
          <div>
            {!csvParsed ? (
              <div>
                {/* Drop zone / file picker */}
                <label
                  htmlFor="csv-upload"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ps-border bg-ps-bg px-6 py-8 text-center transition-colors hover:border-ps-amber-deep"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-8 w-8 text-ps-text-ter"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="text-sm font-medium text-ps-text">
                    Click to upload a CSV file
                  </span>
                  <span className="text-xs text-ps-text-ter">
                    .csv format only
                  </span>
                  <input
                    id="csv-upload"
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>

                {/* Example format */}
                <div className="mt-4 rounded-xl border border-ps-border bg-ps-bg px-4 py-3">
                  <p className="mb-1.5 text-xs font-medium text-ps-text-sec">
                    Expected CSV format
                  </p>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-ps-text-ter leading-relaxed">
                    {EXAMPLE_CSV}
                  </pre>
                  <p className="mt-2 text-xs text-ps-text-ter">
                    Date format: YYYY-MM-DD. Time format: HH:MM (24-hour). Sport
                    values: gaa, soccer, rugby, rugby_league, cricket, snooker,
                    tennis, golf, formula_1, horse_racing, athletics, nfl, nba,
                    nhl, mlb.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                {/* Parse summary */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-ps-text-sec">
                    <span className="font-semibold text-ps-text">{csvRows.length}</span>{" "}
                    event{csvRows.length !== 1 ? "s" : ""} parsed
                    {csvErrors.length > 0 && (
                      <span className="ml-2 text-ps-red">
                        ({csvErrors.length} parse error{csvErrors.length !== 1 ? "s" : ""})
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvParsed(false);
                      setCsvRows([]);
                      setCsvErrors([]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-xs text-ps-text-ter underline hover:text-ps-text"
                  >
                    Upload different file
                  </button>
                </div>

                {/* Parse errors */}
                {csvErrors.length > 0 && (
                  <div className="mb-3 rounded-xl bg-ps-red-soft px-4 py-3">
                    <p className="mb-1 text-xs font-medium text-ps-red">
                      Parse errors (these rows were skipped):
                    </p>
                    <ul className="list-inside list-disc space-y-0.5 text-xs text-ps-red">
                      {csvErrors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preview / edit table */}
                {csvRows.length > 0 && (
                  <RowTable
                    rows={csvRows}
                    onChange={handleCsvRowChange}
                    onDelete={handleCsvDeleteRow}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Action bar                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || validRowsForSubmit.length === 0}
            className="rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-5 py-2 text-sm font-medium text-[#1a1208] transition-opacity hover:opacity-90 disabled:opacity-50"
            aria-busy={isSubmitting}
          >
            {submitLabel}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-xl border border-ps-border-strong bg-transparent px-4 py-2 text-sm font-medium text-ps-text transition-colors hover:bg-ps-chip disabled:opacity-50"
          >
            Cancel
          </button>

          {isSubmitting && progress && (
            <span
              className="text-xs text-ps-text-ter"
              aria-live="polite"
              role="status"
            >
              {progress.done} / {progress.total} done
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
