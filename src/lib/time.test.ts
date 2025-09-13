import { describe, it, expect, vi } from 'vitest';
import { toMinutes, fromMinutes, todayISO, isToday, nowTimeString } from '@/lib/time';

describe('time utils', () => {
  it('toMinutes/fromMinutes round-trip HH:MM', () => {
    const cases = ['00:00', '01:30', '09:05', '13:59', '23:00'] as const;
    for (const t of cases) {
      const mins = toMinutes(t);
      expect(fromMinutes(mins)).toBe(t);
    }
    // basic math
    expect(toMinutes('01:30')).toBe(90);
  });

  it('todayISO / isToday / nowTimeString respect mocked system time', () => {
    vi.useFakeTimers();
    const base = new Date('2025-02-03T10:30:00');
    vi.setSystemTime(base);
    expect(todayISO()).toBe('2025-02-03');
    expect(isToday('2025-02-03')).toBe(true);
    expect(isToday('2025-02-02')).toBe(false);
    expect(nowTimeString()).toBe('10:30');
    vi.setSystemTime(new Date('2025-02-03T11:01:00'));
    expect(nowTimeString()).toBe('11:01');
    vi.useRealTimers();
  });
});

