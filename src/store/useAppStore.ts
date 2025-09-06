"use client";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { AuthUser } from "@/lib/firebase/client";
import type { Settings, TaskTemplate, TaskInstance, ScheduleResult } from "@/lib/types";
import { generateSchedule } from "@/lib/domain/scheduling/SchedulingEngine";

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

  // Actions
  setUser: (user: AuthUser) => void;
  setSettings: (settings: Settings) => void;
  setCurrentDate: (date: string) => void;
  setViewMode: (mode: UiState['viewMode']) => void;

  setTaskTemplates: (templates: TaskTemplate[]) => void;
  upsertTaskTemplate: (template: TaskTemplate) => void;
  removeTaskTemplate: (id: string) => void;

  setTaskInstancesForDate: (date: string, instances: TaskInstance[]) => void;
  toggleComplete: (date: string, templateId: string) => void;
  resetAfterSignOut: () => void;

  // Selectors
  getTaskInstancesForDate: (date: string) => TaskInstance[];
  getTemplateById: (id: string) => TaskTemplate | undefined;
  generateScheduleForDate: (date: string) => ScheduleResult; // stub for now
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

      setTaskTemplates(templates) {
        set((s) => { s.templates = templates; });
      },
      upsertTaskTemplate(template) {
        set((s) => {
          const idx = s.templates.findIndex(t => t.id === template.id);
          if (idx >= 0) s.templates[idx] = template; else s.templates.push(template);
        });
      },
      removeTaskTemplate(id) {
        set((s) => { s.templates = s.templates.filter(t => t.id !== id); });
      },

      setTaskInstancesForDate(date, instances) {
        set((s) => { s.instancesByDate[date] = instances; });
      },

      toggleComplete(date, templateId) {
        set((s) => {
          const list = s.instancesByDate[date] ?? [];
          const idx = list.findIndex(i => i.templateId === templateId);
          if (idx >= 0) {
            const inst = list[idx];
            if (inst.status === 'completed') {
              // Undo completion -> remove instance to return to pending baseline
              s.instancesByDate[date] = [...list.slice(0, idx), ...list.slice(idx + 1)];
            } else {
              // Set to completed
              const updated: TaskInstance = { ...inst, status: 'completed', completedAt: Date.now() };
              s.instancesByDate[date] = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
            }
          } else {
            // No instance yet -> create a completed instance
            const newInst: TaskInstance = {
              id: `inst-${date}-${templateId}`,
              templateId,
              date,
              status: 'completed',
              completedAt: Date.now(),
            };
            s.instancesByDate[date] = [...list, newInst];
          }
        });
      },

      resetAfterSignOut() {
        set((s) => {
          s.user = null;
          s.templates = [];
          s.instancesByDate = {};
          s.settings = defaultSettings;
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
        const settings = s.settings ?? defaultSettings;
        const templates = s.templates;
        const instances = s.instancesByDate[date] ?? [];
        return generateSchedule({ settings, templates, instances, date });
      },
    })),
    { name: 'AppStore' }
  )
);

export type { AppState };
