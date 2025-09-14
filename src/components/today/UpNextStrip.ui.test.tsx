import React from 'react';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import userEvent from '@testing-library/user-event';

import { useAppStore } from '@/store/useAppStore';
import type { TaskTemplate } from '@/lib/types';
import UpNextStrip from '@/components/today/UpNextStrip';

function resetStore() {
  const s = useAppStore.getState();
  s.resetAfterSignOut();
}

function setupTemplates(templates: TaskTemplate[], date = '2025-02-01') {
  const s = useAppStore.getState();
  s.setCurrentDate(date);
  s.setTaskTemplates(templates);
}

describe('UpNextStrip — selection and actions', () => {
  beforeEach(() => {
    resetStore();
  });
  afterEach(() => {
    cleanup();
    try {
      useAppStore.getState().resetAfterSignOut();
    } catch {}
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('shows anchor when an anchor spans now and Start/Skip/Postpone act on it', async () => {
    const templates: TaskTemplate[] = [
      {
        id: 't-breakfast',
        taskName: 'Breakfast',
        isMandatory: true,
        isActive: true,
        priority: 5,
        schedulingType: 'fixed',
        defaultTime: '08:50', // spans 08:50–09:20 (now = 09:00)
        durationMinutes: 30,
      } as TaskTemplate,
    ];
    setupTemplates(templates);

    const user = userEvent.setup();
    // Force suggestion to be an anchor regardless of actual time
    const s = useAppStore.getState();
    s.computeUpNext = () => ({
      kind: 'anchor',
      template: templates[0],
      block: { startTime: '08:50', endTime: '09:20' },
      reason: 'fixed',
    });
    render(<UpNextStrip />);

    // Anchor label + hint
    expect(await screen.findByText('Up next')).toBeInTheDocument();
    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText('08:50–09:20')).toBeInTheDocument();

    // Start -> sets instance start time to now (09:00)
    await user.click(screen.getByRole('button', { name: 'Start now' }));
    const instA = useAppStore.getState().getTaskInstancesForDate('2025-02-01').find(i => i.templateId === 't-breakfast');
    expect(instA).toBeTruthy();
    expect(instA?.modifiedStartTime).toMatch(/^\d{2}:\d{2}$/);

    // Open Can't do menu -> Skip
    await user.click(screen.getByRole('button', { name: "Can't do" }));
    const menu = screen.getByRole('menu', { name: "Can't do menu" });
    await user.click(within(menu).getByRole('menuitem', { name: 'Skip' }));
    const instAfterSkip = useAppStore.getState().getTaskInstancesForDate('2025-02-01').find(i => i.templateId === 't-breakfast');
    expect(instAfterSkip?.status).toBe('skipped');

    // Open again -> Postpone
    await user.click(screen.getByRole('button', { name: "Can't do" }));
    const menu2 = screen.getByRole('menu', { name: "Can't do menu" });
    await user.click(within(menu2).getByRole('menuitem', { name: 'Postpone' }));
    const instAfterPostpone = useAppStore.getState().getTaskInstancesForDate('2025-02-01').find(i => i.templateId === 't-breakfast');
    expect(instAfterPostpone?.status).toBe('postponed');
  });

  it('when between anchors, shows highest-priority flexible in current window; Start sets start time', async () => {
    const templates: TaskTemplate[] = [
      // Anchors around now that do not cover 09:00
      { id: 'a-early', taskName: 'Early Anchor', isMandatory: true, isActive: true, priority: 1, schedulingType: 'fixed', defaultTime: '08:00', durationMinutes: 10 } as TaskTemplate,
      { id: 'a-late', taskName: 'Late Anchor', isMandatory: true, isActive: true, priority: 1, schedulingType: 'fixed', defaultTime: '10:00', durationMinutes: 15 } as TaskTemplate,
      // Flexible candidates
      { id: 'f-high', taskName: 'High Flex', isMandatory: false, isActive: true, priority: 5, schedulingType: 'flexible', timeWindow: 'morning', durationMinutes: 30 } as TaskTemplate,
      { id: 'f-low', taskName: 'Low Flex', isMandatory: false, isActive: true, priority: 1, schedulingType: 'flexible', timeWindow: 'evening', durationMinutes: 30 } as TaskTemplate,
    ];
    setupTemplates(templates);

    const user = userEvent.setup();
    // Force suggestion to be the high-priority flexible candidate
    const s = useAppStore.getState();
    const t = templates.find((x) => x.id === 'f-high')!;
    s.computeUpNext = () => ({ kind: 'flexible', template: t, window: 'morning' });
    render(<UpNextStrip />);

    // Should show the morning high-priority flexible task
    expect(await screen.findByText('Up next')).toBeInTheDocument();
    expect(screen.getByText('High Flex')).toBeInTheDocument();
    expect(screen.getByText(/~30m in/i)).toBeInTheDocument();

    // Start -> sets start time to now for that template
    await user.click(screen.getByRole('button', { name: 'Start now' }));
    const inst = useAppStore.getState().getTaskInstancesForDate('2025-02-01').find(i => i.templateId === 'f-high');
    expect(inst).toBeTruthy();
    expect(inst?.modifiedStartTime).toMatch(/^\d{2}:\d{2}$/);
  });
});
