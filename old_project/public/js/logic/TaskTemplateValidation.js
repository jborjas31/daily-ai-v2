import { state } from '../state.js';
import { taskValidation } from '../utils/TaskValidation.js';
import { TaskTemplateFormService } from './TaskTemplateFormService.js';

/**
 * TaskTemplateValidation
 * Central validation facade for Task Modal V2. Converts the V2 form model
 * to a canonical template payload and runs the comprehensive validator,
 * returning structured field+cross-field errors and warnings.
 */
export const TaskTemplateValidation = {
  /**
   * Validate the entire form model.
   * @param {object} formModel
   * @param {Array<object>} existingTemplates Optional; defaults to state cache
   * @returns {{ isValid: boolean, errorsByField: Map<string,string[]>, warningsByField: Map<string,string[]>, raw: any }}
   */
  validateForm(formModel, existingTemplates = null) {
    const templates = existingTemplates || (state.getTaskTemplates && state.getTaskTemplates()) || [];
    const payload = TaskTemplateFormService.toTemplate(formModel);
    const result = taskValidation.validateTemplate(payload, templates);
    const { errorsByField, warningsByField } = this._groupByField(result);
    return {
      isValid: !!result?.isValid,
      errorsByField,
      warningsByField,
      raw: result
    };
  },

  // Section-scoped helpers
  validateBasics(formModel, existingTemplates = null) {
    const full = this.validateForm(formModel, existingTemplates);
    return this._filterFields(full, [
      'taskName', 'description', 'priority', 'isMandatory', 'isActive', 'category'
    ]);
  },

  validateScheduling(formModel, existingTemplates = null) {
    const full = this.validateForm(formModel, existingTemplates);
    return this._filterFields(full, [
      'schedulingType', 'defaultTime', 'timeWindow', 'endTime', 'durationMinutes', 'minDurationMinutes'
    ]);
  },

  validateRecurrence(formModel, existingTemplates = null) {
    const full = this.validateForm(formModel, existingTemplates);
    return this._filterFields(full, [
      'recurrence.frequency', 'recurrence.interval', 'recurrence.daysOfWeek', 'recurrence.startDate', 'recurrence.endDate', 'recurrence.endAfterOccurrences', 'recurrence.dayOfMonth', 'recurrence.month'
    ]);
  },

  validateDependencies(formModel, existingTemplates = null) {
    const full = this.validateForm(formModel, existingTemplates);
    return this._filterFields(full, ['dependsOn']);
  },

  // ========== Internals ==========
  _filterFields(full, allowedKeys) {
    const errorsByField = new Map();
    const warningsByField = new Map();
    const allow = new Set(allowedKeys);
    full.errorsByField.forEach((msgs, key) => {
      if (allow.has(key)) errorsByField.set(key, msgs);
    });
    full.warningsByField.forEach((msgs, key) => {
      if (allow.has(key)) warningsByField.set(key, msgs);
    });
    return {
      isValid: errorsByField.size === 0,
      errorsByField,
      warningsByField,
      raw: full.raw
    };
  },

  _groupByField(validationResult) {
    const errorsByField = new Map();
    const warningsByField = new Map();
    const add = (map, key, message) => {
      const list = map.get(key) || [];
      list.push(message);
      map.set(key, list);
    };
    const normalize = (field) => this._normalizeField(field);

    (validationResult?.errors || []).forEach(err => {
      const key = normalize(err.field);
      add(errorsByField, key, err.message);
    });
    (validationResult?.warnings || []).forEach(warn => {
      const key = normalize(warn.field);
      add(warningsByField, key, warn.message);
    });

    return { errorsByField, warningsByField };
  },

  _normalizeField(field) {
    if (!field) return 'general';
    // Map legacy validator paths to V2-friendly keys
    const map = new Map([
      ['durationMinutes', 'durationMinutes'],
      ['minDurationMinutes', 'minDurationMinutes'],
      ['taskName', 'taskName'],
      ['description', 'description'],
      ['priority', 'priority'],
      ['isMandatory', 'isMandatory'],
      ['isActive', 'isActive'],
      ['schedulingType', 'schedulingType'],
      ['defaultTime', 'defaultTime'],
      ['timeWindow', 'timeWindow'],
      ['endTime', 'endTime'],
      // Recurrence nested fields
      ['recurrenceRule.frequency', 'recurrence.frequency'],
      ['recurrenceRule.interval', 'recurrence.interval'],
      ['recurrenceRule.daysOfWeek', 'recurrence.daysOfWeek'],
      ['recurrenceRule.startDate', 'recurrence.startDate'],
      ['recurrenceRule.endDate', 'recurrence.endDate'],
      ['recurrenceRule.endAfterOccurrences', 'recurrence.endAfterOccurrences'],
      ['recurrenceRule.dayOfMonth', 'recurrence.dayOfMonth'],
      ['recurrenceRule.month', 'recurrence.month'],
      ['dependsOn', 'dependsOn']
    ]);
    return map.get(field) || field;
  }
};

