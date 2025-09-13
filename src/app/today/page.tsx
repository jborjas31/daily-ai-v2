"use client";
import { useEffect, useMemo, useState } from "react";
import Timeline from "@/components/today/Timeline";
import TaskList from "@/components/today/TaskList";
import useRequireAuth from "@/components/guards/useRequireAuth";
import { useAppStore } from "@/store/useAppStore";
import type { AppState } from "@/store/useAppStore";
import TaskModal from "@/components/library/TaskModal";
import { createTemplate } from "@/lib/data/templates";
import { toast } from "sonner";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { toMinutes, todayISO } from "@/lib/time";
import useNowTick from "@/lib/utils/useNowTick";

function useNowMinutes() {
  const [mins, setMins] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setMins(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return mins;
}

export default function TodayPage() {
  const { user, ready } = useRequireAuth();
  const currentDate = useAppStore((s: AppState) => s.ui.currentDate);
  const setCurrentDate = useAppStore((s: AppState) => s.setCurrentDate);
  const schedule = useAppStore((s: AppState) => s.generateScheduleForDate(s.ui.currentDate));
  const instances = useAppStore((s: AppState) => s.getTaskInstancesForDate(s.ui.currentDate));
  const loadInstancesForDate = useAppStore((s: AppState) => s.loadInstancesForDate);
  const preloadCachedSchedule = useAppStore((s: AppState) => s.preloadCachedSchedule);
  const upsert = useAppStore((s: AppState) => s.upsertTaskTemplate);
  const prefill = useAppStore((s: AppState) => s.ui.newTaskPrefill);
  const setNewTaskPrefill = useAppStore((s: AppState) => s.setNewTaskPrefill);
  const [modalOpen, setModalOpen] = useState(false);
  const nowMins = useNowMinutes();
  const { nowTime } = useNowTick(30_000);

  function addDaysISO(dateISO: string, delta: number): string {
    const d = new Date(dateISO + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const isToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return currentDate === today;
  }, [currentDate]);

  const { completedCount, skippedCount, overdueCount } = useMemo(() => {
    const completedCount = instances.filter(i => i.status === 'completed').length;
    const skippedCount = instances.filter(i => i.status === 'skipped').length;
    // Overdue: scheduled start before now and not completed/skipped
    let overdueCount = 0;
    if (isToday) {
      const instMap = new Map(instances.map(i => [i.templateId, i]));
      for (const b of schedule.schedule) {
        const start = toMinutes(b.startTime);
        const inst = instMap.get(b.templateId);
        const done = !!inst && (inst.status === 'completed' || inst.status === 'skipped');
        if (!done && start < nowMins) overdueCount++;
      }
    }
    return { completedCount, skippedCount, overdueCount };
  }, [instances, schedule.schedule, nowMins, isToday]);

  useEffect(() => {
    if (!ready || !user) return;
    loadInstancesForDate(currentDate);
    preloadCachedSchedule(currentDate);
  }, [ready, user, currentDate, loadInstancesForDate, preloadCachedSchedule]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <h1 className="text-xl font-semibold mb-3">Today</h1>
        <p className="text-sm text-black/70 dark:text-white/70">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Today</h1>
          <span className="text-sm text-black/70 dark:text-white/70" aria-label="Current time">{nowTime}</span>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-2" role="group" aria-label="Date navigation">
            <button
              type="button"
              onClick={() => setCurrentDate(addDaysISO(currentDate, -1))}
              className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-sm"
              title="Previous day"
              aria-label="Previous day"
            >
              ◀ Prev
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate(todayISO())}
              className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-sm"
              title="Jump to today"
              aria-label="Jump to today"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate(addDaysISO(currentDate, 1))}
              className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-sm"
              title="Next day"
              aria-label="Next day"
            >
              Next ▶
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="dateInput" className="text-sm">Date</label>
            <input
              id="dateInput"
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="px-2 py-1.5 border rounded-md text-sm"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          New Task
        </button>
      </div>
      {/* Status rollup (counts only) */}
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100" title="Completed today">
          Completed: {completedCount}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100" title="Skipped today">
          Skipped: {skippedCount}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100" title="Overdue (scheduled before now and not done)">
          Overdue: {overdueCount}
        </span>
      </div>
      <Timeline />
      <TaskList />

      {/* Floating action button (mobile-friendly) */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="fixed bottom-4 right-4 px-4 py-2 rounded-full shadow-lg bg-blue-600 text-white hover:bg-blue-700 sm:hidden"
        aria-label="Create new task"
      >
        New Task
      </button>

      {/* Today-scoped TaskModal using store prefill */}
      <TaskModal
        open={modalOpen}
        onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) setNewTaskPrefill(null); // clear prefill on close/cancel
        }}
        initial={null}
        prefill={prefill ?? undefined}
        onSave={async (payload) => {
          if (!user) {
            toast.error("Sign in required");
            return;
          }
          try {
            // Only create path for Today modal
            if ('id' in payload) {
              // Today modal should not receive edit payloads
              toastError('save');
              return;
            }
            const created = await createTemplate(user.uid, payload);
            upsert(created);
            toastSuccess('create');
          } catch {
            toastError('create');
          }
        }}
      />
    </div>
  );
}
