import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Firestore instance APIs used by the store
vi.mock('@/lib/data/instances', () => {
  return {
    listInstancesByDate: vi.fn(async () => []),
    upsertInstance: vi.fn(async () => 'mock-id'),
    deleteInstance: vi.fn(async () => {}),
    instanceIdFor: (date: string, templateId: string) => `inst-${date}-${templateId}`,
  };
});

import { useAppStore } from './useAppStore';
import type { AuthUser } from "@/lib/firebase/client";
import * as instApi from '@/lib/data/instances';

function resetStore() {
  const s = useAppStore.getState();
  s.resetAfterSignOut();
}

describe('useAppStore - skip/postpone/undo (optimistic + revert)', () => {
  const date = '2025-06-01';
  const templateId = 'task-xyz';

  beforeEach(() => {
    resetStore();
    // Set a user so persistence path runs
    useAppStore.getState().setUser({ uid: 'u1' } as unknown as AuthUser);
    vi.clearAllMocks();
  });

  it('skipInstance: optimistic create and persists', async () => {
    vi.mocked(instApi.upsertInstance).mockResolvedValue('ok');
    const ok = await useAppStore.getState().skipInstance(date, templateId, 'because busy');
    expect(ok).toBe(true);
    const list = useAppStore.getState().getTaskInstancesForDate(date);
    expect(list.length).toBe(1);
    expect(list[0].templateId).toBe(templateId);
    expect(list[0].status).toBe('skipped');
    expect(instApi.upsertInstance).toHaveBeenCalledTimes(1);
  });

  it('skipInstance: revert on persistence failure', async () => {
    vi.mocked(instApi.upsertInstance).mockRejectedValue(new Error('boom'));
    const ok = await useAppStore.getState().skipInstance(date, templateId, 'err');
    expect(ok).toBe(false);
    const list = useAppStore.getState().getTaskInstancesForDate(date);
    expect(list.length).toBe(0); // reverted to before (empty)
  });

  it('postponeInstance: optimistic create and persists', async () => {
    vi.mocked(instApi.upsertInstance).mockResolvedValue('ok');
    const ok = await useAppStore.getState().postponeInstance(date, templateId, 'tomorrow');
    expect(ok).toBe(true);
    const list = useAppStore.getState().getTaskInstancesForDate(date);
    expect(list.length).toBe(1);
    expect(list[0].templateId).toBe(templateId);
    expect(list[0].status).toBe('postponed');
    expect(instApi.upsertInstance).toHaveBeenCalledTimes(1);
  });

  it('postponeInstance: revert on persistence failure', async () => {
    vi.mocked(instApi.upsertInstance).mockRejectedValue(new Error('boom'));
    const ok = await useAppStore.getState().postponeInstance(date, templateId, 'later');
    expect(ok).toBe(false);
    const list = useAppStore.getState().getTaskInstancesForDate(date);
    expect(list.length).toBe(0);
  });

  it('undoInstanceStatus: removes instance when no overrides', async () => {
    // Seed as skipped
    vi.mocked(instApi.upsertInstance).mockResolvedValue('ok');
    await useAppStore.getState().skipInstance(date, templateId);
    expect(useAppStore.getState().getTaskInstancesForDate(date).length).toBe(1);
    // Undo -> should delete
    vi.mocked(instApi.deleteInstance).mockResolvedValue();
    const ok = await useAppStore.getState().undoInstanceStatus(date, templateId);
    expect(ok).toBe(true);
    expect(useAppStore.getState().getTaskInstancesForDate(date).length).toBe(0);
  });

  it('undoInstanceStatus: revert on delete failure', async () => {
    // Seed as skipped
    vi.mocked(instApi.upsertInstance).mockResolvedValue('ok');
    await useAppStore.getState().skipInstance(date, templateId);
    expect(useAppStore.getState().getTaskInstancesForDate(date).length).toBe(1);
    // Fail delete -> store should revert to previous state
    vi.mocked(instApi.deleteInstance).mockRejectedValue(new Error('nope'));
    const ok = await useAppStore.getState().undoInstanceStatus(date, templateId);
    expect(ok).toBe(false);
    expect(useAppStore.getState().getTaskInstancesForDate(date).length).toBe(1);
  });
});

