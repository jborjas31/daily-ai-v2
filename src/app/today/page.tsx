"use client";
import { useEffect } from "react";
import Timeline from "@/components/today/Timeline";
import TaskList from "@/components/today/TaskList";
import useRequireAuth from "@/components/guards/useRequireAuth";
import { useAppStore } from "@/store/useAppStore";
import type { AppState } from "@/store/useAppStore";

export default function TodayPage() {
  const { user, ready } = useRequireAuth();
  const currentDate = useAppStore((s: AppState) => s.ui.currentDate);
  const loadInstancesForDate = useAppStore((s: AppState) => s.loadInstancesForDate);
  const preloadCachedSchedule = useAppStore((s: AppState) => s.preloadCachedSchedule);

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
      <h1 className="text-xl font-semibold mb-3">Today</h1>
      <Timeline />
      <TaskList />
    </div>
  );
}
