import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import userEvent from '@testing-library/user-event';
import { enableMapSet } from 'immer';
enableMapSet();

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

// Mock heavy UI/portal dependencies to keep JSDOM stable
vi.mock('sonner', () => ({
  __esModule: true,
  toast: {
    success: () => {},
    error: () => {},
  },
}));
vi.mock('@/components/ui/ConfirmDialog', () => ({
  __esModule: true,
  default: (props: { open: boolean }) => (props.open ? <div data-testid="confirm-dialog" /> : null),
}));
vi.mock('@/components/ui/ScopeDialog', () => ({
  __esModule: true,
  default: (props: { open: boolean }) => (props.open ? <div data-testid="scope-dialog" /> : null),
}));
vi.mock('@/components/library/TaskModal', () => ({
  __esModule: true,
  default: (props: { open: boolean }) => (props.open ? <div data-testid="task-modal" /> : null),
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

function baseFixtures(): TaskTemplate[] {
  return [
    tpl({ id: 'a', taskName: 'Morning Run', description: 'Jog in the park', isMandatory: false, schedulingType: 'flexible', timeWindow: 'morning', priority: 2 }),
    tpl({ id: 'b', taskName: 'Email Cleanup', description: 'Inbox zero', isMandatory: false, schedulingType: 'flexible', timeWindow: 'afternoon', priority: 3 }),
    tpl({ id: 'c', taskName: 'Standup Meeting', description: 'Daily sync', isMandatory: true, schedulingType: 'fixed', defaultTime: '09:00', timeWindow: undefined, priority: 5 }),
    tpl({ id: 'd', taskName: 'Archived Task', description: 'Old', isMandatory: false, schedulingType: 'flexible', timeWindow: 'evening', isActive: false, priority: 1 }),
    tpl({ id: 'e', taskName: 'Dependent Task', description: 'depends on Standup', isMandatory: false, schedulingType: 'flexible', timeWindow: 'anytime', priority: 4, dependsOn: 'c' }),
    tpl({ id: 'f', taskName: 'Missing Dep Task', description: 'has missing dep', isMandatory: false, schedulingType: 'flexible', timeWindow: 'anytime', priority: 2, dependsOn: 'zzz' }),
    tpl({ id: 'g', taskName: 'Disabled Dep Task', description: 'depends on inactive', isMandatory: false, schedulingType: 'flexible', timeWindow: 'anytime', priority: 3, dependsOn: 'd' }),
  ];
}

function resetStore() {
  useAppStore.getState().resetAfterSignOut();
}

async function findActiveSection(): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name: /^Active \(/ });
  return (heading.closest('section') ?? heading.parentElement) as HTMLElement;
}

describe('Library UI - search, filters, sort, badges', () => {
  beforeEach(() => {
    cleanup();
    resetStore();
    mockedTemplates = baseFixtures();
    // Seed store to avoid relying solely on async effect
    useAppStore.getState().setTaskTemplates(mockedTemplates);
  });

  it('Search filters results after debounce; Reset restores', async () => {
    render(<LibraryPage />);
    const user = userEvent.setup();

    // Wait for page to render
    await screen.findByRole('heading', { name: 'Library' });
    // Wait for sections to render
    await findActiveSection();

    // Type into search
    const searchInput = screen.getByLabelText('Search');
    await user.type(searchInput, 'run');
    // advance debounce using real timers
    await new Promise((r) => setTimeout(r, 300));

    // Only Morning Run remains
    await screen.findByText('Morning Run');
    expect(screen.queryByText('Email Cleanup')).toBeNull();

    // Reset filters -> full list back
    await user.click(screen.getByRole('button', { name: 'Reset Filters' }));
    expect(await screen.findByText('Standup Meeting')).toBeInTheDocument();
  });

  it('Mandatory filter shows only mandatory templates', async () => {
    render(<LibraryPage />);
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Library' });
    const activeSection = await findActiveSection();

    await user.click(screen.getByRole('button', { name: 'Mandatory' }));
    expect(await screen.findByText('Standup Meeting')).toBeInTheDocument();
    expect(within(activeSection).queryByText('Email Cleanup')).toBeNull();
  });

  it('Time window Morning keeps fixed + morning flexible', async () => {
    render(<LibraryPage />);
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Library' });
    const activeSection = await findActiveSection();

    await user.click(screen.getByRole('button', { name: 'Morning' }));
    // Should include Morning Run and Standup Meeting (fixed)
    expect(await screen.findByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Standup Meeting')).toBeInTheDocument();
    // Exclude afternoon/anytime flex
    expect(within(activeSection).queryByText('Email Cleanup')).toBeNull();
    expect(within(activeSection).queryByText('Dependent Task')).toBeNull();
    expect(within(activeSection).queryByText('Missing Dep Task')).toBeNull();
    expect(within(activeSection).queryByText('Disabled Dep Task')).toBeNull();
  });

  it('Priority sort orders High→Low then A→Z', async () => {
    render(<LibraryPage />);
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Library' });

    await user.click(screen.getByRole('button', { name: 'Priority High→Low' }));
    const updatedActive = await findActiveSection();
    const lis = within(updatedActive).getAllByRole('listitem');
    // First few in order
    expect(within(lis[0]).getByText('Standup Meeting')).toBeInTheDocument(); // prio 5
    expect(within(lis[1]).getByText('Dependent Task')).toBeInTheDocument();  // prio 4
    // Next prio 3 names sorted A->Z: Disabled Dep Task (D) before Email Cleanup (E)
    expect(within(lis[2]).getByText('Disabled Dep Task')).toBeInTheDocument();
    expect(within(lis[3]).getByText('Email Cleanup')).toBeInTheDocument();
  });

  it('Dependency badges show ok/missing/disabled statuses', async () => {
    render(<LibraryPage />);
    await screen.findByRole('heading', { name: 'Library' });
    // OK: e depends on c (active)
    const depOkRow = (await screen.findByText('Dependent Task')).closest('li') as HTMLElement;
    expect(within(depOkRow).getByText(/Depends on Standup Meeting/)).toBeInTheDocument();
    // Missing: f depends on zzz
    const depMissingRow = (await screen.findByText('Missing Dep Task')).closest('li') as HTMLElement;
    expect(within(depMissingRow).getByText(/Depends on zzz/)).toBeInTheDocument();
    // Disabled: g depends on d (inactive)
    const depDisabledRow = (await screen.findByText('Disabled Dep Task')).closest('li') as HTMLElement;
    expect(within(depDisabledRow).getByText(/Depends on Archived Task/)).toBeInTheDocument();
  });
});
