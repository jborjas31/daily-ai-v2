// Pure recurrence utilities for task templates
// No global state; operates on provided rule + dates only

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export type CustomPattern =
  | { type: 'weekdays' }
  | { type: 'weekends' }
  | { type: 'nth_weekday'; dayOfWeek: number; nthWeek: number }
  | { type: 'last_weekday'; dayOfWeek: number }
  | { type: 'business_days' };

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number; // >=1
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  endAfterOccurrences?: number;
  // weekly
  daysOfWeek?: number[]; // 0-6 (Sun=0)
  // monthly/yearly
  dayOfMonth?: number; // 1-31 or -1 for last day of month
  month?: number; // 1-12 (for yearly)
  // custom
  customPattern?: CustomPattern;
}

function toDate(d: string | Date): Date {
  if (d instanceof Date) {
    // Normalize to local midnight to avoid TZ drift in day/month comparisons
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  // Parse canonical YYYY-MM-DD as a date-only value at local midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, da] = d.split('-').map((x) => parseInt(x, 10));
    return new Date(y, m - 1, da);
  }
  // Fallback for other formats
  return new Date(d);
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isWithinRecurrenceDateRange(rule: RecurrenceRule, date: Date): boolean {
  if (rule.startDate) {
    if (date < toDate(rule.startDate)) return false;
  }
  if (rule.endDate) {
    if (date > toDate(rule.endDate)) return false;
  }
  return true;
}

export function shouldGenerateDaily(rule: RecurrenceRule, date: Date): boolean {
  const interval = rule.interval ?? 1;
  if (interval === 1) return true;
  const start = rule.startDate ? toDate(rule.startDate) : new Date();
  const daysDiff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff >= 0 && daysDiff % interval === 0;
}

export function shouldGenerateWeekly(rule: RecurrenceRule, date: Date): boolean {
  const days = rule.daysOfWeek ?? [];
  if (days.length === 0) return false;
  const dow = date.getDay();
  if (!days.includes(dow)) return false;
  const interval = rule.interval ?? 1;
  if (interval === 1) return true;
  const start = rule.startDate ? toDate(rule.startDate) : new Date();
  const weeksDiff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
  return weeksDiff >= 0 && weeksDiff % interval === 0;
}

export function shouldGenerateMonthly(rule: RecurrenceRule, date: Date): boolean {
  const interval = rule.interval ?? 1;
  if (rule.dayOfMonth) {
    const targetDom = date.getDate();
    if (rule.dayOfMonth === -1) {
      const lastDom = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      if (targetDom !== lastDom) return false;
    } else if (rule.dayOfMonth !== targetDom) {
      return false;
    }
  }
  if (interval === 1) return true;
  const start = rule.startDate ? toDate(rule.startDate) : new Date();
  const monthsDiff = (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
  return monthsDiff >= 0 && monthsDiff % interval === 0;
}

export function shouldGenerateYearly(rule: RecurrenceRule, date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (rule.month && rule.month !== month) return false;
  if (rule.dayOfMonth && rule.dayOfMonth !== day) return false;
  const interval = rule.interval ?? 1;
  if (interval === 1) return true;
  const start = rule.startDate ? toDate(rule.startDate) : new Date();
  const yearsDiff = date.getFullYear() - start.getFullYear();
  return yearsDiff >= 0 && yearsDiff % interval === 0;
}

export function shouldGenerateCustom(rule: RecurrenceRule, date: Date): boolean {
  const p = rule.customPattern;
  if (!p) return false;
  const dow = date.getDay();
  switch (p.type) {
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekends':
      return dow === 0 || dow === 6;
    case 'business_days':
      return dow >= 1 && dow <= 5;
    case 'nth_weekday': {
      const nth = Math.ceil(date.getDate() / 7);
      return p.dayOfWeek === dow && p.nthWeek === nth;
    }
    case 'last_weekday': {
      if (p.dayOfWeek !== dow) return false;
      const nextWeek = new Date(date);
      nextWeek.setDate(date.getDate() + 7);
      return nextWeek.getMonth() !== date.getMonth();
    }
    default:
      return false;
  }
}

export function shouldGenerateForDate(rule: RecurrenceRule | undefined, date: string | Date): boolean {
  if (!rule || rule.frequency === 'none') return true;
  const target = toDate(date);
  if (!isWithinRecurrenceDateRange(rule, target)) return false;
  // Occurrence limits would require counting instances; defer for MVP
  switch (rule.frequency) {
    case 'daily':
      return shouldGenerateDaily(rule, target);
    case 'weekly':
      return shouldGenerateWeekly(rule, target);
    case 'monthly':
      return shouldGenerateMonthly(rule, target);
    case 'yearly':
      return shouldGenerateYearly(rule, target);
    case 'custom':
      return shouldGenerateCustom(rule, target);
    default:
      return false;
  }
}

export function getNextOccurrence(rule: RecurrenceRule | undefined, fromDate: string | Date): Date | null {
  if (!rule || rule.frequency === 'none') return null;
  const start = toDate(fromDate);
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);
  const max = new Date(cursor);
  max.setFullYear(max.getFullYear() + 1);
  while (cursor <= max) {
    if (shouldGenerateForDate(rule, cursor)) return new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

export function getOccurrencesInRange(rule: RecurrenceRule | undefined, startDate: string | Date, endDate: string | Date): Date[] {
  if (!rule || rule.frequency === 'none') return [];
  const start = toDate(startDate);
  const end = toDate(endDate);
  const out: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (shouldGenerateForDate(rule, cur)) out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function expandRecurrencePattern(rule: RecurrenceRule | undefined, range: { start: string | Date; end: string | Date }): string[] {
  return getOccurrencesInRange(rule, range.start, range.end).map(formatDate);
}

export function validateRecurrenceRule(rule: unknown): { isValid: boolean; errors: string[] } {
  const result = { isValid: true, errors: [] as string[] };
  if (!rule || typeof rule !== 'object') {
    return { isValid: false, errors: ['Recurrence rule must be an object'] };
  }
  const r = rule as RecurrenceRule;
  const validFrequencies: RecurrenceFrequency[] = ['none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'];
  if (!r.frequency || !validFrequencies.includes(r.frequency)) {
    result.isValid = false;
    result.errors.push('Invalid frequency');
  }
  if (r.interval && (!Number.isInteger(r.interval) || r.interval < 1)) {
    result.isValid = false;
    result.errors.push('Interval must be a positive integer');
  }
  if (r.startDate && r.endDate) {
    if (toDate(r.startDate) >= toDate(r.endDate)) {
      result.isValid = false;
      result.errors.push('End date must be after start date');
    }
  }
  if (r.frequency === 'weekly' && r.daysOfWeek) {
    const ok = Array.isArray(r.daysOfWeek) && r.daysOfWeek.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (!ok) {
      result.isValid = false;
      result.errors.push('daysOfWeek must be an array of integers 0-6');
    }
  }
  if ((r.frequency === 'monthly' || r.frequency === 'yearly') && r.dayOfMonth !== undefined) {
    const dom = r.dayOfMonth;
    if (!Number.isInteger(dom) || ((dom < 1 || dom > 31) && dom !== -1)) {
      result.isValid = false;
      result.errors.push('dayOfMonth must be an integer 1-31 or -1 for last day');
    }
  }
  return result;
}
