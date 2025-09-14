import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

// Mock auth guard to always be ready + signed-in
vi.mock('@/components/guards/useRequireAuth', () => ({
  __esModule: true,
  default: () => ({ user: { uid: 'test-user' }, ready: true }),
}));

// Mock instances + schedules data access used by Today page effects
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

import TodayPage from '@/app/today/page';
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
    defaultTime: '12:00',
    durationMinutes: 60,
    ...partial,
  } as any;
}

function parseHeightPx(el: HTMLElement): number {
  const s = el.getAttribute('style') || '';
  const m = s.match(/height:\s*([0-9.]+)px/);
  return m ? parseFloat(m[1]) : 0;
}

describe('Timeline buffers — visual spacing around anchors', () => {
  it('renders faint buffers before/after a fixed anchor (default ~8 min each)', async () => {
    const store = useAppStore.getState();
    store.setCurrentDate('2025-02-06');
    store.setTaskTemplates([
      tpl({ id: 'A', taskName: 'Anchor A', schedulingType: 'fixed', defaultTime: '12:00', durationMinutes: 30 }),
    ]);

    render(<TodayPage />);
    const timeline = screen.getAllByTestId('timeline').at(-1)!;
    const buffers = within(timeline).getAllByTestId('timeline-buffer');

    // Two buffers for the anchor (before + after)
    const forA = buffers.filter((b) => b.getAttribute('data-buffer-id') === 'A');
    expect(forA.length).toBe(2);

    // Roughly 8 minutes -> ~8.53px with 64px/hour scaling
    const heights = forA.map(parseHeightPx);
    const approx = (n: number) => Math.abs(n - (64 * (8 / 60))) < 2; // allow +/- 2px
    expect(approx(heights[0])).toBe(true);
    expect(approx(heights[1])).toBe(true);
  });

  it('respects per-task bufferMinutes override independently per anchor', async () => {
    const store = useAppStore.getState();
    store.setCurrentDate('2025-02-07');
    store.setTaskTemplates([
      tpl({ id: 'A', taskName: 'Anchor A', schedulingType: 'fixed', defaultTime: '12:00', durationMinutes: 30 }),
      tpl({ id: 'B', taskName: 'Anchor B', schedulingType: 'fixed', defaultTime: '15:00', durationMinutes: 30, bufferMinutes: 20 }),
    ]);

    render(<TodayPage />);
    const timeline = screen.getAllByTestId('timeline').at(-1)!;
    const buffers = within(timeline).getAllByTestId('timeline-buffer');

    const forA = buffers.filter((b) => b.getAttribute('data-buffer-id') === 'A');
    const forB = buffers.filter((b) => b.getAttribute('data-buffer-id') === 'B');
    expect(forA.length).toBe(2);
    expect(forB.length).toBe(2);

    const hA = forA.map(parseHeightPx);
    const hB = forB.map(parseHeightPx);

    const px8 = 64 * (8 / 60);
    const px20 = 64 * (20 / 60);
    const approx = (a: number, target: number) => Math.abs(a - target) < 2;
    expect(approx(hA[0], px8)).toBe(true);
    expect(approx(hA[1], px8)).toBe(true);
    expect(approx(hB[0], px20)).toBe(true);
    expect(approx(hB[1], px20)).toBe(true);
  });
});

