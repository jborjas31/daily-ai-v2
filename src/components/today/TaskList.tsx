"use client";
import { useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { AppState } from "@/store/useAppStore";
import type { ScheduleBlock, TaskInstance } from "@/lib/types";

export default function TaskList() {
  const date = useAppStore((s: AppState) => s.ui.currentDate);
  const templates = useAppStore((s: AppState) => s.templates);
  const schedule = useAppStore((s: AppState) => s.generateScheduleForDate(s.ui.currentDate));
  const instances = useAppStore((s: AppState) => s.getTaskInstancesForDate(s.ui.currentDate));
  const toggleComplete = useAppStore((s: AppState) => s.toggleComplete);

  const instanceByTemplate = useMemo(() => {
    const map = new Map<string, (typeof instances)[number]>();
    for (const i of instances) map.set(i.templateId, i);
    return map;
  }, [instances]);

  const pending = schedule.schedule.filter((b: ScheduleBlock) => {
    const inst = instanceByTemplate.get(b.templateId);
    return !inst || (inst.status !== 'completed' && inst.status !== 'skipped');
  });
  const completed = instances.filter((i: TaskInstance) => i.status === 'completed');
  const skipped = instances.filter((i: TaskInstance) => i.status === 'skipped');

  function templateName(id: string) {
    return templates.find((t) => t.id === id)?.taskName ?? id;
  }

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      <section className="border rounded-md p-3">
        <h2 className="font-semibold mb-2">Pending</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No pending tasks.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((b) => (
              <li key={`${b.templateId}-${b.startTime}`} className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{templateName(b.templateId)}</div>
                  <div className="text-sm text-black/60 dark:text-white/60">{b.startTime}–{b.endTime}</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleComplete(date, b.templateId)}
                  className="px-2 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Complete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border rounded-md p-3">
        <h2 className="font-semibold mb-2">Completed</h2>
        {completed.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No completed tasks.</p>
        ) : (
          <ul className="space-y-2">
            {completed.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{templateName(i.templateId)}</div>
                  <div className="text-sm text-black/60 dark:text-white/60">Completed</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleComplete(date, i.templateId)}
                  className="px-2 py-1 rounded-md bg-slate-700 text-white hover:bg-slate-800"
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border rounded-md p-3">
        <h2 className="font-semibold mb-2">Skipped</h2>
        {skipped.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No skipped tasks.</p>
        ) : (
          <ul className="space-y-2">
            {skipped.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{templateName(i.templateId)}</div>
                  <div className="text-sm text-black/60 dark:text-white/60">Skipped</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
