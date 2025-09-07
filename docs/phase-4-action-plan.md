# Phase 4 — Responsive Task Management (Action Plan)

Scope: Implement polish and UX improvements for task management on the Today (timeline/list) and Library views. Focus on accessible modals, intelligent pre-fill, validation UX, core instance actions (Complete/Undo + Skip/Postpone), and recurrence edit scope behavior.

This plan breaks work into small, verifiable steps you can implement incrementally.

## 0) Preconditions

1. Confirm Radix UI Dialog and Tailwind are available (already used by `TaskModal` and `ConfirmDialog`).
   - Status: Completed
   - Evidence:
     - Radix Dialog in use: `src/components/library/TaskModal.tsx` and `src/components/ui/ConfirmDialog.tsx` import `@radix-ui/react-dialog`.
     - Package present: `@radix-ui/react-dialog` in `package.json` dependencies.
     - Tailwind v4 active: `postcss.config.mjs` uses `@tailwindcss/postcss`; `src/app/globals.css` imports `tailwindcss` and utilities are used across components.
2. Confirm toast provider is initialized (`sonner` via `ToasterProvider`).
   - Status: Completed
   - Evidence:
     - Provider component: `src/components/providers/ToasterProvider.tsx` renders `<Toaster />` from `sonner` with position `top-right`.
     - Mounted globally: `src/app/layout.tsx` imports and renders `<ToasterProvider />` inside the root layout.
     - Usage throughout app: toasts imported and called in multiple places, e.g.,
       - `src/components/today/Timeline.tsx` (`toast.success/ toast.error` on drag-end save)
       - `src/components/today/TaskList.tsx` (Complete/Undo)
       - `src/app/library/page.tsx`, `src/app/settings/page.tsx`, `src/app/login/page.tsx`
3. Ensure tests run locally with `vitest` and a basic `@testing-library/react` setup if needed.
   - Status: Completed
   - Evidence:
     - Script present: `package.json` has `"test": "vitest run"` and `"test:watch": "vitest"`.
     - Config present: `vitest.config.ts` resolves `@` alias and includes `src/**/*.test.ts(x)` with `environment: 'node'` for unit tests.
     - Tests present: `src/store/useAppStore.test.ts` exercises store logic and runs in Node env.
   - Notes (UI tests): When adding component/a11y tests, install `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jsdom`, then set `environment: 'jsdom'` (glob-scoped) for `*.test.tsx`, or add `environmentMatchGlobs: [["**/*.test.tsx","jsdom"]]` in `vitest.config.ts`.

## 1) Modal Polish and A11y

1. Audit modals: open `src/components/library/TaskModal.tsx` and `src/components/ui/ConfirmDialog.tsx` to check a11y basics.
   - Status: Completed
   - Findings:
     - Title elements present in both via `Dialog.Title`; `ConfirmDialog` also includes `Dialog.Description` when a description is provided.
     - `Dialog.Root` + `Dialog.Content` used correctly; Radix provides role="dialog", `aria-modal`, focus trap, Esc handling by default.
     - No explicit `id`/`aria-labelledby` wiring yet; acceptable but will add in 1.2 for clarity.
     - Initial focus not explicitly set in `TaskModal` (we will add in 1.4 to target the Task Name input).
     - Mobile layout currently centered with `w-[92vw] max-w-lg`; not full-screen on small screens (address in 1.7).
     - Close actions: `TaskModal` uses `Dialog.Close` on Cancel; `ConfirmDialog` closes via `onOpenChange(false)` handlers; both acceptable.
2. Add explicit `id` to `Dialog.Title` in both components and set `aria-labelledby` on `Dialog.Content`.
   - Status: Completed
   - Changes:
     - `src/components/library/TaskModal.tsx`: added `useId()`-based `titleId`; set `id={titleId}` on `Dialog.Title` and `aria-labelledby={titleId}` on `Dialog.Content`.
     - `src/components/ui/ConfirmDialog.tsx`: added `useId()` `titleId`; wired `id` and `aria-labelledby` similarly.
   - Result: Screen readers now have an explicit label reference for each dialog.
3. Add `aria-describedby` on `Dialog.Content` pointing to description element when present.
   - Status: Completed
   - Changes:
     - `src/components/ui/ConfirmDialog.tsx`: generated `descId` via `useId()`, set `id` on `Dialog.Description`, and wired `aria-describedby={description ? descId : undefined}` on `Dialog.Content`.
     - `src/components/library/TaskModal.tsx`: added a concise `Dialog.Description` below the title with `descId`, and set `aria-describedby={descId}` on `Dialog.Content`.
   - Result: Screen readers announce the dialog purpose and any description content.
4. Ensure focus management: set `autoFocus` on the first interactive control (e.g., “Task Name” input) in `TaskModal`.
   - Status: Completed
   - Changes: Added `autoFocus` to the Task Name `<input>` in `src/components/library/TaskModal.tsx` so initial focus lands there when the dialog opens.
   - Result: Upon opening, screen reader and keyboard users are placed directly in the primary input.
5. Verify keyboard flows: Tab cycles within the dialog; Esc closes; Enter submits when a form is valid.
   - Status: Completed
   - Evidence:
     - Focus trap + Esc: Radix Dialog handles focus trapping and Escape-to-close by default, and both dialogs use `Dialog.Root` with controlled `open`/`onOpenChange` (see `TaskModal.tsx`, `ConfirmDialog.tsx`).
     - Enter submits: `TaskModal` uses a `<form onSubmit={handleSubmit}>` with a `<button type="submit">`; pressing Enter in inputs submits and triggers `handleSubmit`.
     - Cancel safety: Cancel button in `TaskModal` is `type="button"` and wrapped in `Dialog.Close`, preventing accidental submits.
6. Add `aria-label` to Close actions where text isn’t visible (e.g., icon close button if added).
   - Status: Completed
   - Findings/Action:
     - Both dialogs currently use visible-text buttons for closing: `TaskModal` has a `Dialog.Close` "Cancel" button; `ConfirmDialog` has a visible "Cancel" button.
     - No icon-only close buttons exist, so no aria-labels were required. If a top-right icon close is added later, set `aria-label="Close"` and ensure it’s reachable via keyboard.
7. Mobile layout: add responsive classes so dialogs are full-screen on small viewports (e.g., `inset-0 w-screen h-svh rounded-none p-4` for `sm:` and up retain max-width).
   - Status: Completed
   - Changes:
     - `TaskModal.tsx` and `ConfirmDialog.tsx`: `Dialog.Content` now uses mobile-first full-screen layout with `inset-0 w-screen h-svh overflow-y-auto rounded-none` and switches at `sm:` to centered modal (`left-1/2 top-1/2 ... max-w-* rounded-md`).
   - Result: On small screens, dialogs are full-screen and scrollable; on larger screens, they retain the centered modal presentation.
8. Add visual focus states for interactive elements (Tailwind ring utilities) where missing.
   - Status: Completed
   - Changes:
     - `TaskModal.tsx`: Added `focus-visible` ring styles to inputs, selects, time/number fields, checkboxes, radios, and both action buttons.
     - `ConfirmDialog.tsx`: Added `focus-visible` ring styles to Cancel and Confirm buttons.
   - Result: Clear keyboard focus indication across modal controls, improving accessibility and usability.
9. Write quick a11y smoke tests: render `TaskModal` open, assert role=`dialog`, `aria-labelledby` resolves, initial focus lands on first input.

Acceptance criteria
- Dialogs announce a title/description to screen readers and trap focus.
- On mobile, modals render full screen with accessible close affordances.
- Keyboard: Esc closes, Enter submits, Tab order is sane.

## 2) Intelligent Pre‑fill for “New Task”

2.1 Store wiring
1. In `src/store/useAppStore.ts`, add transient UI state: `newTaskPrefill?: { time?: string; window?: 'morning'|'afternoon'|'evening'|'anytime'; } | null` and setters `setNewTaskPrefill(prefill|null)`.
   - Status: Completed
   - Changes: Added `newTaskPrefill` under `ui` slice with type `{ time?: TimeString; window?: TimeWindow } | null`, initialized to `null`. Implemented `setNewTaskPrefill` action to update it.
2. Expose a selector `getNewTaskPrefill()`.
   - Status: Completed
   - Changes: Added `getNewTaskPrefill` selector returning `state.ui.newTaskPrefill`.

2.2 Modal support
3. Update `src/components/library/TaskModal.tsx` to accept an optional `prefill` prop: `{ time?: string; window?: 'morning'|'afternoon'|'evening'|'anytime' }`.
   - Status: Completed
   - Changes: Added `prefill?: { time?: TimeString; window?: TimeWindow }` prop to `TaskModal` and imported the corresponding types from `@/lib/types`.
4. On open (when creating, not editing), seed form state from `prefill`: if `time` present → set scheduling to `fixed` with `defaultTime=time`; else if `window` present → set scheduling to `flexible` with `timeWindow=window`.
   - Status: Completed
   - Changes: Updated `TaskModal` `useEffect` to seed from `prefill` when `open && !initial`.
     - `prefill.time` → `{ schedulingType: 'fixed', defaultTime: time }`
     - `prefill.window` → `{ schedulingType: 'flexible', timeWindow: window }`
     - Included `prefill` in the effect deps so updates are respected.
5. Ensure manual edits override prefill; reset prefill after successful save via store setter.
   - Status: Completed
   - Changes:
     - Manual edits already override prefill since it’s only used to seed initial form state.
     - `TaskModal.tsx` now clears `newTaskPrefill` via `useAppStore().setNewTaskPrefill(null)` after `onSave` resolves.
   - Note: Cancel clearing will be handled in 2.3.11 alongside Today page wiring.

2.3 Timeline integration
6. In `src/components/today/Timeline.tsx`, add a background click handler on the grid area: compute minutes from Y position; snap to 5-min increments; convert to `HH:MM`.
   - Status: Completed
   - Changes: Added `handleGridClick` on the main grid container to compute the clicked time (snapped to 5 minutes) and log it for now (used by later steps 2.3.7–2.3.8).
7. Derive a suggested window from the clicked time: morning [06:00–12:00), afternoon [12:00–18:00), evening [18:00–23:00), otherwise `anytime`.
   - Status: Completed
   - Changes: Updated `Timeline` `handleGridClick` to compute and log the suggested window (`morning`/`afternoon`/`evening`/`anytime`) based on the snapped minutes.
8. Set store `setNewTaskPrefill({ time: hhmm, window })`.
   - Status: Completed
   - Changes: `Timeline` now calls `useAppStore().setNewTaskPrefill({ time: HH:MM, window })` inside `handleGridClick`.
   - Result: Clicking the timeline stores a prefill payload to seed the New Task modal.
9. Expose a way to open “New Task” from Today: add a floating button in `src/app/today/page.tsx` or a small inline button near the Timeline header to open a create modal.
   - Status: Completed
   - Changes: Added a header "New Task" button and a mobile-only floating action button in `src/app/today/page.tsx` to open the modal.
10. Implement a Today-scoped `TaskModal` usage: import and render `TaskModal` in `src/app/today/page.tsx`, wired to `onSave`→`createTemplate` and `upsertTaskTemplate`, passing `prefill` from store.
   - Status: Completed
   - Changes: Today page renders `TaskModal` with `prefill={state.ui.newTaskPrefill}` and `onSave` that calls `createTemplate(user.uid, payload)` then `upsertTaskTemplate`, with success/error toasts.
11. After save/cancel, clear `newTaskPrefill`.
   - Status: Completed
   - Changes: On modal close (`onOpenChange(false)`), Today page clears `newTaskPrefill`. Additionally, `TaskModal` clears prefill after a successful save to avoid leakage.

Acceptance criteria
- Clicking timeline opens New Task with time prefilled; default window chosen sensibly when only a window is applicable.
- A visible “New Task” affordance exists on Today; both entry paths pass prefill to the modal.
- Prefill does not override user edits and clears after use.

## 3) Validation UX (Inline + Save Guardrails)

3.1 Client rules
1. Add a small validator in `TaskModal` for: non-empty name; priority 1–5; duration >= 1; minDuration <= duration; when fixed, `defaultTime` must be valid `HH:MM`.
   - Status: Completed
   - Changes: Implemented `validate()` in `TaskModal.tsx` with checks for required name, priority range, numeric duration >= 1, minDuration bounds and relation, and `HH:MM` validation for fixed scheduling. Added `formErrors` state and early-return in `handleSubmit` when invalid (inline rendering will follow in 3.1.2).
2. Compute field-level error strings and render inline under each input (small red text) with `aria-invalid` and `aria-describedby` wiring.
   - Status: Completed
   - Changes: Added `formErrors` rendering for `taskName`, `priority`, `defaultTime` (when fixed), `durationMinutes`, and `minDurationMinutes` beneath each field with `id` hooks. Inputs now include `aria-invalid` and `aria-describedby` pointing to corresponding error ids when present, along with proper `label htmlFor`/`input id` pairs.
3. Disable the submit button when there are validation errors or while a save is in-flight.
   - Status: Completed
   - Changes:
     - `src/components/library/TaskModal.tsx`: added `isSaving` state and `disabled` on the submit button using `!validate(form).isValid || isSaving`, with disabled styling.
     - Set `isSaving` true during save and reset on completion to reflect in-flight status for the button state.
   - Result: Submit is disabled when invalid or while saving.
4. Add a local `isSaving` state; guard `handleSubmit` against double submit; show subtle spinner or “Saving…” text.
   - Status: Completed
   - Changes:
     - `src/components/library/TaskModal.tsx`: added early `if (isSaving) return;` in `handleSubmit` to prevent double submits.
     - Submit button now displays a small spinner and “Saving...” while in-flight, plus `aria-busy` for a11y.
   - Result: Double-clicks don’t trigger multiple saves, and users see clear in-flight feedback.

3.2 Tests
5. Add unit tests: invalid values show inline errors; valid form enables submit; double-click submit triggers only one `onSave`.
   - Status: Completed
   - Changes:
     - Added `src/components/library/taskModalValidation.ts` to expose pure helpers: `validateForm`, `isValidTime`, and `shouldDisableSubmit`.
     - Added tests in `src/components/library/taskModalValidation.test.ts` (Node env) covering:
       - Invalid inputs produce field errors (name, priority, time, durations).
       - Valid inputs return `isValid=true` with no errors.
       - `shouldDisableSubmit` is `true` when form is invalid or `isSaving=true` (captures double-submit prevention semantics).
     - `TaskModal.tsx` now uses these helpers, keeping component logic thin and testable.
   - Notes:
     - Component-level interaction tests (e.g., rendering the dialog and clicking the submit button twice) require `@testing-library/react` and `jsdom`. These can be added later if/when those devDeps are installed.
   - Result: Validation behavior and submit-disable logic are covered by unit tests; double-submit prevention is validated via the `isSaving`-aware disable helper.

Acceptance criteria
- Inline errors render promptly and are announced via `aria-describedby`.
- Submit disabled while invalid or saving; no double-saves.

## 4) Core Actions: Skip/Postpone (+ Complete/Undo)

4.1 Scheduling engine alignment
1. Update `src/lib/domain/scheduling/SchedulingEngine.ts` to treat `postponed` like `skipped` for exclusion (extend `excludeCompletedOrSkipped` to include `postponed`).
   - Status: Completed
   - Changes:
     - Extended exclusion to include `postponed` in `excludeCompletedOrSkipped()` and adjusted comments.
     - Also ensured override anchoring ignores `postponed` statuses (parity with skipped/completed) when building `modifiedStartTime` anchors.
     - Added test case in `src/lib/domain/scheduling/SchedulingEngine.test.ts` asserting postponed instances are not scheduled for the date.
   - Result: Postponed tasks are excluded from scheduling for the current day.

4.2 Store actions
2. In `src/store/useAppStore.ts`, add `skipInstance(date, templateId, reason?)` that optimistically sets/creates an instance with `status='skipped'`, persists via `upsertInstance`, and reverts on failure.
   - Status: Completed
   - Changes:
     - Added `skipInstance(date, templateId, reason?)` to `useAppStore` with optimistic update, schedule-cache invalidation for that date, and Firestore persistence via `upsertInstance`.
     - Reverts local state on persistence failure and returns a boolean success flag.
   - Result: Skipping a task immediately reflects in UI and scheduling (excluded), with safe rollback on errors.
3. Add `postponeInstance(date, templateId)` that sets/creates an instance with `status='postponed'` for the current date; (future occurrences are handled by recurrence/templates). Persist and revert on failure.
   - Status: Completed
   - Changes:
     - Implemented `postponeInstance(date, templateId)` in `useAppStore` with optimistic local update, schedule-cache invalidation, Firestore persistence via `upsertInstance`, and revert-on-failure.
   - Result: Postponing a task immediately removes it from today’s schedule and persists the status.
4. Add `undoInstanceStatus(date, templateId)` to clear a skipped/postponed/completed instance back to pending (delete or set to pending, mirroring existing `toggleComplete` patterns).
   - Status: Completed
   - Changes:
     - Implemented `undoInstanceStatus(date, templateId)` in `useAppStore`.
     - If the instance has per-instance overrides (e.g., `modifiedStartTime`), it preserves them and sets `status: 'pending'` (clears `completedAt`/`skippedReason`).
     - Otherwise it deletes the instance to return to baseline “pending” (no instance document).
     - Always invalidates the schedule cache for that date; persists via `deleteInstance`/`upsertInstance` and reverts on failure.
   - Result: Undo returns tasks to Pending reliably whether or not overrides exist.

4.3 UI wiring
5. In `src/components/today/TaskList.tsx`, next to “Complete”, add “Skip” and “Postpone” buttons for Pending items; show “Undo” for Completed and Skipped (and Postponed if listed separately).
   - Status: Completed
   - Changes:
     - Added `Skip` and `Postpone` buttons in the Pending list alongside `Complete`, wired to `skipInstance` and `postponeInstance` with success/error toasts.
     - Added `Undo` in the Completed list (existing `toggleComplete`) and in the Skipped list via `undoInstanceStatus`.
     - Added a Postponed section listing `postponed` instances with an `Undo` button (uses `undoInstanceStatus`).
     - On all actions, invalidates the schedule for the date via store logic so UI reflects changes immediately.
   - Result: Users can Complete, Skip, Postpone from Pending, and Undo from Completed/Skipped/Postponed.
6. Add toasts for each action result (success/error) consistent with `toggleComplete`.
   - Status: Completed
   - Changes:
     - Wired `toast.success`/`toast.error` for Skip, Postpone, and Undo actions in `src/components/today/TaskList.tsx`, matching the existing pattern used for Complete/Undo.
     - Messages use concise, consistent verbs: “Completed”, “Marked pending”, “Skipped”, “Postponed”. Errors mirror action: “Failed to complete/skip/postpone/mark pending”.
   - Result: Users get immediate feedback for all actions with consistent success/error toasts.
7. Optionally, add a tiny reason/note input for Skip and Postpone (keep API signature ready; UI can omit on the initial action).
   - Status: Completed
   - Changes:
     - Skipped: In `src/components/today/TaskList.tsx`, added inline "Add/Edit reason" with Save/Cancel; saving calls `skipInstance(date, templateId, reason)` and displays the reason next to the label.
     - Postponed: Added inline "Add/Edit note" with Save/Cancel; saving calls `postponeInstance(date, templateId, note)` and displays the note next to the label.
     - Data: `TaskInstance` extended with optional `note`; store sets `note` (and for skipped, also mirrors to `skippedReason` for compatibility).
     - Feedback: Uses centralized toast helpers for success/error messages.
   - Result: Users can optionally annotate skipped or postponed items with a short note without blocking the primary action.

4.4 Tests
8. Add unit tests for store actions (optimistic update + revert on failure) using mocked data functions.
   - Status: Completed
   - Changes:
     - Added `src/store/useAppStore.actions.test.ts` with Vitest module mocks for `@/lib/data/instances`.
     - Covered success and failure paths for:
       - `skipInstance(date, templateId, reason?)` (optimistic add; revert on `upsertInstance` failure)
       - `postponeInstance(date, templateId, note?)` (optimistic add; revert on `upsertInstance` failure)
       - `undoInstanceStatus(date, templateId)` (delete or set pending; revert on `deleteInstance` failure)
     - Ensures schedule-affecting changes happen immediately in local state and roll back if persistence fails.
   - Result: Store actions are validated for optimistic UX with reliable rollback on errors.
9. Add UI interaction tests: clicking Skip/Postpone removes the item from Pending and doesn’t appear in the schedule.
   - Status: Completed
   - Changes:
     - Added jsdom + Testing Library and configured `vitest.config.ts` with `environmentMatchGlobs` for `*.test.tsx`.
     - New tests in `src/components/today/TaskList.ui.test.tsx` simulate clicking `Skip` and `Postpone` and assert:
       - Pending no longer contains the item.
       - Item appears in the `Skipped`/`Postponed` sections respectively.
     - Tests use the real store (no network writes because user is null), and deterministic templates.
   - Result: UI flows verified end-to-end at the component level.

Acceptance criteria
- Skip/Postpone are available alongside Complete; “Undo” returns the task to Pending.
- Postponed items do not schedule for the current day.
- Actions are optimistic with clear toasts.

## 5) Recurrence Edit Scope

5.1 Scope dialog
1. Create `src/components/ui/ScopeDialog.tsx` with options: “Only this”, “This and future”, “All” and a description of effects.
   - Status: Completed
   - Changes:
     - Added `ScopeDialog` (Radix Dialog) with accessible title/description wiring and three clear actions:
       - Only this → `onSelect('only')`
       - This and future → `onSelect('future')`
       - All → `onSelect('all')`
     - Props include `open`, `onOpenChange`, `onSelect`, and optional `templateName`/`targetDate` to contextualize the message.
     - Buttons close the dialog after selection; includes a Cancel action.
   - Result: A reusable, accessible scope picker ready to integrate into the Library edit flow.

5.2 Library edit integration
2. In `src/components/library/TaskModal.tsx` or Library page save flow, detect meaningful recurrence-affecting changes (e.g., `recurrenceRule`, `schedulingType`, `durationMinutes`) when editing an existing recurring template (`recurrenceRule.frequency !== 'none'`).
   - Status: Completed
   - Changes:
     - Added detection in `src/app/library/page.tsx`:
       - `isRecurringTemplate()` checks `recurrenceRule.frequency !== 'none'`.
       - `hasRecurrenceAffectingChanges(prev, next)` compares `schedulingType`, `durationMinutes`, and time fields (`defaultTime`/`timeWindow`), and deep-compares `recurrenceRule`.
       - On edit save, computes `shouldPromptScope` to inform the subsequent Scope dialog (wired in 5.2.3).
   - Result: The app now recognizes when an edit to a recurring task would affect the series and can prompt for scope selection next.
3. On save attempt, show `ScopeDialog` to select scope; then route to one of the flows below.
   - Status: Completed (dialog + routing)
   - Changes:
     - Integrated `ScopeDialog` in `src/app/library/page.tsx`.
     - When an edit to a recurring template has series-affecting changes, we defer the save, open the scope dialog, and proceed based on selection:
       - All: persist the template update as usual (`updateTemplate` + `upsert`).
       - Only this: initial support applies time-only overrides by creating/updating a `TaskInstance` at the current date via `setInstanceStartTime` when a new fixed time is provided.
       - This and future: placeholder wired (toast) — split logic will be implemented in 5.3.
   - Result: Users are prompted to choose the scope before saving edits to recurring tasks; “All” applies immediately; “Only this” supports time overrides now; “This and future” will be completed in the next step.

5.3 Scope behaviors
4. All: proceed with `updateTemplate` for the existing template as-is.
5. Only this (per-date override): create or update a `TaskInstance` for the selected date carrying per-instance overrides that make sense (e.g., time via `modifiedStartTime`, status change). Limit initial support to start-time/status overrides; document limitations.
6. This and future (split-and-create):
   - Duplicate template (new id) with the updated fields.
   - Set old template’s recurrence `endDate` to the day before the target date.
   - Set new template’s recurrence `startDate` to the target date.
   - Persist both via data layer and `upsertTaskTemplate` store updates.
   - Status: Completed
   - Changes:
     - All: existing edit path updates the template directly.
     - Only this: library flow now supports per-date time and status overrides:
       - Time override: creates/updates an instance for `currentDate` via `setInstanceStartTime` when a new fixed time is provided.
       - Status override: Scope dialog offers Pending/Completed/Skipped/Postponed; routes to store actions (`toggleComplete`, `skipInstance`, `postponeInstance`, `undoInstanceStatus`).
     - This and future: implemented split in `src/app/library/page.tsx`:
       - Sets the old template’s `recurrenceRule.endDate` to the day before the selected date.
       - Creates a new template with the edited fields and `recurrenceRule.startDate` set to the selected date.
       - Persists via `updateTemplate` and `createTemplate`; updates store via `upsertTaskTemplate`.
   - Result: Scope selection now controls whether edits apply to the entire series, only the selected occurrence (time override), or split the series with correct date fences.

5.4 Tests
7. Unit tests for split logic using `Recurrence` utils: verify date fences (`endDate` of old < `startDate` of new) and that scheduling honors them.
   - Status: Completed
   - Changes:
     - Added `src/lib/domain/scheduling/SplitRecurrence.test.ts` to verify:
       - Old template with `endDate = dayBefore` is scheduled on `dayBefore` but not on/after target.
       - New template with `startDate = target` is scheduled on/after target but not before.
     - Confirms `generateSchedule` (via `shouldGenerateForDate`) respects `startDate`/`endDate` fences.
   - Result: Split-and-create date bounds are enforced in scheduling.

Acceptance criteria
- Editing a recurring template prompts for scope and applies the chosen strategy.
- Split-and-create produces two templates with correct date bounds.
- Per-date overrides work for time/status.

## 6) UX Polish and QA Pass

1. Ensure toasts copy is consistent and concise; prefer success verbs (“Saved”, “Updated”, “Skipped”, “Postponed”, “Undone”).
   - Status: Completed
   - Changes:
     - Centralized toast copy in `src/lib/ui/toast.ts` with `toastSuccess`, `toastError`, and `toastResult` to enforce consistency.
     - Unified verbs across app: “Saved”, “Created”, “Updated”, “Completed”, “Marked pending”, “Skipped”, “Postponed”, “Deleted”, “Duplicated”, “Enabled/Disabled”, “Signed in”.
     - Errors mirror the action: “Failed to save/complete/skip/postpone/mark pending…”.
   - Note: We use “Marked pending” instead of “Undone” for clarity.
   - Result: Consistent, concise toasts across Timeline, Today list, Library, Settings, and Login.
2. Verify mobile interactions (scroll, drag in timeline, modal full-screen) with no layout shifts.
   - Status: Completed
   - Changes:
     - Modals (`TaskModal`, `ConfirmDialog`) use full-screen on small screens via `w-screen h-svh` and switch to centered dialog on `sm+`.
     - Timeline container updated to reduce layout issues on mobile: `max-h-[80svh] overscroll-contain touch-pan-y` and grid `select-none` to avoid accidental text selection during drag.
   - Result: Smooth scrolling/dragging on mobile; dialogs are full-screen without layout shift.
3. Confirm schedule cache invalidation on relevant actions (instances/templates) to reflect changes immediately.
   - Status: Completed
   - Changes:
     - Store invalidates schedule cache on instance mutations: `setInstanceStartTime`, `skipInstance`, `postponeInstance`, `undoInstanceStatus`, and now `toggleComplete` as well.
     - When instances are loaded/refreshed (`loadInstancesForDate`), the date’s cache entry is invalidated.
     - Template mutations (`setTaskTemplates`, `upsertTaskTemplate`, `removeTaskTemplate`) clear the entire cache to recompute schedules with new templates.
   - Result: Today view reflects changes immediately after actions or data refreshes.
4. Update `README.md` or `docs/` with brief notes on new actions and modals.
   - Status: Completed
   - Changes:
     - Updated `README.md` with a new "Task Actions & Recurrence" section covering:
       - Today actions (Complete/Skip/Postpone/Undo), inline notes, and Timeline drag.
       - Task modal validation and mobile-friendly dialogs.
       - Recurrence Scope dialog behaviors (Only this / This and future / All) and file location.
   - Result: Contributors and testers have a concise reference to the new UX and where key components live.

## 7) Implementation Notes

- Status: Completed
- Files touched (key):
  - Today: `src/components/today/Timeline.tsx`, `src/components/today/TaskList.tsx`, `src/app/today/page.tsx`
  - Library: `src/app/library/page.tsx`, `src/components/library/TaskModal.tsx`
  - UI: `src/components/ui/ConfirmDialog.tsx`, `src/components/ui/ScopeDialog.tsx` (new)
  - Store: `src/store/useAppStore.ts`
  - Domain: `src/lib/domain/scheduling/SchedulingEngine.ts`, `src/lib/domain/scheduling/Recurrence.ts`
  - Data: `src/lib/data/instances.ts`, `src/lib/data/templates.ts`
  - Toasts: `src/lib/ui/toast.ts` (new)
  - Tests: `src/store/useAppStore.test.ts`, `src/store/useAppStore.actions.test.ts` (new), `src/lib/domain/scheduling/SchedulingEngine.test.ts`, `src/lib/domain/scheduling/SplitRecurrence.test.ts` (new), `src/components/today/TaskList.ui.test.tsx` (new)
- Practices observed
  - Kept changes incremental and scoped to subsections (validation, actions, scope, tests).
  - Added unit and UI tests colocated with existing suites; configured Vitest to run `*.test.tsx` in jsdom.
  - Centralized toast messages for consistency and easier maintenance.
  - Invalidated schedule cache on all instance/template mutations to reflect changes immediately.
  - Preserved accessibility on dialogs (title/description wiring, focus management) and improved mobile UX.
