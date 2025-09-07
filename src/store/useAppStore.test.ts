import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';
import type { AuthUser } from "@/lib/firebase/client";

function resetStore() {
  const s = useAppStore.getState();
  s.resetAfterSignOut();
}

describe('useAppStore - core actions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('sets user and resets state on sign-out', () => {
    const s = useAppStore.getState();
    s.setUser({ uid: 'u1' } as unknown as AuthUser);
    expect(useAppStore.getState().user && (useAppStore.getState().user as AuthUser).uid).toBe('u1');

    s.resetAfterSignOut();
    const after = useAppStore.getState();
    expect(after.user).toBeNull();
    expect(after.templates).toEqual([]);
    expect(after.instancesByDate).toEqual({});
    expect(after.settings).toBeTruthy();
    expect(after.settings?.defaultWakeTime).toBe('06:30');
    expect(after.settings?.defaultSleepTime).toBe('23:00');
  });

  it('updates settings and affects generated schedule output', () => {
    const s = useAppStore.getState();
    const date = '2024-05-01';
    s.setCurrentDate(date);
    s.setSettings({ desiredSleepDuration: 8, defaultWakeTime: '07:00', defaultSleepTime: '22:30' });

    const res = useAppStore.getState().generateScheduleForDate(date);
    expect(res.success).toBe(true);
    expect(res.sleepSchedule.duration).toBe(8);
    expect(res.sleepSchedule.wakeTime).toBe('07:00');
    expect(res.sleepSchedule.sleepTime).toBe('22:30');
  });

  it('toggleComplete creates and undoes a completed instance locally', async () => {
    const date = '2024-05-02';
    useAppStore.getState().setCurrentDate(date);
    const templateId = 'task-1';

    // Initially no instances
    expect(useAppStore.getState().getTaskInstancesForDate(date)).toEqual([]);

    // Complete -> creates instance
    const ok1 = await useAppStore.getState().toggleComplete(date, templateId);
    expect(ok1).toBe(true);
    const afterComplete = useAppStore.getState().getTaskInstancesForDate(date);
    expect(afterComplete.length).toBe(1);
    expect(afterComplete[0].status).toBe('completed');
    expect(afterComplete[0].id).toBe(`inst-${date}-${templateId}`);

    // Undo -> removes instance
    const ok2 = await useAppStore.getState().toggleComplete(date, templateId);
    expect(ok2).toBe(true);
    const afterUndo = useAppStore.getState().getTaskInstancesForDate(date);
    expect(afterUndo.length).toBe(0);
  });
});
