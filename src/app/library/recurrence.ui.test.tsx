import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import userEvent from '@testing-library/user-event';

import type { TaskTemplate } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';

// Mock auth guard to always be ready + signed-in
vi.mock('@/components/guards/useRequireAuth', () => ({
  __esModule: true,
  default: () => ({ user: { uid: 'test-user' }, ready: true }),
}));

// Provide controllable templates for listTemplates
let mockedTemplates: TaskTemplate[] = [];
vi.mock('@/lib/data/templates', () => ({
  __esModule: true,
  listTemplates: vi.fn(async () => mockedTemplates),
  updateTemplate: vi.fn(async () => {}),
  duplicateTemplate: vi.fn(async () => ({})),
  softDeleteTemplate: vi.fn(async () => {}),
  createTemplate: vi.fn(async (_uid: string, payload: Omit<TaskTemplate, 'id'>) => ({ ...payload, id: 'new' } as TaskTemplate)),
}));

// Silence toasts
vi.mock('sonner', () => ({
  __esModule: true,
  toast: { success: () => {}, error: () => {} },
}));

import LibraryPage from './page';

function tpl(partial: Partial<TaskTemplate> & { id: string; taskName: string }): TaskTemplate {
  return {
    description: '',
    isMandatory: false,
    priority: 3,
    isActive: true,
    schedulingType: 'flexible',
    timeWindow: 'anytime',
    durationMinutes: 30,
    ...partial,
  } as TaskTemplate;
}

function resetStore() {
  useAppStore.getState().resetAfterSignOut();
}

describe('Library UI — recurrence summary and scope dialog', () => {
  beforeEach(() => {
    cleanup();
    resetStore();
    mockedTemplates = [];
  });

  it('renders recurrence summary for weekly templates', async () => {
    mockedTemplates = [
      tpl({
        id: 'r1',
        taskName: 'Weekly Review',
        isMandatory: false,
        schedulingType: 'fixed',
        defaultTime: '09:00',
        durationMinutes: 30,
        recurrenceRule: { frequency: 'weekly', interval: 1, daysOfWeek: [1, 5] },
      }),
    ];
    // Seed store to avoid depending solely on async effect
    useAppStore.getState().setTaskTemplates(mockedTemplates);

    render(<LibraryPage />);

    // Wait for page + list
    await screen.findByRole('heading', { name: 'Library' });
    const activeSection = (await screen.findByRole('heading', { name: /Active \(/ })).closest('section') as HTMLElement;
    expect(within(activeSection).getByText('Weekly Review')).toBeInTheDocument();
    // Summary should include weekdays
    expect(within(activeSection).getByText('Weekly · Mon/Fri')).toBeInTheDocument();
  });

  it('opens Scope dialog when editing a recurring fixed-time task with time change', async () => {
    mockedTemplates = [
      tpl({
        id: 'r2',
        taskName: 'Team Standup',
        isMandatory: true,
        schedulingType: 'fixed',
        defaultTime: '09:00',
        durationMinutes: 15,
        recurrenceRule: { frequency: 'weekly', daysOfWeek: [1,2,3,4,5] },
      }),
    ];
    useAppStore.getState().setTaskTemplates(mockedTemplates);

    render(<LibraryPage />);
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: 'Library' });
    // Click Edit on the recurring template
    const row = (await screen.findByText('Team Standup')).closest('li') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));

    // Modal opens — change default time
    await screen.findByRole('heading', { name: 'Edit Task' });
    const timeInput = screen.getByLabelText('Default Time') as HTMLInputElement;
    // Use fireEvent to set time input value reliably in JSDOM
    fireEvent.change(timeInput, { target: { value: '10:00' } });
    // Save
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // ScopeDialog should open
    expect(await screen.findByRole('heading', { name: 'Edit Recurrence Scope' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Only this' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'This and future' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });
});
