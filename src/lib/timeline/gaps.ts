
export type Interval = { start: number; end: number };
export type Gap = { start: number; end: number; duration: number };

/**
 * detectGaps — compute gaps >= minGapMinutes between busy intervals within a window.
 * - Intervals are in minutes from midnight [start, end) with start < end.
 * - Overlapping/adjacent intervals are merged before gap detection.
 * - The search is clamped to [windowStart, windowEnd].
 */
export function detectGaps(
  intervals: Interval[],
  windowStart: number,
  windowEnd: number,
  minGapMinutes = 5,
): Gap[] {
  const out: Gap[] = [];
  if (windowEnd <= windowStart) return out;
  const norm = intervals
    .map((i) => ({ start: Math.max(windowStart, i.start), end: Math.min(windowEnd, i.end) }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  // Merge overlaps
  const merged: Interval[] = [];
  for (const i of norm) {
    const last = merged[merged.length - 1];
    if (!last) merged.push({ ...i });
    else if (i.start <= last.end) {
      last.end = Math.max(last.end, i.end);
    } else {
      merged.push({ ...i });
    }
  }

  // Cursor begins at windowStart
  let cur = windowStart;
  for (const b of merged) {
    if (b.start - cur >= minGapMinutes) {
      out.push({ start: cur, end: b.start, duration: b.start - cur });
    }
    cur = Math.max(cur, b.end);
    if (cur >= windowEnd) break;
  }
  if (windowEnd - cur >= minGapMinutes) {
    out.push({ start: cur, end: windowEnd, duration: windowEnd - cur });
  }
  return out;
}

export default detectGaps;
