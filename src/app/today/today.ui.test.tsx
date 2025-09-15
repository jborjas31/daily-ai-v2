import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import userEvent from '@testing-library/user-event';

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

import TodayPage from './page';

function addDaysISO(dateISO: string, delta: number) {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('Today header — live clock, date navigation, now-line visibility', () => {
  it('Live clock updates when timers advance', async () => {
    vi.useFakeTimers();
    const base = new Date('2025-02-03T10:00:00');
    vi.setSystemTime(base);
    const { unmount } = render(<TodayPage />);
     
    console.log('TODAY DOM:', document.body.innerHTML.slice(0, 500));
    const clock = screen.getByLabelText('Current time');
    expect(clock).toHaveTextContent('10:00');

    // Advance one minute of system time; tick interval is 60s
    vi.setSystemTime(new Date(base.getTime() + 60_000));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(clock).toHaveTextContent('10:01');
    vi.useRealTimers();
    unmount();
  });

  it('Prev/Next/Today/date input update currentDate and toggle now-line', async () => {
    render(<TodayPage />);
     
    console.log('TODAY DOM (nav test):', document.body.innerHTML.slice(0, 500));
    const user = userEvent.setup();

    const dateInput = screen.getByLabelText('Date');
    const today = (dateInput as HTMLInputElement).value;
    const next = addDaysISO(today, 1);

    expect((dateInput as HTMLInputElement).value).toBe(today);

    // Now-line visible on today
    expect(screen.queryByLabelText('Now line')).toBeInTheDocument();

    // Next day: input updates, now-line hidden
    const nextBtn = screen.getAllByRole('button', { name: 'Next day' })[0];
    await user.click(nextBtn);
    expect((dateInput as HTMLInputElement).value).toBe(next);
    expect(screen.queryByLabelText('Now line')).not.toBeInTheDocument();

    // Prev day (back to today): input updates, now-line visible again
    const prevBtn = screen.getAllByRole('button', { name: 'Previous day' })[0];
    await user.click(prevBtn);
    expect((dateInput as HTMLInputElement).value).toBe(today);
    expect(screen.queryByLabelText('Now line')).toBeInTheDocument();

    // Go to a specific date using the date input; now-line hides when not today
    const someDate = addDaysISO(today, -2);
    fireEvent.change(dateInput, { target: { value: someDate } });
    expect((dateInput as HTMLInputElement).value).toBe(someDate);
    expect(screen.queryByLabelText('Now line')).not.toBeInTheDocument();

    // Click Today to return; now-line visible
    await user.click(screen.getByRole('button', { name: 'Jump to today' }));
    expect((dateInput as HTMLInputElement).value).toBe(today);
    expect(screen.queryByLabelText('Current time')).toBeInTheDocument();
  });
});
