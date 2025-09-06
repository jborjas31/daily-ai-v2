/**
 * Offline-Enabled Data Bridge
 * 
 * This module provides a drop-in replacement for the original data.js
 * with offline functionality. It maintains the same API while adding
 * automatic offline/online switching, caching, and sync capabilities.
 */

import { offlineDataLayer } from './utils/OfflineDataLayer.js';
import { auth } from './firebase.js';

// Wait for offline data layer to be initialized
let isInitialized = false;
const initPromise = new Promise((resolve) => {
  const checkInitialization = () => {
    if (offlineDataLayer.isInitialized) {
      isInitialized = true;
      resolve();
    } else {
      setTimeout(checkInitialization, 100);
    }
  };
  checkInitialization();
});

/**
 * Ensure the offline data layer is initialized before operations
 */
async function ensureInitialized() {
  if (!isInitialized) {
    await initPromise;
  }
}

/**
 * Enhanced User Settings with offline capabilities
 * Maintains the same API as original data.js
 */
export const userSettings = {
  async get() {
    await ensureInitialized();
    return offlineDataLayer.userSettings.get();
  },

  async save(settings) {
    await ensureInitialized();
    return offlineDataLayer.userSettings.save(settings);
  },

  async initialize() {
    await ensureInitialized();
    return offlineDataLayer.userSettings.initialize();
  }
};

/**
 * Enhanced Task Templates with offline capabilities
 * Maintains the same API as original data.js
 */
export const taskTemplates = {
  async getAll(userId = null, options = {}) {
    await ensureInitialized();
    return offlineDataLayer.taskTemplates.getAll(userId, options);
  },

  async get(templateId) {
    await ensureInitialized();
    return offlineDataLayer.taskTemplates.get(templateId);
  },

  async search(userId = null, searchQuery, options = {}) {
    await ensureInitialized();
    return offlineDataLayer.taskTemplates.search(userId, searchQuery, options);
  },

  async getByFilters(userId = null, filters = {}, pagination = {}) {
    await ensureInitialized();
    // For now, use getAll with filters - can be optimized later
    const templates = await offlineDataLayer.taskTemplates.getAll(userId, { 
      ...options,
      filters,
      limit: pagination.limit 
    });
    return {
      templates,
      hasMore: templates.length === (pagination.limit || 50),
      lastDoc: null,
      total: templates.length
    };
  },

  async create(userId, templateData) {
    await ensureInitialized();
    return offlineDataLayer.taskTemplates.create(userId, templateData);
  },

  async update(templateId, updates) {
    await ensureInitialized();
    return offlineDataLayer.taskTemplates.update(templateId, updates);
  },

  async delete(templateId) {
    await ensureInitialized();
    return offlineDataLayer.taskTemplates.delete(templateId);
  },

  async permanentDelete(templateId) {
    await ensureInitialized();
    // For offline, we'll treat this the same as regular delete
    // The actual permanent deletion will happen when syncing
    return offlineDataLayer.taskTemplates.delete(templateId);
  },

  async batchActivate(templateIds) {
    await ensureInitialized();
    return offlineDataLayer.taskTemplates.batchActivate(templateIds);
  },

  async batchDeactivate(templateIds) {
    await ensureInitialized();
    return offlineDataLayer.taskTemplates.batchDeactivate(templateIds);
  },

  async batchUpdate(templateIds, updates) {
    await ensureInitialized();
    const results = [];
    for (const templateId of templateIds) {
      const result = await offlineDataLayer.taskTemplates.update(templateId, updates);
      results.push(result);
    }
    return results;
  },

  async batchDelete(templateIds) {
    await ensureInitialized();
    for (const templateId of templateIds) {
      await offlineDataLayer.taskTemplates.delete(templateId);
    }
    return { deletedCount: templateIds.length };
  },

  async getActiveCount(userId = null) {
    await ensureInitialized();
    const templates = await offlineDataLayer.taskTemplates.getAll(userId, { includeInactive: false });
    return templates.length;
  },

  async getTotalCount(userId = null) {
    await ensureInitialized();
    const templates = await offlineDataLayer.taskTemplates.getAll(userId, { includeInactive: true });
    return templates.length;
  },

  async duplicate(templateId) {
    await ensureInitialized();
    const original = await offlineDataLayer.taskTemplates.get(templateId);
    const duplicateData = {
      ...original,
      taskName: `${original.taskName} (Copy)`,
      id: undefined, // Remove ID so a new one is generated
      createdAt: undefined,
      updatedAt: undefined
    };
    delete duplicateData.id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    
    return offlineDataLayer.taskTemplates.create(null, duplicateData);
  }
};

/**
 * Enhanced Task Instances with offline capabilities
 * Maintains the same API as original data.js
 */
export const taskInstances = {
  async get(instanceId) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.get(instanceId);
  },

  async getForDate(date, options = {}) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.getForDate(date, options);
  },

  async getForDateRange(startDate, endDate, options = {}) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.getForDateRange(startDate, endDate, options);
  },

  async getByTemplateId(templateId, options = {}) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.getByTemplateId(templateId, options);
  },

  async create(instanceData) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.create(instanceData);
  },

  async update(instanceId, updates) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.update(instanceId, updates);
  },

  async delete(instanceId) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.delete(instanceId);
  },

  async batchUpdate(instanceIds, updates) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.batchUpdate(instanceIds, updates);
  },

  async batchCreate(instancesData) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.batchCreate(instancesData);
  },

  async batchDelete(instanceIds) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.batchDelete(instanceIds);
  },

  async cleanupOldInstances(retentionDays = 365) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.cleanupOldInstances(retentionDays);
  },

  async getStats(startDate, endDate) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.getStats(startDate, endDate);
  },

  async createWithRetry(instanceData, maxAttempts = 3) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.createWithRetry(instanceData, maxAttempts);
  },

  async updateWithRetry(instanceId, updates, maxAttempts = 3) {
    await ensureInitialized();
    return offlineDataLayer.taskInstances.updateWithRetry(instanceId, updates, maxAttempts);
  }
};

/**
 * Data Utilities (preserved from original)
 * These remain the same as they don't require offline functionality
 */
export const dataUtils = {
  getCurrentUserId() {
    const user = auth?.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.uid;
  },

  getTodayDateString() {
    return new Date().toISOString().split('T')[0];
  },

  getDateString(date) {
    return new Date(date).toISOString().split('T')[0];
  },

  addDaysToDate(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  cleanObjectData(obj) {
    const cleaned = {};
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value !== null && value !== undefined && value !== '') {
        cleaned[key] = value;
      }
    });
    return cleaned;
  },

  async withRetry(operation, maxAttempts = 3, delay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, error.message);
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
    throw lastError;
  },

  formatDateTime(dateTime) {
    return new Date(dateTime).toLocaleString();
  },

  formatTime(time) {
    if (typeof time === 'string') {
      return time;
    }
    return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '0 min';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  },

  formatDateString(date) {
    if (typeof date === 'string') {
      return date;
    }
    return new Date(date).toISOString().split('T')[0];
  },

  formatDate(date) {
    return new Date(date).toLocaleDateString();
  }
};

/**
 * Offline-specific utilities
 */
export const offlineUtils = {
  async getSyncStatus() {
    await ensureInitialized();
    return offlineDataLayer.getSyncStatus();
  },

  async forceSync() {
    await ensureInitialized();
    return offlineDataLayer.forcSync();
  },

  async clearOfflineData() {
    await ensureInitialized();
    return offlineDataLayer.clearOfflineData();
  },

  isOfflineMode() {
    return !navigator.onLine;
  },

  async getOfflineStats() {
    await ensureInitialized();
    const syncStatus = await offlineDataLayer.getSyncStatus();
    return {
      isOnline: syncStatus.online,
      pendingOperations: syncStatus.pendingOperations,
      failedOperations: syncStatus.failedOperations,
      hasOfflineChanges: syncStatus.hasOfflineChanges,
      lastSyncTime: syncStatus.lastSyncTime,
      syncInProgress: syncStatus.syncInProgress
    };
  }
};

console.log('✅ Offline-enabled data bridge initialized');
