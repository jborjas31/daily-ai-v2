"use client";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { AuthUser } from "@/lib/firebase/client";
import type { Settings, TaskTemplate, TaskInstance, ScheduleResult } from "@/lib/types";
import { generateSchedule } from "@/lib/domain/scheduling/SchedulingEngine";
import { listInstancesByDate, upsertInstance, deleteInstance, instanceIdFor } from "@/lib/data/instances";
import { getCachedSchedule, putCachedSchedule } from "@/lib/data/schedules";

type FiltersState = {
  search: string;
  schedulingType: 'all' | 'flexible' | 'fixed';
};

type UiState = {
  viewMode: 'timeline' | 'list';
  currentDate: string; // YYYY-MM-DD
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
  preloadCachedSchedule: (date: string) => Promise<void>;

  setTaskTemplates: (templates: TaskTemplate[]) => void;
  upsertTaskTemplate: (template: TaskTemplate) => void;
  removeTaskTemplate: (id: string) => void;

  setTaskInstancesForDate: (date: string, instances: TaskInstance[]) => void;
  loadInstancesForDate: (date: string) => Promise<void>;
  toggleComplete: (date: string, templateId: string) => Promise<boolean>;
  resetAfterSignOut: () => void;

  // Selectors
  getTaskInstancesForDate: (date: string) => TaskInstance[];
  getTemplateById: (id: string) => TaskTemplate | undefined;
  generateScheduleForDate: (date: string) => ScheduleResult;
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
      },
      filters: {
        search: '',
        schedulingType: 'all',
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
          set((st) => { st.instancesByDate[date] = items; });
        } catch (e) {
          console.warn("Failed to load task instances for", date, e);
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
    })),
    { name: 'AppStore' }
  )
);

export type { AppState };
