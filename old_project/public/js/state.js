/**
 * Application State Management
 * Single source of truth for all application data
 */

import { taskTemplates, dataUtils } from './dataOffline.js';
import { userSettingsManager } from './userSettings.js';
import { taskTemplateManager, taskInstanceManager } from './taskLogic.js';
import { appState as appStateFromStore, notifyStateChange, stateListeners } from './state/Store.js';
import * as templateActions from './state/actions.templates.js';
import * as instanceActions from './state/actions.instances.js';
import * as appActions from './state/actions.app.js';
import * as userActions from './state/actions.user.js';

/**
 * Global Application State (moved to Store.js)
 */
let appState = appStateFromStore;

/**
 * State Management Functions
 */
export const state = {
  // Get current state (read-only)
  get: () => ({ ...appState }),
  
  // Get specific part of state
  getUser: () => appState.user,
  getSettings: () => ({ ...appState.settings }),
  getCurrentDate: () => appState.currentDate,
  getCurrentView: () => appState.currentView,
  getTaskTemplates: () => [...appState.taskTemplates.data],
  getTaskTemplateById: (templateId) => appState.taskTemplates.cache.get(templateId) || null,
  getTaskTemplateMetadata: () => ({ ...appState.taskTemplates.metadata }),
  getTaskTemplateFilters: () => ({ ...appState.taskTemplates.filters }),
  getTaskTemplatePagination: () => ({ ...appState.taskTemplates.pagination }),
  getTaskTemplateSearchResults: () => ({ ...appState.taskTemplates.searchResults }),
  getTemplateOperationQueue: () => [...appState.templateOperationQueue],
  
  // Enhanced task instance getters
  getTaskInstancesForDate: (date) => appState.taskInstances.data.get(date) || [],
  getTaskInstanceById: (instanceId) => appState.taskInstances.cache.get(instanceId) || null,
  getTaskInstanceMetadata: () => ({ ...appState.taskInstances.metadata }),
  getTaskInstanceFilters: () => ({ ...appState.taskInstances.filters }),
  getTaskInstanceSearchResults: () => ({ ...appState.taskInstances.searchResults }),
  getTaskInstanceCurrentDate: () => appState.taskInstances.currentDate,
  getTaskInstanceNavigationHistory: () => [...appState.taskInstances.navigationHistory],
  getTaskInstanceStats: (period = 'daily', identifier = null) => {
    const statsMap = appState.taskInstances.stats[period];
    return identifier ? (statsMap?.get(identifier) || null) : new Map(statsMap);
  },
  getLoadedInstanceDates: () => new Set(appState.taskInstances.dateRange.loadedDates),
  getInstanceDateRange: () => ({ ...appState.taskInstances.dateRange }),
  getInstancesForDateRange: (startDate, endDate) => {
    const instances = [];
    const dates = dataUtils.getDateRange(startDate, endDate);
    dates.forEach(date => {
      const dateInstances = appState.taskInstances.data.get(date) || [];
      instances.push(...dateInstances);
    });
    return instances;
  },
  getInstancesByTemplateId: (templateId) => {
    const instances = [];
    appState.taskInstances.data.forEach(dateInstances => {
      const templateInstances = dateInstances.filter(inst => inst.templateId === templateId);
      instances.push(...templateInstances);
    });
    return instances;
  },
  getInstancesByStatus: (status, dateFilter = null) => {
    const instances = [];
    appState.taskInstances.data.forEach((dateInstances, date) => {
      if (dateFilter && date !== dateFilter) return;
      const statusInstances = dateInstances.filter(inst => inst.status === status);
      instances.push(...statusInstances);
    });
    return instances;
  },
  getInstanceOperationQueue: () => [...appState.instanceOperationQueue],
  
  getDailyScheduleForDate: (date) => appState.dailySchedules.get(date) || null,
  isLoading: (type) => appState.loading[type] || false,
  isOnline: () => appState.isOnline,
  getSearchQuery: () => appState.searchQuery,
  getActiveFilters: () => ({ ...appState.activeFilters }),
  
  // Set user authentication
  setUser: (user) => {
    appState.user = user;
    appState.isAuthenticated = !!user;
    notifyStateChange('user', user);
  },
  
  // Set user settings
  setSettings: (settings) => {
    appState.settings = { ...settings };
    appState.lastUpdated = new Date().toISOString();
    notifyStateChange('settings', settings);
  },
  
  // Set current view
  setCurrentView: (view) => {
    appState.currentView = view;
    notifyStateChange('view', view);
  },
  
  // Set current date
  setCurrentDate: (date) => {
    appState.currentDate = date;
    notifyStateChange('date', date);
  },
  
  // Set task templates with caching and metadata update
  setTaskTemplates: (templates) => {
    appState.taskTemplates.data = [...templates];
    
    // Update cache
    appState.taskTemplates.cache.clear();
    templates.forEach(template => {
      appState.taskTemplates.cache.set(template.id, { ...template });
    });
    
    // Update metadata
    updateTaskTemplateMetadata(templates);
    
    appState.taskTemplates.lastLoaded = new Date().toISOString();
    appState.lastUpdated = new Date().toISOString();
    appState.lastSyncTimestamp = new Date().toISOString();
    
    notifyStateChange('taskTemplates', templates);
    notifyStateChange('taskTemplateMetadata', appState.taskTemplates.metadata);
  },
  
  // Add/update single task template with caching
  updateTaskTemplate: (task) => {
    const index = appState.taskTemplates.data.findIndex(t => t.id === task.id);
    const taskCopy = { ...task };
    
    if (index >= 0) {
      appState.taskTemplates.data[index] = taskCopy;
    } else {
      appState.taskTemplates.data.push(taskCopy);
    }
    
    // Update cache
    appState.taskTemplates.cache.set(task.id, taskCopy);
    
    // Update metadata
    updateTaskTemplateMetadata(appState.taskTemplates.data);
    
    appState.lastUpdated = new Date().toISOString();
    appState.lastSyncTimestamp = new Date().toISOString();
    
    notifyStateChange('taskTemplates', appState.taskTemplates.data);
    notifyStateChange('templateUpdate', task);
    notifyStateChange('taskTemplateMetadata', appState.taskTemplates.metadata);
  },
  
  // Remove task template with cache cleanup
  removeTaskTemplate: (taskId) => {
    appState.taskTemplates.data = appState.taskTemplates.data.filter(t => t.id !== taskId);
    appState.taskTemplates.cache.delete(taskId);
    
    // Update metadata
    updateTaskTemplateMetadata(appState.taskTemplates.data);
    
    appState.lastUpdated = new Date().toISOString();
    appState.lastSyncTimestamp = new Date().toISOString();
    
    notifyStateChange('taskTemplates', appState.taskTemplates.data);
    notifyStateChange('templateRemove', taskId);
    notifyStateChange('taskTemplateMetadata', appState.taskTemplates.metadata);
  },

  // Set template filters
  setTaskTemplateFilters: (filters) => {
    appState.taskTemplates.filters = { ...appState.taskTemplates.filters, ...filters };
    notifyStateChange('taskTemplateFilters', appState.taskTemplates.filters);
  },

  // Set template pagination
  setTaskTemplatePagination: (pagination) => {
    appState.taskTemplates.pagination = { ...appState.taskTemplates.pagination, ...pagination };
    notifyStateChange('taskTemplatePagination', appState.taskTemplates.pagination);
  },

  // Set template search results
  setTaskTemplateSearchResults: (query, results) => {
    appState.taskTemplates.searchResults = {
      query,
      results: [...results],
      lastSearch: new Date().toISOString()
    };
    notifyStateChange('taskTemplateSearch', appState.taskTemplates.searchResults);
  },

  // Clear template cache
  clearTaskTemplateCache: () => {
    appState.taskTemplates.cache.clear();
    appState.taskTemplates.lastLoaded = null;
    notifyStateChange('taskTemplateCacheCleared', true);
  },

  // Add template operation to queue (for offline mode)
  addTemplateOperation: (operation) => {
    appState.templateOperationQueue.push({
      ...operation,
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random() // Simple unique ID
    });
    notifyStateChange('templateOperationQueued', operation);
  },

  // Clear template operation queue
  clearTemplateOperationQueue: () => {
    appState.templateOperationQueue = [];
    notifyStateChange('templateOperationQueueCleared', true);
  },
  
  // Enhanced task instance setters with caching and metadata updates
  
  // Set task instances for date with caching and metadata update
  setTaskInstancesForDate: (date, instances) => {
    appState.taskInstances.data.set(date, [...instances]);
    
    // Update instance cache
    instances.forEach(instance => {
      appState.taskInstances.cache.set(instance.id, { ...instance });
    });
    
    // Mark date as loaded
    appState.taskInstances.dateRange.loadedDates.add(date);
    
    // Update date range tracking
    if (!appState.taskInstances.dateRange.startDate || date < appState.taskInstances.dateRange.startDate) {
      appState.taskInstances.dateRange.startDate = date;
    }
    if (!appState.taskInstances.dateRange.endDate || date > appState.taskInstances.dateRange.endDate) {
      appState.taskInstances.dateRange.endDate = date;
    }
    
    // Update metadata
    updateTaskInstanceMetadata();
    
    appState.lastUpdated = new Date().toISOString();
    appState.lastSyncTimestamp = new Date().toISOString();
    
    notifyStateChange('taskInstances', { date, instances });
    notifyStateChange('taskInstanceMetadata', appState.taskInstances.metadata);
  },
  
  // Add/update single task instance with caching
  updateTaskInstance: (instance) => {
    const date = instance.date;
    const instances = appState.taskInstances.data.get(date) || [];
    const index = instances.findIndex(i => i.id === instance.id);
    const instanceCopy = { ...instance };
    
    if (index >= 0) {
      instances[index] = instanceCopy;
    } else {
      instances.push(instanceCopy);
    }
    
    // Update data and cache
    appState.taskInstances.data.set(date, instances);
    appState.taskInstances.cache.set(instance.id, instanceCopy);
    
    // Mark date as loaded if not already
    appState.taskInstances.dateRange.loadedDates.add(date);
    
    // Update metadata
    updateTaskInstanceMetadata();
    
    appState.lastUpdated = new Date().toISOString();
    appState.lastSyncTimestamp = new Date().toISOString();
    
    notifyStateChange('taskInstances', { date, instances });
    notifyStateChange('instanceUpdate', instance);
    notifyStateChange('taskInstanceMetadata', appState.taskInstances.metadata);
  },
  
  // Remove task instance with cache cleanup
  removeTaskInstance: (instanceId) => {
    const instance = appState.taskInstances.cache.get(instanceId);
    if (!instance) return;
    
    const date = instance.date;
    const instances = appState.taskInstances.data.get(date) || [];
    const filteredInstances = instances.filter(i => i.id !== instanceId);
    
    appState.taskInstances.data.set(date, filteredInstances);
    appState.taskInstances.cache.delete(instanceId);
    
    // Update metadata
    updateTaskInstanceMetadata();
    
    appState.lastUpdated = new Date().toISOString();
    appState.lastSyncTimestamp = new Date().toISOString();
    
    notifyStateChange('taskInstances', { date, instances: filteredInstances });
    notifyStateChange('instanceRemove', instanceId);
    notifyStateChange('taskInstanceMetadata', appState.taskInstances.metadata);
  },

  // Set instance filters
  setTaskInstanceFilters: (filters) => {
    appState.taskInstances.filters = { ...appState.taskInstances.filters, ...filters };
    notifyStateChange('taskInstanceFilters', appState.taskInstances.filters);
  },

  // Set instance search results
  setTaskInstanceSearchResults: (query, results, dateFilter = null) => {
    appState.taskInstances.searchResults = {
      query,
      results: [...results],
      dateFilter,
      lastSearch: new Date().toISOString()
    };
    notifyStateChange('taskInstanceSearch', appState.taskInstances.searchResults);
  },

  // Set current instance date for navigation
  setTaskInstanceCurrentDate: (date) => {
    const previousDate = appState.taskInstances.currentDate;
    appState.taskInstances.currentDate = date;
    
    // Add to navigation history if different
    if (previousDate !== date) {
      appState.taskInstances.navigationHistory.push({
        from: previousDate,
        to: date,
        timestamp: new Date().toISOString()
      });
      
      // Limit history to last 50 entries
      if (appState.taskInstances.navigationHistory.length > 50) {
        appState.taskInstances.navigationHistory = appState.taskInstances.navigationHistory.slice(-50);
      }
    }
    
    notifyStateChange('taskInstanceCurrentDate', date);
    notifyStateChange('taskInstanceNavigation', { from: previousDate, to: date });
  },

  // Set preload dates for performance
  setTaskInstancePreloadDates: (dates) => {
    appState.taskInstances.preloadDates = [...dates];
    notifyStateChange('taskInstancePreloadDates', dates);
  },

  // Clear instance cache
  clearTaskInstanceCache: () => {
    appState.taskInstances.data.clear();
    appState.taskInstances.cache.clear();
    appState.taskInstances.dateRange.loadedDates.clear();
    appState.taskInstances.dateRange.startDate = null;
    appState.taskInstances.dateRange.endDate = null;
    updateTaskInstanceMetadata(); // Reset metadata
    notifyStateChange('taskInstanceCacheCleared', true);
  },

  // Add instance operation to queue (for offline mode)
  addInstanceOperation: (operation) => {
    appState.instanceOperationQueue.push({
      ...operation,
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random() // Simple unique ID
    });
    notifyStateChange('instanceOperationQueued', operation);
  },

  // Clear instance operation queue
  clearInstanceOperationQueue: () => {
    appState.instanceOperationQueue = [];
    notifyStateChange('instanceOperationQueueCleared', true);
  },

  // Update instance statistics
  updateTaskInstanceStats: (period, identifier, stats) => {
    appState.taskInstances.stats[period].set(identifier, { ...stats });
    notifyStateChange('taskInstanceStats', { period, identifier, stats });
  },

  // Batch update multiple instances (for performance)
  batchUpdateTaskInstances: (updates) => {
    const affectedDates = new Set();
    
    updates.forEach(({ instanceId, updates: instanceUpdates }) => {
      const instance = appState.taskInstances.cache.get(instanceId);
      if (instance) {
        const updatedInstance = { ...instance, ...instanceUpdates };
        const date = updatedInstance.date;
        
        // Update cache
        appState.taskInstances.cache.set(instanceId, updatedInstance);
        
        // Update date data
        const instances = appState.taskInstances.data.get(date) || [];
        const index = instances.findIndex(i => i.id === instanceId);
        if (index >= 0) {
          instances[index] = updatedInstance;
          appState.taskInstances.data.set(date, instances);
          affectedDates.add(date);
        }
      }
    });
    
    // Update metadata once after all changes
    updateTaskInstanceMetadata();
    
    appState.lastUpdated = new Date().toISOString();
    appState.lastSyncTimestamp = new Date().toISOString();
    
    // Notify for each affected date
    affectedDates.forEach(date => {
      const instances = appState.taskInstances.data.get(date) || [];
      notifyStateChange('taskInstances', { date, instances });
    });
    
    notifyStateChange('instanceBatchUpdate', { updates, affectedDates: Array.from(affectedDates) });
    notifyStateChange('taskInstanceMetadata', appState.taskInstances.metadata);
  },
  
  // Set daily schedule for date
  setDailyScheduleForDate: (date, schedule) => {
    if (schedule) {
      appState.dailySchedules.set(date, { ...schedule });
    } else {
      appState.dailySchedules.delete(date);
    }
    appState.lastUpdated = new Date().toISOString();
    notifyStateChange('dailySchedules', { date, schedule });
  },
  
  // Set loading state
  setLoading: (type, isLoading) => {
    appState.loading[type] = isLoading;
    notifyStateChange('loading', { type, isLoading });
  },
  
  // Set online state
  setOnline: (isOnline) => {
    appState.isOnline = isOnline;
    notifyStateChange('online', isOnline);
  },
  
  // Set search query
  setSearchQuery: (query) => {
    appState.searchQuery = query;
    notifyStateChange('search', query);
  },
  
  // Set filters
  setFilter: (filterType, value) => {
    appState.activeFilters[filterType] = value;
    notifyStateChange('filters', appState.activeFilters);
  },
  
  // Add pending sync action (for offline mode)
  addPendingSyncAction: (action) => {
    appState.pendingSyncActions.push({
      ...action,
      timestamp: new Date().toISOString()
    });
    notifyStateChange('pendingSync', appState.pendingSyncActions);
  },
  
  // Clear pending sync actions
  clearPendingSyncActions: () => {
    appState.pendingSyncActions = [];
    notifyStateChange('pendingSync', []);
  }
};

/**
 * Utility Functions for State Management
 */
function updateTaskTemplateMetadata(templates) {
  const metadata = {
    total: templates.length,
    active: templates.filter(t => t.isActive !== false).length,
    inactive: templates.filter(t => t.isActive === false).length,
    byPriority: {},
    byTimeWindow: {},
    mandatory: templates.filter(t => t.isMandatory === true).length,
    flexible: templates.filter(t => t.schedulingType === 'flexible').length,
    fixed: templates.filter(t => t.schedulingType === 'fixed').length,
    lastUpdated: new Date().toISOString()
  };

  // Calculate distribution by priority
  templates.forEach(template => {
    const priority = template.priority || 3;
    metadata.byPriority[priority] = (metadata.byPriority[priority] || 0) + 1;
  });

  // Calculate distribution by time window
  templates.forEach(template => {
    const timeWindow = template.timeWindow || 'anytime';
    metadata.byTimeWindow[timeWindow] = (metadata.byTimeWindow[timeWindow] || 0) + 1;
  });

  appState.taskTemplates.metadata = metadata;
}

/**
 * Update task instance metadata based on current data
 */
function updateTaskInstanceMetadata() {
  let totalInstances = 0;
  const byStatus = {};
  const byDate = {};
  let completedCount = 0;
  let totalCompletionTime = 0;
  let completionTimeCount = 0;

  // Iterate through all instances in all dates
  appState.taskInstances.data.forEach((instances, date) => {
    byDate[date] = instances.length;
    totalInstances += instances.length;

    instances.forEach(instance => {
      // Count by status
      const status = instance.status || 'pending';
      byStatus[status] = (byStatus[status] || 0) + 1;

      // Calculate completion metrics
      if (status === 'completed') {
        completedCount++;
        
        if (instance.actualDuration) {
          totalCompletionTime += instance.actualDuration;
          completionTimeCount++;
        }
      }
    });
  });

  // Calculate completion rate
  const completionRate = totalInstances > 0 ? 
    Math.round((completedCount / totalInstances) * 100) : 0;

  // Calculate average completion time
  const averageCompletionTime = completionTimeCount > 0 ? 
    Math.round(totalCompletionTime / completionTimeCount) : null;

  const metadata = {
    totalInstances,
    dateCount: appState.taskInstances.data.size,
    byStatus,
    byDate,
    completionRate,
    averageCompletionTime,
    lastUpdated: new Date().toISOString()
  };

  appState.taskInstances.metadata = metadata;
}

/**
 * Multi-tab Synchronization
 */

// Event system (notifyStateChange, stateListeners) moved to './state/Store.js'

/**
 * Data Loading Functions
 */
export const stateActions = {
  // Initialize user data
  async initializeUser() {
    try {
      state.setLoading('settings', true);
      
      // Get current user ID
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      // Initialize user settings using the new comprehensive settings manager
      const settings = await userSettingsManager.initializeUserSettings(user.uid);
      state.setSettings(settings);
      
      console.log('✅ User data initialized with comprehensive settings');
    } catch (error) {
      console.error('❌ Error initializing user:', error);
      throw error;
    } finally {
      state.setLoading('settings', false);
    }
  },
  
  // Load user settings
  async loadSettings() {
    try {
      state.setLoading('settings', true);
      
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      const settings = await userSettingsManager.loadUserSettings(user.uid);
      if (settings) {
        state.setSettings(settings);
        console.log('✅ Settings loaded with comprehensive settings manager');
      } else {
        console.log('⚠️ No settings found, will use defaults');
      }
    } catch (error) {
      console.error('❌ Error loading settings:', error);
      throw error;
    } finally {
      state.setLoading('settings', false);
    }
  },
  
  // Save user settings
  async saveSettings(newSettings) {
    try {
      state.setLoading('saving', true);
      
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      const savedSettings = await userSettingsManager.updateSettings(user.uid, newSettings);
      
      console.log('✅ Settings saved with comprehensive settings manager');
      return savedSettings;
    } catch (error) {
      console.error('❌ Error saving settings:', error);
      throw error;
    } finally {
      state.setLoading('saving', false);
    }
  },
  
  // Update sleep schedule settings
  async updateSleepSchedule(sleepSchedule) {
    try {
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      const updatedSettings = await userSettingsManager.updateSleepSchedule(user.uid, sleepSchedule);
      console.log('✅ Sleep schedule updated');
      return updatedSettings;
    } catch (error) {
      console.error('❌ Error updating sleep schedule:', error);
      throw error;
    }
  },
  
  // Update time window preferences
  async updateTimeWindows(timeWindows) {
    try {
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      const updatedSettings = await userSettingsManager.updateTimeWindows(user.uid, timeWindows);
      console.log('✅ Time windows updated');
      return updatedSettings;
    } catch (error) {
      console.error('❌ Error updating time windows:', error);
      throw error;
    }
  },
  
  // Update application preferences
  async updatePreferences(preferences) {
    try {
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      const updatedSettings = await userSettingsManager.updatePreferences(user.uid, preferences);
      console.log('✅ Preferences updated');
      return updatedSettings;
    } catch (error) {
      console.error('❌ Error updating preferences:', error);
      throw error;
    }
  },
  
  // Reset settings to defaults
  async resetSettingsToDefaults() {
    try {
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      const defaultSettings = await userSettingsManager.resetToDefaults(user.uid);
      console.log('✅ Settings reset to defaults');
      return defaultSettings;
    } catch (error) {
      console.error('❌ Error resetting settings:', error);
      throw error;
    }
  },
  
  /* BEGIN legacy template actions (disabled)
   */
  // Enhanced task template management actions
  // NOTE: Deprecated — migrated to './state/actions.templates.js'.
  // Calls resolve to the extracted module via Object.assign below.
  
  // Initialize task template manager
  async initializeTaskTemplateManager() {
    try {
      await taskTemplateManager.initialize();
      console.log('✅ Task template manager initialized');
    } catch (error) {
      console.error('❌ Error initializing task template manager:', error);
      throw error;
    }
  },

  // Load task templates with options
  async loadTaskTemplates(options = {}) {
    try {
      state.setLoading('tasks', true);
      
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const templates = await taskTemplateManager.getAll(user.uid, options.includeInactive);
      state.setTaskTemplates(templates);
      
      // Update filters if provided
      if (options.filters) {
        state.setTaskTemplateFilters(options.filters);
      }
      
      console.log(`✅ Task templates loaded (${templates.length} templates)`);
    } catch (error) {
      console.error('❌ Error loading task templates:', error);
      
      // Add to offline queue if network error
      if (!state.isOnline()) {
        state.addTemplateOperation({
          type: 'LOAD_TEMPLATES',
          data: options,
          retry: true
        });
      }
      
      throw error;
    } finally {
      state.setLoading('tasks', false);
    }
  },

  // Create new task template
  async createTaskTemplate(templateData) {
    try {
      state.setLoading('saving', true);
      
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const newTemplate = await taskTemplateManager.create(user.uid, templateData);
      state.updateTaskTemplate(newTemplate);
      
      console.log('✅ Task template created:', newTemplate.taskName);
      return newTemplate;
    } catch (error) {
      console.error('❌ Error creating task template:', error);
      
      // Add to offline queue if network error
      if (!state.isOnline()) {
        state.addTemplateOperation({
          type: 'CREATE_TEMPLATE',
          data: templateData,
          retry: true
        });
      }
      
      throw error;
    } finally {
      state.setLoading('saving', false);
    }
  },

  // Update task template
  async updateTaskTemplate(templateId, updates) {
    try {
      state.setLoading('saving', true);
      
      const updatedTemplate = await taskTemplateManager.update(templateId, updates);
      state.updateTaskTemplate(updatedTemplate);
      
      console.log('✅ Task template updated:', templateId);
      return updatedTemplate;
    } catch (error) {
      console.error('❌ Error updating task template:', error);
      
      // Add to offline queue if network error
      if (!state.isOnline()) {
        state.addTemplateOperation({
          type: 'UPDATE_TEMPLATE',
          data: { templateId, updates },
          retry: true
        });
      }
      
      throw error;
    } finally {
      state.setLoading('saving', false);
    }
  },

  // Delete task template (soft delete)
  async deleteTaskTemplate(templateId) {
    try {
      state.setLoading('saving', true);
      
      await taskTemplateManager.delete(templateId);
      state.removeTaskTemplate(templateId);
      
      console.log('✅ Task template deleted:', templateId);
    } catch (error) {
      console.error('❌ Error deleting task template:', error);
      
      // Add to offline queue if network error
      if (!state.isOnline()) {
        state.addTemplateOperation({
          type: 'DELETE_TEMPLATE',
          data: { templateId },
          retry: true
        });
      }
      
      throw error;
    } finally {
      state.setLoading('saving', false);
    }
  },

  // Override a single occurrence by applying updates to its instance for a given date
  async overrideTaskInstanceForDate(templateId, date, updates, reason = 'Scoped edit: only this occurrence') {
    try {
      state.setLoading('saving', true);
      const instance = await taskInstanceManager.resolveInstanceByTemplateAndDate(templateId, date);
      if (!instance) throw new Error('Unable to resolve task instance for scoped edit');
      const updated = await taskInstanceManager.update(instance.id, updates, reason);
      return updated;
    } catch (error) {
      console.error('❌ Error overriding task instance for date:', error);
      throw error;
    } finally {
      state.setLoading('saving', false);
    }
  },

  // Duplicate task template
  async duplicateTaskTemplate(templateId, customName = null) {
    try {
      state.setLoading('saving', true);
      
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const duplicatedTemplate = await taskTemplateManager.duplicate(user.uid, templateId, customName);
      state.updateTaskTemplate(duplicatedTemplate);
      
      console.log('✅ Task template duplicated:', duplicatedTemplate.taskName);
      return duplicatedTemplate;
    } catch (error) {
      console.error('❌ Error duplicating task template:', error);
      
      // Add to offline queue if network error
      if (!state.isOnline()) {
        state.addTemplateOperation({
          type: 'DUPLICATE_TEMPLATE',
          data: { templateId, customName },
          retry: true
        });
      }
      
      throw error;
    } finally {
      state.setLoading('saving', false);
    }
  },

  // Split recurring template at date and create a new future template with updates
  async splitTemplateFromDate(templateId, date, updates) {
    try {
      state.setLoading('saving', true);
      const ops = taskTemplateManager.getBulkOperations();
      const result = await ops.splitAndCreateFromDate(templateId, date, updates);
      // The manager.update/create calls inside ops already update state via state.updateTaskTemplate
      return result;
    } catch (error) {
      console.error('❌ Error splitting template from date:', error);
      throw error;
    } finally {
      state.setLoading('saving', false);
    }
  },

  // Activate task template
  async activateTaskTemplate(templateId) {
    try {
      const activatedTemplate = await taskTemplateManager.activate(templateId);
      state.updateTaskTemplate(activatedTemplate);
      
      console.log('✅ Task template activated:', templateId);
      return activatedTemplate;
    } catch (error) {
      console.error('❌ Error activating task template:', error);
      throw error;
    }
  },

  // Deactivate task template
  async deactivateTaskTemplate(templateId) {
    try {
      const deactivatedTemplate = await taskTemplateManager.deactivate(templateId);
      state.updateTaskTemplate(deactivatedTemplate);
      
      console.log('✅ Task template deactivated:', templateId);
      return deactivatedTemplate;
    } catch (error) {
      console.error('❌ Error deactivating task template:', error);
      throw error;
    }
  },

  // Bulk activate templates
  async bulkActivateTemplates(templateIds) {
    try {
      state.setLoading('saving', true);
      
      const results = await taskTemplateManager.getBulkOperations().bulkActivate(templateIds);
      
      // Update each template in state
      for (const templateId of templateIds) {
        const template = state.getTaskTemplateById(templateId);
        if (template) {
          state.updateTaskTemplate({ ...template, isActive: true });
        }
      }
      
      console.log(`✅ Bulk activated ${templateIds.length} templates`);
      return results;
    } catch (error) {
      console.error('❌ Error bulk activating templates:', error);
      throw error;
    } finally {
      state.setLoading('saving', false);
    }
  },

  // Bulk deactivate templates
  async bulkDeactivateTemplates(templateIds) {
    try {
      state.setLoading('saving', true);
      
      const results = await taskTemplateManager.getBulkOperations().bulkDeactivate(templateIds);
      
      // Update each template in state
      for (const templateId of templateIds) {
        const template = state.getTaskTemplateById(templateId);
        if (template) {
          state.updateTaskTemplate({ ...template, isActive: false });
        }
      }
      
      console.log(`✅ Bulk deactivated ${templateIds.length} templates`);
      return results;
    } catch (error) {
      console.error('❌ Error bulk deactivating templates:', error);
      throw error;
    } finally {
      state.setLoading('saving', false);
    }
  },

  // Search task templates
  async searchTaskTemplates(searchQuery, options = {}) {
    try {
      state.setLoading('tasks', true);
      
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const results = await taskTemplates.search(user.uid, searchQuery, options);
      state.setTaskTemplateSearchResults(searchQuery, results);
      
      console.log(`✅ Found ${results.length} templates matching "${searchQuery}"`);
      return results;
    } catch (error) {
      console.error('❌ Error searching task templates:', error);
      throw error;
    } finally {
      state.setLoading('tasks', false);
    }
  },

  // Filter task templates
  async filterTaskTemplates(filters, pagination = {}) {
    try {
      state.setLoading('tasks', true);
      
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const result = await taskTemplates.getByFilters(user.uid, filters, pagination);
      
      // Update state with filtered results
      state.setTaskTemplates(result.templates);
      state.setTaskTemplateFilters(filters);
      state.setTaskTemplatePagination({
        ...pagination,
        hasMore: result.hasMore,
        total: result.total
      });
      
      console.log(`✅ Filtered templates: ${result.templates.length} results`);
      return result;
    } catch (error) {
      console.error('❌ Error filtering task templates:', error);
      throw error;
    } finally {
      state.setLoading('tasks', false);
    }
  },

  // Get template statistics
  async getTaskTemplateStats() {
    try {
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const stats = await taskTemplates.getStats(user.uid);
      
      // Update metadata in state
      appState.taskTemplates.metadata = {
        ...appState.taskTemplates.metadata,
        ...stats,
        lastUpdated: new Date().toISOString()
      };
      
      notifyStateChange('taskTemplateMetadata', appState.taskTemplates.metadata);
      
      console.log('✅ Template statistics updated');
      return stats;
    } catch (error) {
      console.error('❌ Error getting template statistics:', error);
      throw error;
    }
  },

  // Export templates
  async exportTaskTemplates(includeInactive = false) {
    try {
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const exportData = await taskTemplates.exportTemplates(user.uid, includeInactive);
      
      console.log(`✅ Exported ${exportData.templateCount} templates`);
      return exportData;
    } catch (error) {
      console.error('❌ Error exporting templates:', error);
      throw error;
    }
  },

  // Import templates
  async importTaskTemplates(importData, options = {}) {
    try {
      state.setLoading('saving', true);
      
      const user = state.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const result = await taskTemplates.importTemplates(user.uid, importData, options);
      
      // Refresh templates after import
      await this.loadTaskTemplates();
      
      console.log(`✅ Import completed: ${result.importedCount} imported, ${result.skippedCount} skipped`);
      return result;
    } catch (error) {
      console.error('❌ Error importing templates:', error);
      throw error;
    } finally {
      state.setLoading('saving', false);
    }
  },

  // Process offline template operations queue
  async processTemplateOperationQueue() {
    if (state.isOnline() && appState.templateOperationQueue.length > 0) {
      try {
        const operations = [...appState.templateOperationQueue];
        state.clearTemplateOperationQueue();
        
        for (const operation of operations) {
          try {
            switch (operation.type) {
              case 'CREATE_TEMPLATE':
                await this.createTaskTemplate(operation.data);
                break;
              case 'UPDATE_TEMPLATE':
                await this.updateTaskTemplate(operation.data.templateId, operation.data.updates);
                break;
              case 'DELETE_TEMPLATE':
                await this.deleteTaskTemplate(operation.data.templateId);
                break;
              case 'DUPLICATE_TEMPLATE':
                await this.duplicateTaskTemplate(operation.data.templateId, operation.data.customName);
                break;
              case 'LOAD_TEMPLATES':
                await this.loadTaskTemplates(operation.data);
                break;
              default:
                console.warn('Unknown template operation type:', operation.type);
            }
          } catch (error) {
            console.error('Error processing queued operation:', operation, error);
          }
        }
        
        console.log(`✅ Processed ${operations.length} queued template operations`);
      } catch (error) {
        console.error('❌ Error processing template operation queue:', error);
      }
    }
  },
  
  // Clear template cache and reload
  async refreshTaskTemplates() {
    try {
      state.clearTaskTemplateCache();
      await this.loadTaskTemplates();
      console.log('✅ Task templates refreshed');
    } catch (error) {
      console.error('❌ Error refreshing task templates:', error);
      throw error;
    }
  },
  // END legacy template actions
  
  // Load daily schedule for date moved to './state/actions.app.js'
};

// After construction, merge in extracted template actions to avoid behavioral changes
Object.assign(stateActions, templateActions);
Object.assign(stateActions, instanceActions);
Object.assign(stateActions, appActions);
Object.assign(stateActions, userActions);

// Initialize online/offline detection
window.addEventListener('online', () => {
  state.setOnline(true);
  // Process any queued operations when coming back online
  stateActions.processTemplateOperationQueue();
  stateActions.processInstanceOperationQueue();
});
window.addEventListener('offline', () => state.setOnline(false));

// Initialize multi-tab synchronization
if (typeof BroadcastChannel !== 'undefined') {
  const syncChannel = new BroadcastChannel('daily-ai-state');
  
  syncChannel.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    // Ignore messages from this tab
    if (event.data.source === 'state-manager') return;
    
    // Process state synchronization messages
    if (type.startsWith('state-')) {
      const stateType = type.replace('state-', '');
      
      switch (stateType) {
        // Template synchronization
        case 'taskTemplates':
          state.setTaskTemplates(data);
          break;
        case 'templateUpdate':
          state.updateTaskTemplate(data);
          break;
        case 'templateRemove':
          state.removeTaskTemplate(data);
          break;
        case 'taskTemplateMetadata':
          appState.taskTemplates.metadata = { ...data };
          notifyStateChange('taskTemplateMetadata', data);
          break;
          
        // Instance synchronization  
        case 'taskInstances':
          state.setTaskInstancesForDate(data.date, data.instances);
          break;
        case 'instanceUpdate':
          state.updateTaskInstance(data);
          break;
        case 'instanceRemove':
          state.removeTaskInstance(data);
          break;
        case 'taskInstanceMetadata':
          appState.taskInstances.metadata = { ...data };
          notifyStateChange('taskInstanceMetadata', data);
          break;
        case 'taskInstanceCurrentDate':
          state.setTaskInstanceCurrentDate(data);
          break;
        case 'instanceBatchUpdate':
          // Sync batch update from other tab
          data.affectedDates.forEach(date => {
            const instances = state.getTaskInstancesForDate(date);
            notifyStateChange('taskInstances', { date, instances });
          });
          break;
          
        // User and settings synchronization
        case 'user':
          state.setUser(data);
          break;
        case 'settings':
          state.setSettings(data);
          break;
          
        // Daily schedule synchronization
        case 'dailySchedules':
          state.setDailyScheduleForDate(data.date, data.schedule);
          break;
          
        default:
          console.log('Received sync message for:', stateType, data);
      }
      
      console.log(`🔄 Synced ${stateType} from other tab`);
    }
  });
  
  console.log('✅ Multi-tab synchronization initialized');
}

console.log('✅ Enhanced state management initialized with comprehensive template and instance support');

// ---
// Refactor façade re-exports (compat mode; non-breaking)
// These exports expose the new module surfaces without altering existing API.
// Later steps (ST-10) will flip primary exports to use these modules.
// Re-export public API for listeners to maintain compatibility
export { stateListeners };
export { stateListeners as __storeStateListeners } from './state/Store.js';
export * as __selectors from './state/selectors.js';
export * as __actionsTemplates from './state/actions.templates.js';
export * as __actionsInstances from './state/actions.instances.js';
export * as __actionsApp from './state/actions.app.js';
export * as __actionsUser from './state/actions.user.js';
