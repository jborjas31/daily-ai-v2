# Daily AI V2 — Migration Status (Live Checklist)

Update this file as tasks complete. Check items when merged into main.

## Environment & Providers
- [x] `.env.local` created from `.env.example`
- [x] Firebase client provider initialized (`onAuthStateChanged` wired)
- [x] Firestore offline persistence enabled
 - [x] Auth wired to store (setUser/reset on sign-out)

## Routing & Layout
- [x] Pages scaffolded: `/today`, `/library`, `/settings`
- [x] Shared `AppHeader` shows current date and user
- [x] `AppNav` highlights the active route

## Store (Zustand)
- [x] Slices implemented: `user`, `settings`, `templates`, `instances`, `filters`, `ui`
- [x] Selectors implemented: `getTaskInstancesForDate`, `getTemplateById`, `generateScheduleForDate`
- [x] Devtools + immer middleware wired

## Domain (Pure Modules)
- [x] Recurrence module ported with unit tests
- [x] SchedulingEngine ported with unit tests
- [x] Four scenarios pass: Dependency Chain, Crunch Time, Impossible Day, Flexible Reschedule

## Today (MVP)
- [x] Timeline MVP: grid, sleep blocks, now-line, scheduled blocks (no DnD)
- [x] Basic List view: grouped rendering, complete toggle

## Library (MVP)
- [x] Template list with enable/disable/duplicate/delete (confirm)
- [x] Minimal edit modal (core fields)
- [x] Firestore CRUD + optimistic UI updates

## PWA
- [x] Manifest added and linked
- [x] Default icons generated under `public/icons/`

## Hosting
- [x] Firebase Hosting configured (`firebase.json`, `.firebaserc`)
- [x] Next static export configured (`output: 'export'`)
- [ ] Deploy script verified

## CI
- [x] GitHub Actions workflow runs lint/typecheck/test/build on PR
- [ ] Pipeline required for merge

## Docs
- [x] `docs/v2-migration-plan.md` updated with decisions and backlog
- [x] `docs/v2-action-plan.md` committed and followed
 - [x] Root `README.md` updated for V2 context
