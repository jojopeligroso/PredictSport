"use client";

import { useEffect, useState } from "react";
import type { User } from "@/types/database";
import { useTheme, type ThemePref } from "@/components/ThemeProvider";

const SPORT_OPTIONS = [
  "Soccer", "GAA", "Rugby", "US Sports", "Motorsport", "Tennis", "Cricket", "Other",
] as const;

type SportOption = typeof SPORT_OPTIONS[number];

interface NotificationPrefs {
  prediction_reminders: boolean;
  result_notifications: boolean;
  leaderboard_updates: boolean;
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
        : false,
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

const THEME_OPTIONS: ReadonlyArray<{ value: ThemePref; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function BiggerCardsToggle() {
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
        Display
      </h2>
      <div className="divide-y divide-ps-border">
        <Toggle
          id="bigger_cards"
          checked={bigger}
          onChange={handleChange}
          label="Bigger cards"
          description="Use larger fixture cards on the World Cup results page"
        />
      </div>
    </section>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="rounded-xl border border-ps-border bg-ps-surface p-6">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-ps-text-sec">
        Appearance
      </h2>
      <p className="mt-0.5 text-xs text-ps-text-ter">
        Light is a warm off-white. Dark is the deep ink shell. System follows
        your device.
      </p>
      <div
        className="mt-3 inline-flex rounded-lg border border-ps-border bg-ps-chip p-0.5"
        role="group"
        aria-label="Theme"
      >
        {THEME_OPTIONS.map((opt) => {
          const active = theme === opt.value;
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
              {opt.label}
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

export function ProfileForm({ user }: { user: User }) {
  const initial = stateFromUser(user);
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [tab, setTab] = useState<Tab>("profile");

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
  const nameValid =
    form.display_name.trim().length >= 1 &&
    form.display_name.trim().length <= 50;
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
          message: body?.error ?? "Something went wrong. Please try again.",
        });
      } else {
        setFeedback({ type: "success", message: "Profile saved." });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Network error. Please try again.",
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
                Display Name
              </h2>
              <label htmlFor="display_name" className="sr-only">
                Display name
              </label>
              <input
                id="display_name"
                type="text"
                required
                minLength={1}
                maxLength={50}
                value={form.display_name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, display_name: e.target.value }));
                  setFeedback(null);
                }}
                placeholder="Your display name"
                className="w-full rounded-xl border border-ps-border bg-ps-surface p-3 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-text-sec focus:outline-none"
              />
              {form.display_name.trim().length > 50 && (
                <p className="mt-2 text-xs text-ps-red" role="alert">
                  Display name must be 50 characters or fewer.
                </p>
              )}
            </section>

            {/* Avatar */}
            <section className="rounded-xl border border-ps-border bg-ps-surface p-6">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ps-text-sec">
                Avatar
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
                      ? "Google profile picture"
                      : "No avatar set"}
                  </p>
                  <p className="mt-0.5 text-xs text-ps-text-ter">
                    Avatar upload is not available in this version.
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
                Notifications
              </h2>
              <div className="divide-y divide-ps-border">
                <Toggle
                  id="prediction_reminders"
                  checked={form.notification_prefs.prediction_reminders}
                  onChange={(v) => setNotifPref("prediction_reminders", v)}
                  label="Prediction reminders"
                  description="Remind me before events lock"
                />
                <Toggle
                  id="result_notifications"
                  checked={form.notification_prefs.result_notifications}
                  onChange={(v) => setNotifPref("result_notifications", v)}
                  label="Result notifications"
                  description="Notify me when results are confirmed"
                />
                <Toggle
                  id="leaderboard_updates"
                  checked={form.notification_prefs.leaderboard_updates}
                  onChange={(v) => setNotifPref("leaderboard_updates", v)}
                  label="Leaderboard updates"
                  description="Weekly leaderboard summary"
                />
              </div>
            </section>

            {/* Display */}
            <BiggerCardsToggle />

            {/* Predictions */}
            <section className="rounded-xl border border-ps-border bg-ps-surface p-6">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-ps-text-sec">
                Predictions
              </h2>
              <div className="divide-y divide-ps-border">
                <Toggle
                  id="result_hints"
                  checked={form.notification_prefs.result_hints}
                  onChange={(v) => setNotifPref("result_hints", v)}
                  label="Result colour hints"
                  description="Green or red accent on cards when a result is confirmed"
                />
                <div className="py-3">
                  <p className="text-sm font-medium text-ps-text">Default sport</p>
                  <p className="mt-0.5 text-xs text-ps-text-ter">
                    Opens here when you visit My Personal Predictions
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Default sport">
                    {SPORT_OPTIONS.map((sport) => {
                      const active = form.notification_prefs.default_sport === sport;
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
                          {sport}
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
            {submitting ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
