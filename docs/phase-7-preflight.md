# Phase 7 Pre‑Flight — Decisions & Mini Action Plan

This short plan locks down the few worthwhile tweaks to decide before starting Phase 7 (Offline Enhancements). Keeping these documented avoids rework while the queue is implemented.

## Goals
- Define deterministic queue deduplication keys and merge policy (instances/templates).
- Define error classification and backoff policy for the flusher.
- Confirm the write centralization contract (where the queue integrates).

---

## 1) Queue Dedupe Keys + Merge Policy

Decide canonical keys and how to coalesce repeated writes targeting the same logical entity.

- Key formats
  - Instances (per day + template): `inst:{uid}:{date}:{templateId}`
  - Templates (by id): `tpl:{uid}:{templateId}`

- Operation → key
  - `setInstanceStartTime`, `skipInstance`, `postponeInstance`, `toggleComplete`, `undoInstanceStatus`, `upsertInstance`, `deleteInstance` → `inst:{uid}:{date}:{templateId}`
  - `updateTemplate`, `softDeleteTemplate` → `tpl:{uid}:{templateId}`
  - `createTemplate`, `duplicateTemplate` → no dedupe (new doc id created by Firestore); treat as unique items

- Merge policy (same key in queue)
  - Time‑only overrides: multiple `setInstanceStartTime` on the same key → keep the newest payload (last write wins).
  - Status ops: for multiple status‑changing ops (`skip`/`postpone`/`complete`/`undo`) on the same key → keep the newest one (last write wins).
  - Mixed time + status: collapse to the newest op by timestamp; if the newest is time‑only and a status op exists earlier, keep both in order (status op last). If the newest is status, drop earlier time‑only ops.
  - Deletes: `deleteInstance` supersedes earlier pending ops for that key.
  - Template updates: subsequent `updateTemplate` merges shallowly; last write wins per field.

- Idempotency notes
  - Instance ids are deterministic (`inst-{YYYY-MM-DD}-{templateId}`) so replays are safe.
  - `deleteInstance` with 404/`not-found` can be treated as success (already deleted).
  - `createTemplate`/`duplicateTemplate` are not deduped; associate queue item with the returned id after success.

- Acceptance
  - Dedupe function coalesces an input list per rules above.
  - Unit tests cover: repeated time overrides, repeated status ops, mixed ops order, delete collapsing, template update merge.

---

## 2) Error Classification + Backoff Policy

Define how the flusher maps Firestore errors to retry vs hard fail, and the retry schedule.

- Classification helper (examples)
  - Retryable: `unavailable`, `deadline-exceeded`, `aborted`, `internal`, `resource-exhausted`, network errors.
  - Hard fail: `permission-denied`, `failed-precondition`, `unauthenticated`, `already-exists` (create collisions), `invalid-argument`.
  - Special cases:
    - `not-found` for `deleteInstance` → treat as success.
    - `not-found` for updates → hard fail (surface toast; likely user deleted elsewhere).

- Backoff
  - Base delay: `1000ms * 2^attempts`, capped at `60s`.
  - Attempt cap: 6 attempts (≈ up to ~1 min between tries); then mark item `failed`.
  - Wake triggers: app start, `online` event, visibility change to visible, and when `Date.now() >= nextAt`.

- Acceptance
  - Helper maps Firestore error codes to `retryable | hard` with unit tests.
  - Flusher respects cap/backoff and wake triggers in tests with mocked timers.

---

## 3) Write Centralization Contract

Affirm the single integration points for the queue to avoid touching UI/store call sites.

- Contract
  - All remote writes continue to go through `src/lib/data/*` modules.
  - The queue wraps these modules or provides thin wrappers, preserving existing function signatures for store actions.
  - Store actions remain optimistic (as today); the queue handles persistence, retry, and failure signaling.

- Minimal interface (for flusher)
  - Instances: `upsertInstance(uid, inst)`, `deleteInstance(uid, id)`
  - Templates: `createTemplate(uid, tpl)`, `updateTemplate(uid, id, updates)`, `softDeleteTemplate(uid, id)`, `duplicateTemplate(uid, tpl)`
  - Keep these pure (no UI side effects); surface errors via throws for classification.

- Acceptance
  - Documented contract and call sites; a single wrapper point is chosen (either replace exports in `src/lib/data/*` or add `src/lib/offline/*` wrappers used by store).

---

## Implementation Notes (when ready)
- Storage: Use a tiny IndexedDB wrapper (`idb-keyval` or a custom `idb.ts`) for the queue store.
- Events: Expose a lightweight subject or callback for queue length changes to update a header badge.
- UI (Phase 7 proper): Add a small status chip in `AppHeader` — “All changes saved” / “Offline (N queued)” / “Syncing… (N)”.

## Done When
- This document’s decisions are reflected in code comments and used by the queue implementation.
- Unit tests exist for dedupe + classification.

---

Links
- Phase 7 plan: `docs/phase-7-action-plan.md`
- Data layer: `src/lib/data/`
- Store actions: `src/store/useAppStore.ts`

---

## 0.5) Queue Item Schema (Reference)

Define a compact, idempotent item stored in IndexedDB.

```ts
type QueueItem = {
  id: string;              // ULID/UUID
  uid: string;             // user namespace
  kind:
    | 'upsertInstance'
    | 'deleteInstance'
    | 'setInstanceStartTime'
    | 'skipInstance'
    | 'postponeInstance'
    | 'toggleComplete'
    | 'undoInstanceStatus'
    | 'updateTemplate'
    | 'softDeleteTemplate';
  key: string;             // dedupe key: inst:{uid}:{date}:{templateId} or tpl:{uid}:{templateId}
  payload: Record<string, unknown>;   // inputs for data-layer call
  prevState?: Record<string, unknown>; // minimal prior state for Undo
  attempts: number;         // retry count
  nextAt: number;           // epoch ms when eligible to retry
  createdAt: number;        // epoch ms
  baseRev?: number;         // optional local rev (e.g., updatedAt millis)
};
```

---

## 4) Queue Scope & Layering with Firestore Offline

Define when to enqueue versus call Firestore directly, and how this coexists with Firestore’s built‑in offline persistence.

- When to enqueue
  - If browser is offline (`navigator.onLine === false`) → enqueue.
  - If a direct write throws a retryable error (see §2 classification) → enqueue and back off.
  - Else (online + no error) → write directly via data layer.

- Scope (initial)
  - Queue: instance ops (`setInstanceStartTime`, `skip`, `postpone`, `toggleComplete`, `undo`, `upsert/delete`).
  - Queue: template updates/deletes (`updateTemplate`, `softDeleteTemplate`).
  - Not queued initially: `createTemplate`/`duplicateTemplate` — rely on Firestore offline persistence for creates; revisit later if needed.

- Sources of truth for connectivity
  - `navigator.onLine`, `window` `online/offline` events, and Firestore error codes.
  - Prefer error‑based fallback (enqueue) over brittle network probing.

## 5) Auth Scoping & Lifecycle

- Namespace queue per user (`uid`).
- On sign‑out: clear queue and reset sync state.
- On user change: re‑initialize storage namespace and pause any in‑flight flusher.
- If auth changes mid‑flush: abort current batch, rebind to new `uid`.

## 6) Multi‑Tab Coordination

- Strategy: single‑writer lease using `IndexedDB` + `BroadcastChannel` (or `localStorage` as fallback).
- Lease
  - Key: `queue-lease:{uid}` with `holderId` and `expiresAt`.
  - Renewal: every 10s while active; timeout 30s.
  - If lease lost or visibility hidden: pause flushing.
- Simpler fallback (acceptable if lease is complex): per‑tab queues with best‑effort de‑duplication; be aware of double‑flush risk.

- Holder identity
  - Generate a random `tabId` per tab on load and keep it in memory; include `tabId` in the lease `holderId`.
  - BroadcastChannel: `queue:{uid}` — publish lease acquisition/release and flush progress for debugging (dev only).

## 7) Ordering & Idempotency Guarantees

- Within a key: process items by `createdAt` after dedupe; enforce last‑write‑wins semantics.
- Deletes supersede earlier ops for the same key.
- `deleteInstance` 404/`not-found` → treat as success; for other updates, `not-found` is a hard fail.

## 8) Inverse Operations (Retry/Undo)

Define the local inverse for the failure toast’s “Undo” action; store minimal prior state in queued item when necessary.

- Mappings (examples)
  - `skipInstance` → `undoInstanceStatus`
  - `postponeInstance` → `undoInstanceStatus`
  - `toggleComplete` (to completed) → `toggleComplete` (undo)
  - `setInstanceStartTime` → set back to previous `modifiedStartTime`, or `undoInstanceStatus` if the instance was created by the action
  - `updateTemplate` → re‑apply prior snapshot (store shallow diff in queue item)
  - `softDeleteTemplate` → updateTemplate `{ isActive: true }`

## 9) Retention & Limits

- TTL: 7 days for queued items; auto‑prune expired.
- Size cap: 500 items; on overflow, drop oldest retryable items.
- Hard‑failed items: surface one coalesced toast; prune after user dismisses/acknowledges.

## 10) UI Badge Spec (Copy + A11y)

- States
  - “All changes saved” (✓)
  - “Offline (N queued)” when offline
  - “Syncing… (N)” when flushing
  - Optional: “Queued (N)” if online but waiting for backoff (rare)
- Behavior: no success toasts; coalesce repeated failures; `aria-live="polite"`.
 - Data source: a small `useSyncStore` slice that exposes `{ pending, syncing, lastSyncAt? }`, updated by queue events/flusher.

## 11) Minimal Sync State in Store

- Fields: `{ pending: number, syncing: boolean, lastSyncAt?: number, lastError?: string }`.
- Source: updated by queue events/flusher only; UI reads to render the header chip.

## 12) Testing Matrix

- Dedupe/merge rules per key; ordering preserved.
- Retry/backoff with caps; mocked timers.
- Online/offline transitions and visibility wake.
- `deleteInstance` 404 treated as success.
- Hard‑fail toast with working Retry/Undo applying inverse ops.
- Sign‑out clears queue and resets state.
- Multi‑tab: only the lease holder flushes.

## 13) Feature Flag

- `NEXT_PUBLIC_QUEUE_ENABLED` (default `true`).
- Tests can disable to assert baseline behavior.

## 14) Service Worker Touchpoint (Deferred)

- Prepare a no‑op hook to request a background flush later:
  - `navigator.serviceWorker.controller?.postMessage({ type: 'flush-queue' })`
- Do not require an SW for Phase 7.

## 15) Build Gates (Timing)

- Keep `ignoreBuildErrors` / `ignoreDuringBuilds` during the queue PR to speed iteration.
- Plan to re‑enable strict type/lint gates after Phase 7 merges cleanly.
