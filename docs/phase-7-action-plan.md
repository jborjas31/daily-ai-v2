# Phase 7 — Offline Enhancements (Action Plan)

Scope: Provide a resilient, user‑visible offline write experience beyond Firestore’s built‑in persistence. Add a lightweight client write queue with retry/backoff and conflict handling, plus a minimal sync status indicator. Prepare hooks for a background sync via a service worker (post‑MVP) without blocking release.

## UX Principles (Phase 7)

- Calm, clear states: “Offline”, “Syncing…”, “All changes saved”. No noisy modals; use subtle badges and one concise toast on hard failures.
- Predictable writes: actions always appear to apply immediately; queued changes sync when online with visible progress.
- Safe conflict handling: when the remote wins, never silently clobber; surface a brief toast with “Retry” and “Undo local”.
- Progressive enhancement: queue works without a service worker; SW background flush is a bonus.

## 0) Preconditions

Status: Planned

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
  - `kind: 'upsertInstance'|'deleteInstance'|'updateTemplate'|'createTemplate'|'softDeleteTemplate'|'setInstanceStartTime'|...`
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

## 2) Flusher & Backoff

Status: Planned

2.1 Flusher loop
- File: `src/lib/offline/flush.ts`
- `startFlusher({ online$: Observable<boolean> })` that:
  - Wakes on: app start, `online$` true, visibility change to visible, and when `now >= nextAt`.
  - Processes N items (e.g., 10) per tick; exponential backoff (e.g., 2^attempts * 1000ms, capped at 60s).
  - Uses the existing data layer (`src/lib/data/*`) to perform writes.

2.2 Result handling
- Success: remove from queue; notify UI progress.
- Retryable failure (network/unavailable): increment `attempts`, reschedule `nextAt`.
- Conflict or permission failure: drop or park item with `state='failed'` and surface a toast with actions (3.3).

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

## 5) Network/Visibility Signals

Status: Planned

5.1 Online status stream
- File: `src/lib/offline/signals.ts`
- Export an observable or callback interface that tracks `navigator.onLine` and `visibilitychange`.

5.2 App integration
- Start flusher at app bootstrap (e.g., in `FirebaseClientProvider` once auth is known) with the signals above.

Acceptance:
- Toggling offline/online in tests (mock) pauses/resumes flush and updates header badge.

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

- Feature flag: `NEXT_PUBLIC_OFFLINE_QUEUE=1` to enable in production.
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
- A small badge indicates “Offline (N queued)”, “Syncing… (N)”, or “All changes saved”.
- On conflict, a single concise toast offers Retry/Undo and avoids spam.
- Optional SW flush path prepared; not required for MVP completion.

