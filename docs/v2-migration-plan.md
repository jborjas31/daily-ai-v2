# Daily AI V2 Migration Plan

This is the single, up‑to‑date plan to modernize the old vanilla web app in `old_project/` into a Next.js (React + Tailwind) V2. It consolidates prior notes and the addendum into one actionable blueprint.

## Decisions Locked (MVP)

- Architecture: Client-only for time/scheduling; server components only for static shell/layout. Avoid SSR for time-sensitive logic.
- Time policy: Local device time only. Store times as `HH:MM` strings.
- State: Zustand with `devtools` + `immer`; selectors for instances/templates/schedule.
- Firebase: Modular SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`); enable Firestore offline persistence; email/password auth only.
- Data model: Keep V1 Firestore structure unchanged (`/users/{userId}`, `tasks`, `task_instances`, `daily_schedules`).
- Offline (MVP): Use Firestore built-in offline persistence; no custom queue yet.
- UI Scope (MVP): Today — Timeline first (with a basic List), Library, Settings (read-only initially).
- UX libs: Toasts via `sonner`; dialogs via Radix UI primitives; Tailwind for styling.
- PWA: Add manifest + icons now; defer custom service worker.
- Branding: Name “Daily AI”, short name “DailyAI”, theme color `#3B82F6`; generate default icons.
- Hosting: Firebase Hosting (CSR/static export friendly).
- CI: GitHub Actions (lint, typecheck, test, build) on PRs.

## Must‑Have Technical Boundaries

- CSR/SSR: Use client components for any time‑sensitive logic (clock, scheduling engine, timeline, Firebase). Use server components only for static shell.
- Time helpers: Implement `src/lib/time.ts` with parse/format/compare/addMinutes to keep logic consistent and timezone‑agnostic.
- Pure domain modules: Port Recurrence/Dependency/Scheduling as pure functions with explicit inputs/outputs; no global state, no DOM.

## Environment & Setup

- Copy `.env.example` to `.env.local` and ensure these client keys are set:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
- Initialize Firebase only on the client; enable Firestore offline persistence.
- Keep `old_project/` as V1 reference; do not import DOM code.

## Starting Point

- Goal: Rebuild UI and state with React while reusing domain logic (scheduling, recurrence, repositories, utilities).
- Approach: Strangler pattern — add new React pages/components and a store; port logic modules incrementally; keep app usable during migration.
- Current setup: Next.js (App Router), Node.js, Tailwind present in this repo; legacy app under `old_project/public/js/*` with clear domains.

## CSR/SSR Boundaries

- Use client components for anything time-sensitive (clock, scheduling, timeline, store, Firebase auth/data).
- Use server components only for static layout/shell (no domain logic or auth in RSC).
- Avoid server-derived time; all time comes from the client.

## Types & Validation

- Define core types in `src/lib/types/*`: `TaskTemplate`, `TaskInstance`, `Settings`, `ScheduleBlock`.
- Store times as strings `HH:MM` (24‑hour).
- Reuse V1 validation messages (name required, duration 1–480, priority 1–5, start<=end, etc.).

## What To Keep vs Rewrite

- Keep (port to `src/lib` as framework-agnostic modules):
  - `old_project/public/js/logic/*` (SchedulingEngine, Recurrence, DependencyResolver, Template/Instance Managers)
  - `old_project/public/js/data/*` repositories if pure (no DOM), `constants/*`, helpers
  - Simple utils that have no DOM access
- Rewrite (React-first):
  - Imperative DOM UI → React components with Tailwind
  - Errors/toasts → `sonner`
  - Dialogs → Radix UI primitives
  - Event bus → Zustand store
- Update:
  - Firebase: replace CDN/global with modular SDK and a client provider; enable offline persistence

## Proposed V2 Structure

- Routes (Next.js App Router):
  - `src/app/today/page.tsx` — MVP list view; timeline later
  - `src/app/library/page.tsx` — task templates
  - `src/app/settings/page.tsx` — read-only initially
- Layout:
  - `src/app/layout.tsx` — header (date, user), nav (Today/Library/Settings), global “Add Task” button
- State (store):
  - Zustand with `devtools` and `immer` middleware
  - Slices: `user`, `settings`, `templates`, `instances`, `filters`, `ui`
  - Selectors mirroring `state.js` (`getTaskInstancesForDate`, `getTaskTemplateById`, `generateScheduleForDate`)
- Domain modules:
  - `src/lib/domain/scheduling/*` — Recurrence, DependencyResolver, SchedulingEngine
  - `src/lib/domain/tasks/*` — TemplateManager, InstanceManager wrappers
  - `src/lib/data/*` — repositories/offline adapters (as needed)
  - `src/lib/types/*` — TaskTemplate, TaskInstance, Settings (TS later)
- UI Components:
  - `AppHeader`, `AppNav`, `Timeline`, `TaskList`, `TaskCard`, `ConfirmDialog` (Radix), `TaskModal`
  - Replace imperative DOM manipulation with component state/props and store subscriptions

## Branding & PWA (MVP)

- Manifest: `app/manifest.webmanifest` with name Daily AI, short_name DailyAI, theme `#3B82F6`.
- Icons: generate default icons under `public/icons/` (replace later with final assets).
- Service Worker: defer custom SW until post‑MVP; rely on Firestore offline and browser cache.

## Reordered Backlog (MVP First) + Definition of Done

1) Foundation (routes/layout)
   - Create `/today`, `/library`, `/settings`; shared layout with `AppHeader`/`AppNav`.
   - DoD: App builds; current date renders in header; nav highlights active route.

2) Store (Zustand)
   - Implement slices (`user`, `settings`, `templates`, `instances`, `filters`, `ui`) and selectors (`getTaskInstancesForDate`, `getTemplateById`, `generateScheduleForDate`).
   - DoD: Unit tests for setters/selectors; devtools + immer wired; no tearing in basic updates.

3) Auth + Data (Firebase modular)
   - Add client provider with `onAuthStateChanged`; enable Firestore offline persistence; `useAuth()` hook; error → toast mapping.
   - DoD: Sign in/out updates header state; route guard (client) works; no crashes when offline.

4) Domain Port — Recurrence (pure)
   - Port recurrence rules into `src/lib/domain/scheduling`.
   - DoD: Unit tests pass for daily/weekly/monthly/yearly fixtures.

5) Domain Port — SchedulingEngine (pure)
   - Port engine independent of legacy state.
   - DoD: Unit tests pass for 4 scenarios (Dependency Chain, Crunch Time, Impossible Day, Flexible Reschedule).

6) Today — Timeline MVP (+ basic List)
   - Timeline: 24h grid, sleep blocks, now‑line, scheduled blocks (no DnD).
   - List: basic grouped rendering and complete toggle.
   - DoD: Both render from store/engine; empty states handled; no time drift issues.

7) Library — MVP
   - List templates; enable/disable; duplicate; confirm delete; minimal edit modal.
   - DoD: Firestore CRUD works with optimistic UI; toasts shown; confirmations are accessible.

8) PWA Basics
   - Add manifest + icons; link in layout.
   - DoD: Lighthouse detects manifest/icons; install prompt available where supported.

9) CI Pipeline
   - Add GitHub Actions (lint, typecheck, test, build) on PRs.
   - DoD: Pipeline passes; configured as required for merges.

## Mapping Old → New

- Views (`today`, `library`, `settings`) from `ui.js` → Next pages + React components
- State (`state.js`, `state/Store.js`) → Zustand store; replace `stateListeners` with `subscribe`/selectors
- Logic (`taskLogic.js`, `logic/*`) → `src/lib/domain/*` (pure, no DOM); keep APIs similar
- Firebase (`public/js/firebase.js`) → modular SDK client with typed wrappers; replace DOM loading with toasts

## Notes from Old App Audit

- Entry: `public/js/app.js` initializes offline layer, Firebase, UI, auth, and wires state actions
- UI: `public/js/ui.js` manages views (today/library/settings), event delegation, and rendering
- State: `public/js/state.js` + `state/Store.js` provide getters, setters, metadata calculations, and event bus
- Logic: `public/js/taskLogic.js` exports singleton scheduling and managers; domain logic in `public/js/logic/*`
- Data: `public/js/dataOffline.js` provides offline-enabled APIs and utilities
- Firebase: `public/js/firebase.js` uses global CDN SDK; includes safe wrappers and tab sync callbacks

## Phase 2+ (Post-MVP)

- Timeline view with DnD, inline editing, keyboard shortcuts, autosave/dirty guard
- Comprehensive offline sync queue and background sync
- Performance monitoring and test harness migration
- Full settings editing UI

## Concrete Next Steps

- Follow the numbered steps in `docs/v2-action-plan.md`.
- Provide `.env.local` based on `.env.example` with your Firebase config.
- Track completion in `docs/MIGRATION_STATUS.md`.

## Testing & Tooling

- Tests: Vitest + React Testing Library for store, components, and domain modules.
- Domain scenarios covered: Dependency Chain, Crunch Time, Impossible Day, Flexible Reschedule.
- Lint/Typecheck: ESLint + TypeScript; CI enforces lint/type/test/build on PRs.

---

Use `docs/MIGRATION_STATUS.md` to track progress as each step lands.

## Current Progress

- Completed: Environment configuration (`.env.local`), development env check.
- Completed: Firebase modular client and provider integrated; Firestore offline persistence configured.
- Completed: Scaffolded pages and shared layout; header shows current date and auth state; nav highlights active route.
- Completed: Implemented Zustand store (core slices/selectors) with stubbed scheduler.
- Completed: Auth wired to store; sign-out resets state; header shows sign-out control.
- Completed: Domain port (Recurrence) with unit tests and test scripts.
- Completed: Ported SchedulingEngine (pure) with unit tests covering 4 scenarios.
- Completed: Timeline MVP (grid, sleep shading, now-line, scheduled blocks) implemented.
- Completed: Basic List view (pending/completed/skipped with complete toggle).
- Completed: Library MVP (templates list, minimal CRUD with soft delete, duplicate, toggle).
- Completed: PWA basics (manifest/icons, theme color, metadata linked).
- Completed: CI pipeline (GitHub Actions for lint/type/test/build).
- Next: Refine Settings UI and polish.

## Remaining Actions To Complete This Plan

1) Enforce CI as a required check for merges
   - Configure GitHub branch protection on `main` to require the workflow "CI / build-and-test" before merging and require branches to be up to date.

2) Implement editable Settings UI with persistence
   - Add a form on `/settings` to edit `desiredSleepDuration`, `defaultWakeTime`, and `defaultSleepTime` with validation and save to Firestore; wire to the store.

3) Persist Task Instances to Firestore
   - Create `src/lib/data/instances.ts` (CRUD for `users/{uid}/task_instances`). Load instances for the selected date and update `toggleComplete` to write-through to Firestore (offline-friendly via persistence).

4) Minimal route guards / redirects (client-side)
   - Redirect unauthenticated users from `/today` and `/library` to `/login`; after sign-in, redirect to `/today`.

5) Optional: Cache daily schedules
   - Store computed schedules under `users/{uid}/daily_schedules/{date}` to speed up subsequent loads. Refresh cache when templates/instances change.

6) Add store unit tests (slices/selectors)
   - Tests for `setUser`, `setSettings`, `toggleComplete`, `generateScheduleForDate` to meet the DoD in this plan.
