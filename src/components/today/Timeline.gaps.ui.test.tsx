import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import userEvent from '@testing-library/user-event';

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

// Mock template creation to capture saves from the modal
vi.mock('@/lib/data/templates', () => ({
  __esModule: true,
  createTemplate: vi.fn(async (uid: string, payload: any) => ({ id: 'new-1', ...payload })),
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
    defaultTime: '08:00',
    durationMinutes: 30,
    ...partial,
  } as any;
}

describe('Timeline gaps — Use gap pill', () => {
  it('shows a Use gap pill and opens New Task with prefilled time on click', async () => {
    const store = useAppStore.getState();
    store.setCurrentDate('2025-02-08');
    // Single early block leaves a sizeable gap after
    store.setTaskTemplates([
      tpl({ id: 'early', taskName: 'Early', defaultTime: '07:00', durationMinutes: 30 }),
    ]);

    const user = userEvent.setup();
    render(<TodayPage />);

    const timeline = screen.getAllByTestId('timeline').at(-1)!;
    const pills = within(timeline).getAllByTestId('gap-pill');
    expect(pills.length).toBeGreaterThan(0);

    fireEvent.click(pills[0]);
    // Store prefill set; modal open is driven by page effect
    const prefill = useAppStore.getState().getNewTaskPrefill();
    expect(prefill?.time).toMatch(/^\d{2}:\d{2}$/);
  });

  // Note: end-to-end save is covered elsewhere; here we assert pill -> prefill triggers creation flow entry.
});
