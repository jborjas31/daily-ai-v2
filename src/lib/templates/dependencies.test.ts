import { describe, it, expect } from 'vitest';
import { buildById, getDependencyStatus } from '@/lib/templates/dependencies';
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

describe('template dependency utils: getDependencyStatus', () => {
  it('returns ok when prerequisite exists and active', () => {
    const a = tpl({ id: 'a', taskName: 'A', dependsOn: 'b' });
    const b = tpl({ id: 'b', taskName: 'B', isActive: true });
    const byId = buildById([a, b]);
    const res = getDependencyStatus(a, byId);
    expect(res).not.toBeNull();
    expect(res!.status).toBe('ok');
    expect(res!.dependsOnId).toBe('b');
    expect(res!.dependsOnName).toBe('B');
  });

  it('returns disabled when prerequisite exists but inactive', () => {
    const a = tpl({ id: 'a', taskName: 'A', dependsOn: 'c' });
    const c = tpl({ id: 'c', taskName: 'C', isActive: false });
    const byId = buildById([a, c]);
    const res = getDependencyStatus(a, byId);
    expect(res).not.toBeNull();
    expect(res!.status).toBe('disabled');
    expect(res!.dependsOnName).toBe('C');
  });

  it('returns missing when prerequisite id not found', () => {
    const a = tpl({ id: 'a', taskName: 'A', dependsOn: 'missing' });
    const byId = buildById([a]);
    const res = getDependencyStatus(a, byId);
    expect(res).not.toBeNull();
    expect(res!.status).toBe('missing');
    expect(res!.dependsOnId).toBe('missing');
    expect(res!.dependsOnName).toBeUndefined();
  });

  it('detects self-cycle and two-node cycle', () => {
    // self-cycle
    const s = tpl({ id: 's', taskName: 'Self', dependsOn: 's' });
    const byIdSelf = buildById([s]);
    const resSelf = getDependencyStatus(s, byIdSelf);
    expect(resSelf).not.toBeNull();
    expect(resSelf!.status).toBe('cycle');

    // two-node cycle: a <-> b
    const a = tpl({ id: 'a', taskName: 'A', dependsOn: 'b' });
    const b = tpl({ id: 'b', taskName: 'B', dependsOn: 'a' });
    const byId = buildById([a, b]);
    const resA = getDependencyStatus(a, byId);
    const resB = getDependencyStatus(b, byId);
    expect(resA!.status).toBe('cycle');
    expect(resB!.status).toBe('cycle');
  });
});

