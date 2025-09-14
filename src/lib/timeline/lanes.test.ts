import { describe, it, expect } from 'vitest';
import { assignLanes, type TimelineBlock } from './lanes';

describe('assignLanes (timeline lanes util)', () => {
  it('assigns non-overlapping blocks to lane 0', () => {
    const blocks: TimelineBlock[] = [
      { start: 60, end: 120 },
      { start: 130, end: 180 },
      { start: 200, end: 240 },
    ];
    const res = assignLanes(blocks, 2);
    expect(res.map(r => r.hidden)).toEqual([false, false, false]);
    expect(res.map(r => r.laneIndex)).toEqual([0, 0, 0]);
  });

  it('uses multiple lanes when blocks overlap, hides beyond cap', () => {
    // Three blocks overlapping around 09:30–10:00
    const blocks: TimelineBlock[] = [
      { start: 540, end: 600 }, // 09:00–10:00
      { start: 555, end: 615 }, // 09:15–10:15
      { start: 570, end: 630 }, // 09:30–10:30
    ];
    const res2 = assignLanes(blocks, 2);
    // Exactly two visible, one hidden when cap=2
    expect(res2.filter(r => r.hidden).length).toBe(1);
    expect(res2.filter(r => !r.hidden).length).toBe(2);

    const res3 = assignLanes(blocks, 3);
    // All visible when cap=3
    expect(res3.every(r => !r.hidden)).toBe(true);
    // Lane indexes should be within [0, cap)
    expect(Math.max(...(res3.map(r => (r.laneIndex ?? 0)))))
      .toBeLessThan(3);
  });

  it('stabilizes with longer duration first when starts are equal', () => {
    const blocks: TimelineBlock[] = [
      { start: 600, end: 660 }, // 10:00–11:00 (longer)
      { start: 600, end: 630 }, // 10:00–10:30
      { start: 600, end: 620 }, // 10:00–10:20 (shortest)
    ];
    const res = assignLanes(blocks, 2);
    // Longer should take lane 0, next lane 1, overflow hidden
    expect(res[0].hidden).toBe(false);
    expect(res[0].laneIndex).toBe(0);
    expect(res[1].hidden).toBe(false);
    expect(res[1].laneIndex).toBe(1);
    expect(res[2].hidden).toBe(true);
  });
});

