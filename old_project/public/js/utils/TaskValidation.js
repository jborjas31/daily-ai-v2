/**
 * Task Validation System
 * 
 * Comprehensive validation for task templates and instances with:
 * - Field validation with specific error messages
 * - Circular dependency detection
 * - Time conflict validation
 * - Recurrence rule validation
 * - Business logic validation
 */

import { TIME_WINDOWS } from '../constants/timeWindows.js';

/**
 * Validation Result Structure
 */
export class ValidationResult {
  constructor(isValid = true, errors = [], warnings = []) {
    this.isValid = isValid;
    this.errors = [...errors];
    this.warnings = [...warnings];
  }

  addError(message, field = null) {
    this.errors.push({ message, field, type: 'error' });
    this.isValid = false;
  }

  addWarning(message, field = null) {
    this.warnings.push({ message, field, type: 'warning' });
  }

  merge(otherResult) {
    this.errors.push(...otherResult.errors);
    this.warnings.push(...otherResult.warnings);
    if (!otherResult.isValid) {
      this.isValid = false;
    }
    return this;
  }

  getErrorMessages() {
    return this.errors.map(error => error.message);
  }

  getWarningMessages() {
    return this.warnings.map(warning => warning.message);
  }

  getAllMessages() {
    return [...this.getErrorMessages(), ...this.getWarningMessages()];
  }
}

/**
 * Core Task Template Validator
 */
export class TaskTemplateValidator {
  constructor() {
    this.validTimeWindows = Object.keys(TIME_WINDOWS);
    this.validFrequencies = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
    this.validSchedulingTypes = ['fixed', 'flexible'];
    this.timeFormatRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  }

  /**
   * Validate a complete task template
   */
  validate(templateData, existingTemplates = []) {
    const result = new ValidationResult();

    // Basic field validation
    result.merge(this.validateBasicFields(templateData));
    
    // Duration validation
    result.merge(this.validateDurations(templateData));
    
    // Scheduling validation
    result.merge(this.validateScheduling(templateData));
    
    // Recurrence validation
    result.merge(this.validateRecurrence(templateData));
    
    // Dependencies validation (requires existing templates for circular check)
    result.merge(this.validateDependencies(templateData, existingTemplates));
    
    // Time conflict validation
    result.merge(this.validateTimeConflicts(templateData, existingTemplates));
    
    // Time relationship validation (for negative duration prevention)
    result.merge(this.validateTimeRelationship(templateData));
    
    // Business logic validation
    result.merge(this.validateBusinessLogic(templateData));

    return result;
  }

  /**
   * Validate basic required fields and formats
   */
  validateBasicFields(templateData) {
    const result = new ValidationResult();

    // Task name validation
    if (!templateData.taskName || typeof templateData.taskName !== 'string') {
      result.addError('Task name is required', 'taskName');
    } else {
      const trimmedName = templateData.taskName.trim();
      if (trimmedName.length === 0) {
        result.addError('Task name cannot be empty', 'taskName');
      } else if (trimmedName.length > 100) {
        result.addError('Task name must be 100 characters or less', 'taskName');
      } else if (trimmedName.length < 2) {
        result.addWarning('Task names under 2 characters may be unclear', 'taskName');
      }
    }

    // Description validation
    if (templateData.description && typeof templateData.description === 'string') {
      if (templateData.description.length > 500) {
        result.addError('Description must be 500 characters or less', 'description');
      }
    }

    // Priority validation
    if (templateData.priority !== undefined) {
      if (!Number.isInteger(templateData.priority) || templateData.priority < 1 || templateData.priority > 5) {
        result.addError('Priority must be an integer between 1 and 5', 'priority');
      }
    }

    // Mandatory flag validation
    if (templateData.isMandatory !== undefined && typeof templateData.isMandatory !== 'boolean') {
      result.addError('isMandatory must be a boolean value', 'isMandatory');
    }

    // Active flag validation
    if (templateData.isActive !== undefined && typeof templateData.isActive !== 'boolean') {
      result.addError('isActive must be a boolean value', 'isActive');
    }

    return result;
  }

  /**
   * Validate duration fields
   */
  validateDurations(templateData) {
    const result = new ValidationResult();

    // Duration validation
    if (templateData.durationMinutes !== undefined) {
      if (!Number.isInteger(templateData.durationMinutes) || templateData.durationMinutes < 1) {
        result.addError('Duration must be a positive integer (minutes)', 'durationMinutes');
      } else if (templateData.durationMinutes < 5) {
        result.addWarning('Durations under 5 minutes may be too short to be meaningful', 'durationMinutes');
      } else if (templateData.durationMinutes > 720) { // 12 hours
        result.addError('Duration cannot exceed 12 hours (720 minutes)', 'durationMinutes');
      } else if (templateData.durationMinutes > 480) { // 8 hours
        result.addWarning('Durations over 8 hours may be difficult to schedule', 'durationMinutes');
      }
    }

    // Minimum duration validation
    if (templateData.minDurationMinutes !== undefined) {
      if (!Number.isInteger(templateData.minDurationMinutes) || templateData.minDurationMinutes < 1) {
        result.addError('Minimum duration must be a positive integer (minutes)', 'minDurationMinutes');
      } else if (templateData.minDurationMinutes < 5) {
        result.addWarning('Minimum durations under 5 minutes may be too short', 'minDurationMinutes');
      }

      // Cross-validation with normal duration
      if (templateData.durationMinutes && templateData.minDurationMinutes > templateData.durationMinutes) {
        result.addError('Minimum duration cannot exceed normal duration', 'minDurationMinutes');
      }

      // Reasonable ratio check
      if (templateData.durationMinutes && templateData.minDurationMinutes < templateData.durationMinutes * 0.3) {
        result.addWarning('Minimum duration is less than 30% of normal duration - may not be useful', 'minDurationMinutes');
      }
    }

    return result;
  }

  /**
   * Validate scheduling configuration
   */
  validateScheduling(templateData) {
    const result = new ValidationResult();

    // Scheduling type validation
    if (templateData.schedulingType && !this.validSchedulingTypes.includes(templateData.schedulingType)) {
      result.addError(`Scheduling type must be one of: ${this.validSchedulingTypes.join(', ')}`, 'schedulingType');
    }

    // Fixed scheduling validation
    if (templateData.schedulingType === 'fixed') {
      if (!templateData.defaultTime) {
        result.addError('Fixed scheduling requires a default time', 'defaultTime');
      } else if (!this.timeFormatRegex.test(templateData.defaultTime)) {
        result.addError('Default time must be in HH:MM format (24-hour)', 'defaultTime');
      } else {
        // Validate time is within reasonable bounds
        const [hours, minutes] = templateData.defaultTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        
        if (totalMinutes < 360 || totalMinutes > 1380) { // 6:00 AM to 11:00 PM
          result.addWarning('Fixed time outside typical waking hours (6:00-23:00)', 'defaultTime');
        }
      }

      // Fixed tasks should generally be mandatory
      if (templateData.isMandatory === false) {
        result.addWarning('Fixed-time tasks are usually mandatory - consider if this should be flexible instead', 'isMandatory');
      }
    } else if (templateData.schedulingType === 'flexible') {
      // Flexible scheduling validation
      if (templateData.defaultTime) {
        result.addWarning('Default time is ignored for flexible scheduling', 'defaultTime');
      }
    }

    // Time window validation
    if (templateData.timeWindow && !this.validTimeWindows.includes(templateData.timeWindow)) {
      result.addError(`Time window must be one of: ${this.validTimeWindows.join(', ')}`, 'timeWindow');
    }

    // Cross-validation between scheduling type and time window
    if (templateData.schedulingType === 'fixed' && templateData.defaultTime && templateData.timeWindow) {
      const timeWindow = TIME_WINDOWS[templateData.timeWindow];
      if (timeWindow && timeWindow.start && timeWindow.end) {
        const [taskHour] = templateData.defaultTime.split(':').map(Number);
        const [startHour] = timeWindow.start.split(':').map(Number);
        const [endHour] = timeWindow.end.split(':').map(Number);
        
        if (taskHour < startHour || taskHour >= endHour) {
          result.addWarning(`Fixed time ${templateData.defaultTime} is outside selected time window ${templateData.timeWindow}`, 'timeWindow');
        }
      }
    }

    return result;
  }

  /**
   * Validate time relationships to prevent negative durations
   */
  validateTimeRelationship(templateData) {
    const result = new ValidationResult();

    // Only validate if both start and end times are provided for fixed scheduling
    if (templateData.schedulingType === 'fixed' && templateData.defaultTime && templateData.endTime) {
      if (!this.timeFormatRegex.test(templateData.endTime)) {
        result.addError('End time must be in HH:MM format (24-hour)', 'endTime');
        return result;
      }

      const startMinutes = this.timeStringToMinutes(templateData.defaultTime);
      const endMinutes = this.timeStringToMinutes(templateData.endTime);
      
      if (endMinutes <= startMinutes) {
        result.addError('End time must be after start time', 'endTime');
      } else {
        // Calculate and validate the duration
        const calculatedDuration = endMinutes - startMinutes;
        
        // Update the template's duration if it was calculated from time range
        if (!templateData.durationMinutes || templateData.durationMinutes !== calculatedDuration) {
          // This is informational - the duration will be auto-calculated
          result.addWarning(`Duration auto-calculated as ${calculatedDuration} minutes from time range`, 'durationMinutes');
        }
      }
    }

    return result;
  }

  /**
   * Validate recurrence rules
   */
  validateRecurrence(templateData) {
    const result = new ValidationResult();

    if (!templateData.recurrenceRule) {
      return result;
    }

    const rule = templateData.recurrenceRule;

    // Frequency validation
    if (!rule.frequency || !this.validFrequencies.includes(rule.frequency)) {
      result.addError(`Recurrence frequency must be one of: ${this.validFrequencies.join(', ')}`, 'recurrenceRule.frequency');
      return result; // Can't validate further without valid frequency
    }

    // Interval validation
    if (rule.interval !== undefined) {
      if (!Number.isInteger(rule.interval) || rule.interval < 1) {
        result.addError('Recurrence interval must be a positive integer', 'recurrenceRule.interval');
      } else if (rule.interval > 365) {
        result.addWarning('Recurrence intervals over 365 may be impractical', 'recurrenceRule.interval');
      }
    }

    // Frequency-specific validation
    switch (rule.frequency) {
      case 'weekly':
        if (!rule.daysOfWeek || !Array.isArray(rule.daysOfWeek) || rule.daysOfWeek.length === 0) {
          result.addError('Weekly recurrence requires at least one day of the week', 'recurrenceRule.daysOfWeek');
        } else {
          const validDays = rule.daysOfWeek.every(day => 
            Number.isInteger(day) && day >= 0 && day <= 6
          );
          if (!validDays) {
            result.addError('Days of week must be integers between 0 (Sunday) and 6 (Saturday)', 'recurrenceRule.daysOfWeek');
          }
          if (rule.daysOfWeek.length > 7) {
            result.addError('Cannot have more than 7 days of the week', 'recurrenceRule.daysOfWeek');
          }
          // Check for duplicates
          const uniqueDays = new Set(rule.daysOfWeek);
          if (uniqueDays.size !== rule.daysOfWeek.length) {
            result.addError('Duplicate days of week are not allowed', 'recurrenceRule.daysOfWeek');
          }
        }
        break;

      case 'monthly':
        // Could add day of month validation here
        if (rule.dayOfMonth && (!Number.isInteger(rule.dayOfMonth) || rule.dayOfMonth < 1 || rule.dayOfMonth > 31)) {
          result.addError('Day of month must be between 1 and 31', 'recurrenceRule.dayOfMonth');
        }
        break;

      case 'none':
        // One-time tasks shouldn't have complex recurrence settings
        if (rule.interval && rule.interval !== 1) {
          result.addWarning('Interval is ignored for non-recurring tasks', 'recurrenceRule.interval');
        }
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          result.addWarning('Days of week are ignored for non-recurring tasks', 'recurrenceRule.daysOfWeek');
        }
        break;
    }

    // End conditions validation
    if (rule.endDate && rule.endAfterOccurrences) {
      result.addError('Cannot specify both end date and end after occurrences', 'recurrenceRule');
    }

    if (rule.endDate) {
      const endDate = new Date(rule.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Compare dates only, not times
      
      if (isNaN(endDate.getTime())) {
        result.addError('End date must be a valid date', 'recurrenceRule.endDate');
      } else if (endDate < today) {
        result.addError('End date cannot be in the past', 'recurrenceRule.endDate');
      }
    }

    if (rule.endAfterOccurrences) {
      if (!Number.isInteger(rule.endAfterOccurrences) || rule.endAfterOccurrences < 1) {
        result.addError('End after occurrences must be a positive integer', 'recurrenceRule.endAfterOccurrences');
      } else if (rule.endAfterOccurrences > 1000) {
        result.addWarning('More than 1000 occurrences may impact performance', 'recurrenceRule.endAfterOccurrences');
      }
    }

    return result;
  }

  /**
   * Validate task dependencies and detect circular dependencies
   */
  validateDependencies(templateData, existingTemplates = []) {
    const result = new ValidationResult();

    // Treat missing or empty dependencies as valid (optional field)
    if (!templateData.dependsOn || (Array.isArray(templateData.dependsOn) && templateData.dependsOn.length === 0)) {
      return result;
    }

    // Normalize to array for consistent handling
    const depIds = Array.isArray(templateData.dependsOn) ? templateData.dependsOn : [templateData.dependsOn];

    // Existence check for each dependency id
    const missing = depIds.filter(id => !existingTemplates.some(t => t.id === id));
    if (missing.length > 0) {
      // Report each missing dependency
      missing.forEach(id => result.addError(`Dependency task not found: ${id}`, 'dependsOn'));
      return result;
    }

    // Self-dependency check
    if (templateData.id && depIds.includes(templateData.id)) {
      result.addError('Task cannot depend on itself', 'dependsOn');
      return result;
    }

    // Circular dependency detection (supports multiple dependencies)
    const circularCheck = this.detectCircularDependencies(templateData, existingTemplates);
    if (circularCheck.hasCircularDependency) {
      result.addError(`Circular dependency detected: ${circularCheck.path.join(' → ')}`, 'dependsOn');
    }

    // Logical consistency warnings for each dependency
    const dependencyTemplates = depIds
      .map(id => existingTemplates.find(t => t.id === id))
      .filter(Boolean);

    for (const dependencyTemplate of dependencyTemplates) {
      // Warning if both tasks are fixed-time and dependency is scheduled later
      if (templateData.schedulingType === 'fixed' && dependencyTemplate.schedulingType === 'fixed' &&
          templateData.defaultTime && dependencyTemplate.defaultTime) {
        const taskTime = this.timeStringToMinutes(templateData.defaultTime);
        const depTime = this.timeStringToMinutes(dependencyTemplate.defaultTime);
        if (taskTime <= depTime) {
          result.addWarning('Task is scheduled before or at same time as its dependency', 'dependsOn');
        }
      }

      // Warning if dependency is not mandatory but this task is
      if (templateData.isMandatory && dependencyTemplate.isMandatory === false) {
        result.addWarning('Mandatory task depends on non-mandatory task - dependency might be skipped', 'dependsOn');
      }

      // Warning if dependency is in a different time window that might cause conflicts
      if (templateData.timeWindow && dependencyTemplate.timeWindow && 
          templateData.timeWindow !== dependencyTemplate.timeWindow && 
          templateData.timeWindow !== 'anytime' && dependencyTemplate.timeWindow !== 'anytime') {
        result.addWarning(`Task (${templateData.timeWindow}) depends on task in different time window (${dependencyTemplate.timeWindow})`, 'dependsOn');
      }
    }

    return result;
  }

  /**
   * Detect circular dependencies using depth-first search
   */
  detectCircularDependencies(templateData, existingTemplates, visited = new Set(), path = []) {
    // No dependencies
    if (!templateData.dependsOn || (Array.isArray(templateData.dependsOn) && templateData.dependsOn.length === 0)) {
      return { hasCircularDependency: false, path: [] };
    }

    const currentId = templateData.id || 'new-task';
    const dependencyIds = Array.isArray(templateData.dependsOn) ? templateData.dependsOn : [templateData.dependsOn];

    // Add current to path
    const currentPath = [...path, currentId];

    // Explore each dependency
    for (const dependencyId of dependencyIds) {
      // Cycle check
      if (visited.has(dependencyId)) {
        const cycleStartIndex = currentPath.indexOf(dependencyId);
        if (cycleStartIndex !== -1) {
          return {
            hasCircularDependency: true,
            path: [...currentPath.slice(cycleStartIndex), dependencyId]
          };
        }
      }

      const dependencyTemplate = existingTemplates.find(t => t.id === dependencyId);
      if (!dependencyTemplate) continue;

      // Continue DFS
      const nextVisited = new Set(visited);
      nextVisited.add(currentId);
      const check = this.detectCircularDependencies(dependencyTemplate, existingTemplates, nextVisited, currentPath);
      if (check.hasCircularDependency) return check;
    }

    return { hasCircularDependency: false, path: [] };
  }

  /**
   * Validate for time conflicts with other templates
   */
  validateTimeConflicts(templateData, existingTemplates = []) {
    const result = new ValidationResult();

    // Only check conflicts for fixed-time tasks
    if (templateData.schedulingType !== 'fixed' || !templateData.defaultTime) {
      return result;
    }

    const taskTime = templateData.defaultTime;
    const taskDuration = templateData.durationMinutes || 30;
    const taskStartMinutes = this.timeStringToMinutes(taskTime);
    const taskEndMinutes = taskStartMinutes + taskDuration;

    // Check against other fixed-time tasks
    const conflicts = existingTemplates.filter(template => {
      // Skip self when updating
      if (templateData.id && template.id === templateData.id) {
        return false;
      }

      // Only check fixed-time tasks
      if (template.schedulingType !== 'fixed' || !template.defaultTime) {
        return false;
      }

      const otherStartMinutes = this.timeStringToMinutes(template.defaultTime);
      const otherEndMinutes = otherStartMinutes + (template.durationMinutes || 30);

      // Check for overlap
      return (taskStartMinutes < otherEndMinutes && taskEndMinutes > otherStartMinutes);
    });

    if (conflicts.length > 0) {
      const conflictNames = conflicts.map(t => t.taskName).join(', ');
      result.addWarning(`Time conflict with existing tasks: ${conflictNames}`, 'defaultTime');
    }

    return result;
  }

  /**
   * Validate business logic rules
   */
  validateBusinessLogic(templateData) {
    const result = new ValidationResult();

    // High priority tasks should generally be mandatory
    if (templateData.priority && templateData.priority >= 4 && templateData.isMandatory === false) {
      result.addWarning('High priority tasks are usually mandatory', 'isMandatory');
    }

    // Very long tasks should have minimum duration
    if (templateData.durationMinutes && templateData.durationMinutes > 120 && !templateData.minDurationMinutes) {
      result.addWarning('Long tasks should have a minimum duration for crunch-time scheduling', 'minDurationMinutes');
    }

    // Fixed-time mandatory tasks in evening might conflict with sleep
    if (templateData.schedulingType === 'fixed' && templateData.isMandatory && 
        templateData.defaultTime && templateData.timeWindow === 'evening') {
      const taskTime = this.timeStringToMinutes(templateData.defaultTime);
      const duration = templateData.durationMinutes || 30;
      
      if (taskTime + duration > 1380) { // After 11 PM
        result.addWarning('Late evening mandatory tasks might conflict with sleep schedule', 'defaultTime');
      }
    }

    // Tasks with dependencies should be flexible unless specifically needed fixed
    if (templateData.dependsOn && templateData.schedulingType === 'fixed') {
      result.addWarning('Tasks with dependencies are usually more flexible - consider flexible scheduling', 'schedulingType');
    }

    return result;
  }

  /**
   * Utility: Convert time string to minutes since midnight
   */
  timeStringToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Utility: Convert minutes since midnight to time string
   */
  minutesToTimeString(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}

/**
 * Task Instance Validator
 */
export class TaskInstanceValidator {
  constructor() {
    this.timeFormatRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    this.dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
    this.validStatuses = ['pending', 'completed', 'skipped', 'postponed', 'incomplete'];
  }

  /**
   * Validate a task instance
   */
  validate(instanceData, templateData = null) {
    const result = new ValidationResult();

    // Basic field validation
    result.merge(this.validateBasicFields(instanceData));
    
    // Status validation
    result.merge(this.validateStatus(instanceData));
    
    // Time validation
    result.merge(this.validateTiming(instanceData, templateData));
    
    // Business logic validation
    result.merge(this.validateInstanceBusinessLogic(instanceData, templateData));

    return result;
  }

  /**
   * Validate basic instance fields
   */
  validateBasicFields(instanceData) {
    const result = new ValidationResult();

    // Template ID validation
    if (!instanceData.templateId) {
      result.addError('Template ID is required', 'templateId');
    }

    // Date validation
    if (!instanceData.date) {
      result.addError('Date is required', 'date');
    } else if (!this.dateFormatRegex.test(instanceData.date)) {
      result.addError('Date must be in YYYY-MM-DD format', 'date');
    } else {
      const date = new Date(instanceData.date);
      if (isNaN(date.getTime())) {
        result.addError('Date must be a valid date', 'date');
      }
    }

    return result;
  }

  /**
   * Validate instance status
   */
  validateStatus(instanceData) {
    const result = new ValidationResult();

    if (instanceData.status && !this.validStatuses.includes(instanceData.status)) {
      result.addError(`Status must be one of: ${this.validStatuses.join(', ')}`, 'status');
    }

    // Status-specific validation
    if (instanceData.status === 'completed') {
      if (instanceData.completedAt && isNaN(new Date(instanceData.completedAt).getTime())) {
        result.addError('Completed timestamp must be a valid date', 'completedAt');
      }
    }

    if (instanceData.status === 'skipped' || instanceData.status === 'postponed') {
      if (instanceData.completedAt) {
        result.addWarning('Completed timestamp should not be set for skipped/postponed tasks', 'completedAt');
      }
    }

    return result;
  }

  /**
   * Validate timing fields
   */
  validateTiming(instanceData, templateData) {
    const result = new ValidationResult();

    // Scheduled time validation
    if (instanceData.scheduledTime && !this.timeFormatRegex.test(instanceData.scheduledTime)) {
      result.addError('Scheduled time must be in HH:MM format (24-hour)', 'scheduledTime');
    }

    // Actual duration validation
    if (instanceData.actualDuration !== undefined) {
      if (!Number.isInteger(instanceData.actualDuration) || instanceData.actualDuration < 0) {
        result.addError('Actual duration must be a non-negative integer (minutes)', 'actualDuration');
      } else if (instanceData.actualDuration > 1440) { // 24 hours
        result.addWarning('Actual duration over 24 hours seems unlikely', 'actualDuration');
      }

      // Compare with template duration if available
      if (templateData && templateData.durationMinutes) {
        const ratio = instanceData.actualDuration / templateData.durationMinutes;
        if (ratio > 3) {
          result.addWarning('Actual duration is more than 3x the planned duration', 'actualDuration');
        } else if (ratio < 0.2) {
          result.addWarning('Actual duration is less than 20% of planned duration', 'actualDuration');
        }
      }
    }

    return result;
  }

  /**
   * Validate instance business logic
   */
  validateInstanceBusinessLogic(instanceData, templateData) {
    const result = new ValidationResult();

    // Past date completion check
    if (instanceData.status === 'completed' && instanceData.date) {
      const instanceDate = new Date(instanceData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (instanceDate > today) {
        result.addWarning('Task marked complete for future date', 'status');
      }
    }

    // Mandatory task skipping check
    if (templateData && templateData.isMandatory && instanceData.status === 'skipped') {
      result.addWarning('Mandatory task was skipped - ensure this was intentional', 'status');
    }

    return result;
  }
}

/**
 * Main Validation Interface
 */
export class TaskValidationSystem {
  constructor() {
    this.templateValidator = new TaskTemplateValidator();
    this.instanceValidator = new TaskInstanceValidator();
  }

  /**
   * Validate a task template
   */
  validateTemplate(templateData, existingTemplates = []) {
    return this.templateValidator.validate(templateData, existingTemplates);
  }

  /**
   * Validate a task instance
   */
  validateInstance(instanceData, templateData = null) {
    return this.instanceValidator.validate(instanceData, templateData);
  }

  /**
   * Validate multiple templates for batch operations
   */
  validateTemplates(templatesData, existingTemplates = []) {
    const results = [];
    
    for (let i = 0; i < templatesData.length; i++) {
      const templateData = templatesData[i];
      const result = this.validateTemplate(templateData, existingTemplates);
      results.push({
        index: i,
        template: templateData,
        validation: result
      });
    }
    
    return results;
  }

  /**
   * Quick validation for UI feedback (basic checks only)
   */
  quickValidateTemplate(templateData) {
    const result = new ValidationResult();
    
    // Only run the fastest checks for real-time UI feedback
    if (!templateData.taskName || templateData.taskName.trim().length === 0) {
      result.addError('Task name is required', 'taskName');
    }
    
    if (templateData.durationMinutes !== undefined && 
        (!Number.isInteger(templateData.durationMinutes) || templateData.durationMinutes < 1)) {
      result.addError('Duration must be a positive integer', 'durationMinutes');
    }
    
    if (templateData.schedulingType === 'fixed' && !templateData.defaultTime) {
      result.addError('Fixed scheduling requires a default time', 'defaultTime');
    }
    
    // Quick time relationship check for real-time feedback
    if (templateData.schedulingType === 'fixed' && templateData.defaultTime && templateData.endTime) {
      const startMinutes = templateData.defaultTime.split(':').reduce((h, m) => h * 60 + +m);
      const endMinutes = templateData.endTime.split(':').reduce((h, m) => h * 60 + +m);
      
      if (endMinutes <= startMinutes) {
        result.addError('End time must be after start time', 'endTime');
      }
    }
    
    return result;
  }
}

// Create singleton instance for easy access
export const taskValidation = new TaskValidationSystem();

// Individual validators already exported with their class definitions above

console.log('✅ Task Validation System initialized');
