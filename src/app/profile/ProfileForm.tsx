"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User, CompetitionType } from "@/types/database";
import { useTheme, type ThemePref } from "@/components/ThemeProvider";
import { validateDisplayName, DISPLAY_NAME_MAX } from "@/lib/display-name";
import { useLiveModePreference } from "@/hooks/useLiveMode";
import { LogoutButton } from "@/components/LogoutButton";
import { useT } from "@/lib/i18n";

export interface CompetitionRef {
  id: string;
  name: string;
  type: CompetitionType;
}

const SPORT_OPTIONS = [
  "Soccer", "GAA", "Rugby", "US Sports", "Motorsport", "Tennis", "Cricket", "Other",
] as const;

type SportOption = typeof SPORT_OPTIONS[number];

type ReminderLead = 30 | 60 | 120 | 240 | 720 | 1440;
type DailyCap = 5 | 8 | 12 | 20 | 0; // 0 = no limit
type LeaderboardTrigger = "rising" | "any_change";

interface NotificationPrefs {
  prediction_reminders: boolean;
  result_notifications: boolean;
  leaderboard_updates: boolean;
  chat_mentions: boolean;
  chat_member_join: boolean;
  result_hints: boolean;
  default_sport: SportOption;
  reminder_lead_minutes: ReminderLead[];
  leaderboard_trigger: LeaderboardTrigger;
  quiet_hours_enabled: boolean;
  quiet_hours_start: number; // 0-23
  quiet_hours_end: number;   // 0-23
  daily_cap: DailyCap;
  // Competitions the user has silenced. Server treats empty/missing as "none muted".
  muted_competition_ids: string[];
}

const VALID_LEADS: readonly ReminderLead[] = [30, 60, 120, 240, 720, 1440];

/** Parse reminder_lead_minutes — handles both legacy single number and new array format. */
function parseReminderLeads(raw: unknown): ReminderLead[] {
  if (Array.isArray(raw)) {
    const valid = raw.filter((v): v is ReminderLead =>
      typeof v === "number" && VALID_LEADS.includes(v as ReminderLead),
    );
    return valid.length > 0 ? valid : [60];
  }
  // Legacy: single number
  if (typeof raw === "number" && VALID_LEADS.includes(raw as ReminderLead)) {
    return [raw as ReminderLead];
  }
  return [60];
}

function parseNotificationPrefs(
  raw: Record<string, unknown> | null
): NotificationPrefs {
  return {
    prediction_reminders:
      typeof raw?.prediction_reminders === "boolean"
        ? raw.prediction_reminders
        : true,
    result_notifications:
      typeof raw?.result_notifications === "boolean"
        ? raw.result_notifications
        : true,
    leaderboard_updates:
      typeof raw?.leaderboard_updates === "boolean"
        ? raw.leaderboard_updates
        : true,
    chat_mentions:
      typeof raw?.chat_mentions === "boolean"
        ? raw.chat_mentions
        : true,
    chat_member_join:
      typeof raw?.chat_member_join === "boolean"
        ? raw.chat_member_join
        : false,
    result_hints:
      typeof raw?.result_hints === "boolean"
        ? raw.result_hints
        : true,
    default_sport:
      SPORT_OPTIONS.includes(raw?.default_sport as SportOption)
        ? (raw!.default_sport as SportOption)
        : "Soccer",
    reminder_lead_minutes: parseReminderLeads(raw?.reminder_lead_minutes),
    leaderboard_trigger:
      raw?.leaderboard_trigger === "rising" || raw?.leaderboard_trigger === "any_change"
        ? (raw.leaderboard_trigger as LeaderboardTrigger)
        : "rising",
    quiet_hours_enabled:
      typeof raw?.quiet_hours_enabled === "boolean"
        ? raw.quiet_hours_enabled
        : true,
    quiet_hours_start:
      typeof raw?.quiet_hours_start === "number" && raw.quiet_hours_start >= 0 && raw.quiet_hours_start <= 23
        ? raw.quiet_hours_start
        : 22,
    quiet_hours_end:
      typeof raw?.quiet_hours_end === "number" && raw.quiet_hours_end >= 0 && raw.quiet_hours_end <= 23
        ? raw.quiet_hours_end
        : 7,
    daily_cap:
      ([5, 8, 12, 20, 0] as const).includes(raw?.daily_cap as DailyCap)
        ? (raw!.daily_cap as DailyCap)
        : 0,
    muted_competition_ids: Array.isArray(raw?.muted_competition_ids)
      ? (raw!.muted_competition_ids as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [],
  };
}

interface FormState {
  display_name: string;
  notification_prefs: NotificationPrefs;
}

function stateFromUser(user: User): FormState {
  return {
    display_name: user.display_name ?? "",
    notification_prefs: parseNotificationPrefs(user.notification_prefs),
  };
}

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

function statesEqual(a: FormState, b: FormState): boolean {
  return (
    a.display_name === b.display_name &&
    a.notification_prefs.prediction_reminders ===
      b.notification_prefs.prediction_reminders &&
    a.notification_prefs.result_notifications ===
      b.notification_prefs.result_notifications &&
    a.notification_prefs.leaderboard_updates ===
      b.notification_prefs.leaderboard_updates &&
    a.notification_prefs.chat_mentions ===
      b.notification_prefs.chat_mentions &&
    a.notification_prefs.chat_member_join ===
      b.notification_prefs.chat_member_join &&
    a.notification_prefs.result_hints ===
      b.notification_prefs.result_hints &&
    a.notification_prefs.default_sport ===
      b.notification_prefs.default_sport &&
    setsEqual(
      a.notification_prefs.reminder_lead_minutes.map(String),
      b.notification_prefs.reminder_lead_minutes.map(String),
    ) &&
    a.notification_prefs.leaderboard_trigger ===
      b.notification_prefs.leaderboard_trigger &&
    a.notification_prefs.quiet_hours_enabled ===
      b.notification_prefs.quiet_hours_enabled &&
    a.notification_prefs.quiet_hours_start ===
      b.notification_prefs.quiet_hours_start &&
    a.notification_prefs.quiet_hours_end ===
      b.notification_prefs.quiet_hours_end &&
    a.notification_prefs.daily_cap ===
      b.notification_prefs.daily_cap &&
    setsEqual(
      a.notification_prefs.muted_competition_ids,
      b.notification_prefs.muted_competition_ids,
    )
  );
}

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}

function Toggle({ id, checked, onChange, label, description }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start justify-between gap-4 py-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ps-text">{label}</p>
        <p className="mt-0.5 text-xs text-ps-text-ter">{description}</p>
      </div>
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        {/* Track */}
        <div
          aria-hidden="true"
          className={`h-6 w-11 rounded-full border transition-colors duration-200 ${
            checked
              ? "border-ps-amber-deep bg-ps-amber-deep"
              : "border-ps-border bg-ps-surface"
          }`}
        />
        {/* Thumb */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-ps-bg shadow transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
    </label>
  );
}

const THEME_OPTIONS: ReadonlyArray<{ value: ThemePref }> = [
  { value: "light" },
  { value: "dark" },
  { value: "system" },
];

const MORE_NOTIFS_KEY = "ps-more-notifs-expanded";

/** iOS-style section label — sits outside the card. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1.5 pl-1 text-caption font-semibold uppercase tracking-wide text-ps-text-ter">
      {children}
    </h2>
  );
}

/**
 * Card 1: Appearance + Display + Live mode merged into one card.
 * Section title rendered outside the card (iOS pattern).
 */
function YourExperienceSection() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const { alwaysOff, setAlwaysOff } = useLiveModePreference();
  const [bigger, setBigger] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ps-bigger-cards") === "true";
  });

  function handleBiggerChange(checked: boolean) {
    setBigger(checked);
    localStorage.setItem("ps-bigger-cards", String(checked));
    document.documentElement.dataset.display = checked ? "large" : "";
  }

  return (
    <div>
      <SectionLabel>{t('profile.your_experience')}</SectionLabel>
      <div className="rounded-xl border border-ps-border bg-ps-surface px-4 py-1">
        {/* Theme */}
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ps-text">{t('profile.appearance')}</p>
          </div>
          <div
            className="inline-flex shrink-0 rounded-lg border border-ps-border bg-ps-chip p-0.5"
            role="group"
            aria-label="Theme"
          >
            {THEME_OPTIONS.map((opt) => {
              const active = theme === opt.value;
              const themeLabel = (v: ThemePref) =>
                t(v === 'light' ? 'profile.theme_light' : v === 'dark' ? 'profile.theme_dark' : 'profile.theme_system');
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTheme(opt.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-ps-surface text-ps-text shadow-sm"
                      : "text-ps-text-sec hover:text-ps-text"
                  }`}
                >
                  {themeLabel(opt.value)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-ps-border" />

        {/* Display size */}
        <Toggle
          id="display_size"
          checked={bigger}
          onChange={handleBiggerChange}
          label={t('profile.display_size')}
          description={t('profile.display_size_desc')}
        />

        <div className="border-t border-ps-border" />

        {/* Live mode — flipped semantics: ON = live view active */}
        <Toggle
          id="live_mode"
          checked={!alwaysOff}
          onChange={(v) => setAlwaysOff(!v)}
          label={t('profile.live_mode_label')}
          description={t('profile.live_mode_desc')}
        />
      </div>
    </div>
  );
}

const COOLDOWN_DAYS = 7;

function nameChangeLockedUntil(updatedAt: string | null): Date | null {
  if (!updatedAt) return null;
  const d = new Date(updatedAt);
  d.setDate(d.getDate() + COOLDOWN_DAYS);
  return d > new Date() ? d : null;
}

export function ProfileForm({
  user,
  competitions = [],
}: {
  user: User;
  competitions?: CompetitionRef[];
}) {
  const t = useT();
  const initial = stateFromUser(user);
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const nameLockDate = nameChangeLockedUntil(user.display_name_updated_at);

  // Collapsible "More notification options"
  const [moreNotifsOpen, setMoreNotifsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(MORE_NOTIFS_KEY) === "1";
  });
  function toggleMoreNotifs() {
    setMoreNotifsOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(MORE_NOTIFS_KEY, next ? "1" : "0"); } catch { /* */ }
      return next;
    });
  }

  // Auto-save indicator for notification prefs
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-detect and persist timezone if not already set
  useEffect(() => {
    if (user.timezone) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    }).catch(() => {});
  }, [user.timezone]);

  // --- Auto-save for notification_prefs ---
  const autoSavePrefs = useCallback(
    async (prefs: NotificationPrefs) => {
      setAutoSaveStatus("saving");
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notification_prefs: prefs }),
        });
        if (res.ok) {
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus("idle"), 1500);
        } else {
          setAutoSaveStatus("error");
          setTimeout(() => setAutoSaveStatus("idle"), 3000);
        }
      } catch {
        setAutoSaveStatus("error");
        setTimeout(() => setAutoSaveStatus("idle"), 3000);
      }
    },
    [],
  );

  // Debounce auto-save: whenever notification_prefs change, save after 500ms
  const prefsRef = useRef(form.notification_prefs);
  prefsRef.current = form.notification_prefs;

  useEffect(() => {
    // Skip if prefs haven't actually changed from the server state
    const changed = !statesEqual(
      { display_name: initial.display_name, notification_prefs: prefsRef.current },
      initial,
    );
    if (!changed) return;

    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      autoSavePrefs(prefsRef.current);
    }, 500);

    return () => clearTimeout(autoSaveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.notification_prefs, autoSavePrefs]);

  // --- Profile tab: explicit save for display_name ---
  const nameChanged = form.display_name !== initial.display_name;
  const nameValid = !validateDisplayName(form.display_name);
  const canSaveProfile = nameChanged && nameValid && !submitting;

  function setNotifPref(
    key: keyof NotificationPrefs,
    value: NotificationPrefs[keyof NotificationPrefs]
  ) {
    setForm((prev) => ({
      ...prev,
      notification_prefs: { ...prev.notification_prefs, [key]: value },
    }));
    setFeedback(null);
  }

  function toggleCompMute(compId: string, mute: boolean) {
    setForm((prev) => {
      const current = prev.notification_prefs.muted_competition_ids;
      const next = mute
        ? current.includes(compId)
          ? current
          : [...current, compId]
        : current.filter((id) => id !== compId);
      return {
        ...prev,
        notification_prefs: { ...prev.notification_prefs, muted_competition_ids: next },
      };
    });
    setFeedback(null);
  }

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSaveProfile) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: form.display_name.trim(),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setFeedback({
          type: "error",
          message: body?.error ?? t('profile.error_generic'),
        });
      } else {
        setFeedback({ type: "success", message: t('profile.saved') });
      }
    } catch {
      setFeedback({
        type: "error",
        message: t('profile.error_network'),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header: Avatar + Display Name ──────────────────────────── */}
      <form onSubmit={handleProfileSubmit} noValidate>
        <div className="flex items-center gap-4">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={`${user.display_name} avatar`}
              className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-ps-border"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ps-chip text-lg font-semibold uppercase text-ps-text"
              aria-label="Default avatar"
            >
              {(user.display_name ?? user.email ?? "?")[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <label htmlFor="display_name" className="sr-only">
              Display name
            </label>
            {nameLockDate ? (
              <>
                <p className="text-sm font-semibold text-ps-text">{form.display_name}</p>
                <p className="mt-0.5 text-xs text-ps-text-ter">
                  {t('profile.name_locked', { date: nameLockDate.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }) })}
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  id="display_name"
                  type="text"
                  required
                  minLength={1}
                  maxLength={50}
                  value={form.display_name}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      display_name: e.target.value,
                    }));
                    setFeedback(null);
                  }}
                  placeholder={t('profile.name_placeholder')}
                  className="min-w-0 flex-1 rounded-lg border border-ps-border bg-ps-surface px-3 py-2 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-text-sec focus:outline-none"
                />
                {canSaveProfile && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="shrink-0 rounded-lg bg-ps-text px-3 py-2 text-xs font-semibold text-ps-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? t('profile.saving') : t('profile.save')}
                  </button>
                )}
              </div>
            )}
            {form.display_name.trim().length > DISPLAY_NAME_MAX && (
              <p className="mt-1 text-xs text-ps-red" role="alert">
                {t('profile.name_max_error', { max: DISPLAY_NAME_MAX })}
              </p>
            )}
            {feedback && (
              <p
                role="status"
                aria-live="polite"
                className={`mt-1 text-xs ${
                  feedback.type === "success" ? "text-ps-green" : "text-ps-red"
                }`}
              >
                {feedback.message}
              </p>
            )}
          </div>
        </div>
      </form>

      {/* ── Card 1: Your Experience ────────────────────────────────── */}
      <YourExperienceSection />

          {/* Card 2: Predictions */}
          <div>
            <SectionLabel>{t('profile.predictions_heading')}</SectionLabel>
            <div className="rounded-xl border border-ps-border bg-ps-surface px-4 py-1">
              <Toggle
                id="result_hints"
                checked={form.notification_prefs.result_hints}
                onChange={(v) => setNotifPref("result_hints", v)}
                label={t('profile.result_hints')}
                description={t('profile.result_hints_desc')}
              />
              <div className="border-t border-ps-border py-3">
                <p className="text-sm font-medium text-ps-text">{t('profile.default_sport')}</p>
                <p className="mt-0.5 text-xs text-ps-text-ter">
                  {t('profile.default_sport_desc')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Default sport">
                  {SPORT_OPTIONS.map((sport) => {
                    const active = form.notification_prefs.default_sport === sport;
                    const sportLabel = (s: SportOption) => {
                      const map: Record<SportOption, string> = {
                        Soccer: t('sport.soccer'),
                        GAA: t('sport.gaa'),
                        Rugby: t('sport.rugby'),
                        'US Sports': t('sport.us_sports'),
                        Motorsport: t('sport.motorsport'),
                        Tennis: t('sport.tennis'),
                        Cricket: t('sport.cricket'),
                        Other: t('sport.other'),
                      };
                      return map[s] ?? s;
                    };
                    return (
                      <button
                        key={sport}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            notification_prefs: { ...prev.notification_prefs, default_sport: sport },
                          }));
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.95] ${
                          active
                            ? "bg-ps-amber-deep text-[#1a1208] hover:opacity-90"
                            : "bg-ps-chip text-ps-text-sec hover:bg-ps-border"
                        }`}
                      >
                        {sportLabel(sport)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Notifications — tier 1 (always visible) + tier 2 (collapsible) */}
          <div>
            <SectionLabel>{t('profile.notifications')}</SectionLabel>
            <div className="rounded-xl border border-ps-border bg-ps-surface px-4 py-1">
              {/* Tier 1: Core notifications */}
              <Toggle
                id="prediction_reminders"
                checked={form.notification_prefs.prediction_reminders}
                onChange={(v) => setNotifPref("prediction_reminders", v)}
                label={t('profile.prediction_reminders')}
                description={t('profile.prediction_reminders_desc')}
              />
              {/* Reminder timing — multi-select pills, indented under reminders */}
              {form.notification_prefs.prediction_reminders && (
                <div className="flex flex-wrap gap-2 pb-3 pl-4" role="group" aria-label="Reminder timing">
                  {([
                    { value: 30 as ReminderLead, label: t('profile.reminder_30m') },
                    { value: 60 as ReminderLead, label: t('profile.reminder_1h') },
                    { value: 120 as ReminderLead, label: t('profile.reminder_2h') },
                    { value: 240 as ReminderLead, label: t('profile.reminder_4h') },
                    { value: 720 as ReminderLead, label: t('profile.reminder_12h') },
                    { value: 1440 as ReminderLead, label: t('profile.reminder_1d') },
                  ]).map((opt) => {
                    const active = form.notification_prefs.reminder_lead_minutes.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          const current = form.notification_prefs.reminder_lead_minutes;
                          const next = active
                            ? current.filter((v) => v !== opt.value)
                            : [...current, opt.value].sort((a, b) => a - b);
                          // Must keep at least one selected
                          if (next.length > 0) setNotifPref("reminder_lead_minutes", next);
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.95] ${
                          active
                            ? "bg-ps-amber-deep text-[#1a1208] hover:opacity-90"
                            : "bg-ps-chip text-ps-text-sec hover:bg-ps-border"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-ps-border" />
              <Toggle
                id="result_notifications"
                checked={form.notification_prefs.result_notifications}
                onChange={(v) => setNotifPref("result_notifications", v)}
                label={t('profile.result_notifications')}
                description={t('profile.result_notifications_desc')}
              />

              <div className="border-t border-ps-border" />
              <Toggle
                id="chat_mentions"
                checked={form.notification_prefs.chat_mentions}
                onChange={(v) => setNotifPref("chat_mentions", v)}
                label={t('profile.chat_mentions')}
                description={t('profile.chat_mentions_desc')}
              />

              {/* Tier 2: Collapsible advanced notifications */}
              <div className="border-t border-ps-border">
                <button
                  type="button"
                  onClick={toggleMoreNotifs}
                  className="flex w-full items-center justify-between py-3 text-xs font-medium text-ps-text-ter transition-colors hover:text-ps-text-sec"
                  aria-expanded={moreNotifsOpen}
                >
                  <span>{t('profile.more_notifications')}</span>
                  <svg
                    className={`h-4 w-4 transition-transform duration-200 ${moreNotifsOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div
                  className={`grid transition-[grid-template-rows] duration-200 ${
                    moreNotifsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <Toggle
                      id="leaderboard_updates"
                      checked={form.notification_prefs.leaderboard_updates}
                      onChange={(v) => setNotifPref("leaderboard_updates", v)}
                      label={t('profile.leaderboard_updates')}
                      description={t('profile.leaderboard_updates_desc')}
                    />
                    {form.notification_prefs.leaderboard_updates && (
                      <div className="flex items-center gap-2 pb-3 pl-4">
                        <span className="text-xs text-ps-text-ter">{t('profile.leaderboard_trigger_label')}</span>
                        <div
                          className="inline-flex rounded-lg border border-ps-border bg-ps-chip p-0.5"
                          role="group"
                          aria-label="Leaderboard trigger"
                        >
                          {([
                            { value: "rising" as LeaderboardTrigger, label: t('profile.leaderboard_rising') },
                            { value: "any_change" as LeaderboardTrigger, label: t('profile.leaderboard_any') },
                          ]).map((opt) => {
                            const active = form.notification_prefs.leaderboard_trigger === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setNotifPref("leaderboard_trigger", opt.value)}
                                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                                  active
                                    ? "bg-ps-surface text-ps-text shadow-sm"
                                    : "text-ps-text-sec hover:text-ps-text"
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-ps-border" />
                    <Toggle
                      id="chat_member_join"
                      checked={form.notification_prefs.chat_member_join}
                      onChange={(v) => setNotifPref("chat_member_join", v)}
                      label={t('profile.new_member')}
                      description={t('profile.new_member_desc')}
                    />

                    <div className="border-t border-ps-border" />
                    <Toggle
                      id="quiet_hours_enabled"
                      checked={form.notification_prefs.quiet_hours_enabled}
                      onChange={(v) => setNotifPref("quiet_hours_enabled", v)}
                      label={t('profile.quiet_hours')}
                      description={t('profile.quiet_hours_desc')}
                    />
                    {form.notification_prefs.quiet_hours_enabled && (
                      <div className="flex items-center gap-3 pb-3 pl-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-ps-text-ter">{t('profile.quiet_hours_start')}</span>
                          <select
                            value={form.notification_prefs.quiet_hours_start}
                            onChange={(e) => setNotifPref("quiet_hours_start", parseInt(e.target.value, 10))}
                            className="rounded-lg border border-ps-border bg-ps-surface px-2 py-1.5 text-xs text-ps-text focus:border-ps-text-sec focus:outline-none"
                          >
                            {Array.from({ length: 24 }, (_, h) => (
                              <option key={h} value={h}>
                                {String(h).padStart(2, "0")}:00
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-ps-text-ter">{t('profile.quiet_hours_end')}</span>
                          <select
                            value={form.notification_prefs.quiet_hours_end}
                            onChange={(e) => setNotifPref("quiet_hours_end", parseInt(e.target.value, 10))}
                            className="rounded-lg border border-ps-border bg-ps-surface px-2 py-1.5 text-xs text-ps-text focus:border-ps-text-sec focus:outline-none"
                          >
                            {Array.from({ length: 24 }, (_, h) => (
                              <option key={h} value={h}>
                                {String(h).padStart(2, "0")}:00
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-ps-border pt-3 pb-1">
                      <p className="text-sm font-medium text-ps-text">{t('profile.daily_cap')}</p>
                      <p className="mt-0.5 text-xs text-ps-text-ter">
                        {t('profile.daily_cap_desc')}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Daily notification cap">
                        {([
                          { value: 0 as DailyCap, label: t('profile.daily_cap_none') },
                          { value: 5 as DailyCap, label: "5" },
                          { value: 8 as DailyCap, label: "8" },
                          { value: 12 as DailyCap, label: "12" },
                          { value: 20 as DailyCap, label: "20" },
                        ]).map((opt) => {
                          const active = form.notification_prefs.daily_cap === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setNotifPref("daily_cap", opt.value)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.95] ${
                                active
                                  ? "bg-ps-amber-deep text-[#1a1208] hover:opacity-90"
                                  : "bg-ps-chip text-ps-text-sec hover:bg-ps-border"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Per-competition mute */}
                    {competitions.length > 0 && (
                      <div className="border-t border-ps-border pt-3">
                        <p className="text-sm font-medium text-ps-text">
                          {t('profile.per_comp_heading')}
                        </p>
                        <p className="mt-0.5 text-xs text-ps-text-ter">
                          {t('profile.per_comp_desc')}
                        </p>
                        <div className="mt-1 divide-y divide-ps-border">
                          {competitions.map((comp) => {
                            const isMuted = form.notification_prefs.muted_competition_ids.includes(comp.id);
                            const label =
                              comp.type === "personal"
                                ? t('profile.per_comp_personal')
                                : comp.name;
                            return (
                              <Toggle
                                key={comp.id}
                                id={`mute_${comp.id}`}
                                checked={!isMuted}
                                onChange={(v) => toggleCompMute(comp.id, !v)}
                                label={label}
                                description={
                                  isMuted
                                    ? t('profile.per_comp_muted')
                                    : t('profile.per_comp_subscribed')
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

      {/* Auto-save status indicator */}
      {autoSaveStatus !== "idle" && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border px-3 py-2 text-xs font-medium transition-opacity ${
            autoSaveStatus === "saved"
              ? "border-ps-green/30 bg-ps-surface text-ps-green"
              : autoSaveStatus === "error"
                ? "border-ps-red/30 bg-ps-red-soft text-ps-red"
                : "border-ps-border bg-ps-surface text-ps-text-ter"
          }`}
        >
          {autoSaveStatus === "saving" && t('profile.saving')}
          {autoSaveStatus === "saved" && t('profile.settings_saved')}
          {autoSaveStatus === "error" && t('profile.error_generic')}
        </div>
      )}

      {/* ── Card 4: Account ────────────────────────────────────────── */}
      <div>
        <SectionLabel>{t('profile.account')}</SectionLabel>
        <div className="rounded-xl border border-ps-border bg-ps-surface px-4 py-3">
          <p className="text-xs text-ps-text-ter">
            {t('profile.signed_in_as')}
          </p>
          <p className="mt-0.5 text-sm font-medium text-ps-text">
            {user.email}
          </p>
          <div className="mt-3 border-t border-ps-border pt-2">
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
