/**
 * Streamlined Task Instance Manager - Core CRUD Operations for Daily Task Instances
 * Phase 5 Step 5.1: Focused on Single Responsibility Principle
 * 
 * Manages task instances which are daily modifications of templates.
 * Handles core CRUD operations, instance lifecycle, and performance caching.
 * 
 * Extracted systems (moved to separate services):
 * - Bulk instance generation -> InstanceGenerationService
 * - Conflict detection & resolution -> ConflictResolutionService  
 * - Schedule optimization -> SchedulingOptimizationService
 */

import { state } from '../state.js';
import { taskInstances, taskTemplates, dataUtils } from '../dataOffline.js';
import { taskValidation } from '../utils/TaskValidation.js';
import { RecurrenceEngine } from './Recurrence.js';

export class TaskInstanceManager {
  constructor(recurrenceEngine = null) {
    this.instances = new Map(); // Local cache organized by date: Map<date, Map<instanceId, instance>>
    this.initialized = false;
    this.recurrenceEngine = recurrenceEngine || new RecurrenceEngine();
  }

  /**
   * Resolve (or generate) an instance by templateId and date
   */
  async resolveInstanceByTemplateAndDate(templateId, date) {
    const user = state.getUser();
    if (!user) {
      throw new Error('No authenticated user');
    }

    // Prefer state cache first
    const cached = state.getTaskInstancesForDate(date) || [];
    const hit = cached.find(i => i.templateId === templateId);
    if (hit) return hit;

    // Fallback: fetch instances for the date and find by template
    const fetched = await taskInstances.getForDate?.(date);
    const found = (fetched || []).find(i => i.templateId === templateId);
    if (found) return found;

    // If not found, try to generate from template (recurrence aware)
    const template = await taskTemplates.get(templateId);
    if (!template) {
      return null;
    }
    return await this.generateFromTemplate(user.uid, template, date);
  }

  /**
   * Toggle completion by templateId and date
   */
  async toggleByTemplateAndDate(templateId, date) {
    const instance = await this.resolveInstanceByTemplateAndDate(templateId, date);
    if (!instance) return null;

    if (instance.status !== 'completed') {
      return this.markCompleted(instance.id);
    }
    // Toggle back to pending
    return this.update(
      instance.id,
      { status: 'pending', completedAt: null, actualDuration: null },
      'Toggled to pending by user'
    );
  }

  /**
   * Mark skipped by templateId and date
   */
  async skipByTemplateAndDate(templateId, date, reason = 'Skipped by user') {
    const instance = await this.resolveInstanceByTemplateAndDate(templateId, date);
    if (!instance) return null;
    return this.markSkipped(instance.id, reason);
  }

  /**
   * Postpone by templateId and date by N minutes
   */
  async postponeByTemplateAndDate(templateId, date, minutes = 30) {
    const instance = await this.resolveInstanceByTemplateAndDate(templateId, date);
    if (!instance) return null;

    let baseMinutes;
    if (instance.scheduledTime) {
      baseMinutes = this.parseTimeToMinutes(instance.scheduledTime);
    } else {
      const now = new Date();
      baseMinutes = (now.getHours() * 60) + now.getMinutes();
    }
    const newTime = this.minutesToTimeString(baseMinutes + (Number(minutes) || 0));

    return this.update(
      instance.id,
      { scheduledTime: newTime },
      'Postponed by user'
    );
  }

  /**
   * Initialize the manager (load existing instances for current date range)
   */
  async initialize(userId, dateRange = 7) {
    try {
      if (!userId) {
        throw new Error('User ID is required for TaskInstanceManager initialization');
      }

      // Load instances for the current date plus dateRange days
      const today = dataUtils.getTodayDateString();
      const dates = this.getDateRange(today, dateRange);
      
      for (const date of dates) {
        const instances = await taskInstances.getByDate(userId, date);
        if (instances.length > 0) {
          const dateMap = new Map();
          instances.forEach(instance => {
            dateMap.set(instance.id, instance);
          });
          this.instances.set(date, dateMap);
        }
      }
      
      this.initialized = true;
      console.log(`✅ TaskInstanceManager initialized with instances for ${dates.length} dates`);
    } catch (error) {
      console.error('❌ Error initializing TaskInstanceManager:', error);
      throw error;
    }
  }

  /**
   * ========================================================================
   * CORE CRUD OPERATIONS
   * ========================================================================
   */

  /**
   * Create instance from template for specific date (main instance creation method)
   */
  async create(userId, instanceData) {
    try {
      if (!userId || !instanceData) {
        throw new Error('User ID and instance data are required');
      }

      // Add metadata and defaults
      const finalInstanceData = {
        status: 'pending',
        scheduledTime: null,
        actualDuration: null,
        completedAt: null,
        notes: null,
        modificationReason: null,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        ...instanceData
      };

      // Validate instance data  
      const validationResult = taskValidation.validateInstance(finalInstanceData);
      if (!validationResult.isValid) {
        throw new Error(`Instance validation failed: ${validationResult.getErrorMessages().join(', ')}`);
      }

      // Create instance in database
      const newInstance = await taskInstances.create(userId, finalInstanceData);
      
      // Cache locally
      this.cacheInstance(newInstance.date, newInstance);
      
      // Update application state
      state.updateTaskInstance(newInstance);
      
      console.log(`✅ Task instance created: ${newInstance.taskName} for ${newInstance.date}`);
      return newInstance;
    } catch (error) {
      console.error('❌ Error creating task instance:', error);
      throw error;
    }
  }

  /**
   * Generate instance from template for specific date
   */
  async generateFromTemplate(userId, template, date) {
    try {
      if (!userId || !template || !date) {
        throw new Error('User ID, template, and date are required');
      }

      // Check if template should generate an instance for this date
      if (!this.recurrenceEngine.shouldGenerateForDate(template, date)) {
        return null;
      }

      // Create instance data from template
      const instanceData = {
        templateId: template.id,
        date: date,
        taskName: template.taskName,
        description: template.description,
        durationMinutes: template.durationMinutes,
        minDurationMinutes: template.minDurationMinutes,
        priority: template.priority,
        isMandatory: template.isMandatory,
        schedulingType: template.schedulingType,
        defaultTime: template.defaultTime,
        timeWindow: template.timeWindow,
        dependsOn: template.dependsOn
      };

      return await this.create(userId, instanceData);
    } catch (error) {
      console.error('❌ Error generating task instance from template:', error);
      throw error;
    }
  }

  /**
   * Get task instance by ID
   */
  async get(instanceId, date = null) {
    try {
      if (!instanceId) {
        throw new Error('Instance ID is required');
      }

      // If date provided, check cache for that date
      if (date && this.instances.has(date)) {
        const dateMap = this.instances.get(date);
        if (dateMap.has(instanceId)) {
          return dateMap.get(instanceId);
        }
      }

      // If no date or not in cache, search all cached dates
      for (const [, dateMap] of this.instances) {
        if (dateMap.has(instanceId)) {
          return dateMap.get(instanceId);
        }
      }

      // Not in cache, fetch from database
      const instance = await taskInstances.get(instanceId);
      if (instance) {
        this.cacheInstance(instance.date, instance);
      }
      
      return instance;
    } catch (error) {
      console.error('❌ Error retrieving task instance:', error);
      throw error;
    }
  }

  /**
   * Get all task instances for a specific date
   */
  async getByDate(userId, date) {
    try {
      if (!userId || !date) {
        throw new Error('User ID and date are required');
      }

      // Check cache first
      if (this.instances.has(date)) {
        const dateMap = this.instances.get(date);
        return Array.from(dateMap.values());
      }

      // Fetch from database if not cached
      const instances = await taskInstances.getByDate(userId, date);
      
      // Update cache
      if (instances.length > 0) {
        const dateMap = new Map();
        instances.forEach(instance => {
          dateMap.set(instance.id, instance);
        });
        this.instances.set(date, dateMap);
      }
      
      return instances;
    } catch (error) {
      console.error('❌ Error retrieving task instances for date:', error);
      throw error;
    }
  }

  /**
   * Update task instance with modification tracking
   */
  async update(instanceId, updates, modificationReason = null) {
    try {
      if (!instanceId) {
        throw new Error('Instance ID is required');
      }

      // Get current instance
      const currentInstance = await this.get(instanceId);
      if (!currentInstance) {
        throw new Error(`Task instance not found: ${instanceId}`);
      }

      // Merge updates with modification tracking
      const updatedData = {
        ...currentInstance,
        ...updates,
        modificationReason: modificationReason,
        modifiedAt: new Date().toISOString()
      };

      // Validate instance data  
      const validationResult = taskValidation.validateInstance(updatedData);
      if (!validationResult.isValid) {
        throw new Error(`Instance validation failed: ${validationResult.getErrorMessages().join(', ')}`);
      }
      
      // Update in database
      const updatedInstance = await taskInstances.update(instanceId, updatedData);
      
      // Update cache
      this.cacheInstance(updatedInstance.date, updatedInstance);
      
      // Update application state
      state.updateTaskInstance(updatedInstance);
      
      console.log(`✅ Task instance updated: ${instanceId}`);
      return updatedInstance;
    } catch (error) {
      console.error('❌ Error updating task instance:', error);
      throw error;
    }
  }

  /**
   * Delete task instance (soft delete)
   */
  async delete(instanceId) {
    try {
      if (!instanceId) {
        throw new Error('Instance ID is required');
      }

      const currentInstance = await this.get(instanceId);
      if (!currentInstance) {
        throw new Error(`Task instance not found: ${instanceId}`);
      }

      await taskInstances.delete(instanceId);
      
      // Remove from cache
      this.removeCachedInstance(currentInstance.date, instanceId);
      
      // Remove from application state
      state.removeTaskInstance(instanceId);
      
      console.log(`✅ Task instance deleted: ${instanceId}`);
    } catch (error) {
      console.error('❌ Error deleting task instance:', error);
      throw error;
    }
  }

  /**
   * ========================================================================
   * INSTANCE LIFECYCLE OPERATIONS
   * ========================================================================
   */

  /**
   * Mark task instance as completed
   */
  async markCompleted(instanceId, completionData = {}) {
    try {
      const updates = {
        status: 'completed',
        completedAt: new Date().toISOString(),
        actualDuration: completionData.actualDuration || null,
        notes: completionData.notes || null
      };

      return await this.update(instanceId, updates, 'Marked as completed by user');
    } catch (error) {
      console.error('❌ Error marking task instance as completed:', error);
      throw error;
    }
  }

  /**
   * Mark task instance as skipped
   */
  async markSkipped(instanceId, reason = null) {
    try {
      const updates = {
        status: 'skipped',
        notes: reason
      };

      return await this.update(instanceId, updates, 'Skipped by user');
    } catch (error) {
      console.error('❌ Error marking task instance as skipped:', error);
      throw error;
    }
  }

  /**
   * Update scheduled time for instance
   */
  async updateScheduledTime(instanceId, newTime) {
    try {
      if (!newTime) {
        throw new Error('New scheduled time is required');
      }

      const updates = {
        scheduledTime: newTime
      };

      return await this.update(instanceId, updates, `Scheduled time updated to ${newTime}`);
    } catch (error) {
      console.error('❌ Error updating scheduled time:', error);
      throw error;
    }
  }

  /**
   * Postpone task instance to another date
   */
  async postpone(instanceId, newDate, reason = null) {
    try {
      if (!newDate) {
        throw new Error('New date is required for postponing');
      }

      const currentInstance = await this.get(instanceId);
      if (!currentInstance) {
        throw new Error(`Task instance not found: ${instanceId}`);
      }

      const updates = {
        date: newDate,
        status: 'pending', // Reset to pending on new date
        notes: reason
      };

      const updatedInstance = await this.update(instanceId, updates, `Postponed to ${newDate}`);
      
      // Move in cache from old date to new date
      this.removeCachedInstance(currentInstance.date, instanceId);
      this.cacheInstance(newDate, updatedInstance);

      return updatedInstance;
    } catch (error) {
      console.error('❌ Error postponing task instance:', error);
      throw error;
    }
  }

  /**
   * ========================================================================
   * PERFORMANCE CACHING SYSTEM
   * ========================================================================
   */

  /**
   * Cache instance locally for performance
   */
  cacheInstance(date, instance) {
    if (!this.instances.has(date)) {
      this.instances.set(date, new Map());
    }
    this.instances.get(date).set(instance.id, instance);
  }

  /**
   * Remove instance from cache
   */
  removeCachedInstance(date, instanceId) {
    if (this.instances.has(date)) {
      const dateMap = this.instances.get(date);
      dateMap.delete(instanceId);
      if (dateMap.size === 0) {
        this.instances.delete(date);
      }
    }
  }

  /**
   * Clear all cached instances (useful for memory management)
   */
  clearCache() {
    this.instances.clear();
    console.log('✅ Task instance cache cleared');
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    let totalInstances = 0;
    const dateCount = this.instances.size;
    
    for (const [, dateMap] of this.instances) {
      totalInstances += dateMap.size;
    }

    return {
      cachedDates: dateCount,
      totalCachedInstances: totalInstances,
      initialized: this.initialized,
      averageInstancesPerDate: dateCount > 0 ? Math.round(totalInstances / dateCount) : 0
    };
  }

  /**
   * ========================================================================
   * HELPER UTILITIES
   * ========================================================================
   */

  /**
   * Generate date range array
   */
  getDateRange(startDate, days) {
    const dates = [];
    const start = new Date(startDate);
    
    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(dataUtils.formatDateString(date));
    }
    
    return dates;
  }

  /**
   * Parse time string (HH:MM) to minutes since midnight
   */
  parseTimeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to time string (HH:MM)
   */
  minutesToTimeString(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Check if template is active for given date (based on date constraints)
   */
  isTemplateActiveForDate(template, date) {
    const targetDate = new Date(date);
    
    // Check start date constraint
    if (template.startDate) {
      const startDate = new Date(template.startDate);
      if (targetDate < startDate) {
        return false;
      }
    }
    
    // Check end date constraint
    if (template.endDate) {
      const endDate = new Date(template.endDate);
      if (targetDate > endDate) {
        return false;
      }
    }
    
    // Check occurrence limits
    if (template.recurrenceRule && template.recurrenceRule.endAfterOccurrences) {
      // This would require counting previous occurrences - delegate to RecurrenceEngine
      return this.recurrenceEngine.isWithinOccurrenceLimits(template, date);
    }
    
    return true;
  }

  /**
   * Bulk operation helper - get instances for multiple dates
   */
  async getInstancesForDateRange(userId, startDate, endDate) {
    try {
      const dates = this.getDateRange(startDate, this.calculateDaysBetween(startDate, endDate) + 1);
      const allInstances = [];
      
      for (const date of dates) {
        const instances = await this.getByDate(userId, date);
        allInstances.push(...instances);
      }
      
      return allInstances;
    } catch (error) {
      console.error('❌ Error getting instances for date range:', error);
      throw error;
    }
  }

  /**
   * Calculate days between two dates
   */
  calculateDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }
}

console.log('✅ Streamlined TaskInstanceManager class loaded');
