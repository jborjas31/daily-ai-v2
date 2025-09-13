import { describe, it, expect } from 'vitest';
import { filterTemplates, sortTemplates, type SortMode, type MandatoryFilter } from '@/lib/templates/filtering';
import type { TaskTemplate } from '@/lib/types';

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

describe('templates filtering utils', () => {
  const templates: TaskTemplate[] = [
    tpl({ id: 'a', taskName: 'Morning Run', description: 'Jog in the park', isMandatory: false, schedulingType: 'flexible', timeWindow: 'morning', priority: 2 }),
    tpl({ id: 'b', taskName: 'Email Cleanup', description: 'Inbox zero', isMandatory: false, schedulingType: 'flexible', timeWindow: 'afternoon', priority: 3 }),
    tpl({ id: 'c', taskName: 'Standup Meeting', description: 'Daily sync', isMandatory: true, schedulingType: 'fixed', defaultTime: '09:00', timeWindow: undefined, priority: 5 }),
    tpl({ id: 'd', taskName: 'Read Book', description: 'Evening reading', isMandatory: false, schedulingType: 'flexible', timeWindow: 'evening', priority: 1 }),
    tpl({ id: 'e', taskName: 'Alpha Task', description: 'Something', isMandatory: false, schedulingType: 'flexible', timeWindow: 'anytime', priority: 5 }),
    tpl({ id: 'f', taskName: 'alpha task', description: 'lowercase variant', isMandatory: false, schedulingType: 'flexible', timeWindow: 'anytime', priority: 5 }),
  ];

  it('matches query on name and description (case-insensitive)', () => {
    const byName = filterTemplates(templates, { query: 'run' });
    expect(byName.map(t => t.id)).toContain('a');
    const byDesc = filterTemplates(templates, { query: 'inbox' });
    expect(byDesc.map(t => t.id)).toContain('b');
    const none = filterTemplates(templates, { query: 'nonexistent' });
    expect(none.length).toBe(0);
  });

  it('filters by mandatory/skippable correctly', () => {
    const all = filterTemplates(templates, { mandatory: 'all' as MandatoryFilter });
    expect(all.length).toBe(templates.length);
    const mand = filterTemplates(templates, { mandatory: 'mandatory' });
    expect(mand.map(t => t.id)).toEqual(['c']);
    const skip = filterTemplates(templates, { mandatory: 'skippable' });
    expect(skip.map(t => t.id)).not.toContain('c');
  });

  it('filters by time windows for flexible tasks, allows fixed tasks always', () => {
    const wins = new Set(['morning'] as const);
    const filtered = filterTemplates(templates, { timeWindows: wins });
    // Morning flexible should remain
    expect(filtered.map(t => t.id)).toContain('a');
    // Evening flexible should be excluded
    expect(filtered.map(t => t.id)).not.toContain('d');
    // Fixed-time meeting should still be included regardless of window
    expect(filtered.map(t => t.id)).toContain('c');
  });

  it('sorts by name A→Z (case-insensitive) stably', () => {
    const subset = templates.filter(t => ['e', 'f', 'b'].includes(t.id));
    const sorted = sortTemplates(subset, 'name' as SortMode);
    // alpha task and Alpha Task should be adjacent, case-insensitive order
    expect(sorted.map(t => t.id).slice(0,2)).toEqual(['e','f']);
    // stability: if two names equal after normalization, preserve original order (e before f)
  });

  it('sorts by priority High→Low then name A→Z as tiebreaker', () => {
    const subset = templates.filter(t => ['a','b','e','f'].includes(t.id));
    const sorted = sortTemplates(subset, 'priority' as SortMode);
    // highest priority ids: e (5), f (5) then b (3) then a (2)
    expect(sorted.slice(0,2).map(t => t.id)).toEqual(['e','f']);
    // tie between e and f is broken by name A->Z (Alpha Task before alpha task) which our normalizer lowercases, so fallback to stable index => e before f
    expect(sorted[2].id).toBe('b');
    expect(sorted[3].id).toBe('a');
  });
});

