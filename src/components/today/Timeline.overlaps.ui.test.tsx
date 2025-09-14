import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

// Mock auth guard to always be ready + signed-in
vi.mock('@/components/guards/useRequireAuth', () => ({
  __esModule: true,
  default: () => ({ user: { uid: 'test-user' }, ready: true }),
}));

// Mock instances + schedules data access used indirectly by Today page effects
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
    defaultTime: '10:00',
    durationMinutes: 60,
    ...partial,
  } as any;
}

function mockMatchMedia(desktop: boolean) {
  // Provide a minimal matchMedia mock that responds to min-width and reduced motion
  const mm = (query: string) => {
    const isDesktopQuery = /(min-width:\s*768px)/.test(query);
    const prefersReduced = /(prefers-reduced-motion)/.test(query);
    return {
      matches: isDesktopQuery ? desktop : (prefersReduced ? false : false),
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
  };
  // @ts-expect-error jsdom
  window.matchMedia = mm as any;
}

describe('Timeline overlaps — responsive lane caps and +X badges', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.setCurrentDate('2025-02-03');
    store.setTaskTemplates([]);
  });

  it('shows +1 more on mobile (2 lanes) when 3 blocks overlap and the badge is accessible', async () => {
    mockMatchMedia(false); // mobile
    const store = useAppStore.getState();
    store.setTaskTemplates([
      tpl({ id: 'A', taskName: 'A', schedulingType: 'fixed', defaultTime: '09:00', durationMinutes: 60 }),
      tpl({ id: 'B', taskName: 'B', schedulingType: 'fixed', defaultTime: '09:15', durationMinutes: 60 }),
      tpl({ id: 'C', taskName: 'C', schedulingType: 'fixed', defaultTime: '09:30', durationMinutes: 60 }),
    ]);

    render(<TodayPage />);

    // Two visible out of three; +1 more badge appears
    const timeline = screen.getAllByTestId('timeline').at(-1)!;
    const blocks = within(timeline).getAllByTestId('timeline-block');
    expect(blocks.length).toBe(2);
    const badge = await screen.findByTestId('more-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label');
    // Open popover and then close with Escape
    await badge.click();
    expect(await screen.findByRole('dialog', { name: 'Hidden overlapping tasks' })).toBeInTheDocument();
    // Close via Escape
    // Use testing-library fireEvent for keydown Escape
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Hidden overlapping tasks' })).toBeNull();
  });

  it('shows all 3 on desktop (3 lanes) with no +X badge', async () => {
    mockMatchMedia(true); // desktop
    const store = useAppStore.getState();
    store.setTaskTemplates([
      tpl({ id: 'A', taskName: 'A', schedulingType: 'fixed', defaultTime: '09:00', durationMinutes: 60 }),
      tpl({ id: 'B', taskName: 'B', schedulingType: 'fixed', defaultTime: '09:15', durationMinutes: 60 }),
      tpl({ id: 'C', taskName: 'C', schedulingType: 'fixed', defaultTime: '09:30', durationMinutes: 60 }),
    ]);

    render(<TodayPage />);

    // All three visible; no +X badge
    const timeline = screen.getAllByTestId('timeline').at(-1)!;
    const blocks = within(timeline).getAllByTestId('timeline-block');
    expect(blocks.length).toBe(3);
    expect(within(timeline).queryByTestId('more-badge')).not.toBeInTheDocument();
  });
});
