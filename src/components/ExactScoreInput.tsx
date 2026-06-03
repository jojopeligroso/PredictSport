"use client";

import { useCallback } from "react";
import { getScoreFormat, gaaAggregate } from "@/lib/score-format";

export interface StandardScore {
  home: number | "";
  away: number | "";
}

export interface GAATeamScore {
  goals: number | "";
  points: number | "";
}

export interface GAAScore {
  home: GAATeamScore;
  away: GAATeamScore;
}

export type ScoreValue = StandardScore | GAAScore;

interface ExactScoreInputProps {
  sport: string;
  homeTeam: string;
  awayTeam: string;
  value: ScoreValue;
  onChange: (value: ScoreValue) => void;
  disabled?: boolean;
}

export function isGAAScore(val: ScoreValue): val is GAAScore {
  return typeof val.home === "object";
}

export function isScoreComplete(val: ScoreValue, sport: string): boolean {
  const format = getScoreFormat(sport);
  if (format === "gaa") {
    const s = val as GAAScore;
    return (
      s.home.goals !== "" &&
      s.home.points !== "" &&
      s.away.goals !== "" &&
      s.away.points !== ""
    );
  }
  const s = val as StandardScore;
  return s.home !== "" && s.away !== "";
}

export function emptyScore(sport: string): ScoreValue {
  const format = getScoreFormat(sport);
  if (format === "gaa") {
    return {
      home: { goals: "", points: "" },
      away: { goals: "", points: "" },
    };
  }
  return { home: "", away: "" };
}

export function scoreToData(val: ScoreValue, sport: string): Record<string, unknown> | null {
  if (!isScoreComplete(val, sport)) return null;
  const format = getScoreFormat(sport);
  if (format === "gaa") {
    const s = val as GAAScore;
    return {
      home: { goals: Number(s.home.goals), points: Number(s.home.points) },
      away: { goals: Number(s.away.goals), points: Number(s.away.points) },
    };
  }
  const s = val as StandardScore;
  return { home: Number(s.home), away: Number(s.away) };
}

export function dataToScore(data: Record<string, unknown> | null, sport: string): ScoreValue {
  if (!data) return emptyScore(sport);
  const format = getScoreFormat(sport);
  if (format === "gaa" && typeof data.home === "object") {
    const h = data.home as Record<string, number>;
    const a = data.away as Record<string, number>;
    return {
      home: { goals: h?.goals ?? "", points: h?.points ?? "" },
      away: { goals: a?.goals ?? "", points: a?.points ?? "" },
    };
  }
  if (data.home !== undefined) {
    return { home: data.home as number | "", away: data.away as number | "" };
  }
  return emptyScore(sport);
}

const numInputClasses =
  "w-12 rounded-md border border-ps-border-strong bg-ps-surface px-1.5 py-1.5 text-center text-base font-mono text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber disabled:opacity-50 disabled:cursor-not-allowed";

export function ExactScoreInput({
  sport,
  homeTeam,
  awayTeam,
  value,
  onChange,
  disabled,
}: ExactScoreInputProps) {
  const format = getScoreFormat(sport);

  const handleNumChange = useCallback(
    (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "") {
        setter("");
        return;
      }
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num >= 0) {
        setter(String(num));  // normalize: "01" → "1"
      }
    },
    []
  );

  if (format === "gaa") {
    const score = value as GAAScore;
    const homeTotal = score.home.goals !== "" && score.home.points !== ""
      ? gaaAggregate(Number(score.home.goals), Number(score.home.points))
      : null;
    const awayTotal = score.away.goals !== "" && score.away.points !== ""
      ? gaaAggregate(Number(score.away.goals), Number(score.away.points))
      : null;

    const updateHome = (field: "goals" | "points", val: string) => {
      onChange({
        ...score,
        home: { ...score.home, [field]: val === "" ? "" : Number(val) },
      });
    };
    const updateAway = (field: "goals" | "points", val: string) => {
      onChange({
        ...score,
        away: { ...score.away, [field]: val === "" ? "" : Number(val) },
      });
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ps-text min-w-[80px] truncate">
            {homeTeam}
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="G"
            value={score.home.goals}
            onChange={handleNumChange((v) => updateHome("goals", v))}
            disabled={disabled}
            className={numInputClasses}
          />
          <span className="text-xs text-ps-text-ter">-</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="P"
            value={score.home.points}
            onChange={handleNumChange((v) => updateHome("points", v))}
            disabled={disabled}
            className={numInputClasses}
          />
          {homeTotal !== null && (
            <span className="text-[11px] font-mono text-ps-text-ter">
              ({homeTotal})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ps-text min-w-[80px] truncate">
            {awayTeam}
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="G"
            value={score.away.goals}
            onChange={handleNumChange((v) => updateAway("goals", v))}
            disabled={disabled}
            className={numInputClasses}
          />
          <span className="text-xs text-ps-text-ter">-</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="P"
            value={score.away.points}
            onChange={handleNumChange((v) => updateAway("points", v))}
            disabled={disabled}
            className={numInputClasses}
          />
          {awayTotal !== null && (
            <span className="text-[11px] font-mono text-ps-text-ter">
              ({awayTotal})
            </span>
          )}
        </div>
      </div>
    );
  }

  // Standard format
  const score = value as StandardScore;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-ps-text min-w-[60px] truncate text-right">
        {homeTeam}
      </span>
      <input
        type="text"
        inputMode="numeric"
        placeholder=""
        value={score.home}
        onChange={handleNumChange((v) => {
          onChange({ ...score, home: v === "" ? "" : Number(v) });
        })}
        disabled={disabled}
        className={numInputClasses}
      />
      <span className="text-xs text-ps-text-ter">-</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder=""
        value={score.away}
        onChange={handleNumChange((v) => {
          onChange({ ...score, away: v === "" ? "" : Number(v) });
        })}
        disabled={disabled}
        className={numInputClasses}
      />
      <span className="text-xs font-semibold text-ps-text min-w-[60px] truncate">
        {awayTeam}
      </span>
    </div>
  );
}
