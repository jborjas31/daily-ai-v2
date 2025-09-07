# Daily AI V2 — Master Project Blueprint (Modern Next.js)

This blueprint captures the up‑to‑date plan and architecture for the modernized Daily AI app. It supersedes the legacy blueprint under `old_project/PROJECT_MASTER_BLUEPRINT.md` while preserving its intent: a calm, responsive, offline‑friendly daily task manager with an intelligent schedule.

## 1) Project Overview

- Core mission: Create a living schedule that respects anchors, dependencies, and user intent; make small adjustments fast and safe.
- Audience: Single user, personal productivity on phone/tablet/laptop/desktop.
- Pillars: Simple data model, pure domain logic, resilient offline UX, predictable time handling (local time only).

## 2) Architecture (V2)

- Frontend: Next.js 15 (App Router) + React 19 + Tailwind 4
- State: Zustand with `immer` and `devtools`
- Domain: Pure TypeScript modules in `src/lib/domain/scheduling/*` (Recurrence, SchedulingEngine)
- Data/Auth: Firebase modular SDK (Auth + Firestore) with offline persistence enabled
- Hosting: Firebase Hosting with static export (`output: 'export'`); predeploy runs `npm run build`
- PWA: Manifest + icons (no custom service worker in MVP)
- CI: GitHub Actions (lint, typecheck, test, build). Branch protection requires “CI / build-and-test”

CSR/SSR boundaries
- Time‑sensitive logic (clock, auth, Firestore, store, scheduling) runs on the client.
- Server components used only for static shell/layout.

## 3) Data Model (per user)

- `users/{uid}` — Settings: `desiredSleepDuration` (hours), `defaultWakeTime`, `defaultSleepTime`
- `users/{uid}/tasks/{id}` — Task templates (recurrence, priority, mandatory, fixed vs flexible, durations, dependencies)
- `users/{uid}/task_instances/{id}` — Daily modifications/overrides
  - Deterministic ID: `inst-{YYYY-MM-DD}-{templateId}`
  - Fields: `status` (pending/completed/skipped/postponed), `modifiedStartTime?: 'HH:MM'`, `completedAt?`
- `users/{uid}/daily_schedules/{YYYY-MM-DD}` — Cached computed schedule (best‑effort)

Notes
- All times are local device time strings (`'HH:MM'`, 24‑hour). No time zones.
- Firestore offline persistence allows optimistic UI and automatic sync when online.

## 4) Application Surface

Routes (App Router)
- `/today` — Timeline (24h grid with sleep shading, now‑line, scheduled blocks) + basic list
- `/library` — Template management (enable/disable, duplicate, soft delete, edit/create)
- `/settings` — Editable settings form with validation and Firestore persistence
- `/login` — Email/password auth; guards redirect unauthenticated users

Key Components
- `Timeline` — Renders schedule; supports vertical drag to reposition non‑mandatory blocks
- `TaskList` — Pending/Completed/Skipped with Complete/Undo toggle (write‑through to instances)
- `TaskModal` — Minimal template editor
- `ConfirmDialog` — Radix‑based confirm for deletes
- `AppHeader` / `AppNav` — Shared layout shell

## 5) Scheduling Engine (Pure)

- Inputs: `settings`, `templates`, `instances`, `date`, optional `dailyOverride` and `currentTime`
- Algorithm (summary):
  1) Place anchors (fixed tasks) and manual overrides (`instances.modifiedStartTime`)
  2) Resolve dependencies (topological order)
  3) Schedule flexible tasks into windows (morning/afternoon/evening/anytime)
  4) Use min durations in “crunch” cases near anchors
  5) Detect impossibilities (mandatory sum > waking window)
- Outputs: `schedule[]`, `sleepSchedule`, totals, advisories, success/error

Manual overrides
- If an instance has `modifiedStartTime` and is not completed/skipped, it anchors that task at the chosen time and is excluded from flexible placement.

## 6) Timeline Drag‑and‑Drop (MVP scope)

- Tech: Framer Motion for light client‑side DnD (no external DnD framework)
- Behavior:
  - Non‑mandatory blocks are draggable vertically
  - Snap to 5‑minute increments
  - On drop, store calls `setInstanceStartTime(date, templateId, 'HH:MM')`
  - Optimistic local update, write‑through to Firestore, schedule cache invalidated
- Constraints: Mandatory blocks are not draggable in MVP. Cross‑day dragging is out of scope.

## 7) Design System — Calm Productivity

- Visual: Minimalist, ample whitespace, soft shadows, rounded corners, micro‑animations
- Colors: Primary `#3B82F6`; Success `#10B981`; Warning `#F59E0B`; Error `#EF4444`; neutral ramp from light to dark
- Typography: Inter (primary), JetBrains Mono for time; 12–30px scale
- Breakpoints: Mobile 320+, Tablet 768+, Laptop 1024+, Desktop 1440+

## 8) Security, Stability, UX

- Firebase Security Rules: User‑scoped access only
- Route guards: Unauthenticated users are redirected to `/login`
- Errors: Toaster feedback via `sonner`; try/catch on async writes; optimistic revert on failures
- Network: Firestore offline persistence; best‑effort schedule cache

## 9) Developer Experience

Environment
- Node 20 (matches CI). Vitest stability is best under Node 20
- Required env vars in `.env.local`:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`

Scripts
- `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`
- Firebase Hosting deploy runs `npm run build` automatically (predeploy)

Structure (key)
- `src/app/*` pages; `src/components/*` UI
- `src/store/useAppStore.ts` state/actions/selectors (Zustand)
- `src/lib/domain/scheduling/*` pure modules
- `src/lib/data/*` Firestore helpers: `templates`, `instances`, `schedules`, `settings`

CI/CD
- GitHub Actions: lint/typecheck/test/build on PRs
- Branch protection requires status check “CI / build-and-test” and up‑to‑date branches

## 10) Testing

- Vitest unit tests for domain modules and store behavior
- Store tests cover `setUser`/reset, settings impact on schedule, and toggle create/undo
- Keep Firestore out of unit tests (pure store); I/O verified via integration/manual

## 11) Roadmap (Post‑MVP)

- Timeline DnD enhancements: resize handles, mandatory override flow, keyboard nudges
- Shortcuts: quick actions (complete/skip), focus cycle, date navigation
- Background sync/service worker for push‑style refresh
- Advanced conflict/advisory UX
- Settings expansion (categories, quiet hours, DST offsets)
- Performance analytics (Web Vitals + custom timings)

## 12) Differences vs Legacy Blueprint

- Framework: React/Next.js instead of vanilla DOM modules
- State: Zustand store replaces custom bus; selectors drive UI
- Data SDK: Firebase modular SDK, persistence enabled
- Build/Deploy: Static export, Firebase Hosting predeploy build
- Tests: Vitest added for recurrence, scheduling engine, and store
- Manual overrides: `modifiedStartTime` anchors introduced to integrate Timeline DnD with scheduling

---

This blueprint is the single source of truth for Daily AI V2. Use `docs/v2-migration-plan.md` and `docs/MIGRATION_STATUS.md` for tactical steps and progress tracking.

## 13) Steps To Complete (Modernized From Legacy Phases)

The legacy blueprint (see `old_project/README.md`) outlines several phases. Below are the remaining items, adapted to the modern V2 stack, grouped with concise, testable steps.

Phase 4 — Responsive Task Management (polish)
- Modal polish and a11y: ensure focus trap, ARIA labels, Esc/Enter/Tab flows; mobile full‑screen layout.
- Intelligent pre‑fill: pass timeline click time/window into “New Task”; seed defaults from context + template defaults.
- Validation UX: inline messages for name/duration/priority/start≤end; disable submit while saving; no double submit.
- Core actions wiring: add Skip/Postpone (instances) alongside Complete/Undo; optimistic updates + toasts.
- Recurrence edit scope: “Only this / This and future / All” using split‑and‑create strategy for “this and future”.

Phase 5 — Library & Search
- Client search (name/description) with debounce; priority sort toggle.
- Category sections: active, inactive/deleted, and optional “recently modified”.
- Filters: mandatory vs skippable; time window (morning/afternoon/evening/anytime).
- Dependency indicator: show when a template is blocked by another.

Phase 6 — Real‑Time & Overlaps
- Overdue logic: treat mandatory vs skippable differently; annotate blocks/list; add “overdue” state.
- Overlap rendering: share width for simultaneous blocks (mobile 2‑way, tablet/desktop 3‑way) with “+X more” overflow.
- Update cadence: ensure now‑line/clock/task state checks tick ~30s without jank on mobile.

Phase 7 — Offline Enhancements (beyond Firestore persistence)
- Optional write queue wrapper for user‑visible syncing states and retry/backoff; conflict toast with “retry/undo”.
- Background sync (post‑MVP): service worker integration to flush queue when the app is reopened.

Phase 8 — Smart Countdown
- Between anchors countdown component (next fixed/override block); compact on mobile; optional in header.

Phase 9 — Scheduling Engine Enhancements
- Cross‑midnight tasks: allow windows/anchors to span midnight; ensure sleep boundaries are respected.
- Circular dependency detection: surface readable error/advisory if a cycle exists.
- Performance guardrails: soft cap and warning for 100+ templates/instances per day.

Phase 10 — Triage Advisor
- “Impossible Day” assistant: when mandatory > awake or conflicts persist, propose minimal edits (reduce to min duration, flip skippables, suggest deferrals) with one‑click apply.

Phase 11 — Dynamic Scheduler
- Live adapt on user actions (complete/skip/postpone/drag): subtle re‑seat flexible tasks; show brief advisories.
- Keyboard nudges for Timeline (↑/↓ in 5‑min steps) with the same write‑through path as drag.

Phase 12 — PWA & Polish
- Add a minimal service worker (workbox/vite‑plugin‑pwa) for offline shell caching of static assets.
- Install prompt polish; icon/manifest checks; theme color consistency.
- Performance telemetry: Web Vitals + lightweight custom timings for schedule compute.

QA & Tests (ongoing)
- Expand unit tests around SchedulingEngine (cross‑midnight, overlaps, advisories) and store actions.
- Add focused component tests for Timeline rendering variants (overlaps, overdue, drag snap) where feasible.
