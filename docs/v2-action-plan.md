# Daily AI V2 — Action Plan (Bite-Sized, Numbered)

Use this sequence to implement V2 step by step. Each step is small and verifiable.

1) Create environment config — COMPLETED
   - Add `.env.local` using `.env.example` values.
   - Verify `NEXT_PUBLIC_*` keys load by logging in a temporary client module.
   - Status: `.env.local` added; env verified in dev; removed temporary `EnvDebug` utility.

2) Add Firebase client provider — COMPLETED
   - Files: `src/lib/firebase/client.ts`, `src/components/providers/FirebaseClientProvider.tsx`, `src/components/providers/Providers.tsx`.
   - Initialize modular SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`).
   - Enable Firestore offline persistence; export `useAuth()` hook; wrap app in provider via `src/app/layout.tsx`.
   - Status: Provider mounted, `onAuthStateChanged` wired, persistence attempted with multi-tab fallback.

3) Scaffold pages and shared layout — COMPLETED
   - Pages: `src/app/today/page.tsx`, `src/app/library/page.tsx`, `src/app/settings/page.tsx` (client components).
   - Shared: `src/components/AppHeader.tsx`, `src/components/AppNav.tsx`.
   - Show current date in header; highlight active nav.
   - Status: Header with current date and auth state; nav highlights active route; pages render placeholders.

4) Add Zustand store (core slices) — COMPLETED
   - File: `src/store/useAppStore.ts` with slices: `user`, `settings`, `templates`, `instances`, `ui`, `filters`.
   - Include `devtools` and `immer` middleware.
   - Selectors: `getTaskInstancesForDate(date)`, `getTemplateById(id)`, `generateScheduleForDate(date)` (stub).
   - Status: Store created with default settings, date, and stub scheduler; types added under `src/lib/types`.

5) Wire auth to store and UI — COMPLETED
   - On `onAuthStateChanged`, call `setUser` and reset state on sign-out.
   - In layout, guard routes (simple client check; can add `/login` later).
   - Status: Store syncs with auth state; sign-out button added to header; state resets on sign-out.

6) Port domain: Recurrence (pure) — COMPLETED
   - Files: `src/lib/domain/scheduling/Recurrence.ts` (pure functions).
   - Implemented daily/weekly/monthly/yearly/custom rules; date range checks; helpers.
   - Added unit tests `src/lib/domain/scheduling/Recurrence.test.ts`; test scripts added to package.json.

7) Port domain: SchedulingEngine (pure) — COMPLETED
   - File: `src/lib/domain/scheduling/SchedulingEngine.ts`.
   - Input: `{ settings, templates, instances, dailyOverride, date, currentTime? }`.
   - Output: `{ success, schedule, sleepSchedule, totalTasks, scheduledTasks, error?, advisories? }`.
   - Unit tests added for 4 scenarios: Dependency Chain, Crunch Time, Impossible Day, Flexible Reschedule.

8) Today — Timeline MVP — COMPLETED
   - Component: `src/components/today/Timeline.tsx` (client component).
   - Features: 24h vertical grid, sleep blocks, now-line, render scheduled blocks (no DnD yet).
   - Data: Uses store selector `generateScheduleForDate(date)` integrated with SchedulingEngine.
   - Status: Timeline renders schedule, shades sleep, auto-scrolls to now.

9) Today — Basic List — COMPLETED
   - Component: `src/components/today/TaskList.tsx`.
   - Renders instances grouped by state (pending/completed/skipped);
     derives pending from schedule minus completed/skipped; simple Complete/Undo toggle updates store.
   - Status: List renders under timeline; toggling completion re-runs schedule via selector.

10) Library — MVP — COMPLETED
   - Page UI: list templates with enable/disable/restore, duplicate, delete (soft, confirm).
   - Components: `ConfirmDialog` (Radix), `TaskModal` (minimal fields) and `ToasterProvider` (sonner) added to layout.
   - Persistence: Firestore reads/writes under `users/{uid}/tasks`; optimistic UI; toasts on success/failure.

11) PWA basics — COMPLETED
   - Added `public/manifest.webmanifest` (name Daily AI, short_name DailyAI, theme `#3B82F6`).
   - Generated default SVG icons under `public/icons/` (192, 512, maskable) and linked manifest via layout metadata.

12) CI pipeline — COMPLETED
   - Added GitHub Actions workflow (`.github/workflows/ci.yml`) to run lint, typecheck, test, and build on pushes/PRs to `main`.
   - Scripts added: `typecheck`, and tests already wired via Vitest.

13) Documentation updates — COMPLETED
   - Updated `README.md` (V2 context, quickstart, scripts, structure, links).
   - Kept `docs/MIGRATION_STATUS.md` up to date throughout.

14) Nice-to-haves (post-MVP)
   - Timeline DnD, keyboard shortcuts, background sync, advanced toasts, analytics for performance.
