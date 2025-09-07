"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useId } from "react";

export default function ConfirmDialog({
  open,
  title = "Confirm",
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const titleId = useId();
  const descId = useId();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          className="fixed inset-0 w-screen h-svh overflow-y-auto bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-none p-4 shadow-lg
                     sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-[92vw] sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md"
        >
          <Dialog.Title id={titleId} className="text-base font-semibold mb-1">{title}</Dialog.Title>
          {description && (
            <Dialog.Description id={descId} className="text-sm text-black/70 dark:text-white/70 mb-4">
              {description}
            </Dialog.Description>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => { onConfirm(); onOpenChange(false); }}
              className="px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
            >
              {confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
