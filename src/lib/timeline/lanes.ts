// Timeline lane assignment utility (pure)
// Step 4.1 — Phase 6: Overlap Rendering + Lane Limits
//
// Assigns each block to the minimal lane index with no overlap in the same lane.
// If more than `maxLanes` blocks overlap at the same time slice, excess blocks
// are marked hidden.
//
// Notes
// - Blocks are treated as half-open intervals [start, end). Adjacent blocks
//   where a.end === b.start do not overlap.
// - Sorting: primary by start ascending, secondary by duration descending
//   to stabilize placement for long-running blocks.

export type TimelineBlock = {
  // Optional identifier for downstream rendering; not used by the algorithm
  id?: string;
  start: number; // minutes from 00:00
  end: number;   // minutes from 00:00 (end > start)
};

export type LaneAssignment = {
  laneIndex: number | null; // 0..maxLanes-1 if visible; null when hidden
  hidden: boolean;
};

function durationOf(b: TimelineBlock): number {
  return Math.max(0, (b.end ?? 0) - (b.start ?? 0));
}

/**
 * Assign lanes to blocks with a greedy, stable algorithm.
 *
 * @param blocks The time blocks to place (minutes-based start/end)
 * @param maxLanes The maximum number of lanes to render concurrently
 * @returns An array of { laneIndex|null, hidden } aligned to the input order
 */
export function assignLanes<T extends TimelineBlock>(blocks: T[], maxLanes: number): LaneAssignment[] {
  if (!Array.isArray(blocks) || blocks.length === 0) return [];
  const cap = Math.max(1, Math.floor(maxLanes || 1));

  // Keep original index to map results back to input order
  const items = blocks.map((b, i) => ({ b, i }));

  // Sort: start asc, duration desc (longer first within same start)
  items.sort((a, c) => {
    if (a.b.start !== c.b.start) return a.b.start - c.b.start;
    return durationOf(c.b) - durationOf(a.b);
  });

  // Track the latest end time per visible lane
  const laneEnds: number[] = [];
  const out: LaneAssignment[] = Array(blocks.length).fill(null).map(() => ({ laneIndex: null, hidden: true }));

  for (const it of items) {
    const cur = it.b;
    const start = cur.start ?? 0;
    const end = Math.max(start, cur.end ?? start);

    // Try to place into the first lane that is free (end <= start)
    let placedLane: number | null = null;
    for (let lane = 0; lane < Math.min(laneEnds.length, cap); lane++) {
      if (laneEnds[lane] <= start) {
        placedLane = lane;
        laneEnds[lane] = end;
        break;
      }
    }

    // If no existing lane was free, try to open a new lane (within cap)
    if (placedLane === null) {
      if (laneEnds.length < cap) {
        placedLane = laneEnds.length;
        laneEnds.push(end);
      }
    }

    if (placedLane === null) {
      // All lanes are occupied at this time slice — mark hidden
      out[it.i] = { laneIndex: null, hidden: true };
    } else {
      out[it.i] = { laneIndex: placedLane, hidden: false };
    }
  }

  return out;
}

export default assignLanes;

