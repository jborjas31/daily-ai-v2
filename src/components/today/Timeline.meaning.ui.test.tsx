import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    durationMinutes: 30,
    ...partial,
  } as any;
}

describe('Timeline color-independent semantics', () => {
  beforeEach(() => {
    const s = useAppStore.getState();
    s.setCurrentDate('2025-02-03');
    s.setTaskTemplates([]);
  });
  afterEach(() => cleanup());

  it('includes mandatory/fixed/flexible in aria-label and shows small badges', async () => {
    const s = useAppStore.getState();
    s.setTaskTemplates([
      tpl({ id: 'mand', taskName: 'Mandatory Fixed', isMandatory: true, schedulingType: 'fixed', defaultTime: '09:00' }),
      tpl({ id: 'fix', taskName: 'Fixed Only', isMandatory: false, schedulingType: 'fixed', defaultTime: '11:00' }),
      { ...tpl({ id: 'flex', taskName: 'Flexible', isMandatory: false, schedulingType: 'flexible', timeWindow: 'anytime' }), defaultTime: undefined },
    ]);

    render(<TodayPage />);

    const timeline = screen.getAllByTestId('timeline').at(-1)!;
    const mandEl = within(timeline).getByText('Mandatory Fixed').closest('[data-testid="timeline-block"]') as HTMLElement;
    const fixEl = within(timeline).getByText('Fixed Only').closest('[data-testid="timeline-block"]') as HTMLElement;
    const flexEl = within(timeline).getByText('Flexible').closest('[data-testid="timeline-block"]') as HTMLElement;

    expect(mandEl.getAttribute('aria-label')).toMatch(/mandatory/);
    expect(fixEl.getAttribute('aria-label')).toMatch(/fixed/);
    expect(flexEl.getAttribute('aria-label')).toMatch(/flexible/);

    // Badges are rendered as small inline pills (not SR-only), so the text should be present visually
    // Badge "M" present (aria-hidden, visual only)
    const badge = within(mandEl).getAllByText('M').find((el) => (el as HTMLElement).tagName.toLowerCase() === 'span');
    expect(badge).toBeTruthy();
    // Find the visual badges by title attribute to avoid ambiguous text queries
    expect(within(fixEl).getByTitle('Fixed time task')).toBeInTheDocument();
    expect(within(flexEl).getByTitle('Flexible task')).toBeInTheDocument();
  });
});
