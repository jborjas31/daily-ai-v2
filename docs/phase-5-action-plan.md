# Phase 5 — Library & Search (Action Plan)

Scope: Improve the Library view with fast client-side search, combined filters, a priority sort toggle, clear categorization, and a dependency indicator. Keep changes incremental, testable, and accessible.

## 0) Preconditions

Status: Completed

1. Testing Library + jsdom are installed and configured.
   - Evidence:
     - Dev deps include `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jsdom` (see `package.json`).
     - `vitest.config.ts` sets `environment: 'node'` and `environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]]` for component tests.
     - Test suite runs clean (see CI and local run) and includes jsdom-based tests (`src/components/today/TaskList.ui.test.tsx`).
2. Library page renders Active and Deleted/Inactive sections.
   - Evidence: `src/app/library/page.tsx` renders two sections labeled “Active” and “Deleted / Inactive”, listing templates by `isActive`.
3. Store exposes `templates` and basic `filters`.
   - Evidence: `src/store/useAppStore.ts` exports `templates` array and `filters` slice with `{ search: '', schedulingType: 'all' }`.


## 1) Store: Extend Filters API

Status: Completed

1.1 Types added in `src/store/useAppStore.ts`.
- `type SortMode = 'name' | 'priority'`.
- `type MandatoryFilter = 'all' | 'mandatory' | 'skippable'`.
- `FiltersState` extended with `sortMode`, `mandatory`, and `timeWindows: Set<TimeWindow>`.

1.2 Defaults extended in `filters` slice.
- `search: ''`, `schedulingType: 'all'` (existing)
- `sortMode: 'name'`
- `mandatory: 'all'`
- `timeWindows: new Set()` (empty = all)

1.3 Actions added.
- `setFilterSearch(search: string)`
- `setFilterSortMode(mode: SortMode)`
- `setFilterMandatory(v: MandatoryFilter)`
- `toggleFilterTimeWindow(win: TimeWindow)` (clones Set for reactivity)
- `resetFilters()` (resets all filter fields to defaults)

1.4 Notes
- All logic is synchronous and does not hit Firestore.
- `resetAfterSignOut()` also resets new filter fields.

Acceptance: New filter state and actions are available without changing existing selectors.

## 2) Pure Utils: Filtering + Sorting

2.1 Create `src/lib/templates/filtering.ts`.
Status: Completed
- Implemented pure helpers:
  - `normalize(s: string)` — lowercase + trim.
  - `matchesQuery(t, q)` — name + description search.
  - `filterByMandatory(t, f)` — all/mandatory/skippable.
  - `filterByTimeWindows(t, wins)` — empty allows all; fixed always allowed; flexible matches selected windows.
  - `filterTemplates(templates, opts)` — composes query + mandatory + windows.
  - `sortTemplates(templates, mode)` — stable; `name` A→Z; `priority` High→Low then name A→Z.

2.2 Add tests `src/lib/templates/filtering.test.ts` covering:
Status: Completed
- Added `src/lib/templates/filtering.test.ts` with 5 tests:
  - Query matches name and description (case-insensitive).
  - Mandatory vs Skippable filter behavior.
  - Time window filter applies to flexible; fixed always allowed.
  - Sort by Name A→Z (stable for equal names after normalization).
  - Sort by Priority High→Low with Name tiebreaker and stability.

Acceptance: Tests pass locally; helpers remain pure and framework-agnostic.

## 3) Library UI: Search, Filters, Sort

3.1 Add a small debounce hook `src/lib/utils/useDebouncedValue.ts`.
Status: Completed
- Added `src/lib/utils/useDebouncedValue.ts`.
- Signature: `useDebouncedValue<T>(value: T, delayMs = 250)` returns a debounced value using `setTimeout` in an effect; cleans up on change/unmount.
- No tests added (kept simple as planned).

3.2 Add Search input at top of Library (`src/app/library/page.tsx`).
Status: Completed
- Added a labeled search field with debounce in `src/app/library/page.tsx`.
- Controlled input `searchDraft`; updates store via `useDebouncedValue(..., 250ms)` and `setFilterSearch`.
- Clear button (✕) resets both the draft and store filter; includes `aria-label` and `title`.
- Label present: `<label htmlFor="librarySearch">Search</label>`.

3.3 Add Sort toggle (button group).
Status: Completed
- Added Sort toggle to `src/app/library/page.tsx` with two options: Name A–Z and Priority High→Low.
- Reflects and updates store via `filters.sortMode` and `setFilterSortMode`.
- Uses an accessible button group with `aria-pressed` and titles for clarity.

3.4 Add Mandatory filter group.
Status: Completed
- Added a Mandatory toggle group (All, Mandatory, Skippable) to `src/app/library/page.tsx`.
- Reflects current selection from `filters.mandatory` and updates via `setFilterMandatory`.
- Accessible group with `aria-pressed` and button titles.

3.5 Add Time Window chips (multi-select).
Status: Completed
- Added multi-select chips (Morning, Afternoon, Evening, Anytime) to the Library toolbar.
- Reads selection from `filters.timeWindows` (Set) and toggles via `toggleFilterTimeWindow`.
- Uses `aria-pressed` for state and pill-style buttons for clarity.

3.6 Compose filtered, sorted arrays.
Status: Completed
- Composed via pure helpers in `src/app/library/page.tsx`:
  - `filteredSorted = sortTemplates(filterTemplates(templates, { query: search, mandatory, timeWindows }), sortMode)`
  - Derived `active` and `inactive` from `filteredSorted` by `isActive`.
- Counts in section headers now reflect filtered lists.

3.7 Add Reset Filters button.
Status: Completed
- Added a "Reset Filters" button in the toolbar (right side) that calls `resetFilters()` and clears `searchDraft` so the input UI resets.
- Styled as a neutral action; includes a `title` for clarity.

3.8 Keep all controls keyboard-accessible (native inputs/buttons) and readable in dark mode.
Status: Completed
- Ensured all toolbar buttons (Sort, Mandatory, Time window, Clear, Reset) have visible keyboard focus via `focus-visible:ring` classes and remain native buttons.
- All controls have labels or `aria-label`/`title` where appropriate; groups have `role="group"` and `aria-label`.
- Styles include dark mode classes for readability (`dark:bg-*`, text remains legible on both themes).

Acceptance:
- Typing filters results after debounce (≈200–300ms). Clearing search restores full list.
- Changing filters updates lists immediately. Sort toggle works predictably.

## 4) Dependency Indicator

4.1 Compute dependency status per template.
Status: Completed
- Added `src/lib/templates/dependencies.ts` with pure helpers:
  - `buildById(templates)` — returns `Map<string, TaskTemplate>`.
  - `getDependencyStatus(template, byId)` — returns `null` if no dependency, else `{ status: 'ok'|'disabled'|'missing', dependsOnId, dependsOnName? }` following the rules:
    - Missing in `byId` → `missing`.
    - Present but `isActive === false` → `disabled`.
    - Otherwise → `ok`.
Acceptance: Utility functions are framework-agnostic and ready for UI use.

4.2 Render indicator in each list item.
Status: Completed
- Implemented dependency badge in `src/app/library/page.tsx` for both Active and Inactive lists.
- Text: `Depends on <Name>`; when name unknown, shows `<ID>` (missing case).
- Colors: ok → neutral (slate), disabled → amber, missing → rose.
- Tooltip/title: “Prerequisite disabled” and “Prerequisite missing” where applicable; “Prerequisite available” for ok.
- Uses `buildById` + `getDependencyStatus` from `src/lib/templates/dependencies.ts` memoized via `useMemo`.

4.3 Optional: cycle guard.
Status: Completed
- Added cycle detection to `getDependencyStatus` in `src/lib/templates/dependencies.ts`.
  - Detects self-cycle (`t.dependsOn === t.id`).
  - Detects trivial 2-node cycles (`A.dependsOn === B.id` and `B.dependsOn === A.id`).
- `DependencyStatus` union extended to include `'cycle'`.
- Library UI shows a rose badge labeled “Cycle” with title “Dependency cycle” when detected.

4.4 Tests (UI or unit-level):
Status: Completed
- Added `src/lib/templates/dependencies.test.ts` with unit tests for `getDependencyStatus` covering:
  - ok (prerequisite exists and active)
  - disabled (prerequisite inactive)
  - missing (prerequisite id not found)
  - cycle (self and two-node cycles)

Acceptance: A visible dependency badge/line is shown whenever `dependsOn` exists, with a clear status hint if not satisfied.

## 5) Category Sections (Keep minimal; optional expansions)

5.1 Keep existing sections: Active and Deleted/Inactive (already present).
Status: Completed
- Evidence: `src/app/library/page.tsx` renders two sections titled “Active” and “Deleted / Inactive”, each showing filtered counts and lists based on `isActive`.

5.2 Optional (behind a flag or follow-up): “Recently modified”.
Status: Completed
- Added `updatedAt` to template writes (server timestamp) in `src/lib/data/templates.ts` for `createTemplate`, `updateTemplate`, `duplicateTemplate`, and `softDeleteTemplate`.
  - Uses Firestore `serverTimestamp()` on persistence; returns a local `Date.now()` value for immediate UI feedback on create/duplicate.
- Updated `TaskTemplate` type to include optional `updatedAt` metadata (`src/lib/types/index.ts`).
- Library UI renders a compact “Recently Modified” section above the main grid (`src/app/library/page.tsx`).
  - Shows top 5 by `updatedAt` (newest first); hides section if no items have `updatedAt`.
  - Gracefully handles Firestore Timestamp, epoch numbers, or absence of the field.

5.3 Optional (future backlog): Instance-based rollups (Skipped/Completed/Overdue) belong to Today/Reports rather than Library; if added, show counts only, not lists.
Status: Completed (counts-only on Today)
- Added a small counts rollup on the Today page (`src/app/today/page.tsx`).
  - Shows Completed, Skipped, and Overdue counts for the current date.
  - Overdue computed from the generated schedule: blocks with start time before “now” whose instance is not completed or skipped (only for actual today).
  - Purely a summary (no lists), aligned with the guidance to keep details in Today/Reports rather than Library.

Acceptance: Minimal categorization remains; optional sections gated and safe when metadata absent.

## 6) UI Tests (jsdom) and Unit Tests

6.1 Unit tests (utils) — see §2.2.
Status: Completed
- Utils tests in place and passing:
  - `src/lib/templates/filtering.test.ts` — query, mandatory/skippable, time windows, sort by name and priority.
  - `src/lib/templates/dependencies.test.ts` — ok, disabled, missing, and cycle detection.

6.2 UI tests `src/app/library/library.ui.test.tsx`:
Status: Completed
- Renders a small set of templates.
- Search: type a substring; advance timers; only matches remain.
- Mandatory filter: switch to Mandatory; only mandatory templates remain.
- Time windows: toggle Morning; only flexible morning templates remain; fixed templates are not excluded by window filter per spec.
- Sort: switch to Priority; verify ordering (desc priority, then name).
- Reset filters restores full list.
- Dependency badges show correct status for ok/missing/disabled.

6.3 Advance debounce window in tests.
Status: Completed
- Implemented in `src/app/library/library.ui.test.tsx` using real timers with `await new Promise(r => setTimeout(r, 300))` to avoid interference with async effects.
- Note: If desired, `vi.useFakeTimers()` can also be used when no component async effects depend on real timers.
- Added `enableMapSet()` from Immer in the test to support Set mutations in the store during time-window toggling.

Acceptance: All tests pass; behaviors match acceptance criteria.

## 7) Polish & Docs

7.1 Performance: memoize filtered/sorted arrays with `useMemo` on relevant deps; avoid recomputing per keystroke beyond debounce.
Status: Completed
- `src/app/library/page.tsx` memoizes derived data:
  - `filteredSorted = useMemo(() => sortTemplates(filterTemplates(...)), [templates, search, mandatory, timeWindows, sortMode])`.
  - `active`, `inactive`, `byId`, and `recent` are also `useMemo`-computed.
- Search input updates store `filters.search` only via a 250ms debounced value, preventing recomputation on every keystroke.

7.2 A11y: ensure all controls have labels/aria; maintain color contrast in badges.
Status: Completed
- `src/app/library/page.tsx` updates:
  - Labeled control groups with `aria-labelledby` using stable ids from `useId()` (Sort, Mandatory, Time window).
  - Search input already labeled via `<label htmlFor="librarySearch">`.
  - Dependency badges include descriptive `title`, and the “Cycle” badge now has `aria-label="Dependency cycle"`.
  - Button groups maintain `aria-pressed` states and clear button text labels; Reset button has a descriptive name.
- Badge colors use high-contrast pairs (e.g., `rose-200`/`rose-900`, `amber-200`/`amber-900`, dark-mode `*-800`/`*-100`).

7.3 Copy: keep labels concise (Search, Sort, Filters, Reset).
Status: Completed
- Toolbar labels are succinct and consistent in `src/app/library/page.tsx`:
  - Search input labeled “Search”.
  - Sort group labeled “Sort” with options “Name A–Z” and “Priority High→Low”.
  - Filters use short labels: “Mandatory” and “Time window”.
  - Reset button labeled “Reset Filters”.
- Button titles/aria are short and descriptive where applicable.

7.4 README/docs: add a short “Library Search & Filters” section in `README.md` and link to this plan.
Status: Completed
- Added a new section “Library Search & Filters” to `README.md` describing:
  - Debounced search (250ms) over name/description
  - Combined filters (Mandatory, Time window) with fixed‑time exception
  - Sort toggle (Name A–Z, Priority High→Low)
  - Reset filters and dependency badges
  - Recently Modified rollup
- Included a direct reference to `docs/phase-5-action-plan.md` from README.

7.5 MIGRATION_STATUS: add a Phase 5 progress section as items complete.
Status: Completed
- Added a "Phase 5 — Library & Search (Progress)" section to `docs/MIGRATION_STATUS.md` summarizing completed items (filters, utils/tests, UI controls, dependency badges, categories, UI tests, performance, a11y, README docs).

## 8) Files to Touch (expected)
Status: Completed
- `src/store/useAppStore.ts` — filters slice extended; actions added (`setFilterSearch`, `setFilterSortMode`, `setFilterMandatory`, `toggleFilterTimeWindow`, `resetFilters`).
- `src/lib/templates/filtering.ts` — filtering/sorting utils implemented with unit tests in `src/lib/templates/filtering.test.ts`.
- `src/lib/utils/useDebouncedValue.ts` — debounce hook added and used by Library search.
- `src/app/library/page.tsx` — search/filters/sort controls, dependency badges, memoized lists, a11y labels.
- `src/app/library/library.ui.test.tsx` — UI tests for search, filters, sort, dependency badges.
- `README.md` — “Library Search & Filters” section added and linked.

## 9) Acceptance Checklist (from Blueprint)

- [x] Typing in search filters results live (name + description) with debounce (~200–300ms).
- [x] Filters combine predictably; clearing filters restores full list.
- [x] Dependency badge/line visible where `dependsOn` exists; status hints when prerequisite not satisfied.
- [x] Priority sort toggle works and is obvious.

---

Notes:
- Keep all changes client-only; no Firestore reads/writes for filters/search.
- Favor minimal styling aligned with current Tailwind classes; re-use existing section structure.
- Keep PRs small: (1) utils + tests, (2) store filters, (3) Library UI, (4) badges + tests, (5) docs.
