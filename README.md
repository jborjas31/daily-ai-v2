# Daily AI V2

Daily AI is a personal, time‑based daily task manager with an intelligent scheduling engine. V2 modernizes the original vanilla app using Next.js (App Router), React, Tailwind, Zustand, and Firebase.

## Quickstart

1) Install dependencies

```
npm install
```

2) Set environment variables

- Copy `.env.example` to `.env.local` and ensure the Firebase client keys are set:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`

3) Run the app

```
npm run dev
```

Open http://localhost:3000 and navigate to `/today`.

## Features (MVP)

- Today: timeline (24h grid, sleep shading, now‑line) + basic list
- Timeline DnD: drag non‑mandatory blocks vertically to reposition; snaps to 5‑minute increments and persists
- Library: manage task templates (enable/disable, duplicate, soft delete, edit/create)
- Settings: editable form (sleep duration, default wake/sleep times) with validation and Firestore persistence
- Auth: client‑side Firebase Auth (email/password); `/login` route; route guards redirect unauthenticated users
- Offline: Firestore offline persistence enabled
- Schedule cache: best‑effort cache of computed schedules under `users/{uid}/daily_schedules/{date}`
- PWA basics: manifest + icons (no custom service worker yet)

## Task Actions & Recurrence

- Today actions
  - Pending tasks show Complete, Skip, and Postpone.
  - Completed/Skipped/Postponed sections show Undo to return to Pending.
  - Optional inline notes: add a reason to Skipped or a note to Postponed items.
  - Drag blocks on the Timeline to adjust start time (5‑minute snap); changes persist.

- Validation & modals
  - Task modal validates inputs inline (name, priority, durations, fixed time) and disables Save while invalid or saving.
  - Modals are accessible (title/description wiring) and full‑screen on mobile.

- Recurrence edit scope (Library)
  - When editing a recurring task, a Scope dialog asks how to apply changes:
    - Only this: per‑date override (supports time change; optional status override)
    - This and future: splits the series at the selected date (old gets endDate; new copy starts at target date)
    - All: apply to the entire series
- Scope dialog: `src/components/ui/ScopeDialog.tsx`

## Library Search & Filters

- Search: debounced (~250ms) search across task name and description.
- Filters: combine Mandatory (All/Mandatory/Skippable) and Time window chips (Morning/Afternoon/Evening/Anytime).
  - Fixed‑time tasks are not excluded by Time window filters by design.
- Sort: toggle between Name A–Z and Priority High→Low.
- Reset: one click to clear all filters and restore the full list.
- Dependency badges: show prerequisite status (available, missing, disabled, cycle) when a template depends on another.
- Recently Modified: optional top‑5 rollup based on `updatedAt` metadata.

See Phase 5 plan for details: `docs/phase-5-action-plan.md`.

## Tech Stack

- Next.js 15 (App Router), React 19, Tailwind 4
- Zustand store with `immer` and `devtools`
- Firebase modular SDK: Auth + Firestore
- Domain logic: pure modules in `src/lib/domain/scheduling` (Recurrence, SchedulingEngine)
- Framer Motion for lightweight Timeline drag‑and‑drop
- Toasts via `sonner`, dialogs via Radix
- Tests: Vitest

### Toasts

- Use the centralized helpers in `src/lib/ui/toast.ts` to keep copy consistent across the app.
  - `toastSuccess('save'|'create'|'delete'|'update'|'complete'|'pending'|'skip'|'postpone'|'duplicate'|'enable'|'disable'|'signin')`
  - `toastError(...)` mirrors the same actions (e.g., "Failed to save").
  - `toastResult(action, ok)` dispatches success or error based on a boolean.
  - Keep custom messages (e.g., "Sign in required", detailed error codes) where specificity helps.

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build (static export; see Deploy)
- `npm run start` — start production server
- `npm run lint` — run ESLint
- `npm run typecheck` — TypeScript type check
- `npm run test` — run unit tests (Vitest)
- `npm run test:watch` — watch mode for Vitest

## Project Structure (key paths)

- `src/app/` — routes and layout (`today`, `library`, `settings`)
- `src/components/` — UI components (header/nav, timeline, dialogs, modals)
- `src/store/useAppStore.ts` — Zustand store (state, actions, selectors)
- `src/lib/domain/scheduling/` — Recurrence + SchedulingEngine (pure)
- `src/lib/firebase/client.ts` — Firebase client init + persistence
- `src/lib/data/templates.ts` — Firestore template CRUD helpers
- `src/lib/data/instances.ts` — Firestore CRUD for `task_instances` (write‑through on toggle)
- `src/lib/data/schedules.ts` — cache helpers for computed schedules
- `public/manifest.webmanifest` — PWA manifest + `public/icons/*`

## Data Model

- Firestore collections (per user):
  - `/users/{userId}` — Settings
  - `/users/{userId}/tasks` — Task templates (active/soft‑deleted)
  - `/users/{userId}/task_instances` — Daily task modifications and overrides (e.g., `modifiedStartTime`)
  - `/users/{userId}/daily_schedules` — Per‑day sleep overrides

## Docs & Migration

- Plan: `docs/v2-migration-plan.md`
- Action steps: `docs/v2-action-plan.md`
- Status: `docs/MIGRATION_STATUS.md`
- V1 reference (vanilla app): `old_project/`

## Notes

- Time handling is local device time only (no time zones). Times are stored as `HH:MM` strings.
- Service worker is deferred to post‑MVP; manifest/icons are present for installability.

## Deploy

- Static export is enabled via `next.config.ts` (`output: 'export'`).
- Firebase Hosting deploy runs a fresh build automatically (see `firebase.json` predeploy):
  - `firebase deploy --only hosting`
- If deploying locally from scratch:
  - `rm -rf .next out && npm ci && npm run build && firebase deploy --only hosting`

## CI & Branch Protection

- GitHub Actions pipeline runs lint, typecheck, test, and build on PRs.
- Main branch protection requires the status check `CI / build-and-test` and branches to be up to date.
- Optional script to enforce this via API: `.github/scripts/enforce-branch-protection.sh`.

## Local Environment

- Recommended Node: v20 (matches CI). Vitest may crash under Node 22 in some environments.
- Sign in via email/password on `/login`. Guards redirect to `/login` when unauthenticated.
