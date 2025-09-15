import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
    durationMinutes: 60,
    ...partial,
  } as any;
}

describe('Today header overdue count', () => {
  afterEach(() => cleanup());

  it('counts overdue tasks on today (start < now, not done)', async () => {
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
      tpl({ id: 'm', taskName: 'Mandatory Meeting', isMandatory: true, schedulingType: 'fixed', defaultTime: '13:00' }),
      tpl({ id: 's', taskName: 'Skippable Call', isMandatory: false, schedulingType: 'fixed', defaultTime: '10:00' }),
    ]);

    const { default: TodayPage } = await import('./page');
    render(<TodayPage />);

    const overduePill = screen.getAllByTitle('Overdue (scheduled before now and not done)').at(-1)!;
    expect(overduePill).toHaveTextContent('Overdue: 2');
  });

  it('shows zero overdue on non-today dates', async () => {
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
    store.setCurrentDate('2025-02-04');
    store.setTaskTemplates([
      tpl({ id: 'm2', taskName: 'Mandatory Meeting 2', isMandatory: true, schedulingType: 'fixed', defaultTime: '13:00' }),
      tpl({ id: 's2', taskName: 'Skippable Call 2', isMandatory: false, schedulingType: 'fixed', defaultTime: '10:00' }),
    ]);

    const { default: TodayPage } = await import('./page');
    render(<TodayPage />);
    const overduePill = screen.getAllByTitle('Overdue (scheduled before now and not done)').at(-1)!;
    expect(overduePill).toHaveTextContent('Overdue: 0');
  });
});
