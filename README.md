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

- Today view: timeline (24h grid, sleep shading, now‑line) plus a basic list
- Library: manage task templates (enable/disable, duplicate, soft delete, edit/create)
- Settings: read‑only placeholder (editable UI coming next)
- Auth: client‑side Firebase Auth (email/password); sign out in header
- Offline: Firestore offline persistence enabled
- PWA basics: manifest + icons (no custom service worker yet)

## Tech Stack

- Next.js 15 (App Router), React 19, Tailwind 4
- Zustand store with `immer` and `devtools`
- Firebase modular SDK: Auth + Firestore
- Domain logic: pure modules in `src/lib/domain/scheduling` (Recurrence, SchedulingEngine)
- Tests: Vitest

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — run ESLint
- `npm run typecheck` — TypeScript type check
- `npm run test` — run unit tests (Vitest)

## Project Structure (key paths)

- `src/app/` — routes and layout (`today`, `library`, `settings`)
- `src/components/` — UI components (header/nav, timeline, dialogs, modals)
- `src/store/useAppStore.ts` — Zustand store (state, actions, selectors)
- `src/lib/domain/scheduling/` — Recurrence + SchedulingEngine (pure)
- `src/lib/firebase/client.ts` — Firebase client init + persistence
- `src/lib/data/templates.ts` — Firestore template CRUD helpers
- `public/manifest.webmanifest` — PWA manifest + `public/icons/*`

## Data Model

- Firestore collections (per user):
  - `/users/{userId}` — Settings
  - `/users/{userId}/tasks` — Task templates (active/soft‑deleted)
  - `/users/{userId}/task_instances` — Daily task modifications
  - `/users/{userId}/daily_schedules` — Per‑day sleep overrides

## Docs & Migration

- Plan: `docs/v2-migration-plan.md`
- Action steps: `docs/v2-action-plan.md`
- Status: `docs/MIGRATION_STATUS.md`
- V1 reference (vanilla app): `old_project/`

## Notes

- Time handling is local device time only (no time zones). Times are stored as `HH:MM` strings.
- Service worker is deferred to post‑MVP; manifest/icons are present for installability.
