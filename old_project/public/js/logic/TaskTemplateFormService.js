import { state } from '../state.js';
import { DEFAULT_SETTINGS } from '../userSettings.js';
import { TemplateDefaultsService } from './TemplateDefaultsService.js';

/**
 * TaskTemplateFormService
 * Provides mapping between persisted template objects and the Task Modal V2 form model.
 */
export const TaskTemplateFormService = {
  /**
   * Map a persisted template (or partial) to the form model shape with sensible defaults.
   * @param {object} template
   * @returns {object} formModel
   */
  toFormModel(template = {}) {
    const settings = (state.getSettings && state.getSettings()) || DEFAULT_SETTINGS;
    const pref = settings.preferences || DEFAULT_SETTINGS.preferences;
    const base = {
      taskName: '',
      description: '',
      category: '',
      durationMinutes: pref.defaultTaskDuration || 30,
      minDurationMinutes: pref.defaultMinTaskDuration || 15,
      priority: 3,
      isMandatory: false,
      isActive: true,
      schedulingType: 'flexible',
      defaultTime: settings.defaultWakeTime || '',
      timeWindow: 'anytime',
      dependsOn: [],
      recurrenceRule: {
        frequency: 'none',
        interval: 1,
        startDate: null,
        endDate: null,
        endAfterOccurrences: null,
        daysOfWeek: [],
        dayOfMonth: null,
        month: null,
        customPattern: null
      }
    };

    const t = template || {};
    const merged = {
      ...base,
      ...t,
      recurrenceRule: { ...base.recurrenceRule, ...(t.recurrenceRule || {}) }
    };

    // Normalize arrays and simple types
    merged.dependsOn = Array.isArray(merged.dependsOn)
      ? Array.from(new Set(merged.dependsOn))
      : (merged.dependsOn ? [merged.dependsOn] : []);
    if (!Array.isArray(merged.recurrenceRule.daysOfWeek)) merged.recurrenceRule.daysOfWeek = [];
    if (typeof merged.recurrenceRule.interval !== 'number' || merged.recurrenceRule.interval < 1) {
      merged.recurrenceRule.interval = 1;
    }

    return merged;
  },

  /**
   * Apply smart defaults to an existing form model, filling only missing values.
   * Uses TemplateDefaultsService heuristics. Does not overwrite user-provided fields.
   * @param {object} formModel
   * @param {object} context Optional context (e.g., initialData from timeline)
   * @returns {object} updated formModel
   */
  applyDefaults(formModel = {}, context = {}) {
    const svc = new TemplateDefaultsService();
    const base = formModel || {};
    const defaults = svc.applySmartDefaults({ ...base, ...(context || {}) });

    const withSchedulingContext = { ...base };
    // Respect explicit defaultTime/timeWindow from context
    if (!withSchedulingContext.defaultTime && context?.defaultTime) {
      withSchedulingContext.defaultTime = context.defaultTime;
      withSchedulingContext.schedulingType = 'fixed';
    }
    if ((!withSchedulingContext.timeWindow || withSchedulingContext.timeWindow === 'anytime') && context?.timeWindow) {
      withSchedulingContext.timeWindow = context.timeWindow;
      if (!withSchedulingContext.defaultTime) withSchedulingContext.schedulingType = 'flexible';
    }

    // Fill only when missing/invalid
    const ensure = (key, isMissing, value) => {
      if (isMissing(withSchedulingContext[key])) withSchedulingContext[key] = value;
    };
    ensure('durationMinutes', (v) => !Number.isFinite(v) || v <= 0, defaults.durationMinutes ?? 30);
    ensure('minDurationMinutes', (v) => !Number.isFinite(v) || v <= 0, defaults.minDurationMinutes ?? 15);
    ensure('priority', (v) => !Number.isFinite(v) || v < 1, defaults.priority ?? 3);
    ensure('timeWindow', (v) => !v, defaults.timeWindow ?? 'anytime');
    ensure('defaultTime', (v) => !v && withSchedulingContext.schedulingType === 'fixed', defaults.defaultTime || '');

    return withSchedulingContext;
  },

  /**
   * Map a form model to a persisted template payload. Optionally merge into an existing template.
   * @param {object} formModel
   * @param {object|null} existingTemplate
   * @returns {object} templatePayload
   */
  toTemplate(formModel = {}, existingTemplate = null) {
    const m = formModel || {};
    const payload = {
      ...(existingTemplate || {}),
      taskName: (m.taskName || '').trim(),
      description: m.description || '',
      category: m.category || (existingTemplate?.category ?? ''),
      durationMinutes: Number.isFinite(m.durationMinutes) ? m.durationMinutes : 30,
      minDurationMinutes: Number.isFinite(m.minDurationMinutes) ? m.minDurationMinutes : 15,
      priority: Number.isFinite(m.priority) ? m.priority : 3,
      isMandatory: !!m.isMandatory,
      isActive: m.isActive !== false,
      schedulingType: m.schedulingType === 'fixed' ? 'fixed' : 'flexible',
      defaultTime: m.schedulingType === 'fixed' ? (m.defaultTime || '') : '',
      timeWindow: m.schedulingType !== 'fixed' ? (m.timeWindow || 'anytime') : (existingTemplate?.timeWindow || 'anytime'),
      dependsOn: Array.isArray(m.dependsOn) ? Array.from(new Set(m.dependsOn)) : [],
      recurrenceRule: {
        frequency: m.recurrenceRule?.frequency || 'none',
        interval: Number.isFinite(m.recurrenceRule?.interval) && m.recurrenceRule.interval > 0 ? m.recurrenceRule.interval : 1,
        startDate: m.recurrenceRule?.startDate || null,
        endDate: m.recurrenceRule?.endDate || null,
        endAfterOccurrences: Number.isFinite(m.recurrenceRule?.endAfterOccurrences) ? m.recurrenceRule.endAfterOccurrences : null,
        daysOfWeek: Array.isArray(m.recurrenceRule?.daysOfWeek) ? m.recurrenceRule.daysOfWeek : [],
        dayOfMonth: Number.isFinite(m.recurrenceRule?.dayOfMonth) ? m.recurrenceRule.dayOfMonth : null,
        month: Number.isFinite(m.recurrenceRule?.month) ? m.recurrenceRule.month : null,
        customPattern: m.recurrenceRule?.customPattern || null
      }
    };

    return payload;
  }
};
