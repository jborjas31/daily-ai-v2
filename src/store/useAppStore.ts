"use client";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { AuthUser } from "@/lib/firebase/client";
import type { Settings, TaskTemplate, TaskInstance, ScheduleResult, TimeWindow, TimeString } from "@/lib/types";
import { generateSchedule } from "@/lib/domain/scheduling/SchedulingEngine";
import { listInstancesByDate, upsertInstance, deleteInstance, instanceIdFor } from "@/lib/data/instances";
import { getCachedSchedule, putCachedSchedule } from "@/lib/data/schedules";
import { todayISO as localTodayISO } from "@/lib/time";
import { shouldGenerateForDate, type RecurrenceRule } from "@/lib/domain/scheduling/Recurrence";
import { toMinutes } from "@/lib/time";

type SortMode = 'name' | 'priority';
type MandatoryFilter = 'all' | 'mandatory' | 'skippable';

type FiltersState = {
  search: string;
  schedulingType: 'all' | 'flexible' | 'fixed';
  sortMode: SortMode;
  mandatory: MandatoryFilter;
  timeWindows: Set<TimeWindow>;
};

type UiState = {
  viewMode: 'timeline' | 'list';
  currentDate: string; // YYYY-MM-DD
  newTaskPrefill: { time?: TimeString; window?: TimeWindow } | null;
};

type AppState = {
  // Data
  user: AuthUser;
  settings: Settings | null;
  templates: TaskTemplate[];
  instancesByDate: Record<string, TaskInstance[]>;

  // UI/Filters
  ui: UiState;
  filters: FiltersState;
  scheduleCacheByDate: Record<string, ScheduleResult | undefined>;

  // Actions
  setUser: (user: AuthUser) => void;
  setSettings: (settings: Settings) => void;
  setCurrentDate: (date: string) => void;
  setViewMode: (mode: UiState['viewMode']) => void;
  setNewTaskPrefill: (prefill: UiState['newTaskPrefill']) => void;
  // Filter actions
  setFilterSearch: (search: string) => void;
  setFilterSortMode: (mode: SortMode) => void;
  setFilterMandatory: (v: MandatoryFilter) => void;
  toggleFilterTimeWindow: (win: TimeWindow) => void;
  resetFilters: () => void;
  preloadCachedSchedule: (date: string) => Promise<void>;

  setTaskTemplates: (templates: TaskTemplate[]) => void;
  upsertTaskTemplate: (template: TaskTemplate) => void;
  removeTaskTemplate: (id: string) => void;

  setTaskInstancesForDate: (date: string, instances: TaskInstance[]) => void;
  loadInstancesForDate: (date: string) => Promise<void>;
  toggleComplete: (date: string, templateId: string) => Promise<boolean>;
  skipInstance: (date: string, templateId: string, reason?: string) => Promise<boolean>;
  postponeInstance: (date: string, templateId: string, note?: string) => Promise<boolean>;
  undoInstanceStatus: (date: string, templateId: string) => Promise<boolean>;
  setInstanceStartTime: (date: string, templateId: string, start: string) => Promise<boolean>;
  resetAfterSignOut: () => void;

  // Selectors
  getTaskInstancesForDate: (date: string) => TaskInstance[];
  getTemplateById: (id: string) => TaskTemplate | undefined;
  generateScheduleForDate: (date: string) => ScheduleResult;
  getNewTaskPrefill: () => UiState['newTaskPrefill'];
  // Phase 6 — Up Next (5.1)
  computeUpNext: (date: string, nowTime?: TimeString) => UpNextSuggestion;
};

// Use local-time aware today ISO for UI defaults
function todayISO() {
  return localTodayISO();
}

const defaultSettings: Settings = {
  desiredSleepDuration: 7.5,
  defaultWakeTime: "06:30",
  defaultSleepTime: "23:00",
};

export const useAppStore = create<AppState>()(
  devtools(
    immer((set, get) => ({
      user: null,
      settings: defaultSettings,
      templates: [],
      instancesByDate: {},
      ui: {
        viewMode: 'timeline',
        currentDate: todayISO(),
        newTaskPrefill: null,
      },
      filters: {
        search: '',
        schedulingType: 'all',
        sortMode: 'name',
        mandatory: 'all',
        timeWindows: new Set<TimeWindow>(),
      },
      scheduleCacheByDate: {},

      setUser(user) {
        set((s) => { s.user = user; });
      },
      setSettings(settings) {
        set((s) => { s.settings = settings; });
      },
      setCurrentDate(date) {
        set((s) => { s.ui.currentDate = date; });
      },
      setViewMode(mode) {
        set((s) => { s.ui.viewMode = mode; });
      },

      setNewTaskPrefill(prefill) {
        set((s) => { s.ui.newTaskPrefill = prefill; });
      },

      // Filter actions
      setFilterSearch(search) {
        set((s) => { s.filters.search = search; });
      },
      setFilterSortMode(mode) {
        set((s) => { s.filters.sortMode = mode; });
      },
      setFilterMandatory(v) {
        set((s) => { s.filters.mandatory = v; });
      },
      toggleFilterTimeWindow(win) {
        set((s) => {
          const next = new Set(s.filters.timeWindows);
          if (next.has(win)) next.delete(win); else next.add(win);
          s.filters.timeWindows = next;
        });
      },
      resetFilters() {
        set((s) => {
          s.filters.search = '';
          s.filters.schedulingType = 'all';
          s.filters.sortMode = 'name';
          s.filters.mandatory = 'all';
          s.filters.timeWindows = new Set<TimeWindow>();
        });
      },

      async preloadCachedSchedule(date) {
        const u = get().user;
        if (!u) return;
        try {
          const cached = await getCachedSchedule(u.uid, date);
          if (cached) set((s) => { s.scheduleCacheByDate[date] = cached; });
        } catch (e) {
          console.warn('Failed to preload cached schedule', e);
        }
      },

      setTaskTemplates(templates) {
        set((s) => { s.templates = templates; s.scheduleCacheByDate = {}; });
      },
      upsertTaskTemplate(template) {
        set((s) => {
          const idx = s.templates.findIndex(t => t.id === template.id);
          if (idx >= 0) s.templates[idx] = template; else s.templates.push(template);
          s.scheduleCacheByDate = {};
        });
      },
      removeTaskTemplate(id) {
        set((s) => { s.templates = s.templates.filter(t => t.id !== id); s.scheduleCacheByDate = {}; });
      },

      setTaskInstancesForDate(date, instances) {
        set((s) => { s.instancesByDate[date] = instances; s.scheduleCacheByDate[date] = undefined; });
      },

      async loadInstancesForDate(date) {
        const s = get();
        const u = s.user;
        if (!u) return;
        try {
          const items = await listInstancesByDate(u.uid, date);
          set((st) => {
            st.instancesByDate[date] = items;
            // Invalidate schedule cache when instances change
            st.scheduleCacheByDate[date] = undefined;
          });
        } catch (e) {
          console.warn("Failed to load task instances for", date, e);
        }
      },

      async setInstanceStartTime(date, templateId, start) {
        const before = (get().instancesByDate[date] ?? []).map(x => ({ ...x }));
        // Optimistic local update
        let updated: TaskInstance | null = null;
        set((s) => {
          const list = s.instancesByDate[date] ?? [];
          const idx = list.findIndex(i => i.templateId === templateId);
          if (idx >= 0) {
            const inst = list[idx];
            updated = { ...inst, modifiedStartTime: start, status: inst.status || 'pending' } as TaskInstance;
            s.instancesByDate[date] = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
          } else {
            const newInst: TaskInstance = {
              id: instanceIdFor(date, templateId),
              templateId,
              date,
              status: 'pending',
              modifiedStartTime: start,
            };
            updated = newInst;
            s.instancesByDate[date] = [...list, newInst];
          }
          // Invalidate schedule cache for this date
          s.scheduleCacheByDate[date] = undefined;
        });

        const u = get().user;
        if (!u) return true;
        try {
          if (updated) await upsertInstance(u.uid, updated);
          return true;
        } catch (e) {
          console.warn('Failed to persist setInstanceStartTime; reverting', e);
          set((s) => { s.instancesByDate[date] = before; });
          return false;
        }
      },

      async toggleComplete(date, templateId) {
        const before = (get().instancesByDate[date] ?? []).map(x => ({ ...x }));
        let writePayload: TaskInstance | null = null;
        let deleteId: string | null = null;

        set((s) => {
          const list = s.instancesByDate[date] ?? [];
          const idx = list.findIndex(i => i.templateId === templateId);
          if (idx >= 0) {
            const inst = list[idx];
            if (inst.status === 'completed') {
              // Undo completion -> remove instance to return to pending baseline
              deleteId = inst.id;
              s.instancesByDate[date] = [...list.slice(0, idx), ...list.slice(idx + 1)];
            } else {
              // Set to completed
              const updated: TaskInstance = { ...inst, id: inst.id || instanceIdFor(date, templateId), status: 'completed', completedAt: Date.now() };
              writePayload = updated;
              s.instancesByDate[date] = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
            }
          } else {
            // No instance yet -> create a completed instance
            const newInst: TaskInstance = {
              id: instanceIdFor(date, templateId),
              templateId,
              date,
              status: 'completed',
              completedAt: Date.now(),
            };
            writePayload = newInst;
            s.instancesByDate[date] = [...list, newInst];
          }
          // Invalidate schedule cache for this date
          s.scheduleCacheByDate[date] = undefined;
        });

        const u = get().user;
        if (!u) return true; // No persistence when signed out
        try {
          if (deleteId) {
            await deleteInstance(u.uid, deleteId);
          } else if (writePayload) {
            await upsertInstance(u.uid, writePayload);
          }
          return true;
        } catch (e) {
          console.warn('Failed to persist toggleComplete; reverting', e);
          set((s) => { s.instancesByDate[date] = before; });
          return false;
        }
      },

      async skipInstance(date, templateId, reason) {
        const before = (get().instancesByDate[date] ?? []).map(x => ({ ...x }));
        let writePayload: TaskInstance | null = null;

        set((s) => {
          const list = s.instancesByDate[date] ?? [];
          const idx = list.findIndex(i => i.templateId === templateId);
          if (idx >= 0) {
            const inst = list[idx];
            const updated: TaskInstance = {
              ...inst,
              id: inst.id || instanceIdFor(date, templateId),
              status: 'skipped',
              ...(typeof reason === 'string' ? { skippedReason: reason, note: reason } : {}),
            };
            writePayload = updated;
            s.instancesByDate[date] = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
          } else {
            const newInst: TaskInstance = {
              id: instanceIdFor(date, templateId),
              templateId,
              date,
              status: 'skipped',
              ...(typeof reason === 'string' ? { skippedReason: reason, note: reason } : {}),
            };
            writePayload = newInst;
            s.instancesByDate[date] = [...list, newInst];
          }
          // Invalidate schedule cache for this date
          s.scheduleCacheByDate[date] = undefined;
        });

        const u = get().user;
        if (!u) return true;
        try {
          if (writePayload) await upsertInstance(u.uid, writePayload);
          return true;
        } catch (e) {
          console.warn('Failed to persist skipInstance; reverting', e);
          set((s) => { s.instancesByDate[date] = before; });
          return false;
        }
      },

      async postponeInstance(date, templateId, note) {
        const before = (get().instancesByDate[date] ?? []).map(x => ({ ...x }));
        let writePayload: TaskInstance | null = null;

        set((s) => {
          const list = s.instancesByDate[date] ?? [];
          const idx = list.findIndex(i => i.templateId === templateId);
          if (idx >= 0) {
            const inst = list[idx];
            const updated: TaskInstance = {
              ...inst,
              id: inst.id || instanceIdFor(date, templateId),
              status: 'postponed',
              ...(typeof note === 'string' ? { note } : {}),
            };
            writePayload = updated;
            s.instancesByDate[date] = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
          } else {
            const newInst: TaskInstance = {
              id: instanceIdFor(date, templateId),
              templateId,
              date,
              status: 'postponed',
              ...(typeof note === 'string' ? { note } : {}),
            };
            writePayload = newInst;
            s.instancesByDate[date] = [...list, newInst];
          }
          // Invalidate schedule cache for this date
          s.scheduleCacheByDate[date] = undefined;
        });

        const u = get().user;
        if (!u) return true;
        try {
          if (writePayload) await upsertInstance(u.uid, writePayload);
          return true;
        } catch (e) {
          console.warn('Failed to persist postponeInstance; reverting', e);
          set((s) => { s.instancesByDate[date] = before; });
          return false;
        }
      },

      async undoInstanceStatus(date, templateId) {
        const before = (get().instancesByDate[date] ?? []).map(x => ({ ...x }));
        let writePayload: TaskInstance | null = null;
        let deleteId: string | null = null;

        set((s) => {
          const list = s.instancesByDate[date] ?? [];
          const idx = list.findIndex(i => i.templateId === templateId);
          if (idx < 0) {
            // Nothing to undo
            return;
          }
          const inst = list[idx];
          const hasOverride = !!inst.modifiedStartTime;
          if (hasOverride) {
            // Preserve overrides but clear status back to pending
            const updated: TaskInstance = {
              ...inst,
              id: inst.id || instanceIdFor(date, templateId),
              status: 'pending',
              completedAt: undefined,
              skippedReason: undefined,
            };
            writePayload = updated;
            s.instancesByDate[date] = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
          } else {
            // No overrides -> remove instance entirely to return to baseline pending
            deleteId = inst.id || instanceIdFor(date, templateId);
            s.instancesByDate[date] = [...list.slice(0, idx), ...list.slice(idx + 1)];
          }
          // Invalidate schedule cache for this date
          s.scheduleCacheByDate[date] = undefined;
        });

        const u = get().user;
        if (!u) return true;
        try {
          if (deleteId) {
            await deleteInstance(u.uid, deleteId);
          } else if (writePayload) {
            await upsertInstance(u.uid, writePayload);
          }
          return true;
        } catch (e) {
          console.warn('Failed to persist undoInstanceStatus; reverting', e);
          set((s) => { s.instancesByDate[date] = before; });
          return false;
        }
      },

      resetAfterSignOut() {
        set((s) => {
          s.user = null;
          s.templates = [];
          s.instancesByDate = {};
          s.settings = defaultSettings;
          s.scheduleCacheByDate = {};
          s.ui.viewMode = 'timeline';
          s.ui.currentDate = todayISO();
          s.filters.search = '';
          s.filters.schedulingType = 'all';
          s.filters.sortMode = 'name';
          s.filters.mandatory = 'all';
          s.filters.timeWindows = new Set<TimeWindow>();
        });
      },

      getTaskInstancesForDate(date) {
        return get().instancesByDate[date] ?? [];
      },
      getTemplateById(id) {
        return get().templates.find(t => t.id === id);
      },
      generateScheduleForDate(date) {
        const s = get();
        const cached = s.scheduleCacheByDate[date];
        if (cached) return cached;
        const settings = s.settings ?? defaultSettings;
        const templates = s.templates;
        const instances = s.instancesByDate[date] ?? [];
        const result = generateSchedule({ settings, templates, instances, date });
        set((st) => { st.scheduleCacheByDate[date] = result; });
        // Best-effort: write cache to Firestore
        const u = s.user;
        if (u && result.success) {
          // Fire and forget
          void putCachedSchedule(u.uid, date, result).catch((e) => console.warn('Failed to cache schedule', e));
        }
        return result;
      },
      getNewTaskPrefill() {
        return get().ui.newTaskPrefill;
      },
      // Phase 6 — 5.1 Compute "Up Next"
      computeUpNext(date, nowTime) {
        const s = get();
        const settings = s.settings ?? defaultSettings;
        const templates = s.templates;
        const instances = s.instancesByDate[date] ?? [];
        // Compute schedule locally to avoid mutating store during render
        const scheduleRes = generateSchedule({
          settings: s.settings ?? defaultSettings,
          templates: s.templates,
          instances: s.instancesByDate[date] ?? [],
          date,
        });

        // If schedule failed or no templates, bail out
        if (!scheduleRes.success || templates.length === 0) return { kind: 'none' } as UpNextSuggestion;

        const now = nowTime ?? (() => {
          const d = new Date();
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          return `${hh}:${mm}` as TimeString;
        })();
        const nowMin = toMinutes(now);

        // Awake bounds
        const wakeMin = toMinutes(settings.defaultWakeTime);
        const sleepMin = toMinutes(settings.defaultSleepTime);
        const isAwakeNow = nowMin >= wakeMin && nowMin < sleepMin;
        if (!isAwakeNow) return { kind: 'none' } as UpNextSuggestion;

        // Helper maps
        const tmplById = new Map(templates.map(t => [t.id, t] as const));
        const instByTmpl = new Map(instances.map(i => [i.templateId, i] as const));
        const completedSet = new Set(instances.filter(i => i.status === 'completed').map(i => i.templateId));
        const excludedSet = new Set(instances.filter(i => i.status === 'completed' || i.status === 'skipped' || i.status === 'postponed').map(i => i.templateId));
        const blockById = new Map(scheduleRes.schedule.map(b => [b.templateId, b] as const));

        // Determine if a block is an anchor (fixed or manual override)
        const isAnchorBlock = (templateId: string, startTime: TimeString): { anchor: boolean; reason?: 'fixed' | 'override' } => {
          const t = tmplById.get(templateId);
          if (!t) return { anchor: false };
          if (t.schedulingType === 'fixed') return { anchor: true, reason: 'fixed' };
          const inst = instByTmpl.get(templateId);
          if (inst?.modifiedStartTime && inst.modifiedStartTime === startTime) return { anchor: true, reason: 'override' };
          return { anchor: false };
        };

        // 1) If an anchor is active now, return it
        for (const b of scheduleRes.schedule) {
          const start = toMinutes(b.startTime);
          const end = toMinutes(b.endTime);
          if (nowMin >= start && nowMin < end) {
            const a = isAnchorBlock(b.templateId, b.startTime as TimeString);
            if (a.anchor) {
              const t = tmplById.get(b.templateId)!;
              return { kind: 'anchor', template: t, block: { startTime: b.startTime, endTime: b.endTime }, reason: a.reason } as UpNextSuggestion;
            }
          }
        }

        // 2) Otherwise choose best flexible for now (highest priority in current window, not blocked)
        const winMorning = { start: Math.max(wakeMin, toMinutes('06:00' as TimeString)), end: Math.min(sleepMin, toMinutes('12:00' as TimeString)) };
        const winAfternoon = { start: Math.max(wakeMin, toMinutes('12:00' as TimeString)), end: Math.min(sleepMin, toMinutes('18:00' as TimeString)) };
        const winEvening = { start: Math.max(wakeMin, toMinutes('18:00' as TimeString)), end: Math.min(sleepMin, toMinutes('23:00' as TimeString)) };
        const winAny = { start: Math.max(wakeMin, toMinutes('06:00' as TimeString)), end: Math.min(sleepMin, toMinutes('23:00' as TimeString)) };

        let nowWindow: TimeWindow = 'anytime';
        if (nowMin >= winMorning.start && nowMin < winMorning.end) nowWindow = 'morning';
        else if (nowMin >= winAfternoon.start && nowMin < winAfternoon.end) nowWindow = 'afternoon';
        else if (nowMin >= winEvening.start && nowMin < winEvening.end) nowWindow = 'evening';
        else if (!(nowMin >= winAny.start && nowMin < winAny.end)) {
          // Outside suggested windows
          return { kind: 'none' } as UpNextSuggestion;
        }

        const occursToday = (t: TaskTemplate) => shouldGenerateForDate((t.recurrenceRule ?? { frequency: 'none' }) as RecurrenceRule, date);

        const depSatisfied = (t: TaskTemplate): boolean => {
          if (!t.dependsOn) return true;
          if (completedSet.has(t.dependsOn)) return true;
          const depBlock = blockById.get(t.dependsOn);
          if (!depBlock) return false;
          const depEnd = toMinutes(depBlock.endTime as TimeString);
          return depEnd <= nowMin;
        };

        const hasFutureManualAnchor = (t: TaskTemplate): boolean => {
          const inst = instByTmpl.get(t.id);
          if (!inst?.modifiedStartTime) return false;
          const start = toMinutes(inst.modifiedStartTime as TimeString);
          return start > nowMin; // anchored in future, avoid suggesting now
        };

        // Remaining time in current window; prefer tasks that fit, then shortest duration when time is tight
        const winRange = nowWindow === 'morning' ? winMorning : nowWindow === 'afternoon' ? winAfternoon : nowWindow === 'evening' ? winEvening : winAny;
        const remaining = Math.max(0, winRange.end - nowMin);

        const candidates = templates
          .filter(t => (t.isActive !== false))
          .filter(t => occursToday(t))
          .filter(t => t.schedulingType !== 'fixed')
          .filter(t => !excludedSet.has(t.id)) // exclude completed/skipped/postponed for today
          .filter(t => depSatisfied(t)) // dependency-ready only
          .filter(t => !hasFutureManualAnchor(t))
          .filter(t => {
            const win = t.timeWindow ?? 'anytime';
            return win === 'anytime' || win === nowWindow;
          });

        const anyFits = candidates.some(t => (t.durationMinutes || 0) <= remaining);

        const sorted = candidates.slice().sort((a, b) => {
          // 1) Priority ↓
          const pa = a.priority || 0;
          const pb = b.priority || 0;
          if (pb !== pa) return pb - pa;
          // 2) Prefer those that fit in the remaining window
          const fitsA = (a.durationMinutes || 0) <= remaining ? 1 : 0;
          const fitsB = (b.durationMinutes || 0) <= remaining ? 1 : 0;
          if (fitsA !== fitsB) return fitsB - fitsA;
          // 3) Shortest duration when time is tight
          if (anyFits) {
            if (fitsA === 1 && fitsB === 1) {
              const da = a.durationMinutes || 0;
              const db = b.durationMinutes || 0;
              if (da !== db) return da - db;
            }
          } else {
            // No candidates fit: prefer shorter to make progress
            const da = a.durationMinutes || 0;
            const db = b.durationMinutes || 0;
            if (da !== db) return da - db;
          }
          // 4) Earliest fit within current window (based on scheduled block start)
          const ba = blockById.get(a.id);
          const bb = blockById.get(b.id);
          const sa = ba ? toMinutes(ba.startTime as TimeString) : Number.POSITIVE_INFINITY;
          const sb = bb ? toMinutes(bb.startTime as TimeString) : Number.POSITIVE_INFINITY;
          const nextA = sa >= nowMin ? sa : Number.POSITIVE_INFINITY;
          const nextB = sb >= nowMin ? sb : Number.POSITIVE_INFINITY;
          if (nextA !== nextB) return nextA - nextB;
          // 5) Deterministic fallback by name then id
          const nameCmp = (a.taskName || '').localeCompare(b.taskName || '');
          if (nameCmp !== 0) return nameCmp;
          return (a.id || '').localeCompare(b.id || '');
        });

        const top = sorted[0];
        if (!top) return { kind: 'none' } as UpNextSuggestion;
        return { kind: 'flexible', template: top, window: nowWindow } as UpNextSuggestion;
      },
    })),
    { name: 'AppStore' }
  )
);

export type { AppState };

// Up Next output shape
export type UpNextSuggestion =
  | { kind: 'none' }
  | { kind: 'anchor'; template: TaskTemplate; block: { startTime: TimeString; endTime: TimeString }; reason?: 'fixed' | 'override' }
  | { kind: 'flexible'; template: TaskTemplate; window: TimeWindow };
