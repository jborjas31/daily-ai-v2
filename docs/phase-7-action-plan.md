# Phase 7 — Offline Enhancements (Action Plan)

Scope: Provide a resilient, user‑visible offline write experience beyond Firestore’s built‑in persistence. Add a client write queue with retry/backoff, minimal conflict handling, a header sync status indicator, and multi‑tab coordination. Queue all instance ops and template updates/deletes; template creates/duplicates remain direct writes (Firestore offline handles them cleanly). Prepare a service‑worker touchpoint but do not block on it.

## UX Principles (Phase 7)

- Calm, clear states: “Offline”, “Syncing…”, “All changes saved”. No noisy modals; use subtle badges and one concise toast on hard failures.
- Predictable writes: actions always appear to apply immediately; queued changes sync when online with visible progress.
- Safe conflict handling: when the remote wins, never silently clobber; surface a brief toast with “Retry” and “Undo local”.
- Progressive enhancement: queue works without a service worker; SW background flush is a bonus.

## 0) Preconditions

Status: Planned (see decisions in `docs/phase-7-preflight.md`)

- Store actions exist for user writes (already implemented):
  - Instances: `setInstanceStartTime`, `toggleComplete`, `skipInstance`, `postponeInstance`, `undoInstanceStatus`
  - Templates: `createTemplate`, `updateTemplate`, `softDeleteTemplate`, `duplicateTemplate` (via data layer)
- Firestore offline persistence is enabled (`ensureFirestorePersistence()`), but we want explicit UX for queued/failed writes.
- Static export deploy (Firebase Hosting) — no SSR dependency.

Acceptance for Preconditions: Confirm the above actions are the primary write paths and that Firestore SDK is initialized client‑side only.

## 1) Write Queue Foundation

Status: Planned

1.1 Define queue schema (idempotent items)
- File: `src/lib/offline/writeQueue.ts`
- Item shape:
  - `id: string` — ULID/UUID
  - `kind: 'upsertInstance'|'deleteInstance'|'updateTemplate'|'softDeleteTemplate'|'setInstanceStartTime'|'skipInstance'|'postponeInstance'|'toggleComplete'|'undoInstanceStatus'`
  - `payload: Record<string, unknown>` — inputs for the operation
  - `key: string` — dedupe key, e.g., `inst:{uid}:{date}:{templateId}` or `tpl:{uid}:{templateId}`
  - `baseRev?: number` — optional local revision for conflict check (e.g., milliseconds from `updatedAt` when available)
  - `attempts: number` — retry count
  - `nextAt: number` — epoch ms when eligible to retry
  - `createdAt: number`

Acceptance:
- TypeScript type exported; pure functions to create/merge items provided.

1.2 Storage strategy
- Use IndexedDB (preferred) via a tiny wrapper. If avoiding deps, implement with `indexedDB` + promisified helpers; otherwise `idb-keyval`.
- File: `src/lib/offline/idb.ts` — `getAll()`, `put()`, `del()`, `clear()`, `count()` for the `writeQueue` store.

Acceptance:
- Queue persists across reloads and survives offline sessions.

1.3 Enqueue API
- Export `enqueue(item)` that:
  - Dedupes by `key` (keep the newest payload, squash older ones where safe; e.g., multiple `setInstanceStartTime` on same key → latest wins).
  - Sets `attempts = 0`, `nextAt = Date.now()`.
  - Emits a lightweight event/subject for UI (see 3.1).

Acceptance:
- Unit tests: dedupe policy, persistence, and basic enqueue/dequeue behavior.

## 2) Flusher, Classification & Backoff

Status: Planned

2.1 Flusher loop
- File: `src/lib/offline/flush.ts`
- Start at app bootstrap; wake on: `online` event, visibility visible, a periodic tick (e.g., 10s), and when `Date.now() >= nextAt`.
- Process small batches per tick (e.g., 10). Exponential backoff `min(60s, 1000ms * 2^attempts)`.
- Use the existing data layer (`src/lib/data/*`) to perform writes.

2.2 Classification
- Map Firestore errors to retryable vs hard per pre‑flight (§2). Treat `not-found` deletes as success.

2.3 Result handling
- Success: remove from queue; update pending count.
- Retryable: increment `attempts`, reschedule `nextAt`.
- Hard: mark `failed` and surface a coalesced toast with `Retry`/`Undo`.

Acceptance:
- Unit tests with mocked data layer: success, retry, backoff, and hard failure paths.

## 3) UI Surface (Sync Status + Failure Toast)

Status: Planned

3.1 Global sync state
- File: `src/store/useSyncStore.ts` (new Zustand slice) or extend `useAppStore` minimally.
- State: `{ pending: number, syncing: boolean, lastError?: string, lastSyncAt?: number }`.
- Actions: `setPending`, `setSyncing`, `setLastError` — triggered by queue events/flusher.

3.2 Header badge
- File: `src/components/AppHeader.tsx` (or Today header region)
- Render small status chip:
  - Online + empty → “All changes saved” (✓)
  - Offline OR pending>0 → “Syncing… (N)” when flushing; “Offline (N queued)” when offline
- A11y: `aria-live="polite"`; ensure concise text.

3.3 Failure toast with actions
- On hard failure (conflict/permission), show a one‑off toast:
  - Copy: “Couldn’t save changes. Keep or undo?”
  - Buttons: `Retry` (re‑enqueue with attempts reset); `Undo` (inverse local change via store action).
- Avoid spam: coalesce multiple failures into one toast with a counter.

Acceptance:
- UI updates live as queue length changes; toast appears only on hard failures.

## 4) Conflict Detection

Status: Planned

4.1 Template conflicts
- Data layer already sets `updatedAt: serverTimestamp()`.
- Strategy: when enqueuing an update to a template, capture the local `baseRev` (best‑effort ms value from `updatedAt`). At flush time:
  - Fetch current `updatedAt` (cheap doc read or rely on SDK cache) and compare.
  - If remote `updatedAt > baseRev`, treat as conflict → fail with `code='conflict'`.

4.2 Instance conflicts
- Instances are day‑scoped and largely idempotent; conflicts are rare. Prefer last‑write‑wins unless an explicit policy dictates otherwise. Only surface as conflict if the remote changed since enqueue and the local change is destructive.

Acceptance:
- Unit tests simulate a conflicting template update and verify toast and queue behavior.

4.3 Auth Scoping & Multi‑Tab Coordination
- Namespace the queue by `uid`; clear on sign‑out and re‑initialize on user change.
- Single‑writer lease across tabs (see pre‑flight §6): advisory lock in IndexedDB with `holderId` and `expiresAt`, renewed ~10s (timeout 30s). Pause flushing when the tab is hidden.
- Use a `BroadcastChannel` (e.g., `queue:{uid}`) for lease announcements and (dev) diagnostics.

## 5) Network/Visibility Signals

Status: Planned

5.1 Online status stream
- File: `src/lib/offline/signals.ts`
- Export an observable or callback interface that tracks `navigator.onLine` and `visibilitychange`.

5.2 App integration
- Start flusher at app bootstrap (e.g., in `FirebaseClientProvider` once auth is known) with the signals above.

Acceptance:
- Toggling offline/online in tests (mock) pauses/resumes flush and updates header badge.

5.3 Retention & Limits
- TTL: ~7 days; prune expired items on wake.
- Cap: ~500 items; on overflow, drop oldest retryable items. Hard‑failed items are pruned after user acknowledgement.

## 6) Service Worker (Post‑MVP Hook)

Status: Planned

6.1 SW scaffolding
- Add a minimal service worker that:
  - Caches static assets (install event) — defers to Phase 12 if needed.
  - Listens for `sync`/custom messages to trigger queue flush in background when the app is reopened.
- Options:
  - Simple custom `service-worker.js` registered in `src/app/layout.tsx` (client effect) for Hosting export.
  - Or integrate Workbox later (Phase 12) — do not block Phase 7.

6.2 Messaging bridge
- `navigator.serviceWorker.controller?.postMessage({ type: 'FLUSH_QUEUE' })` → flusher listens and runs.

Acceptance:
- Manual test: enqueue offline, close tab, reopen online → queue flushes automatically.

## 7) Instrumentation & Logging

Status: Planned

- Lightweight console logs behind `process.env.NEXT_PUBLIC_DEBUG_OFFLINE === '1'`.
- Counters: total enqueued, total flushed, retries, failures, conflicts.
- Optional: expose toasts only for `failure/conflict`; no toasts on success.

Acceptance:
- Debug flag prints useful traces in development; silent in production.

## 8) Tests

Status: Planned

- Unit tests
  - `writeQueue` dedupe/backoff
  - Flusher success/retry/failure
  - Conflict logic for templates
- UI tests (jsdom)
  - Header badge states (offline, syncing, saved)
  - Failure toast actions (Retry re‑queues; Undo reverts store)

Acceptance:
- Vitest suite passes; no flakiness under single‑thread pool.

## 9) Rollout & Guardrails

Status: Planned

- Feature flag: `NEXT_PUBLIC_QUEUE_ENABLED=1` to enable in production.
- Graceful degradation: if IDB unavailable, queue falls back to in‑memory with warning; UX still shows “Offline (N queued)” within session.
- Error budgets: cap attempts at e.g. 8 with 60s max backoff; park item as failed after cap.

Acceptance:
- App remains responsive offline; no data loss on reload; users see accurate sync state.

## File/Module Map (Proposed)

- `src/lib/offline/idb.ts` — IndexedDB helpers
- `src/lib/offline/writeQueue.ts` — queue types + enqueue/dequeue + dedupe
- `src/lib/offline/flush.ts` — flusher with backoff and adapters to data layer
- `src/lib/offline/signals.ts` — online/visibility signals
- `src/store/useSyncStore.ts` — sync state slice (or extend `useAppStore`)
- `src/components/SyncStatusBadge.tsx` — small header badge
- `src/components/AppHeader.tsx` — render badge (hook into existing header)

## Acceptance Summary (Phase 7)

- Offline write attempts never block UI, and changes survive reloads.
 - Header chip reflects `pending`/`syncing` accurately and updates on online/flush.
 - Hard failures show a single coalesced toast with working `Retry`/`Undo`.
 - Multi‑tab runs with a single writer.

## Milestones (Suggested)

- M1: Queue types + IDB storage + dedupe tests; header chip shows `pending`.
- M2: Flusher + classification/backoff; chip shows “Syncing…”.
- M3: Wire instance ops through queue; verify offline→online flush.
- M4: Add template update/delete; verify ordering/dedupe.
- M5: Multi‑tab lease with tests (two tabs).
- M6: Failure toast with Retry/Undo; minimal `prevState` stored; tests.
- M7: Retention/limits + `lastSyncAt` polish.

## Out of Scope (Phase 7)

- Queuing template creates/duplicates (direct writes suffice with Firestore offline).
- Timeline Task Details (popover/sheet) — defer to a later phase.

## 10) Timeline Task Details (Google Calendar-style)

Status: Deferred (move to a later phase)

10.1 Pattern and UX
- Single-click a timeline block opens a contextual details popover anchored to the clicked block (desktop). On small screens, show a bottom sheet (Dialog) instead.
- Popover content mirrors Google Calendar’s event card: concise summary with quick actions, and a primary Edit action that opens the full edit modal.
- Only one popover is open at a time. Clicking outside or pressing Escape closes it and returns focus to the originating block.
- Keyboard: when a block is focused, Enter/Space opens details. Tab order starts at the title, then quick actions, then Edit, then Close.

10.2 Content and Actions
- Header: task name; time range; chips for Mandatory/Fixed/Flex; optional status badge if completed/skipped.
- Body: optional notes/description preview; duration; buffer minutes; next occurrence (if applicable).
- Quick actions: Mark done, Skip, Postpone (preset choices like +30m, Later today, Tomorrow), Start now (for overdue/anchored tasks), and Duplicate.
- Primary: Edit → opens existing `TaskModal` prefilled with the template for full editing.
- All actions call existing store methods (`toggleComplete`, `skipInstance`, `postponeInstance`, `setInstanceStartTime`, `duplicateTemplate`, `updateTemplate`) and integrate with the Phase 7 offline write queue.

10.3 Routing and State
- Route-based state for deep-linking/back navigation: update URL with `?taskId={id}` when opening details; remove it when closing. Use Next.js App Router `router.replace` to avoid noisy history when toggling.
- UI state: extend `useAppStore.ui` with `{ selectedTaskId?: string, isTaskDetailsOpen: boolean }` to coordinate popover/drawer visibility across the app.
- Prefetch: on hover/focus of a block, optionally prefetch the template/instance from cache to minimize open latency.

10.4 Technical Implementation
- Desktop popover: use `@radix-ui/react-popover` anchored to the block element; prefer `side="right"` with collision handling and fallbacks to avoid viewport clipping. Render via portal.
- Mobile drawer: reuse Radix Dialog styled as a bottom sheet; trap focus; swipe-to-close optional (non-blocking polish).
- Focus management: on open, set initial focus to the title; on close, return focus to the originating block. Ensure Escape closes both popover and dialog.
- Event handling: attach `onClick` and keyboard handlers to each `timeline-block` to call `openTaskDetails(templateId)`; stop propagation for buttons inside the block.
- Data source: compute the card from store data using `templateId` + current date to derive the `TaskInstance` (if any).
- Error/edge: if a template is missing, show a lightweight error and close. If an action fails hard, surface the Phase 7 failure toast with Retry/Undo (3.3).

10.5 Accessibility
- Blocks: ensure every `timeline-block` is keyboard-focusable (`tabIndex=0`) and exposes a readable `aria-label` with task name and time; preserve existing drag affordances.
- Popover/Dialog: `role="dialog"` with `aria-labelledby` and `aria-describedby`; use a focus trap; ensure labels for all buttons (e.g., "Mark done", "Skip").
- Motion: respect `prefers-reduced-motion` for popover/drawer transitions.

10.6 Acceptance
- Click on any timeline block opens a details view (popover on desktop, bottom sheet on mobile) with correct task metadata and quick actions.
- Enter/Space opens; Escape and outside click close; focus returns to the originating block after close.
- Edit opens the existing `TaskModal` with prefilled data; saving updates the task and closes the modal, reflecting changes on the timeline.
- Quick actions apply optimistically and queue offline when needed; UI reflects sync state via the Phase 7 badge/toast.
- URL reflects `?taskId={id}` while open and cleans up on close; refresh with the param restores the open details view.

10.7 Files/Modules (Proposed)
- `src/components/today/TaskDetailsCard.tsx` — content component rendering details + actions.
- `src/components/today/TaskDetailsPopover.tsx` — Radix Popover wrapper for desktop, anchors to a block.
- `src/components/today/TaskDetailsSheet.tsx` — Radix Dialog styled as bottom sheet for mobile.
- `src/components/today/Timeline.tsx` — wire click/keyboard handlers to open details; pass anchor refs; ensure blocks are focusable.
- `src/store/useAppStore.ts` — extend `ui` slice with selectedTaskId/isTaskDetailsOpen; reuse existing actions.
- `src/components/library/TaskModal.tsx` — reused for full edit flow.
- A small badge indicates “Offline (N queued)”, “Syncing… (N)”, or “All changes saved”.
- On conflict, a single concise toast offers Retry/Undo and avoids spam.
- Optional SW flush path prepared; not required for MVP completion.

---

## Appendix A — Calendar‑Style QoL Improvements (Deferred)

Low‑risk Google Calendar–style enhancements to implement after Phase 7 core is complete.

1) Scroll‑to‑Now Button
- Floating “Now” button appears when the now‑line is off‑screen; scrolls timeline to current time.
- Files: `src/components/today/Timeline.tsx`.
- Accept: Appears only when now‑line is outside viewport; smooth scroll.

2) Drag Preview Time Tooltip
- While dragging a block, show a tiny tooltip with the snapped start time.
- Files: `Timeline.tsx` (TimelineBlock).
- Accept: Updates during drag; hides on drop.

3) Ghost Drop Indicator
- Thin horizontal guide line at the snapped drop Y while dragging.
- Files: `Timeline.tsx` (TimelineBlock/parent overlay).
- Accept: Tracks drag; removed after drop.

4) Edge Auto‑Scroll While Dragging
- Auto‑scroll timeline near top/bottom edges during drag.
- Files: `Timeline.tsx` (TimelineBlock with container ref prop).
- Accept: Smooth, bounded; no jitter.

5) Keyboard Shortcuts (Calendar‑style)
- Left/Right: prev/next day; T: today; N: new task.
- Files: `src/app/today/page.tsx`.
- Accept: Disabled when typing/in modal.

6) Keyboard Nudge for Focused Block
- Up/Down adjusts a focused draggable block by 5m (Shift=15m).
- Files: `Timeline.tsx`.
- Accept: Non‑mandatory only; respects bounds.

7) Long‑Press to Add (Mobile Grid)
- Long‑press on grid to open New Task prefilled with that time.
- Files: `Timeline.tsx`.
- Accept: Doesn’t interfere with scrolling.

8) “Now” Label on Now‑Line
- Small “Now” pill attached to the red line.
- Files: `Timeline.tsx`.
- Accept: Today only; unobtrusive.

9) Undo After Move
- Toast with “Undo” after moving a block to revert.
- Files: `Timeline.tsx` (TimelineBlock), `@/lib/ui/toast`.
- Accept: Restores exact prior time.

10) Hover Micro‑Actions for Flexible Blocks
- “−5m/+5m” buttons on hover (desktop only).
- Files: `Timeline.tsx`.
- Accept: Hidden on touch; respects snapping.

11) Subtle Overlap Hint
- When `+X more` is shown, lightly outline the overlapping time band.
- Files: `Timeline.tsx` alongside `moreBadges`.
- Accept: Only when overlaps exist; low visual weight.

12) Slight “Haptic” Visual on Drag Start
- Brief 98% scale or shadow pulse on drag start, revert on end.
- Files: `Timeline.tsx` (TimelineBlock).
- Accept: Respects `prefers-reduced-motion`.
