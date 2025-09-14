"use client";
import * as Dialog from "@radix-ui/react-dialog";
import React, { useEffect, useId, useState } from "react";
import type { TaskTemplate, TimeWindow, TimeString } from "@/lib/types";
import type { RecurrenceRule } from "@/lib/domain/scheduling/Recurrence";
import { validateRecurrenceRule } from "@/lib/domain/scheduling/Recurrence";
import { useAppStore } from "@/store/useAppStore";
import { validateForm } from "./taskModalValidation";

type FormState = {
  taskName: string;
  isMandatory: boolean;
  priority: number;
  schedulingType: 'fixed' | 'flexible';
  defaultTime?: string;
  timeWindow?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  durationMinutes: number;
  minDurationMinutes?: number;
  isActive: boolean;
  // Recurrence (Phase 6 – 12.1 UI)
  recurrenceFrequency: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceInterval: number;
  recurrenceDaysOfWeek: number[]; // 0-6 Sun=0
  recurrenceDayOfMonth?: number;
  recurrenceMonth?: number; // 1-12
  recurrenceStartDate?: string; // YYYY-MM-DD
  recurrenceEndDate?: string;   // YYYY-MM-DD
};

type FormErrors = Partial<{
  taskName: string;
  priority: string;
  defaultTime: string;
  durationMinutes: string;
  minDurationMinutes: string;
  recurrence: string;
}>;

const emptyForm: FormState = {
  taskName: '',
  isMandatory: false,
  priority: 3,
  schedulingType: 'flexible',
  timeWindow: 'anytime',
  durationMinutes: 30,
  minDurationMinutes: 0,
  isActive: true,
  recurrenceFrequency: 'none',
  recurrenceInterval: 1,
  recurrenceDaysOfWeek: [],
  recurrenceDayOfMonth: undefined,
  recurrenceMonth: undefined,
  recurrenceStartDate: undefined,
  recurrenceEndDate: undefined,
};

export default function TaskModal({
  open,
  onOpenChange,
  initial,
  onSave,
  prefill,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: TaskTemplate | null;
  onSave: (data: Omit<TaskTemplate, 'id'> | TaskTemplate) => Promise<void> | void;
  prefill?: { time?: TimeString; window?: TimeWindow };
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = !!initial;
  const titleId = useId();
  const descId = useId();
  const setNewTaskPrefill = useAppStore((s) => s.setNewTaskPrefill);

  useEffect(() => {
    if (open) {
      if (initial) {
        const f: FormState = {
          taskName: initial.taskName,
          isMandatory: initial.isMandatory,
          priority: initial.priority,
          schedulingType: initial.schedulingType,
          defaultTime: initial.defaultTime,
          timeWindow: initial.timeWindow ?? 'anytime',
          durationMinutes: initial.durationMinutes,
          minDurationMinutes: initial.minDurationMinutes ?? 0,
          isActive: initial.isActive,
          recurrenceFrequency: (((initial.recurrenceRule as RecurrenceRule | undefined)?.frequency) ?? 'none') as FormState['recurrenceFrequency'],
          recurrenceInterval: (((initial.recurrenceRule as RecurrenceRule | undefined)?.interval) ?? 1),
          recurrenceDaysOfWeek: (((initial.recurrenceRule as RecurrenceRule | undefined)?.daysOfWeek) ?? []),
          recurrenceDayOfMonth: ((initial.recurrenceRule as RecurrenceRule | undefined)?.dayOfMonth),
          recurrenceMonth: ((initial.recurrenceRule as RecurrenceRule | undefined)?.month),
          recurrenceStartDate: ((initial.recurrenceRule as RecurrenceRule | undefined)?.startDate),
          recurrenceEndDate: ((initial.recurrenceRule as RecurrenceRule | undefined)?.endDate),
        };
        setForm(f);
      } else {
        // Creating: seed from prefill if provided
        if (prefill?.time) {
          setForm({
            ...emptyForm,
            schedulingType: 'fixed',
            defaultTime: prefill.time,
            timeWindow: undefined,
          });
        } else if (prefill?.window) {
          setForm({
            ...emptyForm,
            schedulingType: 'flexible',
            timeWindow: prefill.window,
          });
        } else {
          setForm(emptyForm);
        }
      }
    }
  }, [open, initial, prefill]);

  const isFixed = form.schedulingType === 'fixed';

  function validate(current: FormState): { isValid: boolean; errors: FormErrors } {
    const base = validateForm(current);
    const errors = { ...(base.errors as FormErrors) };
    let recurrenceOk = true;
    if (current.recurrenceFrequency && current.recurrenceFrequency !== 'none') {
      const rule: RecurrenceRule = {
        frequency: current.recurrenceFrequency,
        interval: Math.max(1, Number(current.recurrenceInterval) || 1),
        ...(current.recurrenceFrequency === 'weekly' ? { daysOfWeek: current.recurrenceDaysOfWeek } : {}),
        ...(current.recurrenceFrequency === 'monthly' || current.recurrenceFrequency === 'yearly' ? { dayOfMonth: current.recurrenceDayOfMonth } : {}),
        ...(current.recurrenceFrequency === 'yearly' ? { month: current.recurrenceMonth } : {}),
        ...(current.recurrenceStartDate ? { startDate: current.recurrenceStartDate } : {}),
        ...(current.recurrenceEndDate ? { endDate: current.recurrenceEndDate } : {}),
      } as RecurrenceRule;
      const v = validateRecurrenceRule(rule);
      if (!v.isValid) {
        recurrenceOk = false;
        errors.recurrence = v.errors[0] || 'Invalid recurrence rule';
      }
      if (current.recurrenceFrequency === 'weekly' && (!current.recurrenceDaysOfWeek || current.recurrenceDaysOfWeek.length === 0)) {
        recurrenceOk = false;
        errors.recurrence = errors.recurrence || 'Select at least one day of week';
      }
    }
    return { isValid: base.isValid && recurrenceOk, errors };
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    // Basic live error clearing for the edited field
    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return; // guard against double submit
    const v = validate(form);
    if (!v.isValid) {
      setFormErrors(v.errors);
      return;
    }
    setIsSaving(true);
    // Compose recurrence rule from UI (validation in step 12.2)
    let recurrenceRule: RecurrenceRule | undefined;
    if (form.recurrenceFrequency !== 'none') {
      recurrenceRule = {
        frequency: form.recurrenceFrequency,
        interval: Math.max(1, Number(form.recurrenceInterval) || 1),
        ...(form.recurrenceFrequency === 'weekly' ? { daysOfWeek: form.recurrenceDaysOfWeek } : {}),
        ...(form.recurrenceFrequency === 'monthly' || form.recurrenceFrequency === 'yearly' ? { dayOfMonth: form.recurrenceDayOfMonth } : {}),
        ...(form.recurrenceFrequency === 'yearly' ? { month: form.recurrenceMonth } : {}),
        ...(form.recurrenceStartDate ? { startDate: form.recurrenceStartDate } : {}),
        ...(form.recurrenceEndDate ? { endDate: form.recurrenceEndDate } : {}),
      } as RecurrenceRule;
    }

    const base: Omit<TaskTemplate, 'id'> = {
      taskName: form.taskName,
      isMandatory: form.isMandatory,
      priority: form.priority,
      isActive: form.isActive,
      schedulingType: form.schedulingType,
      ...(isFixed
        ? { defaultTime: form.defaultTime || '08:00' }
        : { timeWindow: form.timeWindow || 'anytime' }),
      durationMinutes: form.durationMinutes,
      ...(form.minDurationMinutes !== undefined
        ? { minDurationMinutes: form.minDurationMinutes }
        : {}),
      ...(recurrenceRule ? { recurrenceRule } : {}),
    };

    const toSave: Omit<TaskTemplate, 'id'> | TaskTemplate =
      isEdit && initial ? { ...base, id: initial.id } : base;

    try {
      await onSave(toSave);
      // Clear prefill after a successful create/edit so it doesn't leak into the next open
      setNewTaskPrefill(null);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content
          className="fixed inset-0 w-screen h-svh overflow-y-auto bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-none p-4 shadow-lg
                     sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-[92vw] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md"
        >
          <Dialog.Title className="text-base font-semibold mb-1">{isEdit ? 'Edit Task' : 'New Task'}</Dialog.Title>
          <Dialog.Description className="text-sm text-black/70 dark:text-white/70 mb-3">
            {isEdit ? 'Update task details and save your changes.' : 'Provide details to create a new task.'}
          </Dialog.Description>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="taskName" className="block text-sm mb-1">Task Name</label>
              <input
                id="taskName"
                autoFocus
                value={form.taskName}
                onChange={(e)=>update('taskName', e.target.value)}
                required
                aria-invalid={!!formErrors.taskName || undefined}
                aria-describedby={formErrors.taskName ? 'taskName-error' : undefined}
                className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              {formErrors.taskName && (
                <p id="taskName-error" className="mt-1 text-xs text-rose-600">{formErrors.taskName}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="priority" className="block text-sm mb-1">Priority (1-5)</label>
                <input
                  id="priority"
                  type="number"
                  min={1}
                  max={5}
                  value={form.priority}
                  onChange={(e)=>update('priority', Number(e.target.value))}
                  aria-invalid={!!formErrors.priority || undefined}
                  aria-describedby={formErrors.priority ? 'priority-error' : undefined}
                  className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                {formErrors.priority && (
                  <p id="priority-error" className="mt-1 text-xs text-rose-600">{formErrors.priority}</p>
                )}
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input
                  id="isMandatory"
                  type="checkbox"
                  checked={form.isMandatory}
                  onChange={(e)=>update('isMandatory', e.target.checked)}
                  className="focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                />
                <label htmlFor="isMandatory" className="text-sm">Mandatory</label>
            </div>
          </div>

          {/* Recurrence (Phase 6: 12.1 UI) */}
          <fieldset className="mt-2 border rounded-md p-3" aria-describedby={formErrors.recurrence ? 'recurrence-error' : undefined}>
            <legend className="px-1 text-sm font-medium">Recurrence</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <div>
                <label htmlFor="recurrenceFrequency" className="block text-sm mb-1">Frequency</label>
                <select
                  id="recurrenceFrequency"
                  value={form.recurrenceFrequency}
                  onChange={(e)=>update('recurrenceFrequency', e.target.value as FormState['recurrenceFrequency'])}
                  aria-invalid={!!formErrors.recurrence || undefined}
                  aria-describedby={formErrors.recurrence ? 'recurrence-error' : undefined}
                  className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label htmlFor="recurrenceInterval" className="block text-sm mb-1">Interval</label>
                <input
                  id="recurrenceInterval"
                  type="number"
                  min={1}
                  value={form.recurrenceInterval}
                  onChange={(e)=>update('recurrenceInterval', Math.max(1, Number(e.target.value) || 1))}
                  className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
            </div>
            {form.recurrenceFrequency === 'weekly' ? (
              <div className="mt-2">
                <span className="block text-sm mb-1">Days of week</span>
                <div className="flex flex-wrap gap-2 text-sm" role="group" aria-label="Days of week">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label, idx) => {
                    const selected = form.recurrenceDaysOfWeek.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          const next = new Set(form.recurrenceDaysOfWeek);
                          if (next.has(idx)) next.delete(idx); else next.add(idx);
                          update('recurrenceDaysOfWeek', Array.from(next).sort((a,b)=>a-b));
                        }}
                        className={`px-2 py-1 rounded-md border ${selected ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-200 dark:bg-slate-700 border-transparent'}`}
                        aria-label={label}
                      >{label}</button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {(form.recurrenceFrequency === 'monthly' || form.recurrenceFrequency === 'yearly') ? (
              <div className="mt-2 grid grid-cols-2 gap-3">
                {form.recurrenceFrequency === 'yearly' ? (
                  <div>
                    <label htmlFor="recurrenceMonth" className="block text-sm mb-1">Month</label>
                    <select
                      id="recurrenceMonth"
                      value={form.recurrenceMonth || ''}
                      onChange={(e)=>update('recurrenceMonth', Number(e.target.value) || undefined)}
                      className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <option value="">—</option>
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                        <option key={m} value={i+1}>{m}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div>
                  <label htmlFor="recurrenceDayOfMonth" className="block text-sm mb-1">Day of month</label>
                  <input
                    id="recurrenceDayOfMonth"
                    type="number"
                    min={1}
                    max={31}
                    value={form.recurrenceDayOfMonth || 1}
                    onChange={(e)=>update('recurrenceDayOfMonth', Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                </div>
              </div>
            ) : null}
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="recurrenceStartDate" className="block text-sm mb-1">Start date</label>
                <input
                  id="recurrenceStartDate"
                  type="date"
                  value={form.recurrenceStartDate || ''}
                  onChange={(e)=>update('recurrenceStartDate', e.target.value || undefined)}
                  className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="recurrenceEndDate" className="block text-sm mb-1">End date</label>
                <input
                  id="recurrenceEndDate"
                  type="date"
                  value={form.recurrenceEndDate || ''}
                  onChange={(e)=>update('recurrenceEndDate', e.target.value || undefined)}
                  className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
            </div>
            {formErrors.recurrence && (
              <p id="recurrence-error" className="mt-2 text-xs text-rose-600">{formErrors.recurrence}</p>
            )}
          </fieldset>

            <div>
              <label className="block text-sm mb-1">Scheduling</label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sched"
                    checked={!isFixed}
                    onChange={()=>update('schedulingType','flexible')}
                    className="focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                  Flexible
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sched"
                    checked={isFixed}
                    onChange={()=>update('schedulingType','fixed')}
                    className="focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                  Fixed Time
                </label>
              </div>
            </div>

            {isFixed ? (
              <div>
                <label htmlFor="defaultTime" className="block text-sm mb-1">Default Time</label>
                <input
                  id="defaultTime"
                  type="time"
                  value={form.defaultTime || ''}
                  onChange={(e)=>update('defaultTime', e.target.value)}
                  aria-invalid={!!formErrors.defaultTime || undefined}
                  aria-describedby={formErrors.defaultTime ? 'defaultTime-error' : undefined}
                  className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                {formErrors.defaultTime && (
                  <p id="defaultTime-error" className="mt-1 text-xs text-rose-600">{formErrors.defaultTime}</p>
                )}
              </div>
            ) : (
              <div>
                <label htmlFor="timeWindow" className="block text-sm mb-1">Time Window</label>
                <select
                  id="timeWindow"
                  value={form.timeWindow}
                  onChange={(e)=>update('timeWindow', e.target.value as FormState['timeWindow'])}
                  className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="anytime">Anytime</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="durationMinutes" className="block text-sm mb-1">Duration (min)</label>
                <input
                  id="durationMinutes"
                  type="number"
                  min={1}
                  max={480}
                  value={form.durationMinutes}
                  onChange={(e)=>update('durationMinutes', Number(e.target.value))}
                  aria-invalid={!!formErrors.durationMinutes || undefined}
                  aria-describedby={formErrors.durationMinutes ? 'durationMinutes-error' : undefined}
                  className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                {formErrors.durationMinutes && (
                  <p id="durationMinutes-error" className="mt-1 text-xs text-rose-600">{formErrors.durationMinutes}</p>
                )}
              </div>
              <div>
                <label htmlFor="minDurationMinutes" className="block text-sm mb-1">Min Duration (min)</label>
                <input
                  id="minDurationMinutes"
                  type="number"
                  min={0}
                  max={480}
                  value={form.minDurationMinutes || 0}
                  onChange={(e)=>update('minDurationMinutes', Number(e.target.value))}
                  aria-invalid={!!formErrors.minDurationMinutes || undefined}
                  aria-describedby={formErrors.minDurationMinutes ? 'minDurationMinutes-error' : undefined}
                  className="w-full border rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                {formErrors.minDurationMinutes && (
                  <p id="minDurationMinutes-error" className="mt-1 text-xs text-rose-600">{formErrors.minDurationMinutes}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e)=>update('isActive', e.target.checked)}
                className="focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              />
              <label htmlFor="isActive" className="text-sm">Active</label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSaving || !validate(form).isValid}
                aria-busy={isSaving || undefined}
                className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {isSaving ? (
                  <span className="inline-flex items-center">
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                    Saving...
                  </span>
                ) : (
                  isEdit ? 'Save' : 'Create'
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
