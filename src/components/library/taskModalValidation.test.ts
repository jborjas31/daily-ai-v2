import { describe, it, expect } from 'vitest';
import { isValidTime, validateForm, shouldDisableSubmit, type MinimalFormState } from './taskModalValidation';

const baseValid: MinimalFormState = {
  taskName: 'Test Task',
  priority: 3,
  schedulingType: 'flexible',
  timeWindow: 'anytime',
  durationMinutes: 30,
  minDurationMinutes: 0,
};

describe('taskModalValidation', () => {
  it('validates HH:MM time format', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('7:00')).toBe(false);
    expect(isValidTime(undefined)).toBe(false);
  });

  it('returns errors for invalid fields', () => {
    const invalid: MinimalFormState = {
      ...baseValid,
      taskName: ' ',
      priority: 6,
      schedulingType: 'fixed',
      defaultTime: '',
      durationMinutes: 0,
      minDurationMinutes: 999,
    };
    const res = validateForm(invalid);
    expect(res.isValid).toBe(false);
    expect(res.errors.taskName).toBeTruthy();
    expect(res.errors.priority).toBeTruthy();
    expect(res.errors.defaultTime).toBeTruthy();
    expect(res.errors.durationMinutes).toBeTruthy();
    expect(res.errors.minDurationMinutes).toBeTruthy();
  });

  it('passes validation for a correct form', () => {
    const valid = { ...baseValid };
    const res = validateForm(valid);
    expect(res.isValid).toBe(true);
    expect(res.errors).toEqual({});
  });

  it('shouldDisableSubmit reflects invalid forms and saving state', () => {
    expect(shouldDisableSubmit({ ...baseValid }, false)).toBe(false);
    expect(shouldDisableSubmit({ ...baseValid, durationMinutes: 0 }, false)).toBe(true);
    expect(shouldDisableSubmit({ ...baseValid }, true)).toBe(true);
  });
});

