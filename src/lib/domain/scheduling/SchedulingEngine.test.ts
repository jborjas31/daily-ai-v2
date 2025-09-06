import { describe, it, expect } from 'vitest';
import { generateSchedule } from './SchedulingEngine';
import type { TaskTemplate, Settings, TaskInstance } from '@/lib/types';

function baseSettings(overrides?: Partial<Settings>): Settings {
  return {
    desiredSleepDuration: 7.5,
    defaultWakeTime: '06:00',
    defaultSleepTime: '23:00',
    ...overrides,
  };
}

describe('SchedulingEngine (pure)', () => {
  it('Dependency Chain: Laundry -> Iron -> Pack across windows', () => {
    const settings = baseSettings();
    const date = '2025-02-01';
    const templates: TaskTemplate[] = [
      { id: 'laundry', taskName: 'Do Laundry', isMandatory: false, isActive: true, priority: 3, schedulingType: 'flexible', timeWindow: 'morning', durationMinutes: 60 },
      { id: 'iron', taskName: 'Iron Clothes', isMandatory: false, isActive: true, priority: 3, schedulingType: 'flexible', timeWindow: 'afternoon', durationMinutes: 60, dependsOn: 'laundry' },
      { id: 'pack', taskName: 'Pack for Trip', isMandatory: false, isActive: true, priority: 3, schedulingType: 'flexible', timeWindow: 'evening', durationMinutes: 60, dependsOn: 'iron' },
    ];
    const instances: TaskInstance[] = [];
    const res = generateSchedule({ settings, templates, instances, date });
    expect(res.success).toBe(true);
    const byId = Object.fromEntries(res.schedule.map(b => [b.templateId, b]));
    expect(byId['laundry']).toBeTruthy();
    expect(byId['iron']).toBeTruthy();
    expect(byId['pack']).toBeTruthy();
    // Check windows
    const toMin = (s: string) => parseInt(s.slice(0,2))*60 + parseInt(s.slice(3,5));
    expect(toMin(byId['laundry'].startTime)).toBeGreaterThanOrEqual(6*60);
    expect(toMin(byId['laundry'].endTime)).toBeLessThanOrEqual(12*60);
    expect(toMin(byId['iron'].startTime)).toBeGreaterThanOrEqual(12*60);
    expect(toMin(byId['iron'].endTime)).toBeLessThanOrEqual(18*60);
    expect(toMin(byId['pack'].startTime)).toBeGreaterThanOrEqual(18*60);
    expect(toMin(byId['pack'].endTime)).toBeLessThanOrEqual(23*60);
    // Order respects dependencies
    expect(toMin(byId['laundry'].endTime)).toBeLessThanOrEqual(toMin(byId['iron'].startTime));
    expect(toMin(byId['iron'].endTime)).toBeLessThanOrEqual(toMin(byId['pack'].startTime));
  });

  it('Crunch Time: choose min duration before upcoming anchor', () => {
    const settings = baseSettings();
    const date = '2025-02-01';
    const templates: TaskTemplate[] = [
      { id: 'meeting', taskName: 'Client Meeting', isMandatory: true, isActive: true, priority: 5, schedulingType: 'fixed', defaultTime: '10:00', durationMinutes: 60 },
      { id: 'shower', taskName: 'Shower', isMandatory: false, isActive: true, priority: 3, schedulingType: 'flexible', timeWindow: 'morning', durationMinutes: 15, minDurationMinutes: 5 },
    ];
    const instances: TaskInstance[] = [];
    const res = generateSchedule({ settings, templates, instances, date, currentTime: '09:50' });
    expect(res.success).toBe(true);
    const shower = res.schedule.find(b => b.templateId === 'shower');
    expect(shower).toBeTruthy();
    expect(shower!.startTime).toBe('09:50');
    expect(shower!.endTime).toBe('09:55');
    expect(res.advisories?.some(a => a.startsWith('crunch_time_min_duration_used:shower'))).toBe(true);
  });

  it('Impossible Day: mandatory > awake window', () => {
    const settings = baseSettings({ defaultWakeTime: '08:00', defaultSleepTime: '16:00', desiredSleepDuration: 8 });
    const date = '2025-02-01';
    const templates: TaskTemplate[] = [
      { id: 'a1', taskName: 'Block1', isMandatory: true, isActive: true, priority: 5, schedulingType: 'fixed', defaultTime: '08:00', durationMinutes: 180 },
      { id: 'a2', taskName: 'Block2', isMandatory: true, isActive: true, priority: 5, schedulingType: 'fixed', defaultTime: '11:00', durationMinutes: 240 },
      { id: 'a3', taskName: 'Block3', isMandatory: true, isActive: true, priority: 5, schedulingType: 'fixed', defaultTime: '15:00', durationMinutes: 180 },
    ];
    const res = generateSchedule({ settings, templates, instances: [], date });
    expect(res.success).toBe(false);
    expect(res.error).toBe('impossible_schedule');
  });

  it('Flexible Reschedule: move flexible after new anchor conflict', () => {
    const settings = baseSettings();
    const date = '2025-02-01';
    const baseTemplates: TaskTemplate[] = [
      { id: 'mid', taskName: 'Midday Block', isMandatory: true, isActive: true, priority: 5, schedulingType: 'fixed', defaultTime: '12:00', durationMinutes: 120 },
      { id: 'gro', taskName: 'Groceries', isMandatory: false, isActive: true, priority: 3, schedulingType: 'flexible', timeWindow: 'afternoon', durationMinutes: 60 },
    ];
    const initial = generateSchedule({ settings, templates: baseTemplates, instances: [], date });
    const groceries1 = initial.schedule.find(b => b.templateId === 'gro');
    expect(groceries1).toBeTruthy();
    // With 12:00-14:00 busy, earliest for 60m in afternoon is 14:00
    expect(groceries1!.startTime).toBe('14:00');

    const withDoctor = [...baseTemplates, { id: 'doc', taskName: 'Doctor', isMandatory: true, isActive: true, priority: 5, schedulingType: 'fixed', defaultTime: '14:30', durationMinutes: 60 } as TaskTemplate];
    const updated = generateSchedule({ settings, templates: withDoctor, instances: [], date });
    const groceries2 = updated.schedule.find(b => b.templateId === 'gro');
    expect(groceries2).toBeTruthy();
    // Now 14:30-15:30 is busy, next available is 15:30
    const toMin = (s: string) => parseInt(s.slice(0,2))*60 + parseInt(s.slice(3,5));
    expect(toMin(groceries2!.startTime)).toBeGreaterThanOrEqual(15*60 + 30);
  });
});
