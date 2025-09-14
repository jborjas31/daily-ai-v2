import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
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

import { useAppStore } from '@/store/useAppStore';

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

function parseTopPx(el: HTMLElement): number {
  const s = el.getAttribute('style') || '';
  const mTop = s.match(/top:\s*([0-9.]+)px/);
  const base = mTop ? parseFloat(mTop[1]) : 0;
  const mTrans = s.match(/translateY\(([-0-9.]+)px\)/);
  const dy = mTrans ? parseFloat(mTrans[1]) : 0;
  return base + dy;
}

describe('Timeline overdue visuals', () => {
  afterEach(() => {
    cleanup();
  });
  it('marks mandatory/skippable overdue correctly and re-seats mandatory to now', async () => {
    // Ensure modules pick up mocks
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
      tpl({ id: 'm', taskName: 'Mandatory Meeting', isMandatory: true, schedulingType: 'fixed', defaultTime: '13:00' }),
      tpl({ id: 's', taskName: 'Skippable Call', isMandatory: false, schedulingType: 'fixed', defaultTime: '10:00' }),
    ]);

    const { default: TodayPage } = await import('@/app/today/page');
    render(<TodayPage />);

    const timeline = screen.getAllByTestId('timeline').at(-1)!;
    const nowLine = within(timeline).getByLabelText('Now line');
    const nowTop = parseTopPx(nowLine);

    const mandEl = within(timeline).getByText('Mandatory Meeting').closest('[data-testid="timeline-block"]') as HTMLElement;
    const skipEl = within(timeline).getByText('Skippable Call').closest('[data-testid="timeline-block"]') as HTMLElement;
    expect(mandEl).toHaveAttribute('data-overdue', 'mandatory');
    expect(skipEl).toHaveAttribute('data-overdue', 'skippable');

    // Mandatory aligns with now-line
    const mandTop = parseTopPx(mandEl);
    expect(Math.abs(mandTop - nowTop)).toBeLessThan(1);
    // Skippable remains at original start (10:00 -> 64 * (10) = 640px)
    const skipTop = parseTopPx(skipEl);
    expect(Math.abs(skipTop - 640)).toBeLessThan(1);
  });

  it('hides now-line and overdue tints on non-today dates', async () => {
    vi.resetModules();
    vi.doMock('@/lib/time', async () => {
      const actual = await vi.importActual<any>('@/lib/time');
      return { ...actual, todayISO: () => '2025-02-03' };
    });
    vi.doMock('@/lib/utils/useNowTick', () => ({
      __esModule: true,
      default: () => ({ nowISO: '2025-02-03', nowTime: '14:00' }),
    }));
    const { useAppStore: freshStore2 } = await import('@/store/useAppStore');
    const store = freshStore2.getState();
    store.setCurrentDate('2025-02-04');
    store.setTaskTemplates([
      tpl({ id: 'm2', taskName: 'Mandatory Meeting 2', isMandatory: true, schedulingType: 'fixed', defaultTime: '13:00' }),
      tpl({ id: 's2', taskName: 'Skippable Call 2', isMandatory: false, schedulingType: 'fixed', defaultTime: '10:00' }),
    ]);
    const { default: TodayPage } = await import('@/app/today/page');
    render(<TodayPage />);
    const timeline = screen.getAllByTestId('timeline').at(-1)!;
    expect(within(timeline).queryByLabelText('Now line')).not.toBeInTheDocument();
    const blocks = within(timeline).getAllByTestId('timeline-block');
    for (const el of blocks) {
      expect(el).toHaveAttribute('data-overdue', 'no');
    }
  });
});
