"use client";
import * as Dialog from "@radix-ui/react-dialog";
import React, { useId, useState } from "react";
import type { InstanceStatus } from "@/lib/types";

export type EditScope = "only" | "future" | "all";

export default function ScopeDialog({
  open,
  onOpenChange,
  onSelect,
  title = "Edit Recurrence Scope",
  message,
  templateName,
  targetDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (scope: EditScope, options?: { status?: InstanceStatus }) => void;
  title?: string;
  message?: string;
  templateName?: string;
  targetDate?: string; // YYYY-MM-DD
}) {
  const titleId = useId();
  const descId = useId();
  const statusLabelId = useId();
  const [statusChoice, setStatusChoice] = useState<'' | InstanceStatus>('');

  const defaultMessage = message ??
    `Apply your changes to ${templateName ? `“${templateName}” ` : "this task"}${targetDate ? ` on ${targetDate} ` : " "}using one of the options below.`;

  function choose(scope: EditScope) {
    onSelect(scope, statusChoice ? { status: statusChoice } : undefined);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content
          className="fixed inset-0 w-screen h-svh overflow-y-auto bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-none p-4 shadow-lg
                     sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-[92vw] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md"
        >
          <Dialog.Title className="text-base font-semibold mb-1">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-black/70 dark:text-white/70 mb-3">
            {defaultMessage}
          </Dialog.Description>

          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-black/10 dark:border-white/10 p-3">
              <div className="font-medium mb-1">Only this</div>
              <p className="text-black/70 dark:text-white/70">Apply to the selected date only. Creates a per-date override (e.g., time/status) without affecting other occurrences.</p>
              <div className="mt-2">
                <label id={statusLabelId} className="block mb-1">Status override (optional)</label>
                <select
                  aria-labelledby={statusLabelId}
                  value={statusChoice}
                  onChange={(e)=>{
                    const val = (e.target.value || '') as '' | InstanceStatus;
                    setStatusChoice(val);
                  }}
                  className="w-full border rounded-md px-2 py-1.5 bg-white dark:bg-slate-900"
                >
                  <option value="">No change</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="skipped">Skipped</option>
                  <option value="postponed">Postponed</option>
                </select>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => choose("only")}
                className="mt-2 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                Only this
              </button>
            </div>

            <div className="rounded-md border border-black/10 dark:border-white/10 p-3">
              <div className="font-medium mb-1">This and future</div>
              <p className="text-black/70 dark:text-white/70">Split the series. Updates apply from the selected date onward; earlier occurrences stay unchanged.</p>
              <button
                type="button"
                onClick={() => choose("future")}
                className="mt-2 px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                This and future
              </button>
            </div>

            <div className="rounded-md border border-black/10 dark:border-white/10 p-3">
              <div className="font-medium mb-1">All</div>
              <p className="text-black/70 dark:text-white/70">Update the entire series. Applies to past and future occurrences.</p>
              <button
                type="button"
                onClick={() => choose("all")}
                className="mt-2 px-3 py-1.5 rounded-md bg-slate-700 text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
              >
                All
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Dialog.Close asChild>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
              >
                Cancel
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
