import { describe, it, expect } from 'vitest';
import { generateSchedule } from './SchedulingEngine';
import type { TaskTemplate, Settings } from '@/lib/types';

function baseSettings(overrides?: Partial<Settings>): Settings {
  return {
    desiredSleepDuration: 8,
    defaultWakeTime: '06:00',
    defaultSleepTime: '23:00',
    ...overrides,
  };
}

describe('Split Recurrence - date fences honored', () => {
  it('old ends the day before target; new starts at target; scheduling respects fences', () => {
    const settings = baseSettings();
    const target = '2025-06-10';
    const dayBefore = '2025-06-09';
    const dayAfter = '2025-06-11';

    const oldTpl: TaskTemplate = {
      id: 't-old',
      taskName: 'Daily Workout',
      isMandatory: false,
      isActive: true,
      priority: 3,
      schedulingType: 'flexible',
      timeWindow: 'anytime',
      durationMinutes: 30,
      recurrenceRule: { frequency: 'daily', endDate: dayBefore },
    } as TaskTemplate;

    const newTpl: TaskTemplate = {
      id: 't-new',
      taskName: 'Daily Workout (Updated)',
      isMandatory: false,
      isActive: true,
      priority: 3,
      schedulingType: 'flexible',
      timeWindow: 'anytime',
      durationMinutes: 30,
      recurrenceRule: { frequency: 'daily', startDate: target },
    } as TaskTemplate;

    // Sanity: date fence ordering
    expect(new Date(dayBefore) < new Date(target)).toBe(true);

    // Before target -> old only
    const beforeRes = generateSchedule({ settings, templates: [oldTpl, newTpl], instances: [], date: dayBefore });
    expect(beforeRes.success).toBe(true);
    const beforeIds = beforeRes.schedule.map(b => b.templateId);
    expect(beforeIds).toContain('t-old');
    expect(beforeIds).not.toContain('t-new');

    // On target -> new only
    const targetRes = generateSchedule({ settings, templates: [oldTpl, newTpl], instances: [], date: target });
    expect(targetRes.success).toBe(true);
    const targetIds = targetRes.schedule.map(b => b.templateId);
    expect(targetIds).not.toContain('t-old');
    expect(targetIds).toContain('t-new');

    // After target -> new only
    const afterRes = generateSchedule({ settings, templates: [oldTpl, newTpl], instances: [], date: dayAfter });
    expect(afterRes.success).toBe(true);
    const afterIds = afterRes.schedule.map(b => b.templateId);
    expect(afterIds).not.toContain('t-old');
    expect(afterIds).toContain('t-new');
  });
});

