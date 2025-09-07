"use client";
import { useEffect, useState } from "react";
import Timeline from "@/components/today/Timeline";
import TaskList from "@/components/today/TaskList";
import useRequireAuth from "@/components/guards/useRequireAuth";
import { useAppStore } from "@/store/useAppStore";
import type { AppState } from "@/store/useAppStore";
import TaskModal from "@/components/library/TaskModal";
import { createTemplate } from "@/lib/data/templates";
import { toast } from "sonner";
import { toastError, toastSuccess } from "@/lib/ui/toast";

export default function TodayPage() {
  const { user, ready } = useRequireAuth();
  const currentDate = useAppStore((s: AppState) => s.ui.currentDate);
  const loadInstancesForDate = useAppStore((s: AppState) => s.loadInstancesForDate);
  const preloadCachedSchedule = useAppStore((s: AppState) => s.preloadCachedSchedule);
  const upsert = useAppStore((s: AppState) => s.upsertTaskTemplate);
  const prefill = useAppStore((s: AppState) => s.ui.newTaskPrefill);
  const setNewTaskPrefill = useAppStore((s: AppState) => s.setNewTaskPrefill);
  const [modalOpen, setModalOpen] = useState(false);

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
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Today</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          New Task
        </button>
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
            const created = await createTemplate(user.uid, payload as any);
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
