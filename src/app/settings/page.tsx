"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/FirebaseClientProvider";
import { useAppStore } from "@/store/useAppStore";
import type { AppState } from "@/store/useAppStore";
import type { Settings } from "@/lib/types";
import { getUserSettings, saveUserSettings } from "@/lib/data/settings";
import { toast } from "sonner";

type Errors = Partial<Record<keyof Settings, string>>;

function validate(input: Settings): Errors {
  const errors: Errors = {};
  const num = Number(input.desiredSleepDuration);
  if (Number.isNaN(num) || num < 4 || num > 12) {
    errors.desiredSleepDuration = "Sleep duration must be 4–12 hours";
  }
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRe.test(input.defaultWakeTime)) errors.defaultWakeTime = "Invalid time (HH:MM)";
  if (!timeRe.test(input.defaultSleepTime)) errors.defaultSleepTime = "Invalid time (HH:MM)";
  return errors;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const storeSettings = useAppStore((s: AppState) => s.settings);
  const setSettings = useAppStore((s: AppState) => s.setSettings);
  const [form, setForm] = useState<Settings>({
    desiredSleepDuration: 7.5,
    defaultWakeTime: "06:30",
    defaultSleepTime: "23:00",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  // Load latest settings from Firestore when the user opens this page
  useEffect(() => {
    (async () => {
      if (!user) return;
      setLoading(true);
      try {
        const remote = await getUserSettings(user.uid);
        const next = remote ?? storeSettings ?? form;
        setForm(next);
        if (remote) setSettings(remote);
      } catch {
        // Non-fatal; keep store/defaults
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Keep form in sync if store settings change externally
  useEffect(() => {
    if (storeSettings) setForm(storeSettings);
  }, [storeSettings]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(storeSettings),
    [form, storeSettings]
  );

  async function onSave() {
    if (!user) {
      toast.error("Sign in required");
      return;
    }
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      const payload: Settings = {
        desiredSleepDuration: Number(form.desiredSleepDuration),
        defaultWakeTime: form.defaultWakeTime,
        defaultSleepTime: form.defaultSleepTime,
      };
      await saveUserSettings(user.uid, payload);
      setSettings(payload);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    if (storeSettings) setForm(storeSettings);
    setErrors({});
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="text-xl font-semibold mb-4">Settings</h1>
      {loading ? (
        <p className="text-sm text-black/70 dark:text-white/70">Loading…</p>
      ) : (
        <form
          className="space-y-6"
          onSubmit={(e) => { e.preventDefault(); onSave(); }}
        >
          <div>
            <label className="block text-sm font-medium mb-1">Desired sleep duration (hours)</label>
            <input
              type="number"
              min={4}
              max={12}
              step={0.5}
              value={form.desiredSleepDuration}
              onChange={(e)=> setForm(f=>({ ...f, desiredSleepDuration: Number(e.target.value) }))}
              className="w-full max-w-xs px-3 py-2 border rounded-md bg-white dark:bg-slate-900"
            />
            {errors.desiredSleepDuration && (
              <p className="text-sm text-rose-600 mt-1">{errors.desiredSleepDuration}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1">Default wake time</label>
              <input
                type="time"
                value={form.defaultWakeTime}
                onChange={(e)=> setForm(f=>({ ...f, defaultWakeTime: e.target.value }))}
                className="w-full max-w-xs px-3 py-2 border rounded-md bg-white dark:bg-slate-900"
              />
              {errors.defaultWakeTime && (
                <p className="text-sm text-rose-600 mt-1">{errors.defaultWakeTime}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Default sleep time</label>
              <input
                type="time"
                value={form.defaultSleepTime}
                onChange={(e)=> setForm(f=>({ ...f, defaultSleepTime: e.target.value }))}
                className="w-full max-w-xs px-3 py-2 border rounded-md bg-white dark:bg-slate-900"
              />
              {errors.defaultSleepTime && (
                <p className="text-sm text-rose-600 mt-1">{errors.defaultSleepTime}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !dirty}
              className="px-3 py-1.5 rounded-md bg-blue-600 text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={!dirty || saving}
              className="px-3 py-1.5 rounded-md border"
            >
              Reset
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
