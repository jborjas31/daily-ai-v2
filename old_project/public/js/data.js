/**
 * Data Service Module
 * Handles all Firestore CRUD operations and data structure management
 */

import { auth, db } from './firebase.js';
import { taskValidation } from './utils/TaskValidation.js';
import { UserSettingsRepo } from './data/repo/UserSettingsRepo.js';
import { TaskTemplatesRepo } from './data/repo/TaskTemplatesRepo.js';
import { TaskInstancesRepo } from './data/repo/TaskInstancesRepo.js';
import { DailySchedulesRepo } from './data/repo/DailySchedulesRepo.js';
// Phase 2: shared utilities (re-export via dataUtils for backward compatibility)
import { withRetry as __sharedWithRetry, shouldRetryOperation as __sharedShouldRetry } from './data/shared/Retry.js';
import { timestampToISO as __sharedTimestampToISO } from './data/shared/Mapping.js';

/**
 * Get current user ID
 */
function getCurrentUserId() {
  const user = auth.currentUser;
  console.log('🔍 getCurrentUserId - auth.currentUser:', user ? user.uid : 'null');
  if (!user) {
    throw new Error('No authenticated user');
  }
  return user.uid;
}

/**
 * User Settings Operations
 */
// Phase 3: delegate userSettings operations to repo (legacy API preserved)
const __userSettingsRepo = new UserSettingsRepo();
const __templatesRepo = new TaskTemplatesRepo();
const __instancesRepo = new TaskInstancesRepo();
const __schedulesRepo = new DailySchedulesRepo();

export const userSettings = {
  // Get user settings (with defaults)
  async get() {
    try {
      const userId = getCurrentUserId();
      return await __userSettingsRepo.get(userId);
    } catch (error) {
      console.error('Error getting user settings:', error);
      throw error;
    }
  },

  // Save user settings
  async save(settings) {
    try {
      const userId = getCurrentUserId();
      const result = await __userSettingsRepo.save(userId, settings);
      console.log('✅ User settings saved');
      return result;
    } catch (error) {
      console.error('❌ Error saving user settings:', error);
      throw error;
    }
  },

  // Initialize default settings for new user
  async initialize() {
    try {
      const userId = getCurrentUserId();
      const result = await __userSettingsRepo.initialize(userId);
      console.log('✅ Default user settings initialized');
      return result;
    } catch (error) {
      console.error('❌ Error initializing user settings:', error);
      throw error;
    }
  }
};

/**
 * Task Template Operations
 * Enhanced CRUD operations with batch operations, search, filtering, and offline support
 */
export const taskTemplates = {
  // Get all task templates for user with advanced filtering
  async getAll(userId = null, options = {}) {
    try {
      const uid = userId || getCurrentUserId();
      console.log('🔍 taskTemplates.getAll - Using userId:', uid);
      const results = await __templatesRepo.getAll(uid, options);
      console.log(`✅ Retrieved ${results.length} task templates${options.includeInactive ? ' (including inactive)' : ''}`);
      return results;
    } catch (error) {
      console.error('❌ Error getting task templates:', error);
      console.error('❌ Error details:', error.message, error.code);
      throw error;
    }
  },

  // Get single task template by ID
  async get(templateId) {
    try {
      const result = await __templatesRepo.get(templateId);
      return result;
    } catch (error) {
      console.error('❌ Error getting task template:', error);
      throw error;
    }
  },

  // Search task templates by name or description
  async search(userId = null, searchQuery, options = {}) {
    try {
      const uid = userId || getCurrentUserId();
      const results = await __templatesRepo.search(uid, searchQuery, options);
      console.log(`✅ Found ${results.length} templates matching "${searchQuery}"`);
      return results;
    } catch (error) {
      console.error('❌ Error searching task templates:', error);
      throw error;
    }
  },

  // Get templates by specific criteria with pagination
  async getByFilters(userId = null, filters = {}, pagination = {}) {
    try {
      const uid = userId || getCurrentUserId();
      const result = await __templatesRepo.getByFilters(uid, filters, pagination);
      return result;
    } catch (error) {
      console.error('❌ Error getting filtered templates:', error);
      throw error;
    }
  },

  // Create new task template
  async create(userId, templateData) {
    try {
      const uid = userId || getCurrentUserId();
      const created = await __templatesRepo.create(uid, templateData);
      console.log('✅ Task template created:', created.id);
      return created;
    } catch (error) {
      console.error('❌ Error creating task template:', error);
      throw error;
    }
  },

  // Update task template
  async update(templateId, updates) {
    try {
      const updated = await __templatesRepo.update(templateId, updates);
      console.log('✅ Task template updated:', templateId);
      return updated;
    } catch (error) {
      console.error('❌ Error updating task template:', error);
      throw error;
    }
  },

  // Soft delete task template
  async delete(templateId) {
    try {
      await __templatesRepo.delete(templateId);
      console.log('✅ Task template soft deleted:', templateId);
    } catch (error) {
      console.error('❌ Error deleting task template:', error);
      throw error;
    }
  },

  // Permanently delete task template
  async permanentDelete(templateId) {
    try {
      await __templatesRepo.permanentDelete(templateId);
      console.log('✅ Task template permanently deleted:', templateId);
    } catch (error) {
      console.error('❌ Error permanently deleting task template:', error);
      throw error;
    }
  },

  // Batch operations for multiple templates
  async batchUpdate(templateIds, updates) {
    try {
      const result = await __templatesRepo.batchUpdate(templateIds, updates);
      console.log(`✅ Batch updated ${templateIds.length} templates`);
      return result;
    } catch (error) {
      console.error('❌ Error in batch update:', error);
      throw error;
    }
  },

  // Batch activate templates
  async batchActivate(templateIds) {
    try {
      return await __templatesRepo.batchActivate(templateIds);
    } catch (error) {
      console.error('❌ Error in batch activate:', error);
      throw error;
    }
  },

  // Batch deactivate templates
  async batchDeactivate(templateIds) {
    try {
      return await __templatesRepo.batchDeactivate(templateIds);
    } catch (error) {
      console.error('❌ Error in batch deactivate:', error);
      throw error;
    }
  },

  // Batch create templates
  async batchCreate(userId, templatesData) {
    try {
      const uid = userId || getCurrentUserId();
      const created = await __templatesRepo.batchCreate(uid, templatesData);
      console.log(`✅ Batch created ${created.length} templates`);
      return created;
    } catch (error) {
      console.error('❌ Error in batch create:', error);
      throw error;
    }
  },

  // Get template statistics
  async getStats(userId = null) {
    try {
      const uid = userId || getCurrentUserId();
      
      const [activeTemplates, allTemplates] = await Promise.all([
        this.getAll(uid, { includeInactive: false }),
        this.getAll(uid, { includeInactive: true })
      ]);
      
      const stats = {
        total: allTemplates.length,
        active: activeTemplates.length,
        inactive: allTemplates.length - activeTemplates.length,
        byTimeWindow: {},
        byPriority: {},
        mandatory: activeTemplates.filter(t => t.isMandatory).length,
        flexible: activeTemplates.filter(t => t.schedulingType === 'flexible').length,
        fixed: activeTemplates.filter(t => t.schedulingType === 'fixed').length
      };
      
      // Calculate distribution by time window
      activeTemplates.forEach(template => {
        const timeWindow = template.timeWindow || 'anytime';
        stats.byTimeWindow[timeWindow] = (stats.byTimeWindow[timeWindow] || 0) + 1;
      });
      
      // Calculate distribution by priority
      activeTemplates.forEach(template => {
        const priority = template.priority || 3;
        stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
      });
      
      console.log('✅ Template statistics calculated');
      return stats;
    } catch (error) {
      console.error('❌ Error getting template statistics:', error);
      throw error;
    }
  },

  // Export templates for backup/migration
  async exportTemplates(userId = null, includeInactive = false) {
    try {
      const uid = userId || getCurrentUserId();
      const data = await __templatesRepo.exportTemplates(uid, includeInactive);
      console.log(`✅ Exported ${data.templateCount} templates`);
      return data;
    } catch (error) {
      console.error('❌ Error exporting templates:', error);
      throw error;
    }
  },

  // Import templates from backup
  async importTemplates(userId, importData, options = {}) {
    try {
      const uid = userId || getCurrentUserId();
      const result = await __templatesRepo.importTemplates(uid, importData, options);
      console.log(`✅ Import completed: ${result.importedCount} imported, ${result.skippedCount} skipped`);
      return result;
    } catch (error) {
      console.error('❌ Error importing templates:', error);
      throw error;
    }
  }
};

/**
 * Task Instance Operations
 * Enhanced CRUD operations with date-based queries, batch operations, and cleanup
 */
export const taskInstances = {
  // Get single task instance by ID
  async get(instanceId) {
    try {
      return await __instancesRepo.get(instanceId);
    } catch (error) {
      console.error('❌ Error getting task instance:', error);
      throw error;
    }
  },

  // Get task instances for specific date with filtering
  async getForDate(date, options = {}) {
    try {
      return await __instancesRepo.getForDate(date, options);
    } catch (error) {
      console.error('❌ Error getting task instances for date:', error);
      throw error;
    }
  },

  // Get task instances for date range
  async getForDateRange(startDate, endDate, options = {}) {
    try {
      // Delegated to TaskInstancesRepo (legacy code retained below)
      return await __instancesRepo.getForDateRange(startDate, endDate, options);
      const userId = getCurrentUserId();
      const {
        status = null,
        templateId = null,
        limit = null,
        orderBy = 'date',
        orderDirection = 'asc'
      } = options;
      
      let query = db
        .collection('users')
        .doc(userId)
        .collection('task_instances')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate);
      
      // Apply additional filters
      if (status) {
        query = query.where('status', '==', status);
      }
      
      if (templateId) {
        query = query.where('templateId', '==', templateId);
      }
      
      // Apply ordering
      query = query.orderBy(orderBy, orderDirection);
      
      // Add secondary sort by createdAt for consistency
      if (orderBy !== 'createdAt') {
        query = query.orderBy('createdAt');
      }
      
      // Apply limit if specified
      if (limit) {
        query = query.limit(limit);
      }
      
      const snapshot = await query.get();
      
      const instances = [];
      snapshot.forEach(doc => {
        instances.push({ id: doc.id, ...doc.data() });
      });
      
      console.log(`✅ Retrieved ${instances.length} task instances for range ${startDate} to ${endDate}`);
      return instances;
    } catch (error) {
      console.error('❌ Error getting task instances for date range:', error);
      throw error;
    }
  },

  // Get instances by template ID across all dates
  async getByTemplateId(templateId, options = {}) {
    try {
      // Delegated to TaskInstancesRepo (legacy code retained below)
      return await __instancesRepo.getByTemplateId(templateId, options);
      const userId = getCurrentUserId();
      const {
        startDate = null,
        endDate = null,
        status = null,
        limit = null,
        orderBy = 'date',
        orderDirection = 'desc'
      } = options;
      
      let query = db
        .collection('users')
        .doc(userId)
        .collection('task_instances')
        .where('templateId', '==', templateId);
      
      // Apply date range filters
      if (startDate) {
        query = query.where('date', '>=', startDate);
      }
      
      if (endDate) {
        query = query.where('date', '<=', endDate);
      }
      
      // Apply status filter
      if (status) {
        query = query.where('status', '==', status);
      }
      
      // Apply ordering
      query = query.orderBy(orderBy, orderDirection);
      
      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }
      
      const snapshot = await query.get();
      
      const instances = [];
      snapshot.forEach(doc => {
        instances.push({ id: doc.id, ...doc.data() });
      });
      
      console.log(`✅ Retrieved ${instances.length} instances for template ${templateId}`);
      return instances;
    } catch (error) {
      console.error('❌ Error getting instances by template ID:', error);
      throw error;
    }
  },

  // Create task instance with validation
  async create(instanceData) {
    try {
      const cleanData = dataUtils.cleanObjectData(instanceData);
      const created = await __instancesRepo.create(cleanData);
      console.log('✅ Task instance created:', created.id);
      return created;
    } catch (error) {
      console.error('❌ Error creating task instance:', error);
      throw error;
    }
  },

  // Update task instance with modification tracking
  async update(instanceId, updates) {
    try {
      const cleanUpdates = dataUtils.cleanObjectData(updates);
      const updated = await __instancesRepo.update(instanceId, cleanUpdates);
      console.log('✅ Task instance updated:', instanceId);
      return updated;
    } catch (error) {
      console.error('❌ Error updating task instance:', error);
      throw error;
    }
  },

  // Delete task instance
  async delete(instanceId) {
    try {
      await __instancesRepo.delete(instanceId);
      console.log('✅ Task instance deleted:', instanceId);
    } catch (error) {
      console.error('❌ Error deleting task instance:', error);
      throw error;
    }
  },

  // Batch operations for multiple instances
  async batchUpdate(instanceIds, updates) {
    try {
      const result = await __instancesRepo.batchUpdate(instanceIds, updates);
      console.log(`✅ Batch updated ${instanceIds.length} instances`);
      return result;
    } catch (error) {
      console.error('❌ Error in batch update:', error);
      throw error;
    }
  },

  // Batch create instances
  async batchCreate(instancesData) {
    try {
      const clean = instancesData.map(d => dataUtils.cleanObjectData(d));
      const created = await __instancesRepo.batchCreate(clean);
      console.log(`✅ Batch created ${created.length} instances`);
      return created;
    } catch (error) {
      console.error('❌ Error in batch create:', error);
      throw error;
    }
  },

  // Batch delete instances
  async batchDelete(instanceIds) {
    try {
      const result = await __instancesRepo.batchDelete(instanceIds);
      console.log(`✅ Batch deleted ${instanceIds.length} instances`);
      return result;
    } catch (error) {
      console.error('❌ Error in batch delete:', error);
      throw error;
    }
  },

  // Cleanup old instances (data retention management)
  async cleanupOldInstances(retentionDays = 365) {
    try {
      const result = await __instancesRepo.cleanupOldInstances(retentionDays);
      console.log(`✅ Cleanup completed: ${result.deletedCount} old instances deleted`);
      return result;
    } catch (error) {
      console.error('❌ Error in cleanup old instances:', error);
      throw error;
    }
  },

  // Get instance statistics for a date range
  async getStats(startDate, endDate) {
    try {
      const instances = await this.getForDateRange(startDate, endDate);
      
      const stats = {
        total: instances.length,
        byStatus: {},
        byDate: {},
        completionRate: 0,
        averageCompletionTime: null
      };
      
      let completedCount = 0;
      let totalCompletionTime = 0;
      let completionTimeCount = 0;
      
      instances.forEach(instance => {
        // Count by status
        const status = instance.status || 'pending';
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
        
        // Count by date
        const date = instance.date;
        stats.byDate[date] = (stats.byDate[date] || 0) + 1;
        
        // Calculate completion metrics
        if (status === 'completed') {
          completedCount++;
          
          if (instance.actualDuration) {
            totalCompletionTime += instance.actualDuration;
            completionTimeCount++;
          }
        }
      });
      
      // Calculate completion rate
      stats.completionRate = stats.total > 0 ? 
        Math.round((completedCount / stats.total) * 100) : 0;
      
      // Calculate average completion time
      stats.averageCompletionTime = completionTimeCount > 0 ? 
        Math.round(totalCompletionTime / completionTimeCount) : null;
      
      console.log('✅ Instance statistics calculated');
      return stats;
    } catch (error) {
      console.error('❌ Error getting instance statistics:', error);
      throw error;
    }
  },

  // Offline-first operations with retry logic
  async createWithRetry(instanceData, maxAttempts = 3) {
    try {
      return await dataUtils.withRetry(
        () => this.create(instanceData),
        maxAttempts
      );
    } catch (error) {
      console.error('❌ Error creating instance with retry:', error);
      throw error;
    }
  },

  async updateWithRetry(instanceId, updates, maxAttempts = 3) {
    try {
      return await dataUtils.withRetry(
        () => this.update(instanceId, updates),
        maxAttempts
      );
    } catch (error) {
      console.error('❌ Error updating instance with retry:', error);
      throw error;
    }
  },

  async batchCreateWithRetry(instancesData, maxAttempts = 3) {
    try {
      return await dataUtils.withRetry(
        () => this.batchCreate(instancesData),
        maxAttempts
      );
    } catch (error) {
      console.error('❌ Error batch creating instances with retry:', error);
      throw error;
    }
  },

  async batchUpdateWithRetry(instanceIds, updates, maxAttempts = 3) {
    try {
      return await dataUtils.withRetry(
        () => this.batchUpdate(instanceIds, updates),
        maxAttempts
      );
    } catch (error) {
      console.error('❌ Error batch updating instances with retry:', error);
      throw error;
    }
  },

  // Get cached instances for offline support (would work with state management)
  getCachedForDate(date) {
    // This would integrate with the state management cache
    // For now, returns empty array if offline
    if (dataUtils.isOffline()) {
      console.log(`⚠️ Offline mode: returning empty instances for date ${date}`);
      return [];
    }
    return null; // Indicates cache not available, should fetch from server
  },

  // Sync pending offline operations when back online
  async syncOfflineOperations() {
    try {
      if (dataUtils.isOffline()) {
        console.log('⚠️ Still offline, cannot sync operations');
        return { synced: 0, failed: 0 };
      }

      // This would integrate with a proper offline queue system
      // For now, just log that sync capability is available
      console.log('✅ Offline sync capabilities available for task instances');
      
      return { synced: 0, failed: 0, message: 'Offline sync system ready' };
    } catch (error) {
      console.error('❌ Error syncing offline operations:', error);
      throw error;
    }
  },

  // Export instances for backup/migration
  async exportInstances(startDate, endDate, options = {}) {
    try {
      const data = await __instancesRepo.exportInstances(startDate, endDate, options);
      console.log(`✅ Exported ${data.instanceCount} instances for range ${startDate} to ${endDate}`);
      return data;
    } catch (error) {
      console.error('❌ Error exporting instances:', error);
      throw error;
    }
  },

  // Import instances from backup
  async importInstances(importData, options = {}) {
    try {
      const result = await __instancesRepo.importInstances(importData, options);
      console.log(`✅ Import completed: ${result.importedCount} imported, ${result.skippedCount} skipped`);
      return result;
    } catch (error) {
      console.error('❌ Error importing instances:', error);
      throw error;
    }
  }
};

/**
 * Daily Schedule Operations
 */
export const dailySchedules = {
  // Get daily schedule for specific date
  async getForDate(date) {
    try {
      const userId = getCurrentUserId();
      return await __schedulesRepo.getForDate(userId, date);
    } catch (error) {
      console.error('❌ Error getting daily schedule:', error);
      throw error;
    }
  },

  // Save daily schedule override
  async save(date, scheduleData) {
    try {
      const userId = getCurrentUserId();
      const result = await __schedulesRepo.save(userId, date, scheduleData);
      console.log('✅ Daily schedule saved for:', date);
      return result;
    } catch (error) {
      console.error('❌ Error saving daily schedule:', error);
      throw error;
    }
  },

  // Delete daily schedule override
  async delete(date) {
    try {
      const userId = getCurrentUserId();
      await __schedulesRepo.delete(userId, date);
      console.log('✅ Daily schedule override deleted for:', date);
    } catch (error) {
      console.error('❌ Error deleting daily schedule:', error);
      throw error;
    }
  }
};

/**
 * Utility Functions
 */
export const dataUtils = {
  // Format date as YYYY-MM-DD
  formatDate(date = new Date()) {
    return date.toISOString().split('T')[0];
  },

  // Get today's date string
  getTodayDateString() {
    return this.formatDate();
  },

  // Get current timestamp in ISO format
  getCurrentTimestamp() {
    return new Date().toISOString();
  },

  // Add days to date and return formatted string
  addDaysToDate(date, days) {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    return this.formatDate(newDate);
  },

  // Get date range (start, end) as array of date strings
  getDateRange(startDate, endDate) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    while (start <= end) {
      dates.push(this.formatDate(start));
      start.setDate(start.getDate() + 1);
    }
    
    return dates;
  },

  // Validate task template data using comprehensive validation system
  validateTask(taskData, existingTemplates = []) {
    const validationResult = taskValidation.validateTemplate(taskData, existingTemplates);
    return validationResult.getErrorMessages();
  },

  // Quick validation for UI feedback
  quickValidateTask(taskData) {
    const validationResult = taskValidation.quickValidateTemplate(taskData);
    return validationResult.getErrorMessages();
  },

  // Validate task instance data
  validateTaskInstance(instanceData, templateData = null) {
    const validationResult = taskValidation.validateInstance(instanceData, templateData);
    return validationResult.getErrorMessages();
  },


  // Sanitize user input (remove HTML tags, trim whitespace)
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .trim(); // Remove leading/trailing whitespace
  },

  // Deep clean object data (sanitize strings, remove empty values)
  cleanObjectData(obj, options = {}) {
    const { removeEmpty = true, sanitizeStrings = true } = options;
    const cleaned = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        if (!removeEmpty) cleaned[key] = value;
        continue;
      }

      if (typeof value === 'string') {
        const cleanedString = sanitizeStrings ? this.sanitizeInput(value) : value;
        if (!removeEmpty || cleanedString.length > 0) {
          cleaned[key] = cleanedString;
        }
      } else if (Array.isArray(value)) {
        if (!removeEmpty || value.length > 0) {
          cleaned[key] = value;
        }
      } else if (typeof value === 'object') {
        const cleanedObject = this.cleanObjectData(value, options);
        if (!removeEmpty || Object.keys(cleanedObject).length > 0) {
          cleaned[key] = cleanedObject;
        }
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  },

  /**
   * Convert Firestore timestamp to ISO string
   * @deprecated Use Mapping.timestampToISO from `public/js/data/shared/Mapping.js`
   */
  timestampToISO(timestamp) {
    return __sharedTimestampToISO(timestamp);
  },

  // Check if operation should be retried (deprecated: use shared Retry)
  shouldRetryOperation(error, attempt = 1, maxAttempts = 3) {
    return __sharedShouldRetry(error, attempt, maxAttempts);
  },

  /**
   * Execute operation with retry logic
   * @deprecated Use Retry.withRetry from `public/js/data/shared/Retry.js`
   */
  async withRetry(operation, maxAttempts = 3, delayMs = 1000) {
    return __sharedWithRetry(operation, maxAttempts, delayMs);
  },

  // Check if running in offline mode
  isOffline() {
    return !navigator.onLine;
  },

  // Generate a simple hash for data integrity checking
  simpleHash(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
};
