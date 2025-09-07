"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { TaskTemplate } from "@/lib/types";
import { toMinutes } from "@/lib/time";
import { motion, type PanInfo } from "framer-motion";
import { toastResult } from "@/lib/ui/toast";

const ROW_HEIGHT = 64; // px per hour (mobile-first)
const TOTAL_MINUTES = 24 * 60;

function minutesToY(mins: number) {
  return (mins / 60) * ROW_HEIGHT;
}

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

export default function Timeline() {
  const currentDate = useAppStore((s) => s.ui.currentDate);
  const settings = useAppStore((s) => s.settings);
  const templates = useAppStore((s) => s.templates);
  const scheduleRes = useAppStore((s) => s.generateScheduleForDate(currentDate));
  const containerRef = useRef<HTMLDivElement>(null);
  const nowMins = useNowMinutes();
  const setNewTaskPrefill = useAppStore((s) => s.setNewTaskPrefill);

  function handleGridClick(e: ReactMouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = e.currentTarget.clientHeight;
    const boundedY = Math.max(0, Math.min(y, height));
    const minutesRaw = (boundedY / ROW_HEIGHT) * 60;
    const snapped = Math.round(minutesRaw / 5) * 5;
    const hrs = Math.floor(snapped / 60);
    const mins = snapped % 60;
    const startStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    // Step 2.3.6/2.3.7: compute clicked time and suggested window
    let win: 'morning' | 'afternoon' | 'evening' | 'anytime' = 'anytime';
    if (snapped >= 6 * 60 && snapped < 12 * 60) win = 'morning';
    else if (snapped >= 12 * 60 && snapped < 18 * 60) win = 'afternoon';
    else if (snapped >= 18 * 60 && snapped < 23 * 60) win = 'evening';
    // Write prefill to store for New Task modal
    setNewTaskPrefill({ time: startStr, window: win });
  }

  // Auto-scroll to now on mount (keep near center) if within the day
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const y = minutesToY(nowMins) - el.clientHeight / 2;
    el.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocks = scheduleRes.schedule.map((b) => {
    const start = toMinutes(b.startTime);
    const end = toMinutes(b.endTime);
    const dur = Math.max(0, end - start);
    const top = minutesToY(start);
    const height = Math.max(8, minutesToY(dur));
    const t = templates.find((t) => t.id === b.templateId) as TaskTemplate | undefined;
    const isMandatory = t?.isMandatory;
    const isFixed = t?.schedulingType === 'fixed';
    const bg = isMandatory ? 'bg-rose-500/70' : isFixed ? 'bg-blue-500/70' : 'bg-green-500/70';
    const border = isMandatory ? 'border-rose-700/70' : isFixed ? 'border-blue-700/70' : 'border-green-700/70';
    const label = t?.taskName ?? b.templateId;
    const draggable = !isMandatory; // keep it minimal: draggable when not mandatory
    return { top, height, bg, border, label, id: b.templateId, start: b.startTime, end: b.endTime, draggable, dur };
  });

  const hours = useMemo(() => Array.from({ length: 25 }, (_, i) => i), []);

  // Sleep zones (shade non-awake times)
  const wake = settings?.defaultWakeTime ?? '06:30';
  const sleep = settings?.defaultSleepTime ?? '23:00';
  const sleepSegments = useMemo(() => {
    const w = toMinutes(wake);
    const s = toMinutes(sleep);
    const segs: { top: number; height: number }[] = [];
    if (w > 0) {
      segs.push({ top: 0, height: minutesToY(w) });
    }
    if (s < TOTAL_MINUTES) {
      segs.push({ top: minutesToY(s), height: minutesToY(TOTAL_MINUTES - s) });
    }
    return segs;
  }, [wake, sleep]);

  return (
    <div className="relative border rounded-lg overflow-hidden max-h-[80svh] overscroll-contain touch-pan-y" ref={containerRef}>
      <div className="relative select-none" style={{ height: `${ROW_HEIGHT * 24}px` }} onClick={handleGridClick}>
        {/* Sleep shading */}
        {sleepSegments.map((s, idx) => (
          <div
            key={idx}
            className="absolute left-0 right-0 bg-slate-200/60 dark:bg-slate-700/40 pointer-events-none"
            style={{ top: s.top, height: s.height }}
            aria-hidden
          />
        ))}

        {/* Hour grid */}
        {hours.map((h) => (
          <div key={h} className="absolute left-0 right-0 border-b border-black/10 dark:border-white/10" style={{ top: minutesToY(h * 60) }}>
            <div className="absolute -translate-y-1/2 left-2 text-[11px] text-black/60 dark:text-white/60 select-none">
              {String(h).padStart(2, '0')}:00
            </div>
          </div>
        ))}

        {/* Now line */}
        <div
          className="absolute left-0 right-0 h-[2px] bg-rose-500 shadow-sm"
          style={{ top: minutesToY(nowMins) }}
          aria-label="Current time"
        />

        {/* Scheduled blocks */}
        {blocks.map((b) => {
          const key = b.id + b.start;
          const dragProps = b.draggable ? {
            drag: "y" as const,
            dragMomentum: false,
            onDragEnd: async (_: unknown, info: PanInfo) => {
              const newTopPx = b.top + info.offset.y;
              const maxTopPx = minutesToY(TOTAL_MINUTES - b.dur);
              const boundedTop = Math.max(0, Math.min(newTopPx, maxTopPx));
              const newStartMinsRaw = (boundedTop / ROW_HEIGHT) * 60;
              // snap to 5 minute increments
              const snapped = Math.round(newStartMinsRaw / 5) * 5;
              const hrs = Math.floor(snapped / 60);
              const mins = snapped % 60;
              const startStr = `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
              const ok = await useAppStore.getState().setInstanceStartTime(useAppStore.getState().ui.currentDate, b.id, startStr);
              toastResult('update', ok);
            },
          } : {};
          return (
            <motion.div
              key={key}
              className={`absolute left-[80px] right-3 ${b.bg} ${b.border} border rounded-md text-[12px] text-white shadow-sm p-2 ${b.draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{ top: b.top, height: b.height }}
              {...dragProps}
            >
              <div className="font-medium truncate">{b.label}</div>
              <div className="opacity-90">{b.start}–{b.end}{b.draggable ? ' • drag to move' : ''}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
