/**
 * Offline Data Layer Integration
 * 
 * Provides a unified interface that automatically switches between online Firestore
 * operations and offline storage based on connectivity status. Handles sync queuing
 * and conflict resolution seamlessly.
 */

import { offlineStorage } from './OfflineStorage.js';
import { offlineQueue, OPERATION_TYPES, OPERATION_PRIORITIES } from './OfflineQueue.js';
import { offlineDetection } from './OfflineDetection.js';
import { conflictResolution } from './ConflictResolution.js';
import { dataMaintenance } from './DataMaintenance.js';
import * as originalData from '../data.js';

/**
 * Offline-First Data Layer
 * Wraps the original data operations with offline capabilities
 */
export class OfflineDataLayer {
  constructor() {
    this.isInitialized = false;
    this.syncInProgress = false;
    this.lastSyncTime = null;
    this.autoSyncEnabled = true;
  }

  /**
   * Initialize offline data layer
   */
  async init() {
    try {
      console.log('🔧 OfflineDataLayer: Initializing...');
      
      // Initialize offline storage
      await offlineStorage.init();
      
      // Initialize offline queue
      await offlineQueue.init();
      
      // Initialize offline detection
      await offlineDetection.init();
      
      // Initialize data maintenance
      await dataMaintenance.init();
      
      // Set up sync triggers
      this.setupSyncTriggers();
      
      // Perform initial data validation and cleanup
      await this.performInitialMaintenance();
      
      this.isInitialized = true;
      console.log('✅ OfflineDataLayer: Initialization complete');
      
    } catch (error) {
      console.error('❌ OfflineDataLayer: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup automatic sync triggers
   */
  setupSyncTriggers() {
    // Listen for online events
    window.addEventListener('online', () => {
      console.log('🌐 OfflineDataLayer: Connection restored, triggering sync');
      this.triggerSync();
    });

    // Setup periodic sync check
    setInterval(() => {
      if (this.autoSyncEnabled && navigator.onLine && !this.syncInProgress) {
        this.checkAndSync();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Perform initial data maintenance
   */
  async performInitialMaintenance() {
    try {
      console.log('🔧 OfflineDataLayer: Performing initial maintenance...');

      // Validate data integrity
      const integrityReport = await dataMaintenance.validateDataIntegrity();
      if (integrityReport.taskTemplates.invalid > 0 || integrityReport.taskInstances.invalid > 0) {
        console.warn('⚠️ OfflineDataLayer: Found data with integrity issues, attempting repair');
        await dataMaintenance.repairCorruptedData();
      }

      // Clean up old data
      await dataMaintenance.cleanupOldData();

      // Migrate schema to the latest version
      await dataMaintenance.migrateSchema();

      console.log('✅ OfflineDataLayer: Initial maintenance complete');

    } catch (error) {
      console.warn('⚠️ OfflineDataLayer: Initial maintenance failed:', error);
      // Don't throw - app should still work even if maintenance fails
    }
  }

  /**
   * Enhanced userSettings with offline support
   */
  get userSettings() {
    return {
      async get() {
        try {
          if (navigator.onLine) {
            // Try online first
            const settings = await originalData.userSettings.get();
            // Cache offline for future use
            await offlineStorage.cacheUserSettings(settings);
            return settings;
          } else {
            // Use offline cache
            console.log('📱 OfflineDataLayer: Using cached user settings');
            const cached = await offlineStorage.getUserSettings();
            return cached || {
              desiredSleepDuration: 7.5,
              defaultWakeTime: "06:30",
              defaultSleepTime: "23:00"
            };
          }
        } catch (error) {
          console.warn('⚠️ OfflineDataLayer: Failed to get settings online, trying offline');
          const cached = await offlineStorage.getUserSettings();
          return cached || {
            desiredSleepDuration: 7.5,
            defaultWakeTime: "06:30", 
            defaultSleepTime: "23:00"
          };
        }
      },

      async save(settings) {
        try {
          if (navigator.onLine) {
            // Save online immediately
            const result = await originalData.userSettings.save(settings);
            // Update offline cache
            await offlineStorage.cacheUserSettings(result);
            return result;
          } else {
            // Save offline and queue for sync
            await offlineStorage.cacheUserSettings(settings);
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.UPDATE_SETTINGS,
              data: settings,
              priority: OPERATION_PRIORITIES.HIGH
            });
            console.log('📱 OfflineDataLayer: Settings saved offline, queued for sync');
            return settings;
          }
        } catch (error) {
          // Always save offline as fallback
          await offlineStorage.cacheUserSettings(settings);
          await offlineQueue.enqueue({
            type: OPERATION_TYPES.UPDATE_SETTINGS,
            data: settings,
            priority: OPERATION_PRIORITIES.HIGH
          });
          console.log('📱 OfflineDataLayer: Settings saved offline due to error:', error.message);
          return settings;
        }
      },

      async initialize() {
        try {
          if (navigator.onLine) {
            const settings = await originalData.userSettings.initialize();
            await offlineStorage.cacheUserSettings(settings);
            return settings;
          } else {
            // Initialize with defaults offline
            const defaultSettings = {
              desiredSleepDuration: 7.5,
              defaultWakeTime: "06:30",
              defaultSleepTime: "23:00",
              createdAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            };
            await offlineStorage.cacheUserSettings(defaultSettings);
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.UPDATE_SETTINGS,
              data: defaultSettings,
              priority: OPERATION_PRIORITIES.CRITICAL
            });
            return defaultSettings;
          }
        } catch (error) {
          console.warn('⚠️ OfflineDataLayer: Failed to initialize settings online, using defaults');
          const defaultSettings = {
            desiredSleepDuration: 7.5,
            defaultWakeTime: "06:30",
            defaultSleepTime: "23:00",
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          };
          await offlineStorage.cacheUserSettings(defaultSettings);
          return defaultSettings;
        }
      }
    };
  }

  /**
   * Enhanced taskTemplates with offline support
   */
  get taskTemplates() {
    return {
      async getAll(userId = null, options = {}) {
        try {
          if (navigator.onLine) {
            // Try online first
            const templates = await originalData.taskTemplates.getAll(userId, options);
            // Cache offline
            // Cache templates individually
            for (const template of templates) {
              await offlineStorage.storeTaskTemplate(template);
            }
            return templates;
          } else {
            // Use offline cache
            console.log('📱 OfflineDataLayer: Using cached task templates');
            const cached = await offlineStorage.getAllTaskTemplates();
            return cached;
          }
        } catch (error) {
          console.warn('⚠️ OfflineDataLayer: Failed to get templates online, trying offline');
          const cached = await offlineStorage.getTaskTemplates(options);
          return cached;
        }
      },

      async get(templateId) {
        try {
          if (navigator.onLine) {
            const template = await originalData.taskTemplates.get(templateId);
            await offlineStorage.storeTaskTemplate(template);
            return template;
          } else {
            console.log('📱 OfflineDataLayer: Using cached task template');
            const cached = await offlineStorage.getTaskTemplate(templateId);
            if (!cached) {
              throw new Error(`Task template not found offline: ${templateId}`);
            }
            return cached;
          }
        } catch (error) {
          console.warn('⚠️ OfflineDataLayer: Failed to get template online, trying offline');
          const cached = await offlineStorage.getTaskTemplate(templateId);
          if (!cached) {
            throw error;
          }
          return cached;
        }
      },

      async search(userId = null, searchQuery, options = {}) {
        try {
          if (navigator.onLine) {
            const results = await originalData.taskTemplates.search(userId, searchQuery, options);
            return results;
          } else {
            // Search offline cache
            console.log('📱 OfflineDataLayer: Searching cached templates');
            const cached = await offlineStorage.searchTaskTemplates(searchQuery, options);
            return cached;
          }
        } catch (error) {
          console.warn('⚠️ OfflineDataLayer: Failed to search online, trying offline');
          const cached = await offlineStorage.searchTaskTemplates(searchQuery, options);
          return cached;
        }
      },

      async create(userId, templateData) {
        try {
          if (navigator.onLine) {
            // Create online immediately
            const template = await originalData.taskTemplates.create(userId, templateData);
            await offlineStorage.storeTaskTemplate(template);
            return template;
          } else {
            // Create offline with temporary ID
            const offlineId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            const template = {
              id: offlineId,
              ...templateData,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              _isOfflineCreated: true
            };
            
            await offlineStorage.storeTaskTemplate(template);
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.CREATE_TEMPLATE,
              data: templateData,
              userId: userId,
              resourceId: offlineId,
              priority: OPERATION_PRIORITIES.HIGH
            });
            
            console.log('📱 OfflineDataLayer: Template created offline, queued for sync');
            return template;
          }
        } catch (error) {
          // Always create offline as fallback
          const offlineId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          const template = {
            id: offlineId,
            ...templateData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _isOfflineCreated: true
          };
          
          await offlineStorage.cacheTaskTemplate(template);
          await offlineQueue.enqueue({
            type: OPERATION_TYPES.CREATE_TEMPLATE,
            data: templateData,
            userId: userId,
            resourceId: offlineId,
            priority: OPERATION_PRIORITIES.HIGH
          });
          
          console.log('📱 OfflineDataLayer: Template created offline due to error:', error.message);
          return template;
        }
      },

      async update(templateId, updates) {
        try {
          if (navigator.onLine) {
            // Update online immediately
            const template = await originalData.taskTemplates.update(templateId, updates);
            await offlineStorage.storeTaskTemplate(template);
            return template;
          } else {
            // Update offline cache
            const cached = await offlineStorage.getTaskTemplate(templateId);
            if (!cached) {
              throw new Error(`Template not found in offline cache: ${templateId}`);
            }
            
            const updatedTemplate = {
              ...cached,
              ...updates,
              updatedAt: new Date().toISOString(),
              _hasOfflineChanges: true
            };
            
            await offlineStorage.cacheTaskTemplate(updatedTemplate);
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.UPDATE_TEMPLATE,
              data: updates,
              resourceId: templateId,
              priority: OPERATION_PRIORITIES.NORMAL
            });
            
            console.log('📱 OfflineDataLayer: Template updated offline, queued for sync');
            return updatedTemplate;
          }
        } catch (error) {
          // Always update offline as fallback
          const cached = await offlineStorage.getTaskTemplate(templateId);
          if (cached) {
            const updatedTemplate = {
              ...cached,
              ...updates,
              updatedAt: new Date().toISOString(),
              _hasOfflineChanges: true
            };
            
            await offlineStorage.cacheTaskTemplate(updatedTemplate);
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.UPDATE_TEMPLATE,
              data: updates,
              resourceId: templateId,
              priority: OPERATION_PRIORITIES.NORMAL
            });
            
            console.log('📱 OfflineDataLayer: Template updated offline due to error:', error.message);
            return updatedTemplate;
          }
          throw error;
        }
      },

      async delete(templateId) {
        try {
          if (navigator.onLine) {
            // Delete online immediately
            await originalData.taskTemplates.delete(templateId);
            await offlineStorage.deleteTaskTemplate(templateId);
          } else {
            // Mark as deleted offline
            const cached = await offlineStorage.getTaskTemplate(templateId);
            if (cached) {
              const deletedTemplate = {
                ...cached,
                isActive: false,
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                _hasOfflineChanges: true
              };
              await offlineStorage.cacheTaskTemplate(deletedTemplate);
            }
            
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.DELETE_TEMPLATE,
              resourceId: templateId,
              priority: OPERATION_PRIORITIES.NORMAL
            });
            
            console.log('📱 OfflineDataLayer: Template deleted offline, queued for sync');
          }
        } catch (error) {
          // Always mark as deleted offline as fallback
          const cached = await offlineStorage.getTaskTemplate(templateId);
          if (cached) {
            const deletedTemplate = {
              ...cached,
              isActive: false,
              deletedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              _hasOfflineChanges: true
            };
            await offlineStorage.cacheTaskTemplate(deletedTemplate);
          }
          
          await offlineQueue.enqueue({
            type: OPERATION_TYPES.DELETE_TEMPLATE,
            resourceId: templateId,
            priority: OPERATION_PRIORITIES.NORMAL
          });
          
          console.log('📱 OfflineDataLayer: Template deleted offline due to error:', error.message);
        }
      },

      // Add batch operations with offline support
      async batchActivate(templateIds) {
        try {
          if (navigator.onLine) {
            const result = await originalData.taskTemplates.batchActivate?.(templateIds);
            // Update offline cache
            for (const templateId of templateIds) {
              const cached = await offlineStorage.getTaskTemplate(templateId);
              if (cached) {
                await offlineStorage.cacheTaskTemplate({ ...cached, isActive: true });
              }
            }
            return result;
          } else {
            // Update offline cache
            for (const templateId of templateIds) {
              const cached = await offlineStorage.getTaskTemplate(templateId);
              if (cached) {
                await offlineStorage.cacheTaskTemplate({ 
                  ...cached, 
                  isActive: true,
                  updatedAt: new Date().toISOString(),
                  _hasOfflineChanges: true
                });
              }
            }
            
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.BULK_ACTIVATE_TEMPLATES,
              data: { templateIds },
              priority: OPERATION_PRIORITIES.NORMAL
            });
            
            console.log('📱 OfflineDataLayer: Templates activated offline, queued for sync');
            return templateIds;
          }
        } catch (error) {
          // Always update offline as fallback
          for (const templateId of templateIds) {
            const cached = await offlineStorage.getTaskTemplate(templateId);
            if (cached) {
              await offlineStorage.cacheTaskTemplate({ 
                ...cached, 
                isActive: true,
                updatedAt: new Date().toISOString(),
                _hasOfflineChanges: true
              });
            }
          }
          
          await offlineQueue.enqueue({
            type: OPERATION_TYPES.BULK_ACTIVATE_TEMPLATES,
            data: { templateIds },
            priority: OPERATION_PRIORITIES.NORMAL
          });
          
          console.log('📱 OfflineDataLayer: Templates activated offline due to error:', error.message);
          return templateIds;
        }
      },

      async batchDeactivate(templateIds) {
        try {
          if (navigator.onLine) {
            const result = await originalData.taskTemplates.batchDeactivate?.(templateIds);
            // Update offline cache
            for (const templateId of templateIds) {
              const cached = await offlineStorage.getTaskTemplate(templateId);
              if (cached) {
                await offlineStorage.cacheTaskTemplate({ ...cached, isActive: false });
              }
            }
            return result;
          } else {
            // Update offline cache
            for (const templateId of templateIds) {
              const cached = await offlineStorage.getTaskTemplate(templateId);
              if (cached) {
                await offlineStorage.cacheTaskTemplate({ 
                  ...cached, 
                  isActive: false,
                  updatedAt: new Date().toISOString(),
                  _hasOfflineChanges: true
                });
              }
            }
            
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.BULK_DEACTIVATE_TEMPLATES,
              data: { templateIds },
              priority: OPERATION_PRIORITIES.NORMAL
            });
            
            console.log('📱 OfflineDataLayer: Templates deactivated offline, queued for sync');
            return templateIds;
          }
        } catch (error) {
          // Always update offline as fallback
          for (const templateId of templateIds) {
            const cached = await offlineStorage.getTaskTemplate(templateId);
            if (cached) {
              await offlineStorage.cacheTaskTemplate({ 
                ...cached, 
                isActive: false,
                updatedAt: new Date().toISOString(),
                _hasOfflineChanges: true
              });
            }
          }
          
          await offlineQueue.enqueue({
            type: OPERATION_TYPES.BULK_DEACTIVATE_TEMPLATES,
            data: { templateIds },
            priority: OPERATION_PRIORITIES.NORMAL
          });
          
          console.log('📱 OfflineDataLayer: Templates deactivated offline due to error:', error.message);
          return templateIds;
        }
      }
    };
  }

  /**
   * Enhanced taskInstances with offline support
   */
  get taskInstances() {
    return {
      async get(instanceId) {
        try {
          if (navigator.onLine) {
            const instance = await originalData.taskInstances.get(instanceId);
            await offlineStorage.storeTaskInstance(instance);
            return instance;
          } else {
            console.log('📱 OfflineDataLayer: Using cached task instance');
            const cached = await offlineStorage.getTaskInstance(instanceId);
            if (!cached) {
              throw new Error(`Task instance not found offline: ${instanceId}`);
            }
            return cached;
          }
        } catch (error) {
          console.warn('⚠️ OfflineDataLayer: Failed to get instance online, trying offline');
          const cached = await offlineStorage.getTaskInstance(instanceId);
          if (!cached) {
            throw error;
          }
          return cached;
        }
      },

      async getForDate(date, options = {}) {
        try {
          if (navigator.onLine) {
            const instances = await originalData.taskInstances.getForDate(date, options);
            // Cache instances individually
            for (const instance of instances) {
              await offlineStorage.storeTaskInstance(instance);
            }
            return instances;
          } else {
            console.log('📱 OfflineDataLayer: Using cached task instances for date');
            const cached = await offlineStorage.getTaskInstancesForDate(date, options);
            return cached;
          }
        } catch (error) {
          console.warn('⚠️ OfflineDataLayer: Failed to get instances for date online, trying offline');
          const cached = await offlineStorage.getTaskInstancesForDate(date, options);
          return cached;
        }
      },

      async getForDateRange(startDate, endDate, options = {}) {
        try {
          if (navigator.onLine) {
            const instances = await originalData.taskInstances.getForDateRange(startDate, endDate, options);
            // Cache instances individually
            for (const instance of instances) {
              await offlineStorage.storeTaskInstance(instance);
            }
            return instances;
          } else {
            console.log('📱 OfflineDataLayer: Using cached task instances for date range');
            const cached = await offlineStorage.getTaskInstancesForDateRange(startDate, endDate, options);
            return cached;
          }
        } catch (error) {
          console.warn('⚠️ OfflineDataLayer: Failed to get instances for date range online, trying offline');
          const cached = await offlineStorage.getTaskInstancesForDateRange(startDate, endDate, options);
          return cached;
        }
      },

      async getByTemplateId(templateId, options = {}) {
        try {
          if (navigator.onLine) {
            const instances = await originalData.taskInstances.getByTemplateId(templateId, options);
            // Cache instances individually
            for (const instance of instances) {
              await offlineStorage.storeTaskInstance(instance);
            }
            return instances;
          } else {
            console.log('📱 OfflineDataLayer: Using cached task instances by template');
            const cached = await offlineStorage.getTaskInstancesByTemplate(templateId, options);
            return cached;
          }
        } catch (error) {
          console.warn('⚠️ OfflineDataLayer: Failed to get instances by template online, trying offline');
          const cached = await offlineStorage.getTaskInstancesByTemplate(templateId, options);
          return cached;
        }
      },

      async create(instanceData) {
        try {
          if (navigator.onLine) {
            const instance = await originalData.taskInstances.create(instanceData);
            await offlineStorage.storeTaskInstance(instance);
            return instance;
          } else {
            // Create offline with temporary ID
            const offlineId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            const instance = {
              id: offlineId,
              ...instanceData,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              _isOfflineCreated: true
            };
            
            await offlineStorage.storeTaskInstance(instance);
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.CREATE_INSTANCE,
              data: instanceData,
              resourceId: offlineId,
              priority: OPERATION_PRIORITIES.HIGH
            });
            
            console.log('📱 OfflineDataLayer: Instance created offline, queued for sync');
            return instance;
          }
        } catch (error) {
          // Always create offline as fallback
          const offlineId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          const instance = {
            id: offlineId,
            ...instanceData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _isOfflineCreated: true
          };
          
          await offlineStorage.cacheTaskInstance(instance);
          await offlineQueue.enqueue({
            type: OPERATION_TYPES.CREATE_INSTANCE,
            data: instanceData,
            resourceId: offlineId,
            priority: OPERATION_PRIORITIES.HIGH
          });
          
          console.log('📱 OfflineDataLayer: Instance created offline due to error:', error.message);
          return instance;
        }
      },

      async update(instanceId, updates) {
        try {
          if (navigator.onLine) {
            const instance = await originalData.taskInstances.update(instanceId, updates);
            await offlineStorage.storeTaskInstance(instance);
            return instance;
          } else {
            // Update offline cache
            const cached = await offlineStorage.getTaskInstance(instanceId);
            if (!cached) {
              throw new Error(`Instance not found in offline cache: ${instanceId}`);
            }
            
            const updatedInstance = {
              ...cached,
              ...updates,
              updatedAt: new Date().toISOString(),
              _hasOfflineChanges: true
            };
            
            await offlineStorage.cacheTaskInstance(updatedInstance);
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.UPDATE_INSTANCE,
              data: updates,
              resourceId: instanceId,
              priority: OPERATION_PRIORITIES.NORMAL
            });
            
            console.log('📱 OfflineDataLayer: Instance updated offline, queued for sync');
            return updatedInstance;
          }
        } catch (error) {
          // Always update offline as fallback
          const cached = await offlineStorage.getTaskInstance(instanceId);
          if (cached) {
            const updatedInstance = {
              ...cached,
              ...updates,
              updatedAt: new Date().toISOString(),
              _hasOfflineChanges: true
            };
            
            await offlineStorage.cacheTaskInstance(updatedInstance);
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.UPDATE_INSTANCE,
              data: updates,
              resourceId: instanceId,
              priority: OPERATION_PRIORITIES.NORMAL
            });
            
            console.log('📱 OfflineDataLayer: Instance updated offline due to error:', error.message);
            return updatedInstance;
          }
          throw error;
        }
      },

      async delete(instanceId) {
        try {
          if (navigator.onLine) {
            await originalData.taskInstances.delete(instanceId);
            await offlineStorage.deleteTaskInstance(instanceId);
          } else {
            // Mark as deleted offline
            const cached = await offlineStorage.getTaskInstance(instanceId);
            if (cached) {
              const deletedInstance = {
                ...cached,
                isDeleted: true,
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                _hasOfflineChanges: true
              };
              await offlineStorage.cacheTaskInstance(deletedInstance);
            }
            
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.DELETE_INSTANCE,
              resourceId: instanceId,
              priority: OPERATION_PRIORITIES.NORMAL
            });
            
            console.log('📱 OfflineDataLayer: Instance deleted offline, queued for sync');
          }
        } catch (error) {
          // Always mark as deleted offline as fallback
          const cached = await offlineStorage.getTaskInstance(instanceId);
          if (cached) {
            const deletedInstance = {
              ...cached,
              isDeleted: true,
              deletedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              _hasOfflineChanges: true
            };
            await offlineStorage.cacheTaskInstance(deletedInstance);
          }
          
          await offlineQueue.enqueue({
            type: OPERATION_TYPES.DELETE_INSTANCE,
            resourceId: instanceId,
            priority: OPERATION_PRIORITIES.NORMAL
          });
          
          console.log('📱 OfflineDataLayer: Instance deleted offline due to error:', error.message);
        }
      },

      async batchCreate(instances) {
        try {
          if (navigator.onLine) {
            const result = await originalData.taskInstances.batchCreate?.(instances);
            for (const instance of result) {
              await offlineStorage.storeTaskInstance(instance);
            }
            return result;
          } else {
            // Create all instances offline
            const offlineInstances = instances.map(instance => ({
              id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
              ...instance,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              _isOfflineCreated: true
            }));
            
            for (const instance of offlineInstances) {
              await offlineStorage.storeTaskInstance(instance);
            }
            
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.BATCH_CREATE_INSTANCES,
              data: { instances },
              priority: OPERATION_PRIORITIES.HIGH
            });
            
            console.log('📱 OfflineDataLayer: Instances created offline, queued for sync');
            return offlineInstances;
          }
        } catch (error) {
          // Always create offline as fallback
          const offlineInstances = instances.map(instance => ({
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            ...instance,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _isOfflineCreated: true
          }));
          
          for (const instance of offlineInstances) {
            await offlineStorage.storeTaskInstance(instance);
          }
          
          await offlineQueue.enqueue({
            type: OPERATION_TYPES.BATCH_CREATE_INSTANCES,
            data: { instances },
            priority: OPERATION_PRIORITIES.HIGH
          });
          
          console.log('📱 OfflineDataLayer: Instances created offline due to error:', error.message);
          return offlineInstances;
        }
      },

      async batchUpdate(instanceIds, updates) {
        try {
          if (navigator.onLine) {
            const result = await originalData.taskInstances.batchUpdate(instanceIds, updates);
            // Update offline cache
            for (const instanceId of instanceIds) {
              const cached = await offlineStorage.getTaskInstance(instanceId);
              if (cached) {
                await offlineStorage.cacheTaskInstance({ ...cached, ...updates });
              }
            }
            return result;
          } else {
            // Update offline cache
            for (const instanceId of instanceIds) {
              const cached = await offlineStorage.getTaskInstance(instanceId);
              if (cached) {
                await offlineStorage.cacheTaskInstance({ 
                  ...cached, 
                  ...updates,
                  updatedAt: new Date().toISOString(),
                  _hasOfflineChanges: true
                });
              }
            }
            
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.BATCH_UPDATE_INSTANCES,
              data: { instanceIds, updates },
              priority: OPERATION_PRIORITIES.NORMAL
            });
            
            console.log('📱 OfflineDataLayer: Instances batch updated offline, queued for sync');
            return { updatedCount: instanceIds.length, updates };
          }
        } catch (error) {
          // Always update offline as fallback
          for (const instanceId of instanceIds) {
            const cached = await offlineStorage.getTaskInstance(instanceId);
            if (cached) {
              await offlineStorage.cacheTaskInstance({ 
                ...cached, 
                ...updates,
                updatedAt: new Date().toISOString(),
                _hasOfflineChanges: true
              });
            }
          }
          
          await offlineQueue.enqueue({
            type: OPERATION_TYPES.BATCH_UPDATE_INSTANCES,
            data: { instanceIds, updates },
            priority: OPERATION_PRIORITIES.NORMAL
          });
          
          console.log('📱 OfflineDataLayer: Instances batch updated offline due to error:', error.message);
          return { updatedCount: instanceIds.length, updates };
        }
      },

      async batchDelete(instanceIds) {
        try {
          if (navigator.onLine) {
            const result = await originalData.taskInstances.batchDelete(instanceIds);
            // Remove from offline cache
            for (const instanceId of instanceIds) {
              await offlineStorage.deleteTaskInstance(instanceId);
            }
            return result;
          } else {
            // Mark as deleted offline
            for (const instanceId of instanceIds) {
              const cached = await offlineStorage.getTaskInstance(instanceId);
              if (cached) {
                const deletedInstance = {
                  ...cached,
                  isDeleted: true,
                  deletedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  _hasOfflineChanges: true
                };
                await offlineStorage.cacheTaskInstance(deletedInstance);
              }
            }
            
            // Queue individual delete operations
            for (const instanceId of instanceIds) {
              await offlineQueue.enqueue({
                type: OPERATION_TYPES.DELETE_INSTANCE,
                resourceId: instanceId,
                priority: OPERATION_PRIORITIES.NORMAL
              });
            }
            
            console.log('📱 OfflineDataLayer: Instances batch deleted offline, queued for sync');
            return { deletedCount: instanceIds.length };
          }
        } catch (error) {
          // Always mark as deleted offline as fallback
          for (const instanceId of instanceIds) {
            const cached = await offlineStorage.getTaskInstance(instanceId);
            if (cached) {
              const deletedInstance = {
                ...cached,
                isDeleted: true,
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                _hasOfflineChanges: true
              };
              await offlineStorage.cacheTaskInstance(deletedInstance);
            }
          }
          
          // Queue individual delete operations
          for (const instanceId of instanceIds) {
            await offlineQueue.enqueue({
              type: OPERATION_TYPES.DELETE_INSTANCE,
              resourceId: instanceId,
              priority: OPERATION_PRIORITIES.NORMAL
            });
          }
          
          console.log('📱 OfflineDataLayer: Instances batch deleted offline due to error:', error.message);
          return { deletedCount: instanceIds.length };
        }
      },

      async getStats(startDate, endDate) {
        try {
          if (navigator.onLine) {
            const stats = await originalData.taskInstances.getStats(startDate, endDate);
            return stats;
          } else {
            console.log('📱 OfflineDataLayer: Computing stats from cached instances');
            const instances = await offlineStorage.getTaskInstancesForDateRange(startDate, endDate);
            
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
            
            return stats;
          }
        } catch (error) {
          console.warn('⚠️ OfflineDataLayer: Failed to get stats online, computing from offline');
          const instances = await offlineStorage.getTaskInstancesForDateRange(startDate, endDate);
          
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
            const status = instance.status || 'pending';
            stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
            
            const date = instance.date;
            stats.byDate[date] = (stats.byDate[date] || 0) + 1;
            
            if (status === 'completed') {
              completedCount++;
              
              if (instance.actualDuration) {
                totalCompletionTime += instance.actualDuration;
                completionTimeCount++;
              }
            }
          });
          
          stats.completionRate = stats.total > 0 ? 
            Math.round((completedCount / stats.total) * 100) : 0;
          
          stats.averageCompletionTime = completionTimeCount > 0 ? 
            Math.round(totalCompletionTime / completionTimeCount) : null;
          
          return stats;
        }
      },

      async cleanupOldInstances(retentionDays = 365) {
        try {
          if (navigator.onLine) {
            const result = await originalData.taskInstances.cleanupOldInstances(retentionDays);
            // Also cleanup offline cache
            await offlineStorage.cleanupOldInstances(retentionDays);
            return result;
          } else {
            console.log('📱 OfflineDataLayer: Queuing cleanup operation for when online');
            const result = await offlineStorage.cleanupOldInstances(retentionDays);
            // Note: We don't queue the cleanup as it may be very large
            console.log('🧹 OfflineDataLayer: Local cleanup completed offline');
            return result;
          }
        } catch (error) {
          console.warn('⚠️ OfflineDataLayer: Failed to cleanup online, performing local cleanup');
          const result = await offlineStorage.cleanupOldInstances(retentionDays);
          return result;
        }
      },

      async createWithRetry(instanceData) {
        // Retry logic is handled by the offline queue system
        return this.create(instanceData);
      },

      async updateWithRetry(instanceId, updates) {
        // Retry logic is handled by the offline queue system
        return this.update(instanceId, updates);
      }
    };
  }

  /**
   * Sync Management
   */
  async triggerSync() {
    if (this.syncInProgress || !navigator.onLine) {
      return;
    }

    this.syncInProgress = true;
    try {
      console.log('🔄 OfflineDataLayer: Starting sync...');
      
      // Process offline queue
      await offlineQueue.forceProcess();
      
      // Sync cached data with conflicts resolution
      await this.syncCachedData();
      
      this.lastSyncTime = Date.now();
      console.log('✅ OfflineDataLayer: Sync completed successfully');
      
    } catch (error) {
      console.error('❌ OfflineDataLayer: Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync cached data and resolve conflicts
   */
  async syncCachedData() {
    try {
      // Get all items with offline changes
      const templatesWithChanges = await offlineStorage.getItemsWithOfflineChanges('taskTemplates');
      const instancesWithChanges = await offlineStorage.getItemsWithOfflineChanges('taskInstances');
      
      // Resolve conflicts for templates
      for (const localTemplate of templatesWithChanges) {
        if (localTemplate._hasOfflineChanges) {
          try {
            const remoteTemplate = await originalData.taskTemplates.get(localTemplate.id);
            const conflict = conflictResolution.detectConflict(localTemplate, remoteTemplate, 'taskTemplate');
            let resolved;
            if (conflict) {
              const resolution = await conflictResolution.resolveConflict(conflict);
              resolved = resolution.result;
            } else {
              resolved = localTemplate; // No conflict, use local
            }
            
            if (resolved !== localTemplate) {
              // Update with resolved version
              await originalData.taskTemplates.update(localTemplate.id, resolved);
              await offlineStorage.cacheTaskTemplate({ ...resolved, _hasOfflineChanges: false });
            }
          } catch (error) {
            console.warn('⚠️ OfflineDataLayer: Failed to sync template:', localTemplate.id, error);
          }
        }
      }
      
      // Resolve conflicts for instances
      for (const localInstance of instancesWithChanges) {
        if (localInstance._hasOfflineChanges) {
          try {
            const remoteInstance = await originalData.taskInstances.get(localInstance.id);
            const conflict = conflictResolution.detectConflict(localInstance, remoteInstance, 'taskInstance');
            let resolved;
            if (conflict) {
              const resolution = await conflictResolution.resolveConflict(conflict);
              resolved = resolution.result;
            } else {
              resolved = localInstance; // No conflict, use local
            }
            
            if (resolved !== localInstance) {
              // Update with resolved version
              await originalData.taskInstances.update(localInstance.id, resolved);
              await offlineStorage.cacheTaskInstance({ ...resolved, _hasOfflineChanges: false });
            }
          } catch (error) {
            console.warn('⚠️ OfflineDataLayer: Failed to sync instance:', localInstance.id, error);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ OfflineDataLayer: Failed to sync cached data:', error);
    }
  }

  /**
   * Check if sync is needed and perform it
   */
  async checkAndSync() {
    try {
      // Check if we have pending operations
      const queueStatus = await offlineQueue.getQueueStatus();
      const hasOfflineChanges = await offlineStorage.hasOfflineChanges();
      
      if (queueStatus.pending > 0 || hasOfflineChanges) {
        console.log('📋 OfflineDataLayer: Pending sync operations detected, starting sync');
        await this.triggerSync();
      }
      
    } catch (error) {
      console.warn('⚠️ OfflineDataLayer: Check and sync failed:', error);
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    const queueStatus = await offlineQueue.getQueueStatus();
    const hasOfflineChanges = await offlineStorage.hasOfflineChanges();
    
    return {
      online: navigator.onLine,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      pendingOperations: queueStatus.pending,
      failedOperations: queueStatus.failed,
      hasOfflineChanges,
      queueStatus
    };
  }

  /**
   * Force sync (useful for user-initiated sync)
   */
  async forcSync() {
    if (!navigator.onLine) {
      throw new Error('Cannot sync while offline');
    }
    await this.triggerSync();
  }

  /**
   * Clear all offline data (useful for troubleshooting)
   */
  async clearOfflineData() {
    await offlineStorage.clearAllData();
    await offlineQueue.clearQueue();
    console.log('🧹 OfflineDataLayer: All offline data cleared');
  }

  /**
   * Destroy offline data layer
   */
  destroy() {
    offlineQueue.destroy();
    offlineDetection.destroy();
    this.isInitialized = false;
    console.log('💀 OfflineDataLayer: Destroyed');
  }
}

// Create and export singleton instance
export const offlineDataLayer = new OfflineDataLayer();

console.log('✅ Offline Data Layer initialized');