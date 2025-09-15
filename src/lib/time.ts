import type { TimeString } from '@/lib/types';
export type { TimeString };

export function parseHHMM(t: TimeString): { h: number; m: number } {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

export function toMinutes(t: TimeString): number {
  const { h, m } = parseHHMM(t);
  return h * 60 + m;
}

export function fromMinutes(mins: number): TimeString {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hh = String(((h % 24) + 24) % 24).padStart(2, '0');
  const mm = String(((m % 60) + 60) % 60).padStart(2, '0');
  return `${hh}:${mm}` as TimeString;
}

export function addMinutes(t: TimeString, delta: number): TimeString {
  return fromMinutes(toMinutes(t) + delta);
}

export function compareTime(a: TimeString, b: TimeString): number {
  return toMinutes(a) - toMinutes(b);
}

// Phase 6 helpers (local time aware)
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isToday(dateISO: string): boolean {
  return dateISO === todayISO();
}

export function nowTimeString(): TimeString {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}` as TimeString;
}

// Add or subtract whole days from a local-date ISO (YYYY-MM-DD)
export function addDaysISO(dateISO: string, delta: number): string {
  const [yStr, mStr, dStr] = dateISO.split('-');
  const y = Number(yStr) || 0;
  const m = (Number(mStr) || 1) - 1; // 0-based month
  const d = Number(dStr) || 1;
  const date = new Date(y, m, d);
  date.setDate(date.getDate() + delta);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
