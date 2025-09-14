"use client";
import React, { useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { AppState } from "@/store/useAppStore";
import type { ScheduleBlock, TaskInstance } from "@/lib/types";
import { toastResult } from "@/lib/ui/toast";

export default function TaskList() {
  const date = useAppStore((s: AppState) => s.ui.currentDate);
  const templates = useAppStore((s: AppState) => s.templates);
  const schedule = useAppStore((s: AppState) => s.generateScheduleForDate(s.ui.currentDate));
  // Subscribe directly to instances for the current date to ensure UI updates reliably
  const instances = useAppStore((s: AppState) => s.instancesByDate[s.ui.currentDate] ?? []);
  const toggleComplete = useAppStore((s: AppState) => s.toggleComplete);
  const skipInstance = useAppStore((s: AppState) => s.skipInstance);
  const postponeInstance = useAppStore((s: AppState) => s.postponeInstance);
  const undoInstanceStatus = useAppStore((s: AppState) => s.undoInstanceStatus);

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
  const postponed = instances.filter((i: TaskInstance) => i.status === 'postponed');

  // Inline reason editing for skipped items
  const [editingReasonFor, setEditingReasonFor] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState<string>("");

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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await toggleComplete(date, b.templateId);
                      toastResult('complete', ok);
                    }}
                    className="px-2 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await skipInstance(date, b.templateId);
                      toastResult('skip', ok);
                    }}
                    className="px-2 py-1 rounded-md bg-amber-600 text-white hover:bg-amber-700"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await postponeInstance(date, b.templateId);
                      toastResult('postpone', ok);
                    }}
                    className="px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Postpone
                  </button>
                </div>
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
                  onClick={async () => {
                    const ok = await toggleComplete(date, i.templateId);
                    toastResult('pending', ok);
                  }}
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
                  <div className="text-sm text-black/60 dark:text-white/60">
                    Skipped{i.skippedReason ? ` — ${i.skippedReason}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingReasonFor === i.templateId ? (
                    <>
                      <input
                        type="text"
                        value={reasonDraft}
                        onChange={(e)=>setReasonDraft(e.target.value)}
                        placeholder="Add reason"
                        className="px-2 py-1 border rounded-md text-sm w-44"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await skipInstance(date, i.templateId, reasonDraft.trim() || undefined);
                          toastResult('save', ok);
                          setEditingReasonFor(null);
                          setReasonDraft("");
                        }}
                        className="px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingReasonFor(null); setReasonDraft(""); }}
                        className="px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-700 text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { setEditingReasonFor(i.templateId); setReasonDraft(i.skippedReason ?? ""); }}
                        className="px-2 py-1 rounded-md bg-amber-600 text-white hover:bg-amber-700 text-sm"
                      >
                        {i.skippedReason ? 'Edit reason' : 'Add reason'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await undoInstanceStatus(date, i.templateId);
                          toastResult('pending', ok);
                        }}
                        className="px-2 py-1 rounded-md bg-slate-700 text-white hover:bg-slate-800"
                      >
                        Undo
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border rounded-md p-3">
        <h2 className="font-semibold mb-2">Postponed</h2>
        {postponed.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No postponed tasks.</p>
        ) : (
          <ul className="space-y-2">
            {postponed.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{templateName(i.templateId)}</div>
                  <div className="text-sm text-black/60 dark:text-white/60">Postponed{i.note || i.skippedReason ? ` — ${i.note ?? i.skippedReason}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  {editingReasonFor === i.templateId ? (
                    <>
                      <input
                        type="text"
                        value={reasonDraft}
                        onChange={(e)=>setReasonDraft(e.target.value)}
                        placeholder="Add note"
                        className="px-2 py-1 border rounded-md text-sm w-44"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await postponeInstance(date, i.templateId, reasonDraft.trim() || undefined);
                          toastResult('save', ok);
                          setEditingReasonFor(null);
                          setReasonDraft("");
                        }}
                        className="px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingReasonFor(null); setReasonDraft(""); }}
                        className="px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-700 text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { setEditingReasonFor(i.templateId); setReasonDraft(i.note ?? i.skippedReason ?? ""); }}
                        className="px-2 py-1 rounded-md bg-amber-600 text-white hover:bg-amber-700 text-sm"
                      >
                        {i.note || i.skippedReason ? 'Edit note' : 'Add note'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await undoInstanceStatus(date, i.templateId);
                          toastResult('pending', ok);
                        }}
                        className="px-2 py-1 rounded-md bg-slate-700 text-white hover:bg-slate-800"
                      >
                        Undo
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
