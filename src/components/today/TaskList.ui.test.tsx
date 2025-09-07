import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import userEvent from '@testing-library/user-event';
import TaskList from './TaskList';
import { useAppStore } from '@/store/useAppStore';
import type { TaskTemplate } from '@/lib/types';

function resetStore() {
  const s = useAppStore.getState();
  s.resetAfterSignOut();
}

function setupWithTemplate(t: TaskTemplate, date = '2025-02-01') {
  const s = useAppStore.getState();
  s.setCurrentDate(date);
  s.setTaskTemplates([t]);
}

describe('TaskList UI interactions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('Skip removes item from Pending and shows in Skipped', async () => {
    setupWithTemplate({
      id: 't-skip',
      taskName: 'Skip Me',
      isMandatory: false,
      isActive: true,
      priority: 3,
      schedulingType: 'flexible',
      timeWindow: 'anytime',
      durationMinutes: 30,
    } as TaskTemplate);

    render(<TaskList />);
    const user = userEvent.setup();

    const pendingItem = (await screen.findAllByText('Skip Me'))[0];
    const itemRow = pendingItem.closest('li') as HTMLElement;
    const skipBtn = within(itemRow).getByRole('button', { name: 'Skip' });
    await user.click(skipBtn);

    // Pending section should no longer include this item
    const pendingHeading = screen.getAllByRole('heading', { name: 'Pending' })[0];
    const pendingSection = pendingHeading.closest('section') ?? pendingHeading.parentElement as HTMLElement;
    expect(within(pendingSection).queryByText('Skip Me')).toBeNull();
    // Skipped section lists the task by name
    const skippedHeading = screen.getAllByRole('heading', { name: 'Skipped' })[0];
    const skippedSection = skippedHeading.closest('section') ?? skippedHeading.parentElement as HTMLElement;
    expect(skippedSection).toBeInTheDocument();
    expect(skippedSection).toHaveTextContent('Skip Me');
  });

  it('Postpone removes item from Pending and shows in Postponed', async () => {
    setupWithTemplate({
      id: 't-postpone',
      taskName: 'Postpone Me',
      isMandatory: false,
      isActive: true,
      priority: 3,
      schedulingType: 'flexible',
      timeWindow: 'anytime',
      durationMinutes: 30,
    } as TaskTemplate);

    render(<TaskList />);
    const user = userEvent.setup();

    const pendingItem2 = (await screen.findAllByText('Postpone Me'))[0];
    const itemRow2 = pendingItem2.closest('li') as HTMLElement;
    const postponeBtn = within(itemRow2).getByRole('button', { name: 'Postpone' });
    await user.click(postponeBtn);

    // Pending section should no longer include this item
    const pendingHeading = screen.getAllByRole('heading', { name: 'Pending' })[0];
    const pendingSection = pendingHeading.closest('section') ?? pendingHeading.parentElement as HTMLElement;
    expect(within(pendingSection).queryByText('Postpone Me')).toBeNull();
    // Postponed section lists the task by name
    const postponedHeading = screen.getAllByRole('heading', { name: 'Postponed' })[0];
    const postponedSection = postponedHeading.closest('section') ?? postponedHeading.parentElement as HTMLElement;
    expect(postponedSection).toBeInTheDocument();
    expect(postponedSection).toHaveTextContent('Postpone Me');
  });
});
