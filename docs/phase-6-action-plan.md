# Phase 6 — Real‑Time, Date Nav & Overlaps (Action Plan)

Scope: Add real‑time UX to Today (live clock/now‑line with ~30s cadence), robust date navigation (Prev/Next/Today/date input + mobile swipe), a clear overdue policy, overlap rendering with lane limits and “+X more”, an Up Next strip, small anchor buffers, and minimal smart gap fillers. Keep changes incremental, testable, and mobile‑friendly — with calm defaults, progressive disclosure, and minimal noisy UI.

## UX Principles (Phase 6)

- Calm by default: low‑intensity visuals; avoid banners and modals where a small inline affordance suffices.
- Progressive disclosure: show only the next best action; reveal secondary options on intent.
- Predictable motion: subtle transforms (150–200ms), no layout jank; respect `prefers-reduced-motion`.
- Accessible first: labeled controls, keyboard flows, visible focus, WCAG 2.1 AA contrast.
- Touch friendly: minimum 40–44px tap targets, generous spacing, swipe for date nav on mobile.
- Copy and tone: brief, neutral microcopy; no exclamation; avoid toast spam (prefer inline confirmations).

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

Status: Completed

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
Status: Completed
- `src/lib/time.test.ts` — toMinutes/fromMinutes round‑trip; `todayISO`/`isToday`/`nowTimeString` with mocked Date.
- `src/lib/utils/useNowTick.test.tsx` — basic render returns current local date/time string; hook is isolated and ready for integration in header.

Acceptance: Callers can subscribe to a lightweight tick without forcing store re-renders.

## 2) Header: Date Navigation + Live Clock

Status: Completed

2.1 Update `src/components/AppHeader/*` (or Today page header) to show:
Status: Completed (UI + wiring)
- Current date label + live clock (HH:MM) via `useNowTick(30000)`.
- Buttons: Prev Day, Today, Next Day with accessible labels/titles.
- Native date input bound to `ui.currentDate`, updates store via `setCurrentDate(...)`.
- Implemented within `src/app/today/page.tsx` header; mobile swipe reserved for a follow‑up.

2.2 Wire to store:
Status: Completed
- Prev: `currentDate -> date - 1 day`.
- Today: set to `todayISO()` and recenters Timeline (Timeline auto-scrolls to now when viewing today).
- Next: `currentDate -> date + 1 day`.
Evidence: Implemented in `src/app/today/page.tsx` (buttons + date input) and `src/components/today/Timeline.tsx` (recenter + now-line only on today).

2.3 Header tests:
Status: Completed
- `src/app/today/today.ui.test.tsx`:
  - Live clock updates when timers advance (via fake timers).
  - Prev/Next/Today/date input update `ui.currentDate` and re‑render Today.
  - Now‑line only visible when viewing today.

Acceptance: Header is keyboard accessible; Today button recenters and sets date to today.

## 3) Timeline Now‑Line + Overdue Policy (Visual Only)

Status: Completed

3.1 Now‑line:
Status: Completed
- Rendered a thin, high‑contrast horizontal rule at current time when viewing today.
- Position computed from `nowTime` via `useNowTick(30s)` and `toMinutes(nowTime)`; updates with the ticker.
- Only visible on today; hidden on other dates; Timeline recenters on now (when viewing today).
Evidence: `src/components/today/Timeline.tsx` (`Now line` element; `todayISO()` check; `useNowTick`).

Polish guidelines:
- Animate position with a transform translateY (not top) to prevent reflow.
- Ensure the rule does not obscure text; place below labels; add subtle glow only on focus/hover.
- Respect `prefers-reduced-motion`: jump updates without animation.

3.2 Overdue rendering policy:
Status: Completed
- Mandatory overdue (start < now and not completed/skipped):
  - Renders with a stronger red tint and visually re-seats to “now”; underlying data unchanged.
- Skippable overdue:
  - Renders grayed (reduced opacity) at its original slot.
Implementation: `src/components/today/Timeline.tsx` computes overdue per block using current `nowTime`, instances, and `todayISO()`; applies classes and adjusts render position for mandatory only.

Polish guidelines:
- Use transform translateY for visual re-seat to avoid shifting other blocks.
- Keep contrast at AA; avoid pure red on white; prefer accessible red tones.
- Add a subtle overdue badge only on hover/focus (desktop) to reduce noise.

3.3 Implementation notes:
Status: Completed
- Compute overdue using schedule blocks and instances (pure UI logic); no Firestore writes.
- Added deterministic attributes for testing: `data-testid="timeline-block"` and `data-overdue="mandatory|skippable|no"` on each block.

3.4 Tests:
Status: Completed
- `src/components/today/Timeline.overdue.ui.test.tsx`:
  - For today (fake now 14:00): tasks before 14:00 mark overdue.
  - Mandatory block aligns visually with now-line (same top); skippable stays at original slot.
  - For non-today dates: no now-line and no overdue tints (data-overdue="no").

Acceptance: Overdue status reflects policy; now‑line updates ~30s.

## 4) Overlap Rendering + Lane Limits

Status: Completed

4.1 Lane algorithm (pure util) — Completed
- Implemented `src/lib/timeline/lanes.ts` exporting `assignLanes(blocks, maxLanes)`:
  - Sorts by start asc, duration desc; assigns minimal lane index without overlap in the same lane.
  - Returns `{ laneIndex, hidden }` for each input block (aligned by order); excess overlaps beyond `maxLanes` are marked `hidden`.

4.2 Responsive lane caps — Completed
- Implemented responsive lane cap in `Timeline` (matchMedia `(min-width: 768px)`): 2 lanes on mobile, 3 on desktop.
- Integrated `assignLanes` per overlap cluster; side‑by‑side absolute layout with calculated `left` and `width` per lane.
- Added `+X more` compact badges per cluster where overlaps exceed cap (accessible label indicates count).

Polish guidelines:
- Maintain 8–12px horizontal gutters between lanes; ensure minimum lane width ~42% on mobile to preserve legibility.
- Truncate labels with ellipsis; show full label on focus/hover via title attribute.
- `+X more` badge: right‑aligned within cluster region; strong contrast; keyboard focusable; optional popover may list hidden items (non‑blocking).
- Avoid overlapping badges with blocks; offset by 4–8px.

4.3 Styling — Completed
- Blocks share width by lane count; consistent 8–12px gutters; rounded edges; calm shadows.
- Labels truncate with ellipsis; full label and time via title attribute on focus/hover.
- Accessible contrast for block colors (AA) in both themes; keyboard focus ring visible.

4.4 Tests (unit + ui) — Completed
- Unit: `src/lib/timeline/lanes.test.ts` verifies non-overlap lane 0, overlap behavior under caps (2 vs 3), and duration tiebreak for equal starts.
- UI: `src/components/today/Timeline.overlaps.ui.test.tsx` verifies on mobile cap (2 lanes) a `+1 more` badge appears and only two overlap blocks are visible; on desktop cap (3 lanes) all three render and no `+X` badge is shown.

Acceptance: Overlapping blocks never cover; extra beyond capacity shows `+X more`.

## 5) Up Next Strip (Calm Focus)

Status: Completed

5.1 Compute “Up Next”:
Status: Completed
- Implemented store selector `computeUpNext(date, nowTime?)` in `src/store/useAppStore.ts` returning an `UpNextSuggestion`.
- Logic:
  - If an anchor is active “now” (fixed task or manual override), return that anchor with its block times.
  - Otherwise, choose the highest-priority flexible task in the current window (morning/afternoon/evening/anytime), excluding completed/skipped/postponed and tasks with unmet dependencies.
  - Dependencies considered satisfied if completed today or the dependency’s scheduled block ends before now.
  - Avoid suggesting items with a future manual start override.
Acceptance: Callers can retrieve a single next-step suggestion per date/time without mutating state.

5.2 Actions (inline, no modal):
Status: Completed
- Implemented `UpNextStrip` UI at `src/components/today/UpNextStrip.tsx` and rendered it in `src/app/today/page.tsx` near the header.
- Primary action “Start” calls `setInstanceStartTime(currentDate, templateId, nowTime)` (no toast; shows brief inline “✓ Started”).
- “Can’t do” offers two inline buttons calling store actions directly:
  - `Skip` → `skipInstance(currentDate, templateId)`
  - `Postpone` → `postponeInstance(currentDate, templateId)`
- When an anchor is active, secondary buttons render with slight de‑emphasis; Start remains available to explicitly set a start time if needed.
Acceptance: Inline actions execute against the store without modals.

5.3 Placement:
Status: Completed
- Rendered `UpNextStrip` as a compact strip directly under the Today header controls in `src/app/today/page.tsx`.
- Shows concise label + time hint + Start/Skip/Postpone actions.
 - Polish adhered: exposes exactly one primary action pair — a primary `Start` button and a single secondary `Can’t do` button which opens an inline two-option menu (`Skip`, `Postpone`) with proper a11y (`aria-expanded`, `aria-controls`, `role="menu"/`menuitem``), keyboard navigation (ArrowUp/Down, Tab cycling), and closes on Escape/outside click.

Polish guidelines:
- Exactly one primary action pair visible (Start / Can’t do); keep buttons medium size with clear labels.
- When an anchor is active, deemphasize secondary options; do not duplicate actions shown within the block.
- Use calm microcopy: “Up next: Breakfast” with 1‑line time hint (“~30m in Morning”).
- No toasts on Start success; instead, a brief inline confirmation (e.g., subtle checkmark) and re‑seat.

5.4 Tests:
Status: Completed
- `src/components/today/UpNextStrip.ui.test.tsx` covers:
  - Between anchors (fake now): shows the expected flexible task (highest priority in current window) and Start sets start time to now.
  - Anchor spanning now: strip shows the anchor with time hint and Start/Can’t do present.
  - Actions: Start, Skip, and Postpone each update instance state optimistically (asserted via store selectors).

Acceptance: Shows exactly one next step with Start / Can’t do options.

## 6) Small Buffers Around Anchors (Visual Spacing)

Status: Completed (6.2 deferred)

6.1 Rendering buffer:
Status: Completed
- Implemented visual buffers in `src/components/today/Timeline.tsx` for anchors (fixed tasks and manual overrides):
  - Default 8 minutes shading before and after each anchor block, rendered as faint gradients across the full timeline width (`pointer-events: none`).
  - Respects per‑task override via optional `bufferMinutes` on `TaskTemplate` (added as an optional field in `src/lib/types/index.ts`).
  - Purely visual; does not affect schedule computation or block layout.
Polish:
- Used subtle `bg-gradient-to-b` with transparent fades; does not interfere with dragging or hit‑testing.

Polish guidelines:
- Render buffers as faint gradients, not solid blocks; keep pointer‑events: none.
- Do not allow drops inside visual buffer; snap to outside edges.

6.2 Settings (optional, future):
Status: Deferred
- Consider a default buffer setting in Settings; out of scope to persist in this phase.

6.3 Tests:
Status: Completed
- `src/components/today/Timeline.buffers.ui.test.tsx` verifies:
  - A single fixed anchor renders two faint buffer overlays (before/after) with the default size (~8 minutes).
  - A second anchor with `bufferMinutes: 20` renders larger buffers, while the first remains at default, confirming per‑task override applies independently.
Acceptance: Subtle spacing present and sized as expected.

Acceptance: Subtle spacing improves readability without altering data.

## 7) Smart Gaps (Micro‑Fillers)

Status: Completed

7.1 Detect gaps:
Status: Completed
- Implemented pure util `detectGaps` in `src/lib/timeline/gaps.ts` that:
  - Merges overlapping intervals and detects gaps >= 5 minutes within the awake window.
  - Operates in minutes from midnight for precision.
- Integrated detection in `Timeline` (no UI yet): computes gaps between scheduled blocks clamped to wake/sleep window.
- Tests: `src/lib/timeline/gaps.test.ts` covers merging behavior, thresholding, and window clamps.

7.2 UI pill:
Status: Completed
- Implemented in `src/components/today/Timeline.tsx`:
  - Renders compact “Use gap” pills inside gaps (min 5 min desktop, 10 min mobile), capped to the first 3 to avoid clutter.
  - Clicking a pill sets `newTaskPrefill` with the gap start time and inferred time window; `Today` auto-opens the New Task modal on prefill.
- Tests: `src/components/today/Timeline.gaps.ui.test.tsx` ensures a pill appears and clicking sets prefill for creation.

Polish guidelines:
- Cap to the first 3 visible gap pills per screen to avoid clutter.
- On mobile, increase the threshold to 10 minutes by default; keep 5 minutes on desktop.

7.3 Tests:
Status: Completed
- `src/lib/timeline/gaps.test.ts` validates pure detection logic.
- `src/components/today/Timeline.gaps.ui.test.tsx` verifies a gap ≥ threshold shows a “Use gap” pill and clicking sets prefill to initiate creation (modal + save covered elsewhere).

Acceptance: Non‑intrusive micro‑filler affordance in significant gaps.

## 8) Performance & A11y

Status: Completed

8.1 Performance:
Status: Completed
- Memoized heavy derived values in `Timeline`:
  - Base blocks (geometry, palettes, metadata) memoized by schedule + templates + instances.
  - Time‑dependent visuals (overdue tint + mandatory re‑seat transform) applied in a separate memo keyed by `nowMins` and `isToday` to avoid recomputing lanes.
  - Lane assignment runs on base geometry only; unaffected by ticker updates.
- Ticker scope: `useNowTick` already pauses on hidden tabs and only updates current date/time strings; now‑line and time‑dependent visuals re-render without recomputing lanes/geometry.

Additional guidelines:
- Prefer CSS transforms over top/left for moving elements; avoid layout thrash.
- Debounce resize/media‑query recalculations; avoid per‑frame work.
- Use requestAnimationFrame for smooth scroll/auto‑center.

8.2 Accessibility:
Status: Completed
- Controls labeled: `+X more` badge has an accessible name and is focusable; gap pills have descriptive `aria-label`s; timeline blocks expose `aria-label` with task name and time range.
- Date input is labeled via `<label for="dateInput">Date</label>` and buttons have clear names/`aria-label`s; Up Next “Can’t do” uses `role="menu"/menuitem` and keyboard navigation with focus management.
- Visible focus styles applied (focus-visible ring classes); minimum touch target respected for interactive elements.

Additional guidelines:
- Provide visible focus styles for all interactive elements; minimum hit target 40–44px.
- Meet WCAG 2.1 AA contrast; verify in both light and dark themes.
- Respect `prefers-reduced-motion`: disable nonessential animations and shorten durations.

Acceptance: Smooth 30s tick without jank on mobile; controls are usable via keyboard and screen readers.

## 9) Documentation & Examples

Status: Completed

- README updated with a “Today: Date & Real‑Time” section covering the live clock, now‑line, date navigation, overlaps (+X), Up Next, buffers, and gap pills.
- README links to this Phase 6 plan (`docs/phase-6-action-plan.md`) similar to Phase 5.
- Added `docs/overdue-policy.md` with a brief explanation of the visual‑only overdue policy.

## 10) Files Touched (recap)

Status: Completed

- Time helpers and ticker
  - `src/lib/time.ts` — todayISO/now helpers extended and tested.
  - `src/lib/utils/useNowTick.ts` (+ test) — lightweight ticker with hidden‑tab pause.
- Timeline utilities
  - `src/lib/timeline/lanes.ts` (+ test) — responsive lane assignment for overlaps.
  - `src/lib/timeline/gaps.ts` (+ test) — gap detection (merged intervals, min threshold).
- Today page and components
  - `src/app/today/page.tsx` — header (clock, date nav), auto‑open modal on prefill.
  - `src/components/today/Timeline.tsx` — now‑line, overdue visuals, overlaps with +X, buffers, gap pills, perf memos.
  - `src/components/today/UpNextStrip.tsx` — Up Next strip with Start and “Can’t do” menu.
- Store
  - `src/store/useAppStore.ts` — `computeUpNext`, local todayISO, and misc wiring.
- Tests (UI)
  - `src/app/today/today.ui.test.tsx` — header/clock/date nav/now‑line.
  - `src/components/today/Timeline.overdue.ui.test.tsx` — overdue visuals.
  - `src/components/today/Timeline.overlaps.ui.test.tsx` — lane caps + +X.
  - `src/components/today/Timeline.buffers.ui.test.tsx` — anchor buffers.
  - `src/components/today/Timeline.gaps.ui.test.tsx` — gap pill affordance.
  - `src/components/today/TaskList.ui.test.tsx` — existing actions.
- Docs
  - `README.md` — “Today: Date & Real‑Time” section.
  - `docs/overdue-policy.md` — visual‑only overdue policy.

Notes
- OverlapBadge and GapPill were implemented inline in `Timeline` for simplicity; can be factored later if needed.
- Recurrence editor work is planned under Phase 12 and out of scope for Phase 6.

## 11) Acceptance Checklist (from Blueprint)

- [x] Header shows current date + live clock; Today recenters and resets to today.
  - Verified in `src/app/today/today.ui.test.tsx` (live clock tick and recenter behavior).
- [x] Prev/Next (swipe deferred) update `currentDate` and re-render Today; now‑line only on today.
  - Prev/Next + date input covered by tests; mobile swipe reserved for a follow‑up phase.
- [x] Native date input updates `currentDate`; keyboard accessible; respects locale.
- [x] Mandatory overdue blocks render red and visually re‑seat at current time (no data mutation); skippable overdue grayed.
  - Verified in `src/components/today/Timeline.overdue.ui.test.tsx`.
- [x] Overlapping blocks never cover; extra beyond lane capacity shows “+X more”.
  - Verified in `src/components/today/Timeline.overlaps.ui.test.tsx` (2 lanes mobile, 3 lanes desktop).
- [x] Up Next strip shows exactly one next step with Start / Can’t do.
  - Verified in `src/components/today/UpNextStrip.ui.test.tsx`.
- [x] Small buffers around anchors visible; per‑task override supported.
  - Verified in `src/components/today/Timeline.buffers.ui.test.tsx`.
- [x] Smart gap pill appears for gaps ≥ 5 min; opens quick action/modal.
  - Verified in `src/components/today/Timeline.gaps.ui.test.tsx` (pill appears; clicking sets prefill and initiates creation flow).
- [x] No visible layout jank during 30s tick; transforms animate smoothly or are disabled when `prefers-reduced-motion`.
  - Now‑line and time‑dependent visuals update without recomputing lanes; `useNowTick` pauses on hidden tabs.
- [x] All interactive elements have visible focus and meet minimum touch target sizes.
  - Buttons/badges/pills have focus-visible rings and accessible names.

## 12) Library — Recurrence Editor (Concurrent with Phase 6)

Status: In Progress

12.1 UI (Task modal):
Status: Completed
- Task modal updated (`src/components/library/TaskModal.tsx`):
  - Adds a Recurrence fieldset with `frequency` (`none`|`daily`|`weekly`|`monthly`|`yearly`), `interval`, `daysOfWeek` (weekly), `dayOfMonth` (monthly/yearly), `month` (yearly), and optional `startDate`/`endDate`.
  - On save, composes `recurrenceRule` when frequency != `none` (validation to be handled in 12.2).
  - No “custom” patterns in this phase.
- Library list summary (`src/app/library/page.tsx`):
  - Shows a compact recurrence summary (e.g., “Weekly · Mon/Fri”, “Daily · every 2 days”, “Ends 2025-06-30”).

12.2 Validation:
Status: Completed
- Uses `validateRecurrenceRule` from `src/lib/domain/scheduling/Recurrence.ts` in `src/components/library/TaskModal.tsx`.
- Inline recurrence errors render below the Recurrence fieldset with accessible `aria-describedby`/`aria-invalid` wiring.
- Save is disabled while invalid (including recurrence validation); submit still guards as a fallback.

12.3 Persistence:
Status: Completed
- Persisted `recurrenceRule` on templates via existing CRUD in `src/lib/data/templates.ts`:
  - `createTemplate` and `updateTemplate` pass through `recurrenceRule` when present; `duplicateTemplate` copies it.
  - `listTemplates` returns templates including any stored `recurrenceRule`.
- Offline support enabled via Firestore persistence:
  - `ensureFirestorePersistence()` in `src/lib/firebase/client.ts` uses multi‑tab IndexedDB persistence with single‑tab fallback.
  - Called on app start in `src/components/providers/FirebaseClientProvider.tsx` before auth and data flows.

12.4 Series scope (edits):
Status: Completed
- Implemented via existing `ScopeDialog` in `src/components/ui/ScopeDialog.tsx` and wired in `src/app/library/page.tsx`:
  - Only this: creates a per-date override for the selected date. Currently supports time changes for fixed-time tasks via `setInstanceStartTime(date, templateId, HH:MM)` and optional status override (`completed`, `skipped`, `postponed`, or revert to `pending`).
  - This and future: splits the series by setting `endDate` on the existing template to the day before the target date, then creates a new template starting at the target date with the edited fields.
  - All: applies the edit to the entire series with a normal template update.
Evidence:
- `src/app/library/page.tsx`: detects recurrence-affecting edits, opens `ScopeDialog`, and handles the three scopes in `handleScopeSelect`.
- `src/components/ui/ScopeDialog.tsx`: presents the scope choices and optional status override.

12.5 Tests:
Status: Completed
- Recurrence pattern logic is covered by `src/lib/domain/scheduling/Recurrence.test.ts`.
- Added UI tests:
  - `src/app/library/recurrence.ui.test.tsx` verifies:
    - Recurrence summary text renders for a weekly template (e.g., “Weekly · Mon/Fri”).
    - Editing a recurring fixed-time task with a time change opens the Scope dialog (Only this / This and future / All).

Acceptance (DoD):
- [x] User can create and edit recurring tasks (daily/weekly/monthly/yearly) with intervals and date fences.
- [x] Scheduler respects occurrences for the selected date (already implemented in engine).
- [x] Editing a recurring task triggers Scope dialog when changes affect recurrence.
- [x] “Only this” supports time change for fixed tasks and optional per-date status override.

## 13) UX & Interaction Tweaks (Deferred)

Status: Completed

13.1 Up Next selection rules
Status: Completed
- Deterministic tie-breakers implemented in `src/store/useAppStore.ts` `computeUpNext`:
  - Priority ↓ (higher first)
  - Prefer tasks that fit remaining window time; when time is tight, shorter duration first
  - Dependency-ready only (already filtered)
  - Earliest upcoming start within the current window (based on generated schedule)
  - Stable fallback by name/id
- Exclusions: skipped/postponed/completed instances for the current date are excluded from automatic suggestions.
Evidence:
- Unit tests `src/store/upNext.tiebreakers.test.ts` verify priority, tight-time duration preference, exclusions, and earliest upcoming start tie-breakers.

13.2 Overdue micro‑actions (inline)
Status: Completed
- Mandatory overdue blocks show inline actions on hover/focus:
  - “Start now” sets the instance start time to current time via `setInstanceStartTime(date, templateId, now)`.
  - “Mark done” completes the instance via `toggleComplete(date, templateId)`.
- Accessibility and motion:
  - Buttons are focusable with visible focus rings; appear with opacity transitions disabled when `prefers-reduced-motion` is set.
- Implementation: `src/components/today/Timeline.tsx` renders the actions inside overdue mandatory blocks.
- Tests: `src/components/today/Timeline.overdue.actions.ui.test.tsx` covers both actions (start time set to now; completion without modals).

13.3 Mobile gesture safe zone
Status: Completed
- Swipe-only zone added in Today header area (mobile):
  - `src/app/today/page.tsx` renders a 48px-high strip (`h-12`) just under the “Up Next” area with `aria-label` “Swipe left or right to change date”.
  - Handles touch and pointer events; detects horizontal swipes and calls `setCurrentDate` to Prev/Next. Ignores vertical gestures to avoid conflicts.
  - Timeline keeps vertical scroll and drag uninterrupted (no swipe handlers attached to the timeline container).
- Touch target sizing: the swipe zone is ≥44px (48px used) to meet guidance.
- Tests: `src/app/today/today.swipe.ui.test.tsx` verifies left/right swipe changes date, vertical gestures do nothing, and gestures on the timeline do not change the date.

13.4 +X badge accessibility & discoverability
Status: Completed
- +X badge is compact and interactive:
  - Focusable button with visible focus ring.
  - Descriptive `aria-label` includes time range (e.g., “+2 more between 09:30–10:30”).
  - Keyboard support: Enter/Space toggles; Escape closes.
- Popover (inline list):
  - Clicking the badge opens a small popover listing hidden items in time order, with their labels and time ranges.
  - Accessible via `role="dialog"` and labeled; closes on outside click or Escape.
- Implementation: `src/components/today/Timeline.tsx` renders badges with `data-testid="more-badge"`, a11y attributes, and optional popover.
- Tests: `src/components/today/Timeline.overlaps.ui.test.tsx` updated to verify badge presence, accessibility attributes, and popover open/close.

13.5 Performance guardrails
Status: Completed
- Debounced lane recompute on media breakpoint changes (resize):
  - `Timeline` debounces the `(min-width: 768px)` matchMedia handler (100ms) to avoid churn during window resizes.
- Memoized lane calculation from base geometry:
  - Lane assignment and +X badge computation are memoized from `baseBlocks` + `laneCap`, so 30s ticker updates (now‑line/overdue) do not recompute lanes.
- Motion via transforms:
  - Overdue re‑seat uses `transform: translateY(...)`; base geometry remains static (top/left only for initial layout), avoiding layout thrash.
- Scroll work remains minimal:
  - Auto‑center to now runs on date/now changes only and uses smooth scroll; no per‑scroll computation to throttle at this stage.

13.6 Color‑independent meaning
Status: Completed
- Timeline blocks include non‑color semantics:
  - Small inline badges: “M” for Mandatory, “Fixed” for fixed‑time, and “Flex” for flexible tasks.
  - aria-labels include the semantic type: “mandatory”, “fixed”, or “flexible” (and “overdue” when applicable).
  - Title attribute includes the semantic type, e.g., “Breakfast — 08:30–09:00 (fixed)”.
- Contrast: badges use `bg-white/85 text-black` over colored blocks to maintain AA contrast in both themes.
- Implementation: `src/components/today/Timeline.tsx` (badges + aria/ title semantics).
- Tests: `src/components/today/Timeline.meaning.ui.test.tsx` verifies ARIA semantics for mandatory/fixed/flexible and presence of visual badges.

Acceptance (DoD):
- [x] Up Next consistently picks a predictable item per rules; skipped/postponed are not suggested automatically.
- [x] Mandatory overdue blocks expose inline actions on hover/focus; actions work without modals and respect reduced motion.
- [x] Date swipe gesture does not interfere with timeline scroll/drag on mobile; tap targets meet size guidance.
- [x] +X badges are focusable, labeled (including time range), and optional popover (if enabled) is keyboard accessible.
- [x] Resize and frequent updates remain smooth (no visible jank) due to debounced/transform‑based updates.
- [x] Mandatory/fixed/flexible meaning is conveyed without color alone.

Tests:
- Unit: Up Next selector tie‑breakers and exclusions; reduced‑motion branch for transform animations.
- UI: Keyboard focus on +X badge; `aria-label` correctness; optional popover open/close (desktop); basic mobile swipe safe‑zone behavior (as feasible).

---

Notes:
- Keep mutations minimal in this phase (visual adjustments only); defer schedule algorithm changes until later phases.
- Favor simple, predictable visuals over complex interactions; keep mobile in mind.
- Keep PRs small: (1) time utils + ticker + header clock; (2) now‑line + overdue; (3) lanes + +X badges; (4) Up Next + inline actions; (5) buffers + gap pills; (6) docs.
