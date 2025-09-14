import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

// Auth guard always ready + signed-in
vi.mock('@/components/guards/useRequireAuth', () => ({
  __esModule: true,
  default: () => ({ user: { uid: 'test-user' }, ready: true }),
}));

// Silence data layer used by Today effects
vi.mock('@/lib/data/instances', () => ({
  __esModule: true,
  listInstancesByDate: vi.fn(async () => []),
  upsertInstance: vi.fn(async () => 'id'),
  deleteInstance: vi.fn(async () => {}),
  instanceIdFor: (date: string, templateId: string) => `inst-${date}-${templateId}`,
}));
vi.mock('@/lib/data/schedules', () => ({
  __esModule: true,
  getCachedSchedule: vi.fn(async () => null),
  putCachedSchedule: vi.fn(async () => {}),
}));


function tpl(partial: any) {
  return {
    id: 'id',
    taskName: 'Task',
    description: '',
    isMandatory: false,
    priority: 3,
    isActive: true,
    schedulingType: 'fixed',
    defaultTime: '10:00',
    durationMinutes: 30,
    ...partial,
  } as any;
}

describe('Timeline overdue micro-actions', () => {
  afterEach(() => {
    cleanup();
  });

  it('Start now sets instance start time to now', async () => {
    vi.resetModules();
    // Mock todayISO and ticker to a deterministic local date/time
    vi.doMock('@/lib/time', async () => {
      const actual = await vi.importActual<any>('@/lib/time');
      return { ...actual, todayISO: () => '2025-02-03' };
    });
    vi.doMock('@/lib/utils/useNowTick', () => ({
      __esModule: true,
      default: () => ({ nowISO: '2025-02-03', nowTime: '14:00' }),
    }));
    const { useAppStore: freshStore } = await import('@/store/useAppStore');
    const store = freshStore.getState();
    store.setCurrentDate('2025-02-03');
    store.setTaskTemplates([
      tpl({ id: 'm', taskName: 'Mandatory Meeting', isMandatory: true, schedulingType: 'fixed', defaultTime: '13:00', durationMinutes: 30 }),
    ]);

    const { default: TodayPage } = await import('@/app/today/page');
    render(<TodayPage />);

    const timeline = screen.getAllByTestId('timeline').at(-1)!;
    const block = within(timeline).getByText('Mandatory Meeting').closest('[data-testid="timeline-block"]') as HTMLElement;
    expect(block).toHaveAttribute('data-overdue', 'mandatory');

    // The micro-action buttons are present (opacity transitions only affect visuals)
    const startBtn = within(block).getByRole('button', { name: 'Start now' });
    expect(startBtn).toBeInTheDocument();

    // Start now -> sets instance start time to 14:00 for today
    await startBtn.click();
    const instA = freshStore.getState().getTaskInstancesForDate('2025-02-03').find(i => i.templateId === 'm');
    expect(instA?.modifiedStartTime).toBe('14:00');

  });

  it('Mark done completes the instance without modals', async () => {
    vi.resetModules();
    vi.doMock('@/lib/time', async () => {
      const actual = await vi.importActual<any>('@/lib/time');
      return { ...actual, todayISO: () => '2025-02-03' };
    });
    vi.doMock('@/lib/utils/useNowTick', () => ({
      __esModule: true,
      default: () => ({ nowISO: '2025-02-03', nowTime: '14:00' }),
    }));
    const { useAppStore: freshStore } = await import('@/store/useAppStore');
    const store = freshStore.getState();
    store.setCurrentDate('2025-02-03');
    store.setTaskTemplates([
      tpl({ id: 'm', taskName: 'Mandatory Meeting', isMandatory: true, schedulingType: 'fixed', defaultTime: '13:00', durationMinutes: 30 }),
    ]);
    const { default: TodayPage } = await import('@/app/today/page');
    render(<TodayPage />);
    const timeline = screen.getAllByTestId('timeline').at(-1)!;
    const block = within(timeline).getByText('Mandatory Meeting').closest('[data-testid="timeline-block"]') as HTMLElement;
    const doneBtn = within(block).getByRole('button', { name: 'Mark done' });
    await doneBtn.click();
    await waitFor(() => {
      const inst = freshStore.getState().getTaskInstancesForDate('2025-02-03').find(i => i.templateId === 'm');
      expect(inst?.status).toBe('completed');
    });
  });
});
