import { toast } from 'sonner';

export type ToastAction =
  | 'complete'
  | 'pending'
  | 'skip'
  | 'postpone'
  | 'update'
  | 'create'
  | 'save'
  | 'delete'
  | 'duplicate'
  | 'enable'
  | 'disable'
  | 'signin';

const successMsg: Record<ToastAction, string> = {
  complete: 'Completed',
  pending: 'Marked pending',
  skip: 'Skipped',
  postpone: 'Postponed',
  update: 'Updated',
  create: 'Created',
  save: 'Saved',
  delete: 'Deleted',
  duplicate: 'Duplicated',
  enable: 'Enabled',
  disable: 'Disabled',
  signin: 'Signed in',
};

const errorMsg: Record<ToastAction, string> = {
  complete: 'Failed to complete',
  pending: 'Failed to mark pending',
  skip: 'Failed to skip',
  postpone: 'Failed to postpone',
  update: 'Failed to update',
  create: 'Failed to create',
  save: 'Failed to save',
  delete: 'Failed to delete',
  duplicate: 'Failed to duplicate',
  enable: 'Failed to enable',
  disable: 'Failed to disable',
  signin: 'Failed to sign in',
};

export function toastSuccess(action: ToastAction) {
  toast.success(successMsg[action]);
}

export function toastError(action: ToastAction) {
  toast.error(errorMsg[action]);
}

export function toastResult(action: ToastAction, ok: boolean) {
  if (ok) toastSuccess(action); else toastError(action);
}

