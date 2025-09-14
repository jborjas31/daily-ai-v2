import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from './useAppStore';
import type { TaskTemplate, TaskInstance } from '@/lib/types';

// Mock schedule generation to control block start times for tie-breakers
vi.mock('@/lib/domain/scheduling/SchedulingEngine', () => {
  return {
    __esModule: true,
    generateSchedule: vi.fn((input: any) => {
      const templates = input.templates as TaskTemplate[];
      // Place anchors (fixed) at their defaultTime; flex per provided hints on ids
      const schedule: { templateId: string; startTime: string; endTime: string }[] = [];
      for (const t of templates) {
        if (t.schedulingType === 'fixed' && t.defaultTime) {
          const start = t.defaultTime as string;
          const end = addMinutes(start, t.durationMinutes || 0);
          schedule.push({ templateId: t.id, startTime: start, endTime: end });
        }
      }
      // For flexible, set start by id hints to create deterministic order in tests
      for (const t of templates) {
        if (t.schedulingType !== 'fixed') {
          const hint = t.id.includes('early') ? '09:45' : t.id.includes('late') ? '11:00' : '10:30';
          const start = hint;
          const end = addMinutes(start, t.durationMinutes || 0);
          schedule.push({ templateId: t.id, startTime: start, endTime: end });
        }
      }
      return {
        success: true,
        schedule,
        sleepSchedule: { wakeTime: input.settings.defaultWakeTime, sleepTime: input.settings.defaultSleepTime, duration: input.settings.desiredSleepDuration },
        totalTasks: templates.length,
        scheduledTasks: schedule.length,
      };
    }),
  };
});

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  const tot = h * 60 + m + minutes;
  const hh = String(Math.floor(tot / 60)).padStart(2, '0');
  const mm = String(tot % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function resetStore() {
  useAppStore.getState().resetAfterSignOut();
}

function setTemplates(templates: TaskTemplate[]) {
  const s = useAppStore.getState();
  s.setTaskTemplates(templates);
}

describe('computeUpNext tie-breakers & exclusions', () => {
  const date = '2025-02-01';
  beforeEach(() => {
    resetStore();
    useAppStore.getState().setCurrentDate(date);
  });

  it('prefers higher priority', () => {
    const templates: TaskTemplate[] = [
      { id: 'flex-low', taskName: 'Low', isMandatory: false, isActive: true, priority: 1, schedulingType: 'flexible', timeWindow: 'morning', durationMinutes: 30 } as TaskTemplate,
      { id: 'flex-high', taskName: 'High', isMandatory: false, isActive: true, priority: 5, schedulingType: 'flexible', timeWindow: 'morning', durationMinutes: 30 } as TaskTemplate,
    ];
    setTemplates(templates);
    const up = useAppStore.getState().computeUpNext(date, '09:00');
    expect(up.kind).toBe('flexible');
    // @ts-expect-error narrow
    expect((up as any).template.id).toBe('flex-high');
  });

  it('prefers shorter duration when time is tight', () => {
    const templates: TaskTemplate[] = [
      { id: 'flex-short', taskName: 'Short', isMandatory: false, isActive: true, priority: 3, schedulingType: 'flexible', timeWindow: 'morning', durationMinutes: 10 } as TaskTemplate,
      { id: 'flex-long', taskName: 'Long', isMandatory: false, isActive: true, priority: 3, schedulingType: 'flexible', timeWindow: 'morning', durationMinutes: 25 } as TaskTemplate,
    ];
    setTemplates(templates);
    // 11:50 -> 10 minutes remaining in morning; short fits, long doesn't
    const up = useAppStore.getState().computeUpNext(date, '11:50');
    expect(up.kind).toBe('flexible');
    // @ts-expect-error narrow
    expect((up as any).template.id).toBe('flex-short');
  });

  it('excludes skipped/postponed instances for today', () => {
    const templates: TaskTemplate[] = [
      { id: 'flex-s', taskName: 'S', isMandatory: false, isActive: true, priority: 4, schedulingType: 'flexible', timeWindow: 'morning', durationMinutes: 15 } as TaskTemplate,
      { id: 'flex-t', taskName: 'T', isMandatory: false, isActive: true, priority: 3, schedulingType: 'flexible', timeWindow: 'morning', durationMinutes: 15 } as TaskTemplate,
    ];
    setTemplates(templates);
    // Mark high-priority as skipped -> should pick the other
    const inst: TaskInstance = { id: `inst-${date}-flex-s`, templateId: 'flex-s', date, status: 'skipped' };
    useAppStore.getState().setTaskInstancesForDate(date, [inst]);
    const up = useAppStore.getState().computeUpNext(date, '09:30');
    expect(up.kind).toBe('flexible');
    // @ts-expect-error narrow
    expect((up as any).template.id).toBe('flex-t');
  });

  it('for equal priority/duration, picks earliest upcoming start within window', () => {
    const templates: TaskTemplate[] = [
      { id: 'flex-early', taskName: 'Early', isMandatory: false, isActive: true, priority: 3, schedulingType: 'flexible', timeWindow: 'morning', durationMinutes: 15 } as TaskTemplate,
      { id: 'flex-late', taskName: 'Late', isMandatory: false, isActive: true, priority: 3, schedulingType: 'flexible', timeWindow: 'morning', durationMinutes: 15 } as TaskTemplate,
    ];
    setTemplates(templates);
    const up = useAppStore.getState().computeUpNext(date, '09:30');
    expect(up.kind).toBe('flexible');
    // 'flex-early' is scheduled at 09:45 by mock; 'flex-late' at 11:00
    // @ts-expect-error narrow
    expect((up as any).template.id).toBe('flex-early');
  });
});

