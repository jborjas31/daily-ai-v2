# Phase 6 — Real‑Time, Date Nav & Overlaps (Action Plan)

Scope: Add real‑time UX to Today (live clock/now‑line with ~30s cadence), robust date navigation (Prev/Next/Today/date input + mobile swipe), a clear overdue policy, overlap rendering with lane limits and “+X more”, an Up Next strip, small anchor buffers, and minimal smart gap fillers. Keep changes incremental, testable, and mobile‑friendly.

## 0) Preconditions

Status: Completed

- Today route with Timeline and List views.
  - Evidence:
    - `src/app/today/page.tsx` renders `<Timeline />` and `<TaskList />`.
    - `src/components/today/Timeline.tsx` and `src/components/today/TaskList.tsx` are implemented and used.
- Store exposes `ui.currentDate` and `setCurrentDate(date)`.
  - Evidence: `src/store/useAppStore.ts` defines `ui.currentDate` and action `setCurrentDate(date)`.
- Scheduling engine selector available: `generateScheduleForDate(date)`.
  - Evidence: `src/store/useAppStore.ts` implements `generateScheduleForDate` and it’s used by Today components.
- Instance mutation actions ready: `setInstanceStartTime`, `skipInstance`, `postponeInstance`, `undoInstanceStatus`.
  - Evidence: All actions are implemented in `src/store/useAppStore.ts` and exercised in UI (`TaskList`) and tests.
- Tests configured for jsdom + user-event; fake timers available via Vitest.
  - Evidence:
    - `vitest.config.ts` uses jsdom for `*.test.tsx` via `environmentMatchGlobs`.
    - Tests present and passing: `src/components/today/TaskList.ui.test.tsx`, `src/store/useAppStore.test.ts`.

Acceptance for Preconditions: Verified — Today renders, store date can be set in tests, and schedule computation runs via `generateScheduleForDate`.

## 1) Time Utilities + Ticker Hook

Status: In Progress

1.1 Time helpers implemented in `src/lib/time.ts` (existing module):
- `todayISO()` — returns YYYY-MM-DD for local time.
- `isToday(dateISO: string)` — compares against local `todayISO()`.
- `nowTimeString()` — current local time as `HH:MM`.
- `toMinutes('HH:MM')` / `fromMinutes(n)` — already present and used by scheduling/timeline.

Acceptance: Available as named exports from `@/lib/time`.

1.2 Add `src/lib/utils/useNowTick.ts`:
Status: Completed
- Implemented `useNowTick(periodMs = 30000)` returning `{ nowISO, nowTime }`.
- Skips updates when `document.hidden === true`; forces an immediate refresh on visibility change.
- Cleans up interval and event listener on unmount.

1.3 Unit tests:
- `src/lib/time/index.test.ts` — toMinutes/fromMinutes round‑trip; isToday logic (mock Date).
- `src/lib/utils/useNowTick.test.tsx` — fake timers: advances tick and updates returned time.

Acceptance: Callers can subscribe to a lightweight tick without forcing store re-renders.

## 2) Header: Date Navigation + Live Clock

Status: Pending

2.1 Update `src/components/AppHeader/*` (or Today page header) to show:
- Current date label + live clock (HH:MM). Use `useNowTick(30000)`.
- Buttons: Prev Day, Today, Next Day (keyboard accessible, labeled).
- Native date input: type="date"; value bound to `ui.currentDate`; updates via `setCurrentDate(...)`.
- Mobile swipe left/right on Today to change date (use pointer/touch events or a lightweight library; scope small and cancellable).

2.2 Wire to store:
- Prev: `currentDate -> date - 1 day`.
- Today: set to `todayISO()` and recenters Timeline.
- Next: `currentDate -> date + 1 day`.

2.3 Header tests:
- Renders live clock (updates when timers advance).
- Prev/Next/Today/date input all update `ui.currentDate` and re-render Today.
- Now‑line only visible when `isToday(currentDate)`.

Acceptance: Header is keyboard accessible; Today button recenters and sets date to today.

## 3) Timeline Now‑Line + Overdue Policy (Visual Only)

Status: Pending

3.1 Now‑line:
- Render a thin, high‑contrast horizontal rule at current time when viewing today.
- Position computed from `nowTime` and day scale; updates with ticker.

3.2 Overdue rendering policy:
- Mandatory overdue (start < now and not completed/skipped):
  - Render with red tint.
  - Visually re‑seat at current time (“snaps to now”) without mutating data.
- Skippable overdue:
  - Render grayed at original slot; no re‑seat.

3.3 Implementation notes:
- Compute overdue using schedule blocks and instances; do not write to Firestore.
- Provide deterministic classNames for tests (e.g., `data-testid="timeline-block"`, `data-overdue="mandatory|skippable|no"`).

3.4 Tests:
- For today: with fake now at 14:00, tasks before 14:00 mark overdue.
- Mandatory block’s visual top aligns with now‑line; skippable remains at scheduled start.
- For non‑today dates, no now‑line; no overdue tints.

Acceptance: Overdue status reflects policy; now‑line updates ~30s.

## 4) Overlap Rendering + Lane Limits

Status: Pending

4.1 Lane algorithm (pure util):
- Add `src/lib/timeline/lanes.ts` with a function `assignLanes(blocks, maxLanes)` that:
  - Sorts by start then duration; assigns minimal lane index with no overlap in the same lane.
  - Returns `{ laneIndex, hidden: boolean }` for each block; blocks exceeding `maxLanes` per time slice are marked `hidden`.

4.2 Responsive lane caps:
- Mobile (<= md): 2 lanes; Desktop: 3 lanes.
- Hidden indicator: compute `+X more` per time cluster and render a compact badge; tap/click may show a simple popover list (non‑blocking if omitted).

4.3 Styling:
- Blocks share width by lane count; consistent gutters; rounded edges; good contrast.

4.4 Tests (unit + ui):
- Lanes util assigns lanes deterministically; blocks don’t overlap in same lane.
- UI test verifies: at mobile cap, renders `+X more` with correct count; at desktop cap, shows more blocks and reduces `+X`.

Acceptance: Overlapping blocks never cover; extra beyond capacity shows `+X more`.

## 5) Up Next Strip (Calm Focus)

Status: Pending

5.1 Compute “Up Next”:
- If an anchor is active “now”, show that anchor; else choose the best flexible task for now (highest priority in current window and not blocked by dependencies).
- Use existing dependency info; do not suggest blocked items.

5.2 Actions (inline, no modal):
- Start: set the instance start time to `nowTime` (write‑through using existing action) or mark as in‑progress if modeled.
- Can’t do: offer Skip and Postpone inline; call store actions directly.

5.3 Placement:
- Small strip near the header; concise label and two buttons.

5.4 Tests:
- With fake now between anchors: shows the expected flexible task.
- When an anchor spans “now”: strip shows the anchor.
- Buttons call the corresponding store actions (assert optimistic state change).

Acceptance: Shows exactly one next step with Start / Can’t do options.

## 6) Small Buffers Around Anchors (Visual Spacing)

Status: Pending

6.1 Rendering buffer:
- Apply a small visual buffer (default 5–10 min) before/after fixed anchors on the timeline grid.
- Respect per‑task `bufferMinutes` override when present.
- Visual only; no change to schedule computation in this phase.

6.2 Settings (optional, future):
- Consider a default buffer setting in Settings; out of scope to persist in this phase.

6.3 Tests:
- Timeline shows faint spacing before/after anchors.
- `bufferMinutes` override increases/decreases spacing for that anchor only.

Acceptance: Subtle spacing improves readability without altering data.

## 7) Smart Gaps (Micro‑Fillers)

Status: Pending

7.1 Detect gaps:
- From the rendered blocks, detect gaps >= 5 minutes between blocks (excluding sleep bounds).

7.2 UI pill:
- Render a tiny “Use gap” pill inside sufficiently large gaps.
- Clicking opens the New Task modal prefilled with time (or shows a compact chooser for short tasks, if readily available).

7.3 Tests:
- With a ≥ 5 min gap, pill appears; clicking triggers creation flow (mock create).

Acceptance: Non‑intrusive micro‑filler affordance in significant gaps.

## 8) Performance & A11y

Status: Pending

8.1 Performance:
- Memoize heavy derived values (lanes, overdue flags) by date + blocks.
- Ensure ticker only re-renders necessary parts (now‑line and any visuals depending on time).
- Pause ticker on hidden tabs.

8.2 Accessibility:
- Ensure all new controls have labels/aria; ensure `+X more` badge has accessible name and count.
- Date input is keyboard accessible and respects locale; buttons have clear names.

Acceptance: Smooth 30s tick without jank on mobile; controls are usable via keyboard and screen readers.

## 9) Documentation & Examples

Status: Pending

- Update README with a short “Today: Date & Real‑Time” section (clock, now‑line, navigation, overlaps).
- Link to this plan from README like Phase 5.
- Add a brief note about overdue policy in docs.

## 10) Files to Touch (expected)

- `src/lib/time/index.ts` — time helpers.
- `src/lib/utils/useNowTick.ts` — ticker hook.
- `src/lib/timeline/lanes.ts` — lane assignment util + tests.
- `src/app/today/page.tsx` — header updates, now‑line, overdue, overlaps, Up Next, gap pills.
- `src/components/today/*` — small components as needed (UpNext, OverlapBadge, GapPill).
- `src/store/useAppStore.ts` — may add small helpers/selectors if needed; reuse existing actions.
- `src/app/today/today.ui.test.tsx` — UI tests for header/nav, now‑line, overdue, overlaps, Up Next.
- `README.md` — tiny section for Real‑Time & Date Nav.

## 11) Acceptance Checklist (from Blueprint)

- [ ] Header shows current date + live clock; Today recenters and resets to today.
- [ ] Prev/Next (and swipe) update `currentDate` and re-render Today; now‑line only on today.
- [ ] Native date input updates `currentDate`; keyboard accessible; respects locale.
- [ ] Mandatory overdue blocks render red and visually re‑seat at current time (no data mutation); skippable overdue grayed.
- [ ] Overlapping blocks never cover; extra beyond lane capacity shows “+X more”.
- [ ] Up Next strip shows exactly one next step with Start / Can’t do.
- [ ] Small buffers around anchors visible; per‑task override supported.
- [ ] Smart gap pill appears for gaps ≥ 5 min; opens quick action/modal.

---

Notes:
- Keep mutations minimal in this phase (visual adjustments only); defer schedule algorithm changes until later phases.
- Favor simple, predictable visuals over complex interactions; keep mobile in mind.
- Keep PRs small: (1) time utils + ticker + header clock; (2) now‑line + overdue; (3) lanes + +X badges; (4) Up Next + inline actions; (5) buffers + gap pills; (6) docs.
