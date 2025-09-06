/**
 * Offline Storage Manager
 * 
 * Comprehensive offline storage system using IndexedDB for persistent data
 * storage, sync conflict resolution, and robust offline operations
 */

/**
 * IndexedDB configuration
 */
const DB_NAME = 'daily-ai-offline';
const DB_VERSION = 1;

const STORES = {
  TASK_TEMPLATES: 'taskTemplates',
  TASK_INSTANCES: 'taskInstances',
  OPERATION_QUEUE: 'operationQueue',
  SYNC_LOG: 'syncLog',
  USER_DATA: 'userData',
  SETTINGS: 'settings',
  CONFLICT_RESOLUTION: 'conflictResolution'
};

/**
 * Offline Storage Manager Class
 */
export class OfflineStorage {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize IndexedDB database
   */
  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initDB();
    return this.initPromise;
  }

  /**
   * Private method to initialize database
   */
  async _initDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isInitialized = true;
        console.log('✅ OfflineStorage: IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this._createStores(db);
      };
    });
  }

  /**
   * Create IndexedDB stores
   */
  _createStores(db) {
    // Task Templates Store
    if (!db.objectStoreNames.contains(STORES.TASK_TEMPLATES)) {
      const templateStore = db.createObjectStore(STORES.TASK_TEMPLATES, { keyPath: 'id' });
      templateStore.createIndex('userId', 'userId', { unique: false });
      templateStore.createIndex('isActive', 'isActive', { unique: false });
      templateStore.createIndex('priority', 'priority', { unique: false });
      templateStore.createIndex('modifiedAt', 'modifiedAt', { unique: false });
    }

    // Task Instances Store
    if (!db.objectStoreNames.contains(STORES.TASK_INSTANCES)) {
      const instanceStore = db.createObjectStore(STORES.TASK_INSTANCES, { keyPath: 'id' });
      instanceStore.createIndex('userId', 'userId', { unique: false });
      instanceStore.createIndex('templateId', 'templateId', { unique: false });
      instanceStore.createIndex('date', 'date', { unique: false });
      instanceStore.createIndex('status', 'status', { unique: false });
      instanceStore.createIndex('modifiedAt', 'modifiedAt', { unique: false });
    }

    // Operation Queue Store
    if (!db.objectStoreNames.contains(STORES.OPERATION_QUEUE)) {
      const queueStore = db.createObjectStore(STORES.OPERATION_QUEUE, { keyPath: 'id', autoIncrement: true });
      queueStore.createIndex('type', 'type', { unique: false });
      queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      queueStore.createIndex('attempts', 'attempts', { unique: false });
      queueStore.createIndex('priority', 'priority', { unique: false });
    }

    // Sync Log Store
    if (!db.objectStoreNames.contains(STORES.SYNC_LOG)) {
      const syncStore = db.createObjectStore(STORES.SYNC_LOG, { keyPath: 'id', autoIncrement: true });
      syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      syncStore.createIndex('operation', 'operation', { unique: false });
      syncStore.createIndex('status', 'status', { unique: false });
    }

    // User Data Store
    if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
      db.createObjectStore(STORES.USER_DATA, { keyPath: 'userId' });
    }

    // Settings Store
    if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
      db.createObjectStore(STORES.SETTINGS, { keyPath: 'userId' });
    }

    // Conflict Resolution Store
    if (!db.objectStoreNames.contains(STORES.CONFLICT_RESOLUTION)) {
      const conflictStore = db.createObjectStore(STORES.CONFLICT_RESOLUTION, { keyPath: 'id', autoIncrement: true });
      conflictStore.createIndex('resourceId', 'resourceId', { unique: false });
      conflictStore.createIndex('resourceType', 'resourceType', { unique: false });
      conflictStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    console.log('✅ OfflineStorage: Database stores created');
  }

  /**
   * Ensure database is initialized
   */
  async _ensureDB() {
    if (!this.isInitialized) {
      await this.init();
    }
    return this.db;
  }

  // === Task Templates Storage ===

  /**
   * Store task template offline
   */
  async storeTaskTemplate(template) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.TASK_TEMPLATES, 'readwrite', (store) => {
      const templateWithTimestamp = {
        ...template,
        offlineModifiedAt: new Date().toISOString(),
        offlineStored: true
      };
      return store.put(templateWithTimestamp);
    });
  }

  /**
   * Get task template from offline storage
   */
  async getTaskTemplate(templateId) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.TASK_TEMPLATES, 'readonly', (store) => {
      return store.get(templateId);
    });
  }

  /**
   * Get all task templates from offline storage
   */
  async getAllTaskTemplates(userId = null) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.TASK_TEMPLATES, 'readonly', (store) => {
      if (userId) {
        const index = store.index('userId');
        return this._getAllFromIndex(index, userId);
      } else {
        return this._getAllFromStore(store);
      }
    });
  }

  /**
   * Delete task template from offline storage
   */
  async deleteTaskTemplate(templateId) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.TASK_TEMPLATES, 'readwrite', (store) => {
      return store.delete(templateId);
    });
  }

  // === Task Instances Storage ===

  /**
   * Store task instance offline
   */
  async storeTaskInstance(instance) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.TASK_INSTANCES, 'readwrite', (store) => {
      const instanceWithTimestamp = {
        ...instance,
        offlineModifiedAt: new Date().toISOString(),
        offlineStored: true
      };
      return store.put(instanceWithTimestamp);
    });
  }

  /**
   * Get task instances for date from offline storage
   */
  async getTaskInstancesForDate(date, userId = null) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.TASK_INSTANCES, 'readonly', (store) => {
      const index = store.index('date');
      return this._getAllFromIndex(index, date);
    }).then(instances => {
      if (userId) {
        return instances.filter(instance => instance.userId === userId);
      }
      return instances;
    });
  }

  /**
   * Get task instance from offline storage
   */
  async getTaskInstance(instanceId) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.TASK_INSTANCES, 'readonly', (store) => {
      return store.get(instanceId);
    });
  }

  /**
   * Delete task instance from offline storage
   */
  async deleteTaskInstance(instanceId) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.TASK_INSTANCES, 'readwrite', (store) => {
      return store.delete(instanceId);
    });
  }

  // === Operation Queue Management ===

  /**
   * Add operation to queue
   */
  async queueOperation(operation) {
    const db = await this._ensureDB();
    const queueItem = {
      ...operation,
      id: operation.id || Date.now() + Math.random(),
      createdAt: new Date().toISOString(),
      attempts: 0,
      priority: operation.priority || 0,
      status: 'pending'
    };

    return this._performTransaction(db, STORES.OPERATION_QUEUE, 'readwrite', (store) => {
      return store.add(queueItem);
    });
  }

  /**
   * Get all queued operations
   */
  async getQueuedOperations(limit = 100) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.OPERATION_QUEUE, 'readonly', (store) => {
      const index = store.index('createdAt');
      return this._getLimitedFromIndex(index, null, limit);
    });
  }

  /**
   * Update operation in queue
   */
  async updateQueuedOperation(operationId, updates) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.OPERATION_QUEUE, 'readwrite', async (store) => {
      const operation = await store.get(operationId);
      if (operation) {
        const updatedOperation = { ...operation, ...updates };
        return store.put(updatedOperation);
      }
      throw new Error('Operation not found in queue');
    });
  }

  /**
   * Remove operation from queue
   */
  async removeQueuedOperation(operationId) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.OPERATION_QUEUE, 'readwrite', (store) => {
      return store.delete(operationId);
    });
  }

  /**
   * Clear all completed operations from queue
   */
  async clearCompletedOperations() {
    const db = await this._ensureDB();
    const operations = await this.getQueuedOperations();
    const completedOps = operations.filter(op => op.status === 'completed' || op.status === 'failed');
    
    for (const op of completedOps) {
      await this.removeQueuedOperation(op.id);
    }
    
    return completedOps.length;
  }

  // === Sync Logging ===

  /**
   * Log sync operation
   */
  async logSyncOperation(operation, status, details = {}) {
    const db = await this._ensureDB();
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      status,
      details,
      ...details
    };

    return this._performTransaction(db, STORES.SYNC_LOG, 'readwrite', (store) => {
      return store.add(logEntry);
    });
  }

  /**
   * Get sync logs
   */
  async getSyncLogs(limit = 50) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.SYNC_LOG, 'readonly', (store) => {
      const index = store.index('timestamp');
      return this._getLimitedFromIndex(index, null, limit, 'prev');
    });
  }

  /**
   * Clear old sync logs
   */
  async clearOldSyncLogs(daysToKeep = 30) {
    const db = await this._ensureDB();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffISO = cutoffDate.toISOString();

    return this._performTransaction(db, STORES.SYNC_LOG, 'readwrite', async (store) => {
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffISO);
      let deletedCount = 0;
      
      return new Promise((resolve, reject) => {
        const request = index.openCursor(range);
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            resolve(deletedCount);
          }
        };
        
        request.onerror = () => reject(request.error);
      });
    });
  }

  // === Conflict Resolution ===

  /**
   * Store sync conflict for resolution
   */
  async storeConflict(conflict) {
    const db = await this._ensureDB();
    const conflictRecord = {
      ...conflict,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    return this._performTransaction(db, STORES.CONFLICT_RESOLUTION, 'readwrite', (store) => {
      return store.add(conflictRecord);
    });
  }

  /**
   * Get pending conflicts
   */
  async getPendingConflicts() {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.CONFLICT_RESOLUTION, 'readonly', (store) => {
      return this._getAllFromStore(store);
    }).then(conflicts => conflicts.filter(c => c.status === 'pending'));
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(conflictId, resolution) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.CONFLICT_RESOLUTION, 'readwrite', async (store) => {
      const conflict = await store.get(conflictId);
      if (conflict) {
        const resolvedConflict = {
          ...conflict,
          status: 'resolved',
          resolution,
          resolvedAt: new Date().toISOString()
        };
        return store.put(resolvedConflict);
      }
      throw new Error('Conflict not found');
    });
  }

  // === User Data and Settings ===

  /**
   * Store user data offline
   */
  async storeUserData(userId, userData) {
    const db = await this._ensureDB();
    const userRecord = {
      userId,
      ...userData,
      offlineModifiedAt: new Date().toISOString()
    };

    return this._performTransaction(db, STORES.USER_DATA, 'readwrite', (store) => {
      return store.put(userRecord);
    });
  }

  /**
   * Get user data from offline storage
   */
  async getUserData(userId) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.USER_DATA, 'readonly', (store) => {
      return store.get(userId);
    });
  }

  /**
   * Store settings offline
   */
  async storeSettings(userId, settings) {
    const db = await this._ensureDB();
    const settingsRecord = {
      userId,
      ...settings,
      offlineModifiedAt: new Date().toISOString()
    };

    return this._performTransaction(db, STORES.SETTINGS, 'readwrite', (store) => {
      return store.put(settingsRecord);
    });
  }

  /**
   * Get settings from offline storage
   */
  async getSettings(userId) {
    const db = await this._ensureDB();
    return this._performTransaction(db, STORES.SETTINGS, 'readonly', (store) => {
      return store.get(userId);
    });
  }

  // === Utility Methods ===

  /**
   * Perform IndexedDB transaction with error handling
   */
  async _performTransaction(db, storeName, mode, operation) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(new Error('Transaction aborted'));
        
        const result = operation(store);
        
        if (result && typeof result.then === 'function') {
          // Handle async operations
          result.then(resolve).catch(reject);
        } else if (result && result.onsuccess !== undefined) {
          // Handle IDBRequest
          result.onsuccess = () => resolve(result.result);
          result.onerror = () => reject(result.error);
        } else {
          // Handle direct values
          transaction.oncomplete = () => resolve(result);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get all records from store
   */
  async _getAllFromStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all records from index
   */
  async _getAllFromIndex(index, key) {
    return new Promise((resolve, reject) => {
      const request = key ? index.getAll(key) : index.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get limited records from index
   */
  async _getLimitedFromIndex(index, key, limit, direction = 'next') {
    return new Promise((resolve, reject) => {
      const results = [];
      const range = key ? IDBKeyRange.only(key) : null;
      const request = index.openCursor(range, direction);
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if offline storage is available
   */
  static isSupported() {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  /**
   * Get storage size estimation
   */
  async getStorageEstimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return await navigator.storage.estimate();
    }
    return null;
  }

  /**
   * Clear all offline data
   */
  async clearAllData() {
    const db = await this._ensureDB();
    const storeNames = Object.values(STORES);
    
    for (const storeName of storeNames) {
      await this._performTransaction(db, storeName, 'readwrite', (store) => {
        return store.clear();
      });
    }
    
    console.log('✅ OfflineStorage: All offline data cleared');
  }

  // === User Settings Methods ===

  /**
   * Store user settings
   */
  async storeUserData(userData) {
    const db = await this._ensureDB();
    const dataWithTimestamp = {
      ...userData,
      id: 'userSettings', // Single settings record
      updatedAt: new Date().toISOString(),
      _hasOfflineChanges: true
    };
    
    await this._performTransaction(db, STORES.USER_DATA, 'readwrite', (store) => {
      return store.put(dataWithTimestamp);
    });
  }

  /**
   * Get user settings
   */
  async getUserSettings() {
    const db = await this._ensureDB();
    
    return await this._performTransaction(db, STORES.USER_DATA, 'readonly', (store) => {
      return store.get('userSettings');
    });
  }

  /**
   * Cache user settings (alias for storeUserData for compatibility)
   */
  async cacheUserSettings(settings) {
    return this.storeUserData(settings);
  }

  // === Enhanced Template Methods ===

  /**
   * Cache task template (alias for storeTaskTemplate for compatibility)
   */
  async cacheTaskTemplate(template) {
    return this.storeTaskTemplate(template);
  }

  /**
   * Search task templates
   */
  async searchTaskTemplates(searchQuery, options = {}) {
    const templates = await this.getAllTaskTemplates();
    const query = searchQuery.toLowerCase().trim();
    
    return templates.filter(template => 
      template.taskName?.toLowerCase().includes(query) ||
      template.description?.toLowerCase().includes(query)
    );
  }

  // === Enhanced Instance Methods ===

  /**
   * Cache task instance (alias for storeTaskInstance for compatibility)
   */
  async cacheTaskInstance(instance) {
    return this.storeTaskInstance(instance);
  }

  /**
   * Get task instances for date range
   */
  async getTaskInstancesForDateRange(startDate, endDate, options = {}) {
    const db = await this._ensureDB();
    
    return await this._performTransaction(db, STORES.TASK_INSTANCES, 'readonly', (store) => {
      const index = store.index('date');
      const range = IDBKeyRange.bound(startDate, endDate);
      const request = index.getAll(range);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          let results = request.result;
          
          // Apply additional filters
          if (options.status) {
            results = results.filter(instance => instance.status === options.status);
          }
          
          if (options.templateId) {
            results = results.filter(instance => instance.templateId === options.templateId);
          }
          
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Get task instances by template ID
   */
  async getTaskInstancesByTemplate(templateId, options = {}) {
    const db = await this._ensureDB();
    
    return await this._performTransaction(db, STORES.TASK_INSTANCES, 'readonly', (store) => {
      const index = store.index('templateId');
      const request = index.getAll(templateId);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          let results = request.result;
          
          // Apply date range filters if specified
          if (options.startDate || options.endDate) {
            results = results.filter(instance => {
              const instanceDate = instance.date;
              if (options.startDate && instanceDate < options.startDate) return false;
              if (options.endDate && instanceDate > options.endDate) return false;
              return true;
            });
          }
          
          // Apply status filter
          if (options.status) {
            results = results.filter(instance => instance.status === options.status);
          }
          
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Cleanup old instances
   */
  async cleanupOldInstances(retentionDays = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];
    
    const db = await this._ensureDB();
    
    return await this._performTransaction(db, STORES.TASK_INSTANCES, 'readwrite', (store) => {
      const index = store.index('date');
      const range = IDBKeyRange.upperBound(cutoffDateString, true);
      
      return new Promise((resolve, reject) => {
        let deletedCount = 0;
        const request = index.openCursor(range);
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            console.log(`🧹 OfflineStorage: Cleaned up ${deletedCount} old instances`);
            resolve({ deletedCount });
          }
        };
        
        request.onerror = () => reject(request.error);
      });
    });
  }

  // === Offline Changes Tracking ===

  /**
   * Check if there are offline changes
   */
  async hasOfflineChanges() {
    const templates = await this.getAllTaskTemplates();
    const templatesWithChanges = templates.filter(t => t._hasOfflineChanges || t._isOfflineCreated);
    
    const instances = await this.getAllTaskInstances();
    const instancesWithChanges = instances.filter(i => i._hasOfflineChanges || i._isOfflineCreated);
    
    return templatesWithChanges.length > 0 || instancesWithChanges.length > 0;
  }

  /**
   * Get items with offline changes
   */
  async getItemsWithOfflineChanges(type) {
    if (type === 'taskTemplates') {
      const templates = await this.getAllTaskTemplates();
      return templates.filter(t => t._hasOfflineChanges || t._isOfflineCreated);
    } else if (type === 'taskInstances') {
      const instances = await this.getAllTaskInstances();
      return instances.filter(i => i._hasOfflineChanges || i._isOfflineCreated);
    }
    return [];
  }

  /**
   * Get all task instances
   */
  async getAllTaskInstances() {
    const db = await this._ensureDB();
    
    return await this._performTransaction(db, STORES.TASK_INSTANCES, 'readonly', (store) => {
      return store.getAll();
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      this.initPromise = null;
    }
  }
}

// Create and export singleton instance
export const offlineStorage = new OfflineStorage();

console.log('✅ OfflineStorage system initialized');