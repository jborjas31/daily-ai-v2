"use client";
import React, { useEffect, useMemo, useState, useId } from "react";
import useRequireAuth from "@/components/guards/useRequireAuth";
import { useAppStore } from "@/store/useAppStore";
import type { AppState } from "@/store/useAppStore";
import type { TaskTemplate } from "@/lib/types";
import { listTemplates, updateTemplate, duplicateTemplate, softDeleteTemplate, createTemplate } from "@/lib/data/templates";
import type { RecurrenceRule } from "@/lib/domain/scheduling/Recurrence";
import { formatDate } from "@/lib/domain/scheduling/Recurrence";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ScopeDialog, { type EditScope } from "@/components/ui/ScopeDialog";
import TaskModal from "@/components/library/TaskModal";
import { toast, } from "sonner";
import { toastError, toastSuccess, toastResult } from "@/lib/ui/toast";
import useDebouncedValue from "@/lib/utils/useDebouncedValue";
import { filterTemplates, sortTemplates } from "@/lib/templates/filtering";
import { buildById, getDependencyStatus } from "@/lib/templates/dependencies";

export default function LibraryPage() {
  const { user, ready } = useRequireAuth();
  const templates = useAppStore((s: AppState) => s.templates);
  const setTaskTemplates = useAppStore((s: AppState) => s.setTaskTemplates);
  const upsert = useAppStore((s: AppState) => s.upsertTaskTemplate);
  const currentDate = useAppStore((s: AppState) => s.ui.currentDate);
  const search = useAppStore((s: AppState) => s.filters.search);
  const setFilterSearch = useAppStore((s: AppState) => s.setFilterSearch);
  const sortMode = useAppStore((s: AppState) => s.filters.sortMode);
  const setFilterSortMode = useAppStore((s: AppState) => s.setFilterSortMode);
  const mandatory = useAppStore((s: AppState) => s.filters.mandatory);
  const setFilterMandatory = useAppStore((s: AppState) => s.setFilterMandatory);
  const timeWindows = useAppStore((s: AppState) => s.filters.timeWindows);
  const toggleFilterTimeWindow = useAppStore((s: AppState) => s.toggleFilterTimeWindow);
  const resetFilters = useAppStore((s: AppState) => s.resetFilters);
  const setInstanceStartTime = useAppStore((s: AppState) => s.setInstanceStartTime);
  const toggleComplete = useAppStore((s: AppState) => s.toggleComplete);
  const skipInstance = useAppStore((s: AppState) => s.skipInstance);
  const postponeInstance = useAppStore((s: AppState) => s.postponeInstance);
  const undoInstanceStatus = useAppStore((s: AppState) => s.undoInstanceStatus);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<TaskTemplate | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<{ prev: TaskTemplate; next: TaskTemplate } | null>(null);
  const [searchDraft, setSearchDraft] = useState<string>(search ?? "");
  const debouncedSearch = useDebouncedValue(searchDraft, 250);
  // A11y label ids for control groups
  const sortLabelId = useId();
  const mandatoryLabelId = useId();
  const timeWindowLabelId = useId();

  useEffect(() => {
    setFilterSearch(debouncedSearch);
  }, [debouncedSearch, setFilterSearch]);

  function isRecurringTemplate(t: TaskTemplate | null | undefined): boolean {
    if (!t) return false;
    const freq = ((t.recurrenceRule as unknown as RecurrenceRule | undefined)?.frequency) ?? 'none';
    return freq !== 'none';
  }

  function hasRecurrenceAffectingChanges(prev: TaskTemplate, next: Omit<TaskTemplate, 'id'> | TaskTemplate): boolean {
    const n = next as TaskTemplate;
    if (prev.schedulingType !== n.schedulingType) return true;
    if ((prev.durationMinutes || 0) !== (n.durationMinutes || 0)) return true;
    if (n.schedulingType === 'fixed') {
      if ((prev.defaultTime || '') !== (n.defaultTime || '')) return true;
    } else {
      if ((prev.timeWindow || 'anytime') !== (n.timeWindow || 'anytime')) return true;
    }
    const prevRule = (prev.recurrenceRule ?? null);
    const nextRule = (n.recurrenceRule ?? null);
    try {
      if (JSON.stringify(prevRule) !== JSON.stringify(nextRule)) return true;
    } catch {}
    return false;
  }

  useEffect(() => {
    (async () => {
      if (!ready || !user) return;
      setLoading(true);
      try {
        const list = await listTemplates(user.uid);
        setTaskTemplates(list);
      } catch {
        toast.error("Failed to load templates");
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, user, setTaskTemplates]);

  const filteredSorted = useMemo(() => {
    const filtered = filterTemplates(templates, {
      query: search,
      mandatory,
      timeWindows,
    });
    return sortTemplates(filtered, sortMode);
  }, [templates, search, mandatory, timeWindows, sortMode]);

  const active = useMemo(() => filteredSorted.filter(t => t.isActive !== false), [filteredSorted]);
  const inactive = useMemo(() => filteredSorted.filter(t => t.isActive === false), [filteredSorted]);
  const byId = useMemo(() => buildById(templates), [templates]);

  function updatedAtMillis(v: unknown): number {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    try {
      // Firestore Timestamp
      const f: any = v as any;
      if (typeof f.toMillis === 'function') return f.toMillis();
      if (typeof f.seconds === 'number') return f.seconds * 1000 + Math.floor((f.nanoseconds || 0) / 1e6);
    } catch {}
    return 0;
  }

  const recent = useMemo(() => {
    const withTs = templates
      .map((t) => ({ t, ms: updatedAtMillis((t as any).updatedAt) }))
      .filter((x) => x.ms > 0);
    withTs.sort((a, b) => b.ms - a.ms);
    return withTs.slice(0, 5).map((x) => x.t);
  }, [templates]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold">Library</h1>
        </div>
        <p className="text-sm text-black/70 dark:text-white/70">Loading…</p>
      </div>
    );
  }

  async function toggleActive(t: TaskTemplate) {
    if (!user) return;
    const newVal = !(t.isActive !== false);
    upsert({ ...t, isActive: newVal });
    try {
      await updateTemplate(user.uid, t.id, { isActive: newVal });
      toastSuccess(newVal ? 'enable' : 'disable');
    } catch {
      upsert({ ...t });
      toastError(newVal ? 'enable' : 'disable');
    }
  }

  async function onDuplicate(t: TaskTemplate) {
    if (!user) return;
    try {
      const created = await duplicateTemplate(user.uid, t);
      upsert(created);
      toastSuccess('duplicate');
    } catch {
      toastError('duplicate');
    }
  }

  async function onDelete(id: string) {
    if (!user) return;
    const t = templates.find(x=>x.id===id);
    if (!t) return;
    upsert({ ...t, isActive: false });
    try {
      await softDeleteTemplate(user.uid, id);
      toastSuccess('delete');
    } catch {
      upsert({ ...t });
      toastError('delete');
    }
  }

  async function onSaveModal(payload: Omit<TaskTemplate, 'id'> | TaskTemplate) {
    if (!user) return;
    if ('id' in payload) {
      // edit
      const prev = templates.find(x => x.id === payload.id) || null;
      const needsScope = isRecurringTemplate(prev) && hasRecurrenceAffectingChanges(prev as TaskTemplate, payload);
      if (needsScope && prev) {
        // Defer the actual save until user selects a scope
        setPendingEdit({ prev, next: payload as TaskTemplate });
        setScopeOpen(true);
        setModalOpen(false);
        return;
      }

      // No scope prompt needed — proceed with ALL update
      upsert(payload as TaskTemplate);
      try {
        await updateTemplate(user.uid, payload.id, payload);
        toastSuccess('save');
      } catch {
        toastError('save');
      }
    } else {
      // create
      try {
        const created = await createTemplate(user.uid, payload);
        upsert(created);
        toastSuccess('create');
      } catch {
        toastError('create');
      }
    }
  }

  async function handleScopeSelect(scope: EditScope, options?: { status?: 'pending'|'completed'|'skipped'|'postponed' }) {
    if (!user || !pendingEdit) return;
    const { prev, next } = pendingEdit;
    setPendingEdit(null);
    setScopeOpen(false);

    if (scope === 'all') {
      // Apply update to entire series
      upsert(next);
      try {
        await updateTemplate(user.uid, next.id, next);
        toastSuccess('save');
      } catch {
        toastError('save');
      }
      return;
    }

    if (scope === 'only') {
      // Limit initial support to start-time overrides
      if (next.schedulingType === 'fixed' && next.defaultTime) {
        const ok = await setInstanceStartTime(currentDate, next.id, next.defaultTime);
        toastResult('update', ok);
      } else {
        // Not supported yet – no-op with guidance
        toast.error('Only-this edits currently support time changes only');
      }
      // Apply optional status override
      if (options?.status) {
        let ok = true;
        if (options.status === 'completed') ok = await toggleComplete(currentDate, next.id);
        else if (options.status === 'skipped') ok = await skipInstance(currentDate, next.id);
        else if (options.status === 'postponed') ok = await postponeInstance(currentDate, next.id);
        else if (options.status === 'pending') ok = await undoInstanceStatus(currentDate, next.id);
        if (options.status === 'completed') toastResult('complete', ok);
        else if (options.status === 'skipped') toastResult('skip', ok);
        else if (options.status === 'postponed') toastResult('postpone', ok);
        else toastResult('pending', ok);
      }
      return;
    }

    if (scope === 'future') {
      // Split series: end old at day before target; create new from target with updates
      try {
        const target = new Date(currentDate);
        const prevDay = new Date(target);
        prevDay.setDate(target.getDate() - 1);
        const prevEnd = formatDate(prevDay);

        const basePrevRule = ((prev.recurrenceRule ?? {}) as RecurrenceRule);
        const updatedPrevRule: RecurrenceRule = { ...basePrevRule, endDate: prevEnd };
        await updateTemplate(user.uid, prev.id, { recurrenceRule: updatedPrevRule });
        upsert({ ...prev, recurrenceRule: updatedPrevRule });

        const baseNextRule = ((next.recurrenceRule ?? basePrevRule) as RecurrenceRule);
        const updatedNextRule: RecurrenceRule = { ...baseNextRule, startDate: currentDate, endDate: undefined };
        const newPayload: Omit<TaskTemplate, 'id'> = {
          taskName: next.taskName,
          description: next.description,
          isMandatory: next.isMandatory,
          priority: next.priority,
          isActive: next.isActive,
          schedulingType: next.schedulingType,
          defaultTime: next.defaultTime,
          timeWindow: next.timeWindow,
          durationMinutes: next.durationMinutes,
          minDurationMinutes: next.minDurationMinutes,
          dependsOn: next.dependsOn,
          recurrenceRule: updatedNextRule,
        };
        const created = await createTemplate(user.uid, newPayload);
        upsert(created);
        toastSuccess('save');
      } catch {
        toastError('save');
      }
      return;
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Library</h1>
        <button
          type="button"
          onClick={() => { setEditItem(null); setModalOpen(true); }}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          New Task
        </button>
      </div>
      {/* Toolbar: Search (debounced) + Sort toggle + Mandatory filter + Time window chips + Reset */}
      <div className="mb-4 flex items-end gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <label htmlFor="librarySearch" className="block text-sm mb-1">Search</label>
          <div className="flex items-center gap-2">
            <input
              id="librarySearch"
              type="text"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search by name or description..."
              className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
            {searchDraft ? (
              <button
                type="button"
                onClick={() => { setSearchDraft(""); setFilterSearch(""); }}
                className="px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                aria-label="Clear search"
                title="Clear search"
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>
        <div>
          <span id={sortLabelId} className="block text-sm mb-1">Sort</span>
          <div role="group" aria-labelledby={sortLabelId} className="inline-flex rounded-md overflow-hidden border border-black/10 dark:border-white/10">
            <button
              type="button"
              onClick={() => setFilterSortMode('name')}
              aria-pressed={sortMode === 'name'}
              className={`px-3 py-1.5 text-sm ${sortMode === 'name' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2`}
              title="Sort by name (A–Z)"
            >
              Name A–Z
            </button>
            <button
              type="button"
              onClick={() => setFilterSortMode('priority')}
              aria-pressed={sortMode === 'priority'}
              className={`px-3 py-1.5 text-sm border-l border-black/10 dark:border-white/10 ${sortMode === 'priority' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2`}
              title="Sort by priority (High→Low)"
            >
              Priority High→Low
            </button>
          </div>
        </div>
        <div>
          <span id={mandatoryLabelId} className="block text-sm mb-1">Mandatory</span>
          <div role="group" aria-labelledby={mandatoryLabelId} className="inline-flex rounded-md overflow-hidden border border-black/10 dark:border-white/10">
            <button
              type="button"
              onClick={() => setFilterMandatory('all')}
              aria-pressed={mandatory === 'all'}
              className={`px-3 py-1.5 text-sm ${mandatory === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2`}
              title="Show all tasks"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterMandatory('mandatory')}
              aria-pressed={mandatory === 'mandatory'}
              className={`px-3 py-1.5 text-sm border-l border-black/10 dark:border-white/10 ${mandatory === 'mandatory' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2`}
              title="Show mandatory tasks only"
            >
              Mandatory
            </button>
            <button
              type="button"
              onClick={() => setFilterMandatory('skippable')}
              aria-pressed={mandatory === 'skippable'}
              className={`px-3 py-1.5 text-sm border-l border-black/10 dark:border-white/10 ${mandatory === 'skippable' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2`}
              title="Show skippable tasks only"
            >
              Skippable
            </button>
          </div>
        </div>
        <div>
          <span id={timeWindowLabelId} className="block text-sm mb-1">Time window</span>
          <div role="group" aria-labelledby={timeWindowLabelId} className="inline-flex flex-wrap gap-2">
            {(['morning','afternoon','evening','anytime'] as const).map((w) => {
              const selected = timeWindows.has(w);
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => toggleFilterTimeWindow(w)}
                  aria-pressed={selected}
                  className={`px-3 py-1.5 text-sm rounded-full border border-black/10 dark:border-white/10 ${selected ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2`}
                  title={`Toggle ${w}`}
                >
                  {w[0].toUpperCase() + w.slice(1)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="ml-auto">
          <span className="block text-sm mb-1 invisible">Reset</span>
          <button
            type="button"
            onClick={() => { resetFilters(); setSearchDraft(''); }}
            className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            title="Reset all filters"
          >
            Reset Filters
          </button>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-black/70 dark:text-white/70">Loading…</p>
      ) : (
        <>
        {recent.length > 0 && (
          <section className="border rounded-md p-3 mb-4">
            <h2 className="font-semibold mb-2">Recently Modified ({recent.length})</h2>
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {recent.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t.taskName}</div>
                    <div className="text-sm text-black/60 dark:text-white/60">{t.schedulingType === 'fixed' ? `Fixed @ ${t.defaultTime}` : `Flexible (${t.timeWindow})`} • {t.durationMinutes}m</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-700" onClick={()=>{ setEditItem(t); setModalOpen(true); }}>Edit</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="border rounded-md p-3">
            <h2 className="font-semibold mb-2">Active ({active.length})</h2>
            {active.length === 0 ? (
              <p className="text-sm text-black/60 dark:text-white/60">No active templates.</p>
            ) : (
              <ul className="divide-y divide-black/10 dark:divide-white/10">
                {active.map((t) => {
                  const dep = getDependencyStatus(t, byId);
                  const isCycle = dep?.status === 'cycle';
                  const depName = dep?.dependsOnName ?? dep?.dependsOnId;
                  const depTitle = isCycle
                    ? 'Dependency cycle'
                    : dep?.status === 'disabled'
                      ? 'Prerequisite disabled'
                      : dep?.status === 'missing'
                        ? 'Prerequisite missing'
                        : dep
                          ? 'Prerequisite available'
                          : undefined;
                  const depClass = isCycle
                    ? 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100'
                    : dep?.status === 'disabled'
                      ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                      : dep?.status === 'missing'
                        ? 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100'
                        : 'bg-slate-200 text-black/80 dark:bg-slate-700 dark:text-white/80';
                  return (
                    <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{t.taskName}</div>
                        <div className="text-sm text-black/60 dark:text-white/60">{t.schedulingType === 'fixed' ? `Fixed @ ${t.defaultTime}` : `Flexible (${t.timeWindow})`} • {t.durationMinutes}m</div>
                        {dep ? (
                          <div className="mt-1">
                            <span
                              className={`inline-block text-xs px-2 py-0.5 rounded-full ${depClass}`}
                              title={depTitle}
                              aria-label={isCycle ? 'Dependency cycle' : undefined}
                            >
                              {isCycle ? 'Cycle' : <>Depends on {depName}</>}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <button className="px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-700" onClick={()=>{ setEditItem(t); setModalOpen(true); }}>Edit</button>
                        <button className="px-2 py-1 rounded-md bg-emerald-600 text-white" onClick={()=>toggleActive(t)}>Disable</button>
                        <button className="px-2 py-1 rounded-md bg-blue-600 text-white" onClick={()=>onDuplicate(t)}>Duplicate</button>
                        <button className="px-2 py-1 rounded-md bg-rose-600 text-white" onClick={()=>setConfirm({ id: t.id, name: t.taskName })}>Delete</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="border rounded-md p-3">
            <h2 className="font-semibold mb-2">Deleted / Inactive ({inactive.length})</h2>
            {inactive.length === 0 ? (
              <p className="text-sm text-black/60 dark:text-white/60">None.</p>
            ) : (
              <ul className="divide-y divide-black/10 dark:divide-white/10">
                {inactive.map((t) => {
                  const dep = getDependencyStatus(t, byId);
                  const isCycle = dep?.status === 'cycle';
                  const depName = dep?.dependsOnName ?? dep?.dependsOnId;
                  const depTitle = isCycle
                    ? 'Dependency cycle'
                    : dep?.status === 'disabled'
                      ? 'Prerequisite disabled'
                      : dep?.status === 'missing'
                        ? 'Prerequisite missing'
                        : dep
                          ? 'Prerequisite available'
                          : undefined;
                  const depClass = isCycle
                    ? 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100'
                    : dep?.status === 'disabled'
                      ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                      : dep?.status === 'missing'
                        ? 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100'
                        : 'bg-slate-200 text-black/80 dark:bg-slate-700 dark:text-white/80';
                  return (
                    <li key={t.id} className="py-2 flex items-center justify-between gap-3 opacity-70">
                      <div>
                        <div className="font-medium">{t.taskName}</div>
                        <div className="text-sm text-black/60 dark:text-white/60">{t.schedulingType === 'fixed' ? `Fixed @ ${t.defaultTime}` : `Flexible (${t.timeWindow})`} • {t.durationMinutes}m</div>
                        {dep ? (
                          <div className="mt-1">
                            <span
                              className={`inline-block text-xs px-2 py-0.5 rounded-full ${depClass}`}
                              title={depTitle}
                              aria-label={isCycle ? 'Dependency cycle' : undefined}
                            >
                              {isCycle ? 'Cycle' : <>Depends on {depName}</>}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <button className="px-2 py-1 rounded-md bg-emerald-600 text-white" onClick={()=>toggleActive(t)}>Restore</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Delete Task"
        description={confirm ? `Delete “${confirm.name}”? This is a soft delete (can restore).` : ''}
        confirmText="Delete"
        onConfirm={() => { if (confirm) onDelete(confirm.id); }}
        onOpenChange={(o)=>{ if (!o) setConfirm(null); }}
      />
      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initial={editItem}
        onSave={onSaveModal}
      />
      {/* Scope dialog for recurring edits */}
      <ScopeDialog
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        onSelect={handleScopeSelect}
        templateName={pendingEdit?.next.taskName}
        targetDate={currentDate}
      />
    </div>
  );
}
