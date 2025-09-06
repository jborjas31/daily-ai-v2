"use client";
import * as Dialog from "@radix-ui/react-dialog";

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
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-md p-4 w-[92vw] max-w-sm shadow-lg">
          <Dialog.Title className="text-base font-semibold mb-1">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="text-sm text-black/70 dark:text-white/70 mb-4">
              {description}
            </Dialog.Description>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => { onConfirm(); onOpenChange(false); }}
              className="px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700"
            >
              {confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

