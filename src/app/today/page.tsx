"use client";
import Timeline from "@/components/today/Timeline";
import TaskList from "@/components/today/TaskList";

export default function TodayPage() {
  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="text-xl font-semibold mb-3">Today</h1>
      <Timeline />
      <TaskList />
    </div>
  );
}
