"use client";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { AuthUser } from "@/lib/firebase/client";
import type { Settings, TaskTemplate, TaskInstance, ScheduleResult, TimeWindow, TimeString } from "@/lib/types";
import { generateSchedule } from "@/lib/domain/scheduling/SchedulingEngine";
import { listInstancesByDate, upsertInstance, deleteInstance, instanceIdFor } from "@/lib/data/instances";
import { getCachedSchedule, putCachedSchedule } from "@/lib/data/schedules";

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
};

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
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
    })),
    { name: 'AppStore' }
  )
);

export type { AppState };
