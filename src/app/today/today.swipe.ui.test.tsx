import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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
import TodayPage from './page';

function addDaysISO(dateISO: string, delta: number): string {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('Today swipe safe-zone', () => {
  beforeEach(() => {
    cleanup();
    useAppStore.getState().resetAfterSignOut();
    useAppStore.getState().setCurrentDate('2025-02-03');
  });

  it('swiping left/right in the header swipe zone changes date', async () => {
    render(<TodayPage />);
    const zone = await screen.findByTestId('swipe-zone');
    const before = useAppStore.getState().ui.currentDate;

    // Swipe left -> next day
    fireEvent.touchStart(zone, { touches: [{ clientX: 200, clientY: 10 }] });
    fireEvent.touchMove(zone, { touches: [{ clientX: 120, clientY: 12 }] });
    fireEvent.touchEnd(zone);
    const afterLeft = useAppStore.getState().ui.currentDate;
    expect(afterLeft).toBe(addDaysISO(before, 1));

    // Swipe right -> previous day
    fireEvent.touchStart(zone, { touches: [{ clientX: 100, clientY: 10 }] });
    fireEvent.touchMove(zone, { touches: [{ clientX: 180, clientY: 12 }] });
    fireEvent.touchEnd(zone);
    const afterRight = useAppStore.getState().ui.currentDate;
    expect(afterRight).toBe(before); // advanced then decremented
  });

  it('vertical gestures do not trigger date changes', async () => {
    render(<TodayPage />);
    const zone = await screen.findByTestId('swipe-zone');
    const before = useAppStore.getState().ui.currentDate;
    // Mostly vertical movement
    fireEvent.touchStart(zone, { touches: [{ clientX: 150, clientY: 10 }] });
    fireEvent.touchEnd(zone);
    expect(useAppStore.getState().ui.currentDate).toBe(before);
  });

  it('timeline area is free of swipe handlers (no date change on drag)', async () => {
    render(<TodayPage />);
    const before = useAppStore.getState().ui.currentDate;
    const timeline = await screen.findAllByTestId('timeline');
    const el = timeline[timeline.length - 1];
    // Horizontal drag in timeline should not change date
    fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 200 }] });
    fireEvent.touchEnd(el);
    expect(useAppStore.getState().ui.currentDate).toBe(before);
  });
});
