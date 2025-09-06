import { describe, it, expect } from 'vitest';
import { shouldGenerateForDate, getNextOccurrence, expandRecurrencePattern, type RecurrenceRule } from './Recurrence';

describe('Recurrence (pure)', () => {
  it('daily: every day', () => {
    const rule: RecurrenceRule = { frequency: 'daily' };
    expect(shouldGenerateForDate(rule, '2025-02-01')).toBe(true);
    expect(shouldGenerateForDate(rule, '2025-02-02')).toBe(true);
  });

  it('daily: every 2 days from startDate', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 2, startDate: '2025-01-01' };
    expect(shouldGenerateForDate(rule, '2025-01-01')).toBe(true);
    expect(shouldGenerateForDate(rule, '2025-01-02')).toBe(false);
    expect(shouldGenerateForDate(rule, '2025-01-03')).toBe(true);
  });

  it('weekly: selected days', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', daysOfWeek: [1, 5] }; // Mon & Fri
    // 2025-02-03 is Monday
    expect(shouldGenerateForDate(rule, '2025-02-03')).toBe(true);
    // 2025-02-04 is Tuesday
    expect(shouldGenerateForDate(rule, '2025-02-04')).toBe(false);
  });

  it('monthly: specific day of month', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', dayOfMonth: 15 };
    expect(shouldGenerateForDate(rule, '2025-02-15')).toBe(true);
    expect(shouldGenerateForDate(rule, '2025-02-14')).toBe(false);
  });

  it('monthly: last day of month', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', dayOfMonth: -1 };
    expect(shouldGenerateForDate(rule, '2025-02-28')).toBe(true); // 2025 not leap
    expect(shouldGenerateForDate(rule, '2025-02-27')).toBe(false);
  });

  it('yearly: month + day', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', month: 12, dayOfMonth: 25 };
    expect(shouldGenerateForDate(rule, '2025-12-25')).toBe(true);
    expect(shouldGenerateForDate(rule, '2025-12-24')).toBe(false);
  });

  it('date range limits', () => {
    const rule: RecurrenceRule = { frequency: 'daily', startDate: '2025-01-10', endDate: '2025-01-12' };
    expect(shouldGenerateForDate(rule, '2025-01-09')).toBe(false);
    expect(shouldGenerateForDate(rule, '2025-01-10')).toBe(true);
    expect(shouldGenerateForDate(rule, '2025-01-13')).toBe(false);
  });

  it('next occurrence returns a future date', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', daysOfWeek: [3] }; // Wednesday
    const next = getNextOccurrence(rule, '2025-02-02'); // Sunday
    expect(next).toBeInstanceOf(Date);
  });

  it('expand pattern returns string dates', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', daysOfWeek: [1] }; // Monday
    const list = expandRecurrencePattern(rule, { start: '2025-02-01', end: '2025-02-28' });
    expect(Array.isArray(list)).toBe(true);
    expect(list.every((d) => /\d{4}-\d{2}-\d{2}/.test(d))).toBe(true);
  });
});

