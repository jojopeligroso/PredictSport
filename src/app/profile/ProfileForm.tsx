"use client";

import { useEffect, useState } from "react";
import type { User } from "@/types/database";
import { useTheme, type ThemePref } from "@/components/ThemeProvider";
import { validateDisplayName, DISPLAY_NAME_MAX } from "@/lib/display-name";
import { useT } from "@/lib/i18n";

const SPORT_OPTIONS = [
  "Soccer", "GAA", "Rugby", "US Sports", "Motorsport", "Tennis", "Cricket", "Other",
] as const;

type SportOption = typeof SPORT_OPTIONS[number];

interface NotificationPrefs {
  prediction_reminders: boolean;
  result_notifications: boolean;
  leaderboard_updates: boolean;
  chat_mentions: boolean;
  chat_member_join: boolean;
  result_hints: boolean;
  default_sport: SportOption;
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
        : true,
    result_hints:
      typeof raw?.result_hints === "boolean"
        ? raw.result_hints
        : true,
    default_sport:
      SPORT_OPTIONS.includes(raw?.default_sport as SportOption)
        ? (raw!.default_sport as SportOption)
        : "Soccer",
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
      b.notification_prefs.default_sport
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

function BiggerCardsToggle() {
  const t = useT();
  const [bigger, setBigger] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ps-bigger-cards") === "true";
  });

  function handleChange(checked: boolean) {
    setBigger(checked);
    localStorage.setItem("ps-bigger-cards", String(checked));
  }

  return (
    <section className="rounded-xl border border-ps-border bg-ps-surface p-6">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-ps-text-sec">
        {t('profile.display')}
      </h2>
      <div className="divide-y divide-ps-border">
        <Toggle
          id="bigger_cards"
          checked={bigger}
          onChange={handleChange}
          label={t('profile.bigger_cards')}
          description={t('profile.bigger_cards_desc')}
        />
      </div>
    </section>
  );
}

function AppearanceSection() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  return (
    <section className="rounded-xl border border-ps-border bg-ps-surface p-6">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-ps-text-sec">
        {t('profile.appearance')}
      </h2>
      <p className="mt-0.5 text-xs text-ps-text-ter">
        {t('profile.appearance_desc')}
      </p>
      <div
        className="mt-3 inline-flex rounded-lg border border-ps-border bg-ps-chip p-0.5"
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
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
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
    </section>
  );
}

type Tab = "profile" | "settings";

function readTabFromHash(): Tab {
  if (typeof window === "undefined") return "profile";
  return window.location.hash === "#settings" ? "settings" : "profile";
}

const COOLDOWN_DAYS = 7;

function nameChangeLockedUntil(updatedAt: string | null): Date | null {
  if (!updatedAt) return null;
  const d = new Date(updatedAt);
  d.setDate(d.getDate() + COOLDOWN_DAYS);
  return d > new Date() ? d : null;
}

export function ProfileForm({ user }: { user: User }) {
  const t = useT();
  const initial = stateFromUser(user);
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const nameLockDate = nameChangeLockedUntil(user.display_name_updated_at);

  useEffect(() => {
    setTab(readTabFromHash());
    const onHash = () => setTab(readTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function switchTab(next: Tab) {
    setTab(next);
    const target = next === "settings" ? "#settings" : "#profile";
    if (window.location.hash !== target) {
      history.replaceState(null, "", target);
    }
  }

  const isDirty = !statesEqual(form, initial);
  const nameValid = !validateDisplayName(form.display_name);
  const canSave = isDirty && nameValid && !submitting;

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: form.display_name.trim(),
          notification_prefs: form.notification_prefs,
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
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div
        className="inline-flex self-start rounded-lg border border-ps-border bg-ps-chip p-0.5"
        role="tablist"
        aria-label="Profile sections"
      >
        {(["profile", "settings"] as const).map((value) => {
          const active = tab === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(value)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                active
                  ? "bg-ps-surface text-ps-text shadow-sm"
                  : "text-ps-text-sec hover:text-ps-text"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {tab === "profile" && (
          <>
            {/* Display Name */}
            <section className="rounded-xl border border-ps-border bg-ps-surface p-6">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ps-text-sec">
                {t('profile.display_name')}
              </h2>
              <label htmlFor="display_name" className="sr-only">
                Display name
              </label>
              {nameLockDate ? (
                <>
                  <input
                    id="display_name"
                    type="text"
                    disabled
                    value={form.display_name}
                    className="w-full rounded-xl border border-ps-border bg-ps-chip p-3 text-sm text-ps-text-sec cursor-not-allowed"
                  />
                  <p className="mt-2 text-xs text-ps-text-ter">
                    {t('profile.name_locked', { date: nameLockDate.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }) })}
                  </p>
                </>
              ) : (
                <>
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
                    className="w-full rounded-xl border border-ps-border bg-ps-surface p-3 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-text-sec focus:outline-none"
                  />
                  {form.display_name.trim().length > DISPLAY_NAME_MAX && (
                    <p className="mt-2 text-xs text-ps-red" role="alert">
                      {t('profile.name_max_error', { max: DISPLAY_NAME_MAX })}
                    </p>
                  )}
                </>
              )}
            </section>

            {/* Avatar */}
            <section className="rounded-xl border border-ps-border bg-ps-surface p-6">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ps-text-sec">
                {t('profile.avatar')}
              </h2>
              <div className="flex items-center gap-4">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={`${user.display_name} avatar`}
                    className="h-16 w-16 rounded-full object-cover ring-1 ring-ps-border"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-ps-chip text-xl font-semibold uppercase text-ps-text"
                    aria-label="Default avatar"
                  >
                    {(user.display_name ?? user.email ?? "?")[0]}
                  </div>
                )}
                <div>
                  <p className="text-sm text-ps-text">
                    {user.avatar_url
                      ? t('profile.avatar_google')
                      : t('profile.avatar_none')}
                  </p>
                  <p className="mt-0.5 text-xs text-ps-text-ter">
                    {t('profile.avatar_upload')}
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        {tab === "settings" && (
          <>
            <AppearanceSection />

            {/* Notifications */}
            <section className="rounded-xl border border-ps-border bg-ps-surface p-6">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-ps-text-sec">
                {t('profile.notifications')}
              </h2>
              <div className="divide-y divide-ps-border">
                <Toggle
                  id="prediction_reminders"
                  checked={form.notification_prefs.prediction_reminders}
                  onChange={(v) => setNotifPref("prediction_reminders", v)}
                  label={t('profile.prediction_reminders')}
                  description={t('profile.prediction_reminders_desc')}
                />
                <Toggle
                  id="result_notifications"
                  checked={form.notification_prefs.result_notifications}
                  onChange={(v) => setNotifPref("result_notifications", v)}
                  label={t('profile.result_notifications')}
                  description={t('profile.result_notifications_desc')}
                />
                <Toggle
                  id="leaderboard_updates"
                  checked={form.notification_prefs.leaderboard_updates}
                  onChange={(v) => setNotifPref("leaderboard_updates", v)}
                  label={t('profile.leaderboard_updates')}
                  description={t('profile.leaderboard_updates_desc')}
                />
                <Toggle
                  id="chat_mentions"
                  checked={form.notification_prefs.chat_mentions}
                  onChange={(v) => setNotifPref("chat_mentions", v)}
                  label={t('profile.chat_mentions')}
                  description={t('profile.chat_mentions_desc')}
                />
                <Toggle
                  id="chat_member_join"
                  checked={form.notification_prefs.chat_member_join}
                  onChange={(v) => setNotifPref("chat_member_join", v)}
                  label={t('profile.new_member')}
                  description={t('profile.new_member_desc')}
                />
              </div>
            </section>

            {/* Display */}
            <BiggerCardsToggle />

            {/* Predictions */}
            <section className="rounded-xl border border-ps-border bg-ps-surface p-6">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-ps-text-sec">
                {t('profile.predictions_heading')}
              </h2>
              <div className="divide-y divide-ps-border">
                <Toggle
                  id="result_hints"
                  checked={form.notification_prefs.result_hints}
                  onChange={(v) => setNotifPref("result_hints", v)}
                  label={t('profile.result_hints')}
                  description={t('profile.result_hints_desc')}
                />
                <div className="py-3">
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
                            setFeedback(null);
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
            </section>
          </>
        )}

        {/* Feedback */}
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-xl border p-3 text-sm ${
              feedback.type === "success"
                ? "border-ps-green bg-ps-surface text-ps-green"
                : "border-ps-red bg-ps-red-soft text-ps-red"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-xl bg-ps-text px-4 py-3 text-sm font-semibold text-ps-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? t('profile.saving') : t('profile.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
