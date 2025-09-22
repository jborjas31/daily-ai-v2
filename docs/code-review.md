# Code Review — Daily AI V2 (Cursory)

Date: 2025-09-22

## Overview
- Purpose aligns well with the goal: plan each day with a dynamic schedule, routine management, and focus cues.
- Modern stack: Next.js App Router, React 19, Tailwind 4, Zustand, Firebase (Auth + Firestore), Framer Motion, Vitest.
- Clear separation of concerns:
  - Domain logic in `src/lib/domain/scheduling/*`
  - Store in `src/store/useAppStore.ts`
  - Data access in `src/lib/data/*`
  - UI in `src/components/*` and `src/app/*`
- Strong docs and tests; code is accessible and maintainable.

## Core Features Identified
- Today view: timeline (anchors, overlaps with +X, gap pills, now line, overdue visuals), drag-to-move with persistence.
- “Up Next” strip: chooses active anchor or best flexible task; actions: Start, Skip, Postpone.
- Recurrence + scope editing: All / This and future (split series) / Only this (time override).
- Library: search, filters, sort, dependency badges; duplicate, soft delete.
- Settings: sleep/wake and duration, persisted to Firestore.
- Offline via Firestore persistence; PWA manifest (no custom service worker yet).
- Firestore security rules scoped per-user.

## What’s Working Well
- Scheduling engine correctly handles fixed vs flexible, windows, dependencies, and mandatory checks.
- State design and cache invalidation keep schedules fresh across edits (`useAppStore`).
- Accessibility: ARIA labels, keyboardable popovers/dialogs, focus management.
- Test coverage for timeline geometry (gaps, lanes, overlaps) and “Up Next” behavior.

## Gaps / Risks
- Home route (`/`) is the Next.js starter; consider redirecting to `/today`.
- Crunch‑time logic exists in `SchedulingEngine` (minDuration/advisories/currentTime) but callers don’t pass `currentTime`, so it doesn’t engage.
- “Only this” scope supports time-change overrides; other edits are warned but not supported—could tighten UX to avoid confusion.
- No “carry forward”: postponing doesn’t automatically set up tomorrow’s instance.
- Build config ignores TypeScript/ESLint errors during build (risk of masking issues).
- PWA is minimal: no service worker shell; relies solely on Firestore offline.

## Suggestions (Near‑Term)
- Routing
  - Redirect `/` → `/today` or add a minimal landing that links to Today/Login.
- Scheduling dynamics
  - Pass `currentTime` when generating Today’s schedule to enable crunch‑time min‑duration packing; decide whether timeline should display shortened blocks or keep it advisory-only for “Up Next”.
  - Surface `ScheduleResult.error` (e.g., mandatory tasks exceed waking time) as a small alert on Today.
- Up Next UX
  - Add “Snooze to…” quick actions (this afternoon / tomorrow morning) to set a per‑date override or status.
- Recurrence scope UX
  - In the Scope dialog, gray out or annotate “Only this” when changes aren’t time‑only; or split dialog paths by change type.
- Task lifecycle
  - Optional carry‑over: offer “move to tomorrow” for postponed items (instance on next day, or auto‑prefill window).
- Hardening
  - Remove `ignoreBuildErrors` and `ignoreDuringBuilds` once stable.
  - Add a basic service worker for an offline shell.
- Onboarding
  - First‑run checklist: set wake/sleep, create 2–3 sample templates, explain drag and “Up Next”.

## Notes on Code Quality
- Files are cohesive and well‑named; logic is pure/testable where it matters.
- Firestore rules are appropriately restrictive to the signed‑in user.
- Tests are thoughtful; consider adding more Up Next tie‑breakers and recurrence‑scope edge cases.

## Selected Pointers
- Scheduling: `src/lib/domain/scheduling/SchedulingEngine.ts`, `src/lib/domain/scheduling/Recurrence.ts`
- Store: `src/store/useAppStore.ts`
- Today UI: `src/app/today/page.tsx`, `src/components/today/Timeline.tsx`, `src/components/today/UpNextStrip.tsx`, `src/components/today/TaskList.tsx`
- Data access: `src/lib/data/{templates,instances,schedules}.ts`
- Settings: `src/app/settings/page.tsx`, `src/lib/data/settings.ts`
- Security: `firestore.rules`

---

This review is intentionally cursory and oriented to your stated goal (dynamic day planning + routine management). Happy to expand any section or implement the suggested next steps.

