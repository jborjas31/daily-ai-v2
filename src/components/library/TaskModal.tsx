"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import type { TaskTemplate } from "@/lib/types";

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
};

const emptyForm: FormState = {
  taskName: '',
  isMandatory: false,
  priority: 3,
  schedulingType: 'flexible',
  timeWindow: 'anytime',
  durationMinutes: 30,
  minDurationMinutes: 0,
  isActive: true,
};

export default function TaskModal({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: TaskTemplate | null;
  onSave: (data: Omit<TaskTemplate, 'id'> | TaskTemplate) => Promise<void> | void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const isEdit = !!initial;

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
        };
        setForm(f);
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, initial]);

  const isFixed = form.schedulingType === 'fixed';

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      ...form,
      defaultTime: isFixed ? (form.defaultTime || '08:00') : undefined,
      timeWindow: isFixed ? undefined : (form.timeWindow || 'anytime'),
    };
    if (isEdit && initial) {
      await onSave({ ...payload, id: initial.id } as TaskTemplate);
    } else {
      await onSave(payload as Omit<TaskTemplate, 'id'>);
    }
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-md p-4 w-[92vw] max-w-lg shadow-lg">
          <Dialog.Title className="text-base font-semibold mb-3">{isEdit ? 'Edit Task' : 'New Task'}</Dialog.Title>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Task Name</label>
              <input value={form.taskName} onChange={(e)=>update('taskName', e.target.value)} required className="w-full border rounded-md px-2 py-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Priority (1-5)</label>
                <input type="number" min={1} max={5} value={form.priority} onChange={(e)=>update('priority', Number(e.target.value))} className="w-full border rounded-md px-2 py-1.5" />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input id="isMandatory" type="checkbox" checked={form.isMandatory} onChange={(e)=>update('isMandatory', e.target.checked)} />
                <label htmlFor="isMandatory" className="text-sm">Mandatory</label>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Scheduling</label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="radio" name="sched" checked={!isFixed} onChange={()=>update('schedulingType','flexible')} /> Flexible</label>
                <label className="flex items-center gap-2"><input type="radio" name="sched" checked={isFixed} onChange={()=>update('schedulingType','fixed')} /> Fixed Time</label>
              </div>
            </div>

            {isFixed ? (
              <div>
                <label className="block text-sm mb-1">Default Time</label>
                <input type="time" value={form.defaultTime || ''} onChange={(e)=>update('defaultTime', e.target.value)} className="w-full border rounded-md px-2 py-1.5" />
              </div>
            ) : (
              <div>
                <label className="block text-sm mb-1">Time Window</label>
                <select value={form.timeWindow} onChange={(e)=>update('timeWindow', e.target.value as any)} className="w-full border rounded-md px-2 py-1.5">
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="anytime">Anytime</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Duration (min)</label>
                <input type="number" min={1} max={480} value={form.durationMinutes} onChange={(e)=>update('durationMinutes', Number(e.target.value))} className="w-full border rounded-md px-2 py-1.5" />
              </div>
              <div>
                <label className="block text-sm mb-1">Min Duration (min)</label>
                <input type="number" min={0} max={480} value={form.minDurationMinutes || 0} onChange={(e)=>update('minDurationMinutes', Number(e.target.value))} className="w-full border rounded-md px-2 py-1.5" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input id="isActive" type="checkbox" checked={form.isActive} onChange={(e)=>update('isActive', e.target.checked)} />
              <label htmlFor="isActive" className="text-sm">Active</label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button type="button" className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700">Cancel</button>
              </Dialog.Close>
              <button type="submit" className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700">{isEdit ? 'Save' : 'Create'}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

