import { shouldGenerateForDate, type RecurrenceRule } from "./Recurrence";
import { toMinutes, fromMinutes } from "@/lib/time";
import type { Settings, TaskTemplate, TaskInstance, ScheduleBlock, ScheduleResult, TimeString } from "@/lib/types";

type EffectiveSleep = { wakeTime: TimeString; sleepTime: TimeString; duration: number };

export type SchedulingInput = {
  settings: Settings;
  templates: TaskTemplate[];
  instances: TaskInstance[];
  date: string; // YYYY-MM-DD
  dailyOverride?: { wakeTime?: TimeString; sleepTime?: TimeString } | null;
  currentTime?: TimeString; // optional HH:MM for crunch-time logic
};

type BusyInterval = { start: number; end: number; isAnchor?: boolean };

function getEffectiveSleep(settings: Settings, dailyOverride?: SchedulingInput["dailyOverride"]): EffectiveSleep {
  return {
    wakeTime: dailyOverride?.wakeTime ?? settings.defaultWakeTime,
    sleepTime: dailyOverride?.sleepTime ?? settings.defaultSleepTime,
    duration: settings.desiredSleepDuration,
  };
}

function awakeMinutesBetween(wake: TimeString, sleep: TimeString): number {
  const a = toMinutes(wake);
  const b = toMinutes(sleep);
  return Math.max(0, b - a);
}

function templateOccursOnDate(t: TaskTemplate, date: string): boolean {
  const rule = (t.recurrenceRule ?? { frequency: 'none' }) as RecurrenceRule;
  return shouldGenerateForDate(rule, date);
}

function excludeCompletedOrSkipped(instances: TaskInstance[]): Set<string> {
  const s = new Set<string>();
  for (const i of instances) {
    if (i.status === 'completed' || i.status === 'skipped') s.add(i.templateId);
  }
  return s;
}

function topologicalOrder(templates: TaskTemplate[]): TaskTemplate[] {
  const map = new Map<string, TaskTemplate>();
  const indeg = new Map<string, number>();
  for (const t of templates) {
    map.set(t.id, t);
    indeg.set(t.id, 0);
  }
  for (const t of templates) {
    if (t.dependsOn && map.has(t.dependsOn)) {
      indeg.set(t.id, (indeg.get(t.id) || 0) + 1);
    }
  }
  const q: TaskTemplate[] = [];
  for (const t of templates) if ((indeg.get(t.id) || 0) === 0) q.push(t);
  const out: TaskTemplate[] = [];
  while (q.length) {
    const n = q.shift()!;
    out.push(n);
    for (const t of templates) {
      if (t.dependsOn === n.id) {
        indeg.set(t.id, (indeg.get(t.id) || 0) - 1);
        if ((indeg.get(t.id) || 0) === 0) q.push(t);
      }
    }
  }
  // Fallback: if cycle, return original order
  return out.length === templates.length ? out : templates;
}

function pushBusy(busy: BusyInterval[], start: number, end: number, isAnchor?: boolean) {
  busy.push({ start, end, isAnchor });
  busy.sort((a,b)=>a.start-b.start);
}

function nextSlot(
  busy: BusyInterval[],
  windowStart: number,
  windowEnd: number,
  candidateStart: number,
  duration: number,
  allowMin?: { minDuration?: number; anchorOnly?: boolean; advisories?: string[]; templateId?: string }
): { start: number; end: number; usedMin?: boolean } | null {
  let t = Math.max(windowStart, candidateStart);
  // Walk through busy intervals and find a gap
  for (let i = 0; i <= busy.length; i++) {
    const b = busy[i];
    const gapEnd = b ? Math.min(b.start, windowEnd) : windowEnd;
    if (t + duration <= gapEnd) {
      return { start: t, end: t + duration };
    }
    // If not enough space and a min duration is allowed and next is anchor
    if (allowMin?.minDuration && allowMin.minDuration > 0 && t < gapEnd) {
      const gap = gapEnd - t;
      const nextIsAnchor = b?.isAnchor === true;
      if (!allowMin.anchorOnly || nextIsAnchor) {
        if (gap >= allowMin.minDuration) {
          if (allowMin.advisories && allowMin.templateId) {
            allowMin.advisories.push(`crunch_time_min_duration_used:${allowMin.templateId}`);
          }
          return { start: t, end: t + allowMin.minDuration, usedMin: true };
        }
      }
    }
    if (!b) break;
    t = Math.max(t, b.end);
    if (t >= windowEnd) break;
  }
  return null;
}

export function generateSchedule(input: SchedulingInput): ScheduleResult {
  const { settings, templates, instances, date, dailyOverride, currentTime } = input;
  const sleep = getEffectiveSleep(settings, dailyOverride);
  const wakeMin = toMinutes(sleep.wakeTime);
  const sleepMin = toMinutes(sleep.sleepTime);
  const awakeTotal = awakeMinutesBetween(sleep.wakeTime, sleep.sleepTime);

  // Filter templates: active, occurs on date, not completed/skipped
  const excluded = excludeCompletedOrSkipped(instances);
  const active = templates
    .filter(t => (t.isActive !== false))
    .filter(t => !excluded.has(t.id))
    .filter(t => templateOccursOnDate(t, date));

  // Impossibility check: mandatory total duration must fit into awake window
  const mandatoryTotal = active.filter(t => t.isMandatory).reduce((sum, t) => sum + Math.max(0, t.durationMinutes || 0), 0);
  if (mandatoryTotal > awakeTotal) {
    return {
      success: false,
      error: 'impossible_schedule',
      message: 'Mandatory tasks exceed available waking time.',
      schedule: [],
      sleepSchedule: sleep,
      totalTasks: active.length,
      scheduledTasks: 0,
    };
  }

  // Prepare busy intervals (anchors = fixed tasks)
  const busy: BusyInterval[] = [];
  const schedule: ScheduleBlock[] = [];

  // Manual overrides: instances with modifiedStartTime anchor a task at that time
  const overrides = new Map<string, number>(); // templateId -> start minutes
  for (const i of instances) {
    if (i.modifiedStartTime && i.status !== 'completed' && i.status !== 'skipped') {
      overrides.set(i.templateId, toMinutes(i.modifiedStartTime as TimeString));
    }
  }
  const handled = new Set<string>();

  // Apply overrides first as anchors
  for (const t of active) {
    const o = overrides.get(t.id);
    if (o != null) {
      const start = o;
      const end = start + (t.durationMinutes || 0);
      pushBusy(busy, start, end, t.isMandatory === true);
      schedule.push({ templateId: t.id, startTime: fromMinutes(start), endTime: fromMinutes(end) });
      handled.add(t.id);
    }
  }

  const fixed = active.filter(t => t.schedulingType === 'fixed' && t.defaultTime && !handled.has(t.id));
  for (const t of fixed) {
    const start = toMinutes(t.defaultTime as TimeString);
    const end = start + (t.durationMinutes || 0);
    pushBusy(busy, start, end, t.isMandatory === true);
    schedule.push({ templateId: t.id, startTime: fromMinutes(start), endTime: fromMinutes(end) });
  }

  // Flexible tasks ordered topologically then by priority desc
  const flexibleAll = active.filter(t => t.schedulingType !== 'fixed');
  let flexOrdered = topologicalOrder(flexibleAll);
  flexOrdered = flexOrdered.sort((a,b) => (b.priority||0)-(a.priority||0));

  const advisories: string[] = [];

  const windows: Record<string, { start: number; end: number }> = {
    morning: { start: Math.max(wakeMin, toMinutes('06:00' as TimeString)), end: Math.min(sleepMin, toMinutes('12:00' as TimeString)) },
    afternoon: { start: Math.max(wakeMin, toMinutes('12:00' as TimeString)), end: Math.min(sleepMin, toMinutes('18:00' as TimeString)) },
    evening: { start: Math.max(wakeMin, toMinutes('18:00' as TimeString)), end: Math.min(sleepMin, toMinutes('23:00' as TimeString)) },
    anytime: { start: Math.max(wakeMin, toMinutes('06:00' as TimeString)), end: Math.min(sleepMin, toMinutes('23:00' as TimeString)) },
  };

  const depEndTime = new Map<string, number>();
  for (const t of schedule) depEndTime.set(t.templateId, toMinutes(t.endTime));

  for (const t of flexOrdered) {
    const winName = t.timeWindow ?? 'anytime';
    const win = windows[winName] ?? windows.anytime;
    if (win.end <= win.start) continue; // no space in this window

    const depEnd = t.dependsOn ? (depEndTime.get(t.dependsOn) ?? win.start) : win.start;
    // current time handling only if within window
    let base = depEnd;
    if (currentTime) {
      const cur = toMinutes(currentTime);
      if (cur >= win.start && cur < win.end) base = Math.max(base, cur);
    }

    const duration = t.durationMinutes || 0;
    const minDur = t.minDurationMinutes || 0;
    const slot = nextSlot(busy, win.start, win.end, base, duration, { minDuration: minDur, anchorOnly: true, advisories, templateId: t.id });
    if (slot) {
      pushBusy(busy, slot.start, slot.end);
      schedule.push({ templateId: t.id, startTime: fromMinutes(slot.start), endTime: fromMinutes(slot.end) });
      depEndTime.set(t.id, slot.end);
    }
  }

  schedule.sort((a,b)=> toMinutes(a.startTime)-toMinutes(b.startTime));

  return {
    success: true,
    schedule,
    sleepSchedule: sleep,
    totalTasks: active.length,
    scheduledTasks: schedule.length,
    advisories: advisories.length ? advisories : undefined,
  };
}
