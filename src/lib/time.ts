export type TimeString = string;

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
