export type SchedulingType = 'fixed' | 'flexible';

export type MinimalFormState = {
  taskName: string;
  priority: number;
  schedulingType: SchedulingType;
  defaultTime?: string;
  timeWindow?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  durationMinutes: number;
  minDurationMinutes?: number | null;
};

export type ValidationErrors = Partial<{
  taskName: string;
  priority: string;
  defaultTime: string;
  durationMinutes: string;
  minDurationMinutes: string;
}>;

export function isValidTime(s: string | undefined): boolean {
  if (!s) return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s);
}

export function validateForm(current: MinimalFormState): { isValid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {};
  if (!current.taskName || current.taskName.trim().length === 0) {
    errors.taskName = 'Task name is required';
  }
  if (!Number.isFinite(current.priority) || current.priority < 1 || current.priority > 5) {
    errors.priority = 'Priority must be between 1 and 5';
  }
  if (current.schedulingType === 'fixed') {
    if (!isValidTime(current.defaultTime)) {
      errors.defaultTime = 'Provide a valid time (HH:MM)';
    }
  }
  if (!Number.isFinite(current.durationMinutes) || current.durationMinutes < 1) {
    errors.durationMinutes = 'Duration must be at least 1 minute';
  }
  if (current.minDurationMinutes !== undefined && current.minDurationMinutes !== null) {
    const min = Number(current.minDurationMinutes);
    if (!Number.isFinite(min) || min < 0) {
      errors.minDurationMinutes = 'Min duration must be 0 or greater';
    } else if (Number.isFinite(current.durationMinutes) && min > current.durationMinutes) {
      errors.minDurationMinutes = 'Min duration cannot exceed duration';
    }
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function shouldDisableSubmit(form: MinimalFormState, isSaving: boolean): boolean {
  return !validateForm(form).isValid || isSaving;
}

