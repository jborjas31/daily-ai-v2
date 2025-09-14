import { describe, it, expect } from 'vitest';
import { detectGaps } from './gaps';

describe('detectGaps', () => {
  it('finds gaps between non-overlapping intervals', () => {
    const wake = 6 * 60; // 06:00
    const sleep = 23 * 60; // 23:00
    const intervals = [
      { start: 8 * 60, end: 9 * 60 }, // 08:00–09:00
      { start: 10 * 60 + 30, end: 11 * 60 }, // 10:30–11:00
    ];
    const gaps = detectGaps(intervals, wake, sleep, 5);
    // Expected gaps: 06:00–08:00, 09:00–10:30, 11:00–23:00
    expect(gaps.length).toBe(3);
    expect(gaps[0]).toMatchObject({ start: 360, end: 480, duration: 120 });
    expect(gaps[1]).toMatchObject({ start: 540, end: 630, duration: 90 });
    expect(gaps[2]).toMatchObject({ start: 660, end: 1380, duration: 720 });
  });

  it('merges overlaps and ignores sub-5-minute spaces', () => {
    const wake = 6 * 60; // 06:00
    const sleep = 23 * 60; // 23:00
    const intervals = [
      { start: 8 * 60, end: 9 * 60 }, // 08:00–09:00
      { start: 8 * 60 + 30, end: 10 * 60 }, // 08:30–10:00 (overlaps)
      { start: 10 * 60 + 3, end: 10 * 60 + 10 }, // tiny 3 min gap after 10:00, then short block
    ];
    const gaps = detectGaps(intervals, wake, sleep, 5);
    // Merged busy: 08:00–10:10, so first gap: 06:00–08:00; small 3-minute gap discarded
    expect(gaps[0]).toMatchObject({ start: 360, end: 480 });
    // Final long gap
    const last = gaps[gaps.length - 1];
    expect(last.start).toBe(610); // 10:10
    expect(last.end).toBe(1380); // 23:00
  });

  it('clamps to window and returns empty when no space', () => {
    const wake = 8 * 60;
    const sleep = 9 * 60;
    const intervals = [{ start: 8 * 60, end: 9 * 60 }];
    const gaps = detectGaps(intervals, wake, sleep, 5);
    expect(gaps.length).toBe(0);
  });
});

