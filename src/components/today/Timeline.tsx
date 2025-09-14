"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { TaskTemplate } from "@/lib/types";
import { toMinutes, fromMinutes, todayISO } from "@/lib/time";
import type { TimeString } from "@/lib/time";
import { motion, type PanInfo, useDragControls } from "framer-motion";
import { toastResult } from "@/lib/ui/toast";
import useNowTick from "@/lib/utils/useNowTick";
import assignLanes from "@/lib/timeline/lanes";
import detectGaps from "@/lib/timeline/gaps";

const ROW_HEIGHT = 64; // px per hour (mobile-first)
const TOTAL_MINUTES = 24 * 60;

function minutesToY(mins: number) {
  return (mins / 60) * ROW_HEIGHT;
}

export default function Timeline() {
  const currentDate = useAppStore((s) => s.ui.currentDate);
  const settings = useAppStore((s) => s.settings);
  const templates = useAppStore((s) => s.templates);
  const scheduleRes = useAppStore((s) => s.generateScheduleForDate(currentDate));
  const instances = useAppStore((s) => s.getTaskInstancesForDate(s.ui.currentDate));
  const containerRef = useRef<HTMLDivElement>(null);
  const { nowTime } = useNowTick(30_000);
  const nowMins = useMemo(() => toMinutes(nowTime as TimeString), [nowTime]);
  const setNewTaskPrefill = useAppStore((s) => s.setNewTaskPrefill);
  const [laneCap, setLaneCap] = useState<number>(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        return window.matchMedia('(min-width: 768px)').matches ? 3 : 2;
      } catch {
        return 2;
      }
    }
    return 2;
  });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [openMoreKey, setOpenMoreKey] = useState<string | null>(null);
  const containerRefForOutside = useRef<HTMLDivElement>(null);

  // Responsive lane cap: mobile (<= md) 2 lanes; desktop 3 lanes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(min-width: 768px)');
    const apply = () => setLaneCap(mql.matches ? 3 : 2);
    apply();
    const handler = (e: MediaQueryListEvent) => setLaneCap(e.matches ? 3 : 2);
    try {
      mql.addEventListener('change', handler as unknown as EventListener);
    } catch {
      // Fallback for older browsers
      (mql as unknown as { addListener?: (cb: (e: MediaQueryListEvent) => void) => void }).addListener?.(handler);
    }
    return () => {
      try {
        mql.removeEventListener('change', handler as unknown as EventListener);
      } catch {
        (mql as unknown as { removeListener?: (cb: (e: MediaQueryListEvent) => void) => void }).removeListener?.(handler);
      }
    };
  }, []);

  // Respect prefers-reduced-motion for transform animations
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const set = () => setPrefersReducedMotion(mq.matches);
    set();
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    try {
      mq.addEventListener('change', onChange as unknown as EventListener);
    } catch {
      (mq as unknown as { addListener?: (cb: (e: MediaQueryListEvent) => void) => void }).addListener?.(onChange);
    }
    return () => {
      try {
        mq.removeEventListener('change', onChange as unknown as EventListener);
      } catch {
        (mq as unknown as { removeListener?: (cb: (e: MediaQueryListEvent) => void) => void }).removeListener?.(onChange);
      }
    };
  }, []);

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

  // Auto-scroll to now when viewing today (initially and on date/now changes)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (currentDate !== todayISO()) return;
    const y = minutesToY(nowMins) - el.clientHeight / 2;
    const top = Math.max(0, y);
    const maybeScroll = el as Element & { scrollTo?: (options: ScrollToOptions) => void };
    if (typeof maybeScroll.scrollTo === 'function') {
      maybeScroll.scrollTo({ top, behavior: 'smooth' });
    } else {
      (el as HTMLDivElement).scrollTop = top;
    }
  }, [currentDate, nowMins]);

  const instMap = useMemo(() => new Map(instances.map((i) => [i.templateId, i])), [instances]);
  const isToday = currentDate === todayISO();

  const baseBlocks = useMemo(() => {
    return scheduleRes.schedule.map((b) => {
      const start = toMinutes(b.startTime);
      const end = toMinutes(b.endTime);
      const dur = Math.max(0, end - start);
      const t = templates.find((t) => t.id === b.templateId) as TaskTemplate | undefined;
      const isMandatory = t?.isMandatory === true;
      const isFixed = t?.schedulingType === 'fixed';
      const inst = instMap.get(b.templateId);
      const done = !!inst && (inst.status === 'completed' || inst.status === 'skipped');
      const baseTop = minutesToY(start);
      const height = Math.max(8, minutesToY(dur));
      // Base palette (time-independent)
      const bg = isMandatory ? 'bg-rose-600/85' : isFixed ? 'bg-blue-600/85' : 'bg-green-600/85';
      const border = isMandatory ? 'border-rose-800/80' : isFixed ? 'border-blue-800/80' : 'border-green-800/80';
      const label = t?.taskName ?? b.templateId;
      const draggable = !isMandatory;
      return {
        top: baseTop,
        height,
        bg,
        border,
        extra: '',
        label,
        id: b.templateId,
        start: b.startTime,
        end: b.endTime,
        startMin: start,
        endMin: end,
        draggable,
        dur,
        laneIndex: null as number | null,
        laneCount: 1,
        hidden: false,
        isFixed,
        bufferMinutes: t?.bufferMinutes,
        instModifiedStart: inst?.modifiedStartTime,
        isMandatory,
        done,
      };
    });
  }, [scheduleRes.schedule, templates, instMap]);

  const blocks = useMemo(() => {
    const now = nowMins;
    return baseBlocks.map((b) => {
      const isOverdue = isToday && !b.done && b.startMin < now;
      let extra = b.extra;
      let bg = b.bg;
      let border = b.border;
      const transformY = isOverdue && b.isMandatory ? (minutesToY(now) - minutesToY(b.startMin)) : 0;
      if (isOverdue) {
        if (b.isMandatory) {
          bg = 'bg-rose-600';
          border = 'border-rose-800';
        } else {
          extra = 'opacity-60';
        }
      }
      const overdueKind = isOverdue ? (b.isMandatory ? 'mandatory' : 'skippable') : 'no';
      return { ...b, bg, border, extra, transformY, overdueKind };
    });
  }, [baseBlocks, nowMins, isToday]);

  // Build buffer overlays (visual only) for anchors (fixed or manual override)
  const bufferOverlays: { top: number; height: number; key: string; kind: 'before' | 'after'; id: string }[] = [];
  const GRID_PX = ROW_HEIGHT * 24;
  for (const b of blocks) {
    const isManualAnchor = !!b.instModifiedStart && b.instModifiedStart === b.start;
    const isAnchor = b.isFixed || isManualAnchor;
    if (!isAnchor) continue;
    const bufMin = Math.max(0, b.bufferMinutes ?? 8);
    if (bufMin <= 0) continue;
    const bufPx = minutesToY(bufMin);
    // Before buffer
    const beforeTop = Math.max(0, b.top - bufPx);
    const beforeHeight = Math.min(bufPx, b.top);
    if (beforeHeight > 0.5) bufferOverlays.push({ top: beforeTop, height: beforeHeight, key: `${b.id}-${b.start}-before`, kind: 'before', id: b.id });
    // After buffer
    const blockBottom = b.top + b.height;
    const afterTop = Math.max(0, Math.min(blockBottom, GRID_PX));
    const afterHeight = Math.max(0, Math.min(bufPx, GRID_PX - afterTop));
    if (afterHeight > 0.5) bufferOverlays.push({ top: afterTop, height: afterHeight, key: `${b.id}-${b.end}-after`, kind: 'after', id: b.id });
  }

  // Compute lanes/+X badges from base geometry only to avoid ticker-triggered recomputes
  const laneMemo = useMemo(() => {
    type BlockWithIdx = typeof baseBlocks[number] & { idx: number };
    const withIdx: BlockWithIdx[] = baseBlocks.map((b, i) => ({ ...b, idx: i }));
    withIdx.sort((a, b) => a.startMin - b.startMin);
    const clusters: { indices: number[]; startMin: number; endMin: number }[] = [];
    for (const b of withIdx) {
      const last = clusters[clusters.length - 1];
      if (!last) {
        clusters.push({ indices: [b.idx], startMin: b.startMin, endMin: b.endMin });
      } else if (b.startMin < last.endMin) {
        last.indices.push(b.idx);
        if (b.endMin > last.endMin) last.endMin = b.endMin;
      } else {
        clusters.push({ indices: [b.idx], startMin: b.startMin, endMin: b.endMin });
      }
    }
    const laneAssign: Array<{ laneIndex: number | null; hidden: boolean; laneCount: number }> = Array(baseBlocks.length).fill(null).map(() => ({ laneIndex: 0, hidden: false, laneCount: 1 }));
    const badges: { top: number; count: number; key: string; startMin: number; endMin: number }[] = [];
    const hiddenMap: Record<string, { label: string; start: string; end: string }[]> = {};
    for (const c of clusters) {
      const items = c.indices.map((i) => ({ start: baseBlocks[i].startMin, end: baseBlocks[i].endMin }));
      const assigns = assignLanes(items, laneCap);
      const hiddenCount = assigns.filter((a) => a.hidden).length;
      const usedLaneCount = Math.max(1, Math.min(laneCap, assigns.reduce((m, a) => (a.hidden || a.laneIndex == null ? m : Math.max(m, (a.laneIndex as number) + 1)), 0)));
      c.indices.forEach((i, k) => {
        const a = assigns[k];
        laneAssign[i] = { laneIndex: a.hidden ? null : (a.laneIndex as number), hidden: a.hidden, laneCount: usedLaneCount };
      });
      if (hiddenCount > 0) {
        const topPx = Math.min(...c.indices.map((i) => baseBlocks[i].top));
        const key = `${c.startMin}-${c.endMin}`;
        badges.push({ top: topPx + 4, count: hiddenCount, key, startMin: c.startMin, endMin: c.endMin });
        hiddenMap[key] = c.indices
          .map((i, k) => ({ b: baseBlocks[i], a: assigns[k] }))
          .filter((x) => x.a.hidden)
          .map((x) => ({ label: x.b.label, start: x.b.start, end: x.b.end }));
      }
    }
    return { laneAssign, badges, hiddenMap } as const;
  }, [baseBlocks, laneCap]);

  // Apply memoized lane data onto current visual blocks
  const blocksWithLanes = useMemo(() => {
    return blocks.map((b, i) => {
      const a = laneMemo.laneAssign[i] || { laneIndex: 0, hidden: false, laneCount: 1 };
      return { ...b, laneIndex: a.laneIndex, hidden: a.hidden, laneCount: a.laneCount };
    });
  }, [blocks, laneMemo.laneAssign]);
  const moreBadges = laneMemo.badges;
  const hiddenByCluster = laneMemo.hiddenMap;

  // Close +X popover on outside click or Escape
  useEffect(() => {
    if (!openMoreKey) return;
    const onDocDown = (e: MouseEvent) => {
      const root = containerRefForOutside.current;
      if (!root) return;
      const t = e.target as Node | null;
      if (t && root.contains(t)) return;
      setOpenMoreKey(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMoreKey(null);
    };
    document.addEventListener('mousedown', onDocDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [openMoreKey]);

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

  // 7.1 Detect gaps between blocks within awake window (>= 5 minutes)
  const awakeStart = useMemo(() => toMinutes(wake as TimeString), [wake]);
  const awakeEnd = useMemo(() => toMinutes(sleep as TimeString), [sleep]);
  const gaps = useMemo(() => {
    const intervals = scheduleRes.schedule.map((b) => ({ start: toMinutes(b.startTime as TimeString), end: toMinutes(b.endTime as TimeString) }));
    return detectGaps(intervals, awakeStart, awakeEnd, 5);
  }, [scheduleRes.schedule, awakeStart, awakeEnd]);

  // Gap pills (UI affordance for creating a task in gaps)
  const isDesktop = laneCap >= 3;
  const gapPills = useMemo(() => {
    const min = isDesktop ? 5 : 10; // polish guideline
    const filtered = gaps.filter((g) => g.duration >= min);
    // Cap to first 3 to avoid clutter
    return filtered.slice(0, 3).map((g, idx) => {
      const y = minutesToY(g.start) + 4;
      const label = `Use gap ${fromMinutes(g.start)}–${fromMinutes(g.end)}`;
      return { top: y, key: `${g.start}-${g.end}-${idx}`, aria: label, startMin: g.start };
    });
  }, [gaps, isDesktop]);

  return (
    <div
      className="relative border rounded-lg overflow-y-auto h-[80svh] overscroll-contain touch-pan-y"
      ref={(el) => { containerRef.current = el; containerRefForOutside.current = el; }}
      data-testid="timeline"
    >
      <div className="relative select-none group" style={{ height: `${ROW_HEIGHT * 24}px` }} onClick={handleGridClick}>
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
            <div className="absolute -translate-y-1/2 left-2 text-[11px] text-black/60 dark:text-white/60 select-none z-10">
              {String(h).padStart(2, '0')}:00
            </div>
          </div>
        ))}

        {/* Anchor buffers (visual only) */}
        {bufferOverlays.map((o) => (
          <div
            key={`buf-${o.key}`}
            className={
              o.kind === 'before'
                ? 'absolute left-0 right-0 pointer-events-none bg-gradient-to-b from-slate-400/20 dark:from-slate-500/15 to-transparent'
                : 'absolute left-0 right-0 pointer-events-none bg-gradient-to-b from-transparent to-slate-400/20 dark:to-slate-500/15'
            }
            data-testid="timeline-buffer"
            data-buffer-kind={o.kind}
            data-buffer-id={o.id}
            style={{ top: o.top, height: o.height }}
            aria-hidden
          />
        ))}

        {/* Now line (only on today) */}
        {currentDate === todayISO() ? (
          <div
            className="absolute left-0 right-0 top-0 h-[2px] bg-rose-500 pointer-events-none transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 group-hover:shadow-md group-focus-within:shadow-md z-0"
            style={{ transform: `translateY(${minutesToY(nowMins)}px)` }}
            aria-label="Now line"
          />
        ) : null}

        {/* Scheduled blocks */}
        {blocksWithLanes.map((b) => {
          if (b.hidden) return null;
          return (
            <TimelineBlock
              key={b.id + b.start}
              block={b}
              prefersReducedMotion={prefersReducedMotion}
              nowTime={nowTime as TimeString}
            />
          );
        })}

        {/* +X more badges for hidden overlaps */}
        {moreBadges.map((m) => {
          const rangeLabel = `${fromMinutes(m.startMin)}–${fromMinutes(m.endMin)}`;
          const popId = `more-pop-${m.key}`;
          const isOpen = openMoreKey === m.key;
          return (
            <React.Fragment key={`more-${m.key}`}>
              <button
                type="button"
                className="absolute right-2 inline-flex items-center rounded-full bg-slate-900/85 text-white text-[11px] px-2 py-0.5 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{ top: m.top }}
                aria-label={`+${m.count} more between ${rangeLabel}`}
                title={`+${m.count} more between ${rangeLabel}`}
                aria-expanded={isOpen || undefined}
                aria-controls={isOpen ? popId : undefined}
                onClick={(e) => { e.stopPropagation(); setOpenMoreKey(isOpen ? null : m.key); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpenMoreKey(isOpen ? null : m.key);
                  }
                }}
                data-testid="more-badge"
              >
                +{m.count} more
              </button>
              {isOpen ? (
                <div
                  id={popId}
                  role="dialog"
                  aria-label="Hidden overlapping tasks"
                  className="absolute right-2 z-10 mt-1 w-64 rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg p-2 text-[12px]"
                  style={{ top: m.top + 16 }}
                >
                  <div className="font-medium mb-1">Hidden in {rangeLabel}</div>
                  <ul className="space-y-1">
                    {(hiddenByCluster[m.key] || []).map((h, idx) => (
                      <li key={`${m.key}-${idx}`} className="flex justify-between gap-2">
                        <span className="truncate" title={h.label}>{h.label}</span>
                        <span className="opacity-80">{h.start}–{h.end}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-black dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      onClick={() => setOpenMoreKey(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </React.Fragment>
          );
        })}

        {/* Gap pills (Use gap) */}
        {gapPills.map((p) => (
          <button
            key={`gap-${p.key}`}
            type="button"
            className="absolute left-[88px] inline-flex items-center rounded-full bg-indigo-600 text-white text-[11px] px-2 py-0.5 shadow hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ top: p.top }}
            aria-label={p.aria}
            data-testid="gap-pill"
            onClick={() => {
              const mins = p.startMin;
              const hh = Math.floor(mins / 60);
              const mm = mins % 60;
              const startStr = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}` as TimeString;
              let win: 'morning' | 'afternoon' | 'evening' | 'anytime' = 'anytime';
              if (mins >= 6 * 60 && mins < 12 * 60) win = 'morning';
              else if (mins >= 12 * 60 && mins < 18 * 60) win = 'afternoon';
              else if (mins >= 18 * 60 && mins < 23 * 60) win = 'evening';
              setNewTaskPrefill({ time: startStr, window: win });
            }}
          >
            Use gap
          </button>
        ))}
      </div>
    </div>
  );
}

// Small subcomponent per block to attach per-element drag controls with a start threshold
type OverdueKind = 'mandatory' | 'skippable' | 'no';
interface TimelineBlockData {
  top: number;
  height: number;
  bg: string;
  border: string;
  extra?: string;
  label: string;
  id: string;
  start: TimeString | string;
  end: TimeString | string;
  startMin: number;
  endMin: number;
  draggable: boolean;
  dur: number;
  laneIndex: number | null;
  laneCount: number;
  hidden: boolean;
  isFixed: boolean;
  bufferMinutes?: number;
  instModifiedStart?: string;
  isMandatory: boolean;
  done: boolean;
  transformY?: number;
  overdueKind: OverdueKind;
}

function TimelineBlock({ block: b, prefersReducedMotion, nowTime }: {
  block: TimelineBlockData; // avoid leaking broader internals
  prefersReducedMotion: boolean;
  nowTime: TimeString;
}) {
  // Geometry helpers (keep in sync with parent)
  const LEFT_PX = 80; // matches left gutter used for hour labels
  const RIGHT_PX = 12; // approx right padding (right-3)
  const GAP_PX = 8; // horizontal gutter between lanes
  const laneCount = b.laneCount || 1;
  const laneIndex = b.laneIndex ?? 0;
  const laneW = `calc((100% - ${LEFT_PX}px - ${RIGHT_PX}px - ${GAP_PX}px * (${laneCount - 1})) / ${laneCount})`;
  const leftCalc = `calc(${LEFT_PX}px + ((${laneW} + ${GAP_PX}px) * ${laneIndex}))`;

  const isOverdue = b.overdueKind !== 'no';
  const semantics = b.isMandatory ? 'mandatory' : (b.isFixed ? 'fixed' : 'flexible');

  // Drag controls with a start threshold/long-press
  const dragControls = useDragControls();
  const rootRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    active: boolean;
    started: boolean;
    startX: number;
    startY: number;
    pointerId: number | null;
    pointerType: string | null;
    timer: number | null;
  }>({ active: false, started: false, startX: 0, startY: 0, pointerId: null, pointerType: null, timer: null });

  const DRAG_START_Y = 8; // px movement required to start drag ("give")
  const TOUCH_LONG_PRESS_MS = 180; // slight hold on touch before drag

  const clearWatchers = () => {
    const s = stateRef.current;
    if (s.timer != null) {
      window.clearTimeout(s.timer);
      s.timer = null;
    }
    window.removeEventListener('pointermove', onDocPointerMove, true);
    window.removeEventListener('pointerup', onDocPointerUp, true);
    window.removeEventListener('pointercancel', onDocPointerUp, true);
    s.active = false;
    s.started = false;
    s.pointerId = null;
    s.pointerType = null;
  };

  const startDragNow = (ev: PointerEvent) => {
    const s = stateRef.current;
    if (s.started) return;
    s.started = true;
    try {
      // Start controlled drag using the current pointer event
      dragControls.start(ev);
    } catch {}
    // Once drag starts, we can drop our listeners and let Framer Motion handle it
    clearWatchers();
  };

  const onDocPointerMove = (ev: PointerEvent) => {
    const s = stateRef.current;
    if (!s.active || s.started) return;
    // Only consider vertical movement to initiate a drag
    const dy = Math.abs(ev.clientY - s.startY);
    if (dy >= DRAG_START_Y) {
      startDragNow(ev);
    }
  };

  const onDocPointerUp = () => {
    clearWatchers();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!b.draggable) return;
    // Do not prevent default here to preserve scrolling; we only start drag after threshold
    const s = stateRef.current;
    s.active = true;
    s.started = false;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.pointerId = e.pointerId;
    s.pointerType = e.pointerType;
    // Attach temporary listeners while waiting for threshold
    window.addEventListener('pointermove', onDocPointerMove, true);
    window.addEventListener('pointerup', onDocPointerUp, true);
    window.addEventListener('pointercancel', onDocPointerUp, true);
    // On touch, also allow a short long-press to start drag without movement
    if (e.pointerType === 'touch') {
      s.timer = window.setTimeout(() => {
        // If still active and not started by movement, begin drag
        if (stateRef.current.active && !stateRef.current.started) {
          // Synthesize with last known pointer position: use original coords
          const synthetic = new PointerEvent('pointermove', {
            clientX: stateRef.current.startX,
            clientY: stateRef.current.startY,
            pointerId: stateRef.current.pointerId ?? undefined,
            pointerType: 'touch',
            bubbles: true,
            cancelable: true,
          });
          startDragNow(synthetic);
        }
      }, TOUCH_LONG_PRESS_MS) as unknown as number;
    }
  };

  const dragProps = b.draggable ? {
    drag: 'y' as const,
    dragControls,
    dragListener: false,
    dragMomentum: false,
    onPointerDown,
    onDragEnd: async (_: unknown, info: PanInfo) => {
      // Compute new start by applying the drag offset to the block's top
      const newTopPx = b.top + info.offset.y;
      const maxTopPx = minutesToY(TOTAL_MINUTES - b.dur);
      const boundedTop = Math.max(0, Math.min(newTopPx, maxTopPx));
      const newStartMinsRaw = (boundedTop / ROW_HEIGHT) * 60;
      const snapped = Math.round(newStartMinsRaw / 5) * 5; // snap to 5 minutes
      const hrs = Math.floor(snapped / 60);
      const mins = snapped % 60;
      const startStr = `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
      const ok = await useAppStore.getState().setInstanceStartTime(useAppStore.getState().ui.currentDate, b.id, startStr);
      toastResult('update', ok);
    },
  } : {};

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      if (s.timer != null) {
        window.clearTimeout(s.timer);
        s.timer = null;
      }
      window.removeEventListener('pointermove', onDocPointerMove, true);
      window.removeEventListener('pointerup', onDocPointerUp, true);
      window.removeEventListener('pointercancel', onDocPointerUp, true);
      s.active = false;
      s.started = false;
      s.pointerId = null;
      s.pointerType = null;
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <motion.div
      ref={rootRef}
      className={`group absolute ${b.bg} ${b.border} border rounded-md text-[12px] text-white shadow-sm p-2 ${b.draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${b.extra || ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
      tabIndex={isOverdue ? 0 : undefined}
      style={{ top: b.top, height: b.height, left: leftCalc, width: laneW, transform: `translateY(${b.transformY || 0}px)` }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: 'tween', duration: 0.2, ease: 'easeOut' }}
      data-overdue={b.overdueKind}
      data-testid="timeline-block"
      title={`${b.label} — ${b.start}–${b.end} (${semantics})`}
      aria-label={`Task ${b.label}, ${b.start} to ${b.end}, ${semantics}${isOverdue ? ', overdue' : ''}`}
      {...dragProps}
    >
      <div className="flex items-center gap-1">
        <span
          className="inline-flex items-center rounded-sm bg-white/85 text-black text-[10px] px-1 py-0.5"
          aria-hidden
          title={b.isMandatory ? 'Mandatory task' : (b.isFixed ? 'Fixed time task' : 'Flexible task')}
        >
          {b.isMandatory ? 'M' : (b.isFixed ? 'Fixed' : 'Flex')}
        </span>
        <div className="font-medium truncate">{b.label}</div>
      </div>
      <div className="opacity-90">{b.start}–{b.end}{b.draggable ? ' • drag to move' : ''}</div>
      {isOverdue ? (
        <div
          className="hidden md:block absolute right-1 top-1 text-[10px] px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white opacity-0 group-hover:opacity-90 group-focus-visible:opacity-90 pointer-events-none transition-opacity duration-150"
          title={b.overdueKind === 'mandatory' ? 'Overdue — visually re-seated to now' : 'Overdue'}
          aria-hidden
        >
          Overdue
        </div>
      ) : null}

      {b.overdueKind === 'mandatory' ? (
        <div
          className={`absolute right-1 bottom-1 inline-flex gap-1 ${
            prefersReducedMotion ? '' : 'transition-opacity duration-150'
          } opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 pointer-events-none group-hover:pointer-events-auto group-focus-visible:pointer-events-auto`}
          role="group"
          aria-label="Overdue actions"
        >
          <button
            type="button"
            className="px-1.5 py-0.5 rounded-md bg-white/90 text-black text-[11px] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await useAppStore.getState().setInstanceStartTime(useAppStore.getState().ui.currentDate, b.id, nowTime as TimeString);
              toastResult('update', ok);
            }}
            aria-label="Start now"
            title="Start now"
          >
            Start now
          </button>
          <button
            type="button"
            className="px-1.5 py-0.5 rounded-md bg-white/90 text-black text-[11px] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await useAppStore.getState().toggleComplete(useAppStore.getState().ui.currentDate, b.id);
              toastResult('complete', ok);
            }}
            aria-label="Mark done"
            title="Mark done"
          >
            Mark done
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}
