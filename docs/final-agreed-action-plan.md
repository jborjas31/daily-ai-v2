# Architecture Refactor: A Step-by-Step Implementation Plan

This document outlines the complete, ordered, step-by-step plan to refactor the Timeline architecture. Follow each step in sequence from top to bottom. All details required for a given step are contained within that step.

**Primary Goals:**
- Decouple complex logic from the `Timeline.tsx` component.
- Centralize presentation logic in a pure, testable "View Model" function.
- Decompose the UI into smaller, single-purpose components.
- Improve performance, testability, and maintainability.

---

## Step 1: Documentation (ADR)

Before writing any code, create a new document to record the architectural decision being made.

1.  **Create a file:** `docs/adr/001-timeline-view-model.md`
2.  **Content:** Add a short "Architecture Decision Record" (ADR) that captures the "Timeline View Model" decision.
    -   **Context:** `Timeline.tsx` is a large "God Component" that is difficult to maintain and test. It mixes business logic, presentation logic, and view state.
    -   **Decision:** We will refactor it by introducing a pure "View Model" function. This function will take application state and view parameters (like `rowHeight`) and return fully computed properties for rendering. This separates calculation logic from the UI components. We will also decompose the component and use custom hooks for browser-specific logic.
    -   **Rationale:** This improves testability, maintainability, and performance by creating a clear separation of concerns, keeping the global store clean, and making the data flow predictable.

---

## Step 2: Create the Responsive Behavior Hook

Create a custom hook to manage browser-specific responsive logic.

1.  **Create file:** `src/lib/utils/useResponsiveTimeline.ts`.
2.  **Implement the hook:**
    -   It should return an object: `{ rowHeight, laneCap, prefersReducedMotion }`.
    -   **`laneCap`:** Should be `3` for screen widths `(min-width: 768px)` and `2` otherwise. It must listen to media query changes.
    -   **`rowHeight`:** Should be `64` (pixels per hour) on desktop (`laneCap: 3`). On mobile, it should be computed from the viewport height (e.g., `(window.innerHeight * 0.8) / 24 * 2`). It must have a fallback of `64` for Server-Side Rendering (SSR) and tests.
    -   **`prefersReducedMotion`:** Should reflect the browser's `(prefers-reduced-motion: reduce)` setting and listen for changes.
3.  **Important Considerations:**
    -   **SSR Safety:** All access to the `window` object must be guarded to prevent errors during server-side rendering.
    -   **Performance:** Debounce `resize` and `orientationchange` event handlers by ~100-200ms to prevent excessive re-renders on mobile.
    -   **Cleanup:** Ensure all event listeners are properly removed when the component unmounts.
4.  **Add Tests:** Create a simple test file to verify the hook provides correct initial values and that listener cleanup functions are called.

---

## Step 3: Create the Timeline View Model

Create the pure function that will contain all the complex presentation logic.

1.  **Create file:** `src/lib/viewmodel/timeline.ts`.
2.  **Define Types:** In the same file or in `src/lib/viewmodel/types.ts`, define the output shapes: `TimelineBlockVM`, `MoreBadgeVM`, `GapPillVM`, etc. Use explicit fields and avoid `any`.
3.  **Implement `computeTimelineVMStatic`:** This function will compute the time-**in**variant (static) geometry.
    -   **Function Signature:** `computeTimelineVMStatic(state, staticParams)`
    -   **`state` Inputs:** `schedule`, `instances`, `templates`, `settings`.
    -   **`staticParams` Inputs:** `rowHeight`, `laneCap`, `gapMinMinutes`.
    -   **Functionality:** It should calculate the base block geometry, lane assignments, `+X more` clusters, anchor buffers, gaps, and sleep segments.
    -   **Output:** An object containing the results of the calculations (e.g., `{ blocks, badges, gaps, buffers, sleepSegments }`).
4.  **Implement `applyNowOverlay`:** This lightweight function will apply the time-**variant** (dynamic) adjustments.
    -   **Function Signature:** `applyNowOverlay(staticVM, overlayParams)`
    -   **`staticVM` Input:** The output from `computeTimelineVMStatic`.
    -   **`overlayParams` Inputs:** `{ isToday, nowMins }`.
    -   **Functionality:** It should apply visual adjustments that depend on the current time, such as the `transformY` for mandatory overdue tasks. It should not re-calculate the entire layout.
5.  **Add Tests:**
    -   Create `src/lib/viewmodel/timeline.test.ts`.
    -   Test `computeTimelineVMStatic` for correct lane assignments, gap detection, and buffer calculation with various inputs.
    -   Test `applyNowOverlay` to ensure it correctly modifies the static VM based on the current time, and importantly, that the static VM remains unchanged.
    -   Verify the functions are pure (deterministic results for identical inputs, no input mutation).

---

## Step 4: Refactor `Timeline.tsx` to Use the View Model

Wire the new view model into the main `Timeline.tsx` component. The application should look and feel identical after this step.

1.  **Modify `Timeline.tsx`:**
    -   Use the `useResponsiveTimeline` hook (from Step 2) to get `rowHeight`, `laneCap`, and `prefersReducedMotion`.
    -   Continue to get raw data (`schedule`, `instances`, etc.) from the `useAppStore`.
    -   Compute `nowMins` and `isToday` locally within the component.
    -   Compute `gapMinMinutes` based on your UX policy (e.g., `laneCap >= 3 ? 5 : 10`).
    -   Call the new view model functions:
        -   `const staticVM = computeTimelineVMStatic(...)`
        -   `const vm = applyNowOverlay(staticVM, ...)`
2.  **Memoize Correctly:**
    -   Wrap the `computeTimelineVMStatic` call in a `useMemo` hook. Its dependency array should be `[schedule, instances, templates, settings, rowHeight, laneCap, gapMinMinutes]`.
    -   Wrap the `applyNowOverlay` call in a `useMemo` hook. Its dependency array should be `[staticVM, isToday, nowMins]`.
3.  **Remove Redundant Code:** Delete the large, old `useMemo` blocks that are now replaced by the view model functions.
4.  **Verify:** The application should function exactly as before. This step is purely an internal refactor.

---

## Step 5: Decompose `Timeline.tsx` into Child Components

Break the large `Timeline.tsx` file into smaller, single-purpose presentational components.

1.  **Create new component files** under `src/components/today/timeline/`:
    -   `HourGrid.tsx`: Renders hour lines and labels.
    -   `SleepShading.tsx`: Renders the sleep segments.
    -   `NowLine.tsx`: Renders the moving "now" line.
    -   `MorePopover.tsx`: Renders the `+X more` badge and its popover.
    -   `GapPill.tsx`: Renders the "Use gap" pill.
    -   `TimelineBlock.tsx` should already be a sub-component; ensure it is clean.
2.  **Refactor `Timeline.tsx`:**
    -   Remove the JSX for the features listed above and replace it with the new components.
    -   `Timeline.tsx` will now be an "orchestrator" component. It will call the view model and pass the computed properties down to these new dumb child components.
3.  **Guidelines:**
    -   Child components should receive all data via props and should **not** access the Zustand store directly.
    -   Ensure all accessibility attributes (`aria-label`, `role`, etc.) are preserved in the new components.

---

## Step 6 (Optional): Encapsulate Drag-and-Drop Logic

To further clean up `TimelineBlock.tsx`, you can extract the complex pointer and drag-threshold logic into its own hook.

1.  **Create file:** `src/lib/utils/useDragThreshold.ts`.
2.  **Implement the hook:**
    -   Move the pointer-gating logic (start drag after Y-threshold or long-press) from `TimelineBlock` into this hook.
    -   It should provide a simple API to the component, like `{ onPointerDown, dragControls }`.
    -   It should manage its own event listeners and ensure they are cleaned up on unmount.
3.  **Refactor `TimelineBlock.tsx`:** Use the new hook to simplify the drag-and-drop implementation.
4.  **Add Tests:** Create a test file for the hook to verify the threshold and long-press behaviors work as expected.

---

## Step 7: Final Quality Assurance and Cleanup

Verify the refactor was successful and clean up any remaining artifacts.

1.  **Manual QA:**
    -   Thoroughly test the timeline on both desktop and mobile views.
    -   Confirm that all features work as before: overlaps, `+X` badges, gaps, buffers, overdue visuals, and drag-and-drop persistence.
2.  **Code Cleanup:**
    -   Delete any old, unused code that was replaced during the refactor.
    -   Ensure all new files are properly formatted and linted.
    -   Review the new components and hooks to ensure they are clean and readable.
3.  **Final Verification:** Run the entire test suite (`lint`, `typecheck`, `test`) one last time to ensure everything is green.

---
---

## Appendix A: Master Checklist

Use this checklist to track the completion of the refactor.

- [ ] **Step 1:** ADR for Timeline View Model is created.
- [ ] **Step 2:** `useResponsiveTimeline` hook is created, tested, and wired up.
- [ ] **Step 3:** `computeTimelineVMStatic` and `applyNowOverlay` are implemented with types and tests.
- [ ] **Step 4:** `Timeline.tsx` is refactored to use the new view model pipeline, and old `useMemo` blocks are removed.
- [ ] **Step 5:** `Timeline.tsx` is decomposed into `HourGrid`, `SleepShading`, `NowLine`, `MorePopover`, and `GapPill` components.
- [ ] **Step 6 (Optional):** `useDragThreshold` hook is created and used in `TimelineBlock`.
- [ ] **Step 7:** A full QA pass is complete, and all dead code has been removed.
- [ ] All existing and new tests are passing.

---

## Appendix B: Acceptance Criteria

The refactor is successful if all of the following are true (no regressions):

1.  The timeline renders with identical visuals and interactions on both mobile and desktop.
2.  Drag-to-move functionality, including snapping and persistence, works correctly.
3.  The "Up Next" logic and all other UI behaviors outside the timeline are unchanged.
4.  All existing tests pass, and new tests for the view model and hooks have been added and are passing.