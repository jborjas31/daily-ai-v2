/**
 * actions.instances.js
 * Instance domain actions extracted from state.js (ST-06).
 * Uses Store.js directly to read/write and emit the same events.
 */

import { appState, notifyStateChange } from './Store.js';
import { taskInstances, dataUtils } from '../dataOffline.js';

// --- Local helpers (mirror state mutators) ---
function setLoading(type, isLoading) {
  appState.loading[type] = isLoading;
  notifyStateChange('loading', { type, isLoading });
}

function isOnline() {
  return appState.isOnline;
}

function getTaskInstancesForDate(date) {
  return appState.taskInstances.data.get(date) || [];
}

function getLoadedInstanceDates() {
  return new Set(appState.taskInstances.dateRange.loadedDates);
}

function getTaskInstanceById(instanceId) {
  return appState.taskInstances.cache.get(instanceId) || null;
}

function updateTaskInstanceMetadata() {
  let totalInstances = 0;
  const byStatus = {};
  const byDate = {};
  let completedCount = 0;
  let totalCompletionTime = 0;
  let completionTimeCount = 0;

  appState.taskInstances.data.forEach((instances, date) => {
    byDate[date] = instances.length;
    totalInstances += instances.length;
    instances.forEach(instance => {
      const status = instance.status || 'pending';
      byStatus[status] = (byStatus[status] || 0) + 1;
      if (status === 'completed') {
        completedCount++;
        if (instance.actualDuration) {
          totalCompletionTime += instance.actualDuration;
          completionTimeCount++;
        }
      }
    });
  });

  const completionRate = totalInstances > 0 ? Math.round((completedCount / totalInstances) * 100) : 0;
  const averageCompletionTime = completionTimeCount > 0 ? Math.round(totalCompletionTime / completionTimeCount) : null;

  appState.taskInstances.metadata = {
    totalInstances,
    dateCount: appState.taskInstances.data.size,
    byStatus,
    byDate,
    completionRate,
    averageCompletionTime,
    lastUpdated: new Date().toISOString()
  };
}

function setTaskInstancesForDate(date, instances) {
  appState.taskInstances.data.set(date, [...instances]);
  instances.forEach(instance => {
    appState.taskInstances.cache.set(instance.id, { ...instance });
  });
  appState.taskInstances.dateRange.loadedDates.add(date);
  if (!appState.taskInstances.dateRange.startDate || date < appState.taskInstances.dateRange.startDate) {
    appState.taskInstances.dateRange.startDate = date;
  }
  if (!appState.taskInstances.dateRange.endDate || date > appState.taskInstances.dateRange.endDate) {
    appState.taskInstances.dateRange.endDate = date;
  }
  updateTaskInstanceMetadata();
  appState.lastUpdated = new Date().toISOString();
  appState.lastSyncTimestamp = new Date().toISOString();
  notifyStateChange('taskInstances', { date, instances });
  notifyStateChange('taskInstanceMetadata', appState.taskInstances.metadata);
}

function updateTaskInstanceSync(instance) {
  const date = instance.date;
  const instances = appState.taskInstances.data.get(date) || [];
  const index = instances.findIndex(i => i.id === instance.id);
  const instanceCopy = { ...instance };
  if (index >= 0) {
    instances[index] = instanceCopy;
  } else {
    instances.push(instanceCopy);
  }
  appState.taskInstances.data.set(date, instances);
  appState.taskInstances.cache.set(instance.id, instanceCopy);
  appState.taskInstances.dateRange.loadedDates.add(date);
  updateTaskInstanceMetadata();
  appState.lastUpdated = new Date().toISOString();
  appState.lastSyncTimestamp = new Date().toISOString();
  notifyStateChange('taskInstances', { date, instances });
  notifyStateChange('instanceUpdate', instance);
  notifyStateChange('taskInstanceMetadata', appState.taskInstances.metadata);
}

function removeTaskInstanceSync(instanceId) {
  const instance = appState.taskInstances.cache.get(instanceId);
  if (!instance) return;
  const date = instance.date;
  const instances = appState.taskInstances.data.get(date) || [];
  const filtered = instances.filter(i => i.id !== instanceId);
  appState.taskInstances.data.set(date, filtered);
  appState.taskInstances.cache.delete(instanceId);
  updateTaskInstanceMetadata();
  appState.lastUpdated = new Date().toISOString();
  appState.lastSyncTimestamp = new Date().toISOString();
  notifyStateChange('taskInstances', { date, instances: filtered });
  notifyStateChange('instanceRemove', instanceId);
  notifyStateChange('taskInstanceMetadata', appState.taskInstances.metadata);
}

function setTaskInstanceFilters(filters) {
  appState.taskInstances.filters = { ...appState.taskInstances.filters, ...filters };
  notifyStateChange('taskInstanceFilters', appState.taskInstances.filters);
}

function setTaskInstanceSearchResults(query, results, dateFilter = null) {
  appState.taskInstances.searchResults = {
    query,
    results: [...results],
    dateFilter,
    lastSearch: new Date().toISOString()
  };
  notifyStateChange('taskInstanceSearch', appState.taskInstances.searchResults);
}

function setTaskInstanceCurrentDate(date) {
  const previousDate = appState.taskInstances.currentDate;
  appState.taskInstances.currentDate = date;
  if (previousDate !== date) {
    appState.taskInstances.navigationHistory.push({ from: previousDate, to: date, timestamp: new Date().toISOString() });
    if (appState.taskInstances.navigationHistory.length > 50) {
      appState.taskInstances.navigationHistory = appState.taskInstances.navigationHistory.slice(-50);
    }
  }
  notifyStateChange('taskInstanceCurrentDate', date);
  notifyStateChange('taskInstanceNavigation', { from: previousDate, to: date });
}

function setTaskInstancePreloadDates(dates) {
  appState.taskInstances.preloadDates = [...dates];
  notifyStateChange('taskInstancePreloadDates', dates);
}

function clearTaskInstanceCache() {
  appState.taskInstances.data.clear();
  appState.taskInstances.cache.clear();
  appState.taskInstances.dateRange.loadedDates.clear();
  appState.taskInstances.dateRange.startDate = null;
  appState.taskInstances.dateRange.endDate = null;
  updateTaskInstanceMetadata();
  notifyStateChange('taskInstanceCacheCleared', true);
}

function addInstanceOperation(operation) {
  appState.instanceOperationQueue.push({ ...operation, timestamp: new Date().toISOString(), id: Date.now() + Math.random() });
  notifyStateChange('instanceOperationQueued', operation);
}

function clearInstanceOperationQueue() {
  appState.instanceOperationQueue = [];
  notifyStateChange('instanceOperationQueueCleared', true);
}

function updateTaskInstanceStatsSync(period, identifier, stats) {
  appState.taskInstances.stats[period].set(identifier, { ...stats });
  notifyStateChange('taskInstanceStats', { period, identifier, stats });
}

function batchUpdateTaskInstancesSync(updates) {
  const affectedDates = new Set();
  updates.forEach(({ instanceId, updates: instanceUpdates }) => {
    const instance = appState.taskInstances.cache.get(instanceId);
    if (instance) {
      const updatedInstance = { ...instance, ...instanceUpdates };
      const date = updatedInstance.date;
      appState.taskInstances.cache.set(instanceId, updatedInstance);
      const instances = appState.taskInstances.data.get(date) || [];
      const index = instances.findIndex(i => i.id === instanceId);
      if (index >= 0) {
        instances[index] = updatedInstance;
        appState.taskInstances.data.set(date, instances);
        affectedDates.add(date);
      }
    }
  });
  updateTaskInstanceMetadata();
  appState.lastUpdated = new Date().toISOString();
  appState.lastSyncTimestamp = new Date().toISOString();
  affectedDates.forEach(date => {
    const instances = appState.taskInstances.data.get(date) || [];
    notifyStateChange('taskInstances', { date, instances });
  });
  notifyStateChange('instanceBatchUpdate', { updates, affectedDates: Array.from(affectedDates) });
  notifyStateChange('taskInstanceMetadata', appState.taskInstances.metadata);
}

// --- Exported instance actions ---
export async function loadTaskInstancesForDate(date, options = {}) {
  try {
    setLoading('tasks', true);
    const { status = null, templateId = null, force = false } = options;
    if (!force && getLoadedInstanceDates().has(date)) {
      const cachedInstances = getTaskInstancesForDate(date);
      console.log(`✅ Task instances retrieved from cache for ${date} (${cachedInstances.length} instances)`);
      return cachedInstances;
    }
    const instances = await taskInstances.getForDate(date, { status, templateId });
    setTaskInstancesForDate(date, instances);
    console.log(`✅ Task instances loaded for ${date} (${instances.length} instances)`);
    return instances;
  } catch (error) {
    console.error(`❌ Error loading task instances for ${date}:`, error);
    if (!isOnline()) {
      addInstanceOperation({ type: 'LOAD_INSTANCES_FOR_DATE', data: { date, options }, retry: true });
    }
    throw error;
  } finally {
    setLoading('tasks', false);
  }
}

export async function loadTaskInstancesForDateRange(startDate, endDate, options = {}) {
  try {
    setLoading('tasks', true);
    const instances = await taskInstances.getForDateRange(startDate, endDate, options);
    const instancesByDate = {};
    instances.forEach(instance => {
      if (!instancesByDate[instance.date]) instancesByDate[instance.date] = [];
      instancesByDate[instance.date].push(instance);
    });
    Object.entries(instancesByDate).forEach(([date, dateInstances]) => {
      setTaskInstancesForDate(date, dateInstances);
    });
    console.log(`✅ Task instances loaded for range ${startDate} to ${endDate} (${instances.length} total)`);
    return instances;
  } catch (error) {
    console.error(`❌ Error loading task instances for range ${startDate} to ${endDate}:`, error);
    throw error;
  } finally {
    setLoading('tasks', false);
  }
}

export async function loadTaskInstancesByTemplate(templateId, options = {}) {
  try {
    setLoading('tasks', true);
    const instances = await taskInstances.getByTemplateId(templateId, options);
    const instancesByDate = {};
    instances.forEach(instance => {
      if (!instancesByDate[instance.date]) instancesByDate[instance.date] = [];
      instancesByDate[instance.date].push(instance);
    });
    Object.entries(instancesByDate).forEach(([date, templateInstances]) => {
      const existingInstances = getTaskInstancesForDate(date);
      const existingIds = new Set(existingInstances.map(i => i.id));
      const newInstances = templateInstances.filter(i => !existingIds.has(i.id));
      const merged = [...existingInstances, ...newInstances];
      setTaskInstancesForDate(date, merged);
    });
    console.log(`✅ Task instances loaded for template ${templateId} (${instances.length} instances)`);
    return instances;
  } catch (error) {
    console.error(`❌ Error loading task instances for template ${templateId}:`, error);
    throw error;
  } finally {
    setLoading('tasks', false);
  }
}

export async function createTaskInstance(instanceData) {
  try {
    setLoading('saving', true);
    const newInstance = await taskInstances.create(instanceData);
    updateTaskInstanceSync(newInstance);
    console.log('✅ Task instance created:', newInstance.id);
    return newInstance;
  } catch (error) {
    console.error('❌ Error creating task instance:', error);
    if (!isOnline()) {
      addInstanceOperation({ type: 'CREATE_INSTANCE', data: instanceData, retry: true });
    }
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function updateTaskInstance(instanceId, updates) {
  try {
    setLoading('saving', true);
    const updatedInstance = await taskInstances.update(instanceId, updates);
    updateTaskInstanceSync(updatedInstance);
    console.log('✅ Task instance updated:', instanceId);
    return updatedInstance;
  } catch (error) {
    console.error('❌ Error updating task instance:', error);
    if (!isOnline()) {
      addInstanceOperation({ type: 'UPDATE_INSTANCE', data: { instanceId, updates }, retry: true });
    }
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function deleteTaskInstance(instanceId) {
  try {
    setLoading('saving', true);
    await taskInstances.delete(instanceId);
    removeTaskInstanceSync(instanceId);
    console.log('✅ Task instance deleted:', instanceId);
  } catch (error) {
    console.error('❌ Error deleting task instance:', error);
    if (!isOnline()) {
      addInstanceOperation({ type: 'DELETE_INSTANCE', data: { instanceId }, retry: true });
    }
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function batchUpdateTaskInstances(updates) {
  try {
    setLoading('saving', true);
    const instanceIds = updates.map(u => u.instanceId);
    const updateData = updates.reduce((acc, u) => ({ ...acc, ...u.updates }), {});
    await taskInstances.batchUpdate(instanceIds, updateData);
    const stateUpdates = updates.map(({ instanceId, updates: instanceUpdates }) => ({ instanceId, updates: instanceUpdates }));
    batchUpdateTaskInstancesSync(stateUpdates);
    console.log(`✅ Batch updated ${instanceIds.length} instances`);
    return { updatedCount: instanceIds.length };
  } catch (error) {
    console.error('❌ Error batch updating instances:', error);
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function batchCreateTaskInstances(instancesData) {
  try {
    setLoading('saving', true);
    const createdInstances = await taskInstances.batchCreate(instancesData);
    createdInstances.forEach(instance => updateTaskInstanceSync(instance));
    console.log(`✅ Batch created ${createdInstances.length} instances`);
    return createdInstances;
  } catch (error) {
    console.error('❌ Error batch creating instances:', error);
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function getTaskInstanceStats(startDate, endDate) {
  try {
    const stats = await taskInstances.getStats(startDate, endDate);
    appState.taskInstances.metadata = { ...appState.taskInstances.metadata, ...stats, lastUpdated: new Date().toISOString() };
    notifyStateChange('taskInstanceMetadata', appState.taskInstances.metadata);
    console.log('✅ Instance statistics updated');
    return stats;
  } catch (error) {
    console.error('❌ Error getting instance statistics:', error);
    throw error;
  }
}

export async function exportTaskInstances(startDate, endDate, options = {}) {
  try {
    const exportData = await taskInstances.exportInstances(startDate, endDate, options);
    console.log(`✅ Exported ${exportData.instanceCount} instances for range ${startDate} to ${endDate}`);
    return exportData;
  } catch (error) {
    console.error('❌ Error exporting instances:', error);
    throw error;
  }
}

export async function importTaskInstances(importData, options = {}) {
  try {
    setLoading('saving', true);
    const result = await taskInstances.importInstances(importData, options);
    if (importData.dateRange) {
      await loadTaskInstancesForDateRange(importData.dateRange.startDate, importData.dateRange.endDate, { force: true });
    }
    console.log(`✅ Import completed: ${result.importedCount} imported, ${result.skippedCount} skipped`);
    return result;
  } catch (error) {
    console.error('❌ Error importing instances:', error);
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function cleanupOldInstances(retentionDays = 365) {
  try {
    setLoading('saving', true);
    const result = await taskInstances.cleanupOldInstances(retentionDays);
    const cutoffDate = result.cutoffDate;
    const loadedDates = getLoadedInstanceDates();
    loadedDates.forEach(date => {
      if (date < cutoffDate) {
        const instances = getTaskInstancesForDate(date);
        instances.forEach(instance => {
          appState.taskInstances.cache.delete(instance.id);
        });
        appState.taskInstances.data.delete(date);
        appState.taskInstances.dateRange.loadedDates.delete(date);
      }
    });
    updateTaskInstanceMetadata();
    notifyStateChange('taskInstanceMetadata', appState.taskInstances.metadata);
    console.log(`✅ Cleanup completed: ${result.deletedCount} old instances deleted`);
    return result;
  } catch (error) {
    console.error('❌ Error cleaning up old instances:', error);
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function navigateToInstanceDate(date, preloadDays = 7) {
  try {
    setTaskInstanceCurrentDate(date);
    await loadTaskInstancesForDate(date);
    const preloadDates = [];
    for (let i = -preloadDays; i <= preloadDays; i++) {
      if (i !== 0) {
        const preloadDate = dataUtils.addDaysToDate(date, i);
        preloadDates.push(preloadDate);
      }
    }
    setTaskInstancePreloadDates(preloadDates);
    preloadDates.forEach(async (preloadDate) => {
      try { await loadTaskInstancesForDate(preloadDate); } catch (e) { console.warn(`Failed to preload ${preloadDate}:`, e); }
    });
    console.log(`✅ Navigated to ${date} with preloading`);
    return date;
  } catch (error) {
    console.error(`❌ Error navigating to instance date ${date}:`, error);
    throw error;
  }
}

export async function processInstanceOperationQueue() {
  if (isOnline() && appState.instanceOperationQueue.length > 0) {
    try {
      const operations = [...appState.instanceOperationQueue];
      clearInstanceOperationQueue();
      for (const operation of operations) {
        try {
          switch (operation.type) {
            case 'CREATE_INSTANCE':
              await createTaskInstance(operation.data);
              break;
            case 'UPDATE_INSTANCE':
              await updateTaskInstance(operation.data.instanceId, operation.data.updates);
              break;
            case 'DELETE_INSTANCE':
              await deleteTaskInstance(operation.data.instanceId);
              break;
            case 'LOAD_INSTANCES_FOR_DATE':
              await loadTaskInstancesForDate(operation.data.date, operation.data.options);
              break;
            default:
              console.warn('Unknown instance operation type:', operation.type);
          }
        } catch (error) {
          console.error('Error processing queued instance operation:', operation, error);
        }
      }
      console.log(`✅ Processed ${operations.length} queued instance operations`);
    } catch (error) {
      console.error('❌ Error processing instance operation queue:', error);
    }
  }
}

export async function refreshTaskInstances() {
  try {
    const currentDate = appState.taskInstances.currentDate;
    clearTaskInstanceCache();
    await loadTaskInstancesForDate(currentDate, { force: true });
    console.log('✅ Task instances refreshed');
  } catch (error) {
    console.error('❌ Error refreshing task instances:', error);
    throw error;
  }
}

