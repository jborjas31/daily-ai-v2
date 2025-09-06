/**
 * actions.templates.js
 * Template domain actions extracted from state.js (ST-05).
 * Uses Store.js directly to read/write and emit the same events.
 */

import { appState, notifyStateChange } from './Store.js';
import { taskTemplates, dataUtils } from '../dataOffline.js';
import { taskTemplateManager } from '../taskLogic.js';

// --- Local helpers mirror existing mutators from state.js ---
function setLoading(type, isLoading) {
  appState.loading[type] = isLoading;
  notifyStateChange('loading', { type, isLoading });
}

function isOnline() {
  return appState.isOnline;
}

function getUser() {
  return appState.user;
}

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

  templates.forEach(template => {
    const priority = template.priority || 3;
    metadata.byPriority[priority] = (metadata.byPriority[priority] || 0) + 1;
  });

  templates.forEach(template => {
    const timeWindow = template.timeWindow || 'anytime';
    metadata.byTimeWindow[timeWindow] = (metadata.byTimeWindow[timeWindow] || 0) + 1;
  });

  appState.taskTemplates.metadata = metadata;
}

function setTaskTemplates(templates) {
  appState.taskTemplates.data = [...templates];
  appState.taskTemplates.cache.clear();
  templates.forEach(template => {
    appState.taskTemplates.cache.set(template.id, { ...template });
  });
  updateTaskTemplateMetadata(templates);
  appState.taskTemplates.lastLoaded = new Date().toISOString();
  appState.lastUpdated = new Date().toISOString();
  appState.lastSyncTimestamp = new Date().toISOString();
  notifyStateChange('taskTemplates', templates);
  notifyStateChange('taskTemplateMetadata', appState.taskTemplates.metadata);
}

function updateTaskTemplateSync(task) {
  const index = appState.taskTemplates.data.findIndex(t => t.id === task.id);
  const taskCopy = { ...task };
  if (index >= 0) {
    appState.taskTemplates.data[index] = taskCopy;
  } else {
    appState.taskTemplates.data.push(taskCopy);
  }
  appState.taskTemplates.cache.set(task.id, taskCopy);
  updateTaskTemplateMetadata(appState.taskTemplates.data);
  appState.lastUpdated = new Date().toISOString();
  appState.lastSyncTimestamp = new Date().toISOString();
  notifyStateChange('taskTemplates', appState.taskTemplates.data);
  notifyStateChange('templateUpdate', task);
  notifyStateChange('taskTemplateMetadata', appState.taskTemplates.metadata);
}

function removeTaskTemplateSync(taskId) {
  appState.taskTemplates.data = appState.taskTemplates.data.filter(t => t.id !== taskId);
  appState.taskTemplates.cache.delete(taskId);
  updateTaskTemplateMetadata(appState.taskTemplates.data);
  appState.lastUpdated = new Date().toISOString();
  appState.lastSyncTimestamp = new Date().toISOString();
  notifyStateChange('taskTemplates', appState.taskTemplates.data);
  notifyStateChange('templateRemove', taskId);
  notifyStateChange('taskTemplateMetadata', appState.taskTemplates.metadata);
}

function setTaskTemplateFilters(filters) {
  appState.taskTemplates.filters = { ...appState.taskTemplates.filters, ...filters };
  notifyStateChange('taskTemplateFilters', appState.taskTemplates.filters);
}

function setTaskTemplatePagination(pagination) {
  appState.taskTemplates.pagination = { ...appState.taskTemplates.pagination, ...pagination };
  notifyStateChange('taskTemplatePagination', appState.taskTemplates.pagination);
}

function setTaskTemplateSearchResults(query, results) {
  appState.taskTemplates.searchResults = {
    query,
    results: [...results],
    lastSearch: new Date().toISOString()
  };
  notifyStateChange('taskTemplateSearch', appState.taskTemplates.searchResults);
}

function clearTaskTemplateCache() {
  appState.taskTemplates.cache.clear();
  appState.taskTemplates.lastLoaded = null;
  notifyStateChange('taskTemplateCacheCleared', true);
}

function addTemplateOperation(operation) {
  appState.templateOperationQueue.push({
    ...operation,
    timestamp: new Date().toISOString(),
    id: Date.now() + Math.random()
  });
  notifyStateChange('templateOperationQueued', operation);
}

function clearTemplateOperationQueue() {
  appState.templateOperationQueue = [];
  notifyStateChange('templateOperationQueueCleared', true);
}

function getTaskTemplateById(id) {
  return appState.taskTemplates.cache.get(id) || null;
}

// --- Exported template actions ---
export async function initializeTaskTemplateManager() {
  try {
    await taskTemplateManager.initialize();
    console.log('✅ Task template manager initialized');
  } catch (error) {
    console.error('❌ Error initializing task template manager:', error);
    throw error;
  }
}

export async function loadTaskTemplates(options = {}) {
  try {
    setLoading('tasks', true);
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const templates = await taskTemplateManager.getAll(user.uid, options.includeInactive);
    setTaskTemplates(templates);
    if (options.filters) setTaskTemplateFilters(options.filters);
    console.log(`✅ Task templates loaded (${templates.length} templates)`);
  } catch (error) {
    console.error('❌ Error loading task templates:', error);
    if (!isOnline()) {
      addTemplateOperation({ type: 'LOAD_TEMPLATES', data: options, retry: true });
    }
    throw error;
  } finally {
    setLoading('tasks', false);
  }
}

export async function createTaskTemplate(templateData) {
  try {
    setLoading('saving', true);
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const newTemplate = await taskTemplateManager.create(user.uid, templateData);
    updateTaskTemplateSync(newTemplate);
    console.log('✅ Task template created:', newTemplate.taskName);
    return newTemplate;
  } catch (error) {
    console.error('❌ Error creating task template:', error);
    if (!isOnline()) {
      addTemplateOperation({ type: 'CREATE_TEMPLATE', data: templateData, retry: true });
    }
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function updateTaskTemplate(templateId, updates) {
  try {
    setLoading('saving', true);
    const updatedTemplate = await taskTemplateManager.update(templateId, updates);
    updateTaskTemplateSync(updatedTemplate);
    console.log('✅ Task template updated:', templateId);
    return updatedTemplate;
  } catch (error) {
    console.error('❌ Error updating task template:', error);
    if (!isOnline()) {
      addTemplateOperation({ type: 'UPDATE_TEMPLATE', data: { templateId, updates }, retry: true });
    }
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function deleteTaskTemplate(templateId) {
  try {
    setLoading('saving', true);
    await taskTemplateManager.delete(templateId);
    removeTaskTemplateSync(templateId);
    console.log('✅ Task template deleted:', templateId);
  } catch (error) {
    console.error('❌ Error deleting task template:', error);
    if (!isOnline()) {
      addTemplateOperation({ type: 'DELETE_TEMPLATE', data: { templateId }, retry: true });
    }
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function duplicateTaskTemplate(templateId, customName = null) {
  try {
    setLoading('saving', true);
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const duplicatedTemplate = await taskTemplateManager.duplicate(user.uid, templateId, customName);
    updateTaskTemplateSync(duplicatedTemplate);
    console.log('✅ Task template duplicated:', duplicatedTemplate.taskName);
    return duplicatedTemplate;
  } catch (error) {
    console.error('❌ Error duplicating task template:', error);
    if (!isOnline()) {
      addTemplateOperation({ type: 'DUPLICATE_TEMPLATE', data: { templateId, customName }, retry: true });
    }
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function activateTaskTemplate(templateId) {
  try {
    const activatedTemplate = await taskTemplateManager.activate(templateId);
    updateTaskTemplateSync(activatedTemplate);
    console.log('✅ Task template activated:', templateId);
    return activatedTemplate;
  } catch (error) {
    console.error('❌ Error activating task template:', error);
    throw error;
  }
}

export async function deactivateTaskTemplate(templateId) {
  try {
    const deactivatedTemplate = await taskTemplateManager.deactivate(templateId);
    updateTaskTemplateSync(deactivatedTemplate);
    console.log('✅ Task template deactivated:', templateId);
    return deactivatedTemplate;
  } catch (error) {
    console.error('❌ Error deactivating task template:', error);
    throw error;
  }
}

export async function bulkActivateTemplates(templateIds) {
  try {
    setLoading('saving', true);
    const results = await taskTemplateManager.getBulkOperations().bulkActivate(templateIds);
    for (const templateId of templateIds) {
      const template = getTaskTemplateById(templateId);
      if (template) updateTaskTemplateSync({ ...template, isActive: true });
    }
    console.log(`✅ Bulk activated ${templateIds.length} templates`);
    return results;
  } catch (error) {
    console.error('❌ Error bulk activating templates:', error);
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function bulkDeactivateTemplates(templateIds) {
  try {
    setLoading('saving', true);
    const results = await taskTemplateManager.getBulkOperations().bulkDeactivate(templateIds);
    for (const templateId of templateIds) {
      const template = getTaskTemplateById(templateId);
      if (template) updateTaskTemplateSync({ ...template, isActive: false });
    }
    console.log(`✅ Bulk deactivated ${templateIds.length} templates`);
    return results;
  } catch (error) {
    console.error('❌ Error bulk deactivating templates:', error);
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function searchTaskTemplates(searchQuery, options = {}) {
  try {
    setLoading('tasks', true);
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const results = await taskTemplates.search(user.uid, searchQuery, options);
    setTaskTemplateSearchResults(searchQuery, results);
    console.log(`✅ Found ${results.length} templates matching "${searchQuery}"`);
    return results;
  } catch (error) {
    console.error('❌ Error searching task templates:', error);
    throw error;
  } finally {
    setLoading('tasks', false);
  }
}

export async function filterTaskTemplates(filters, pagination = {}) {
  try {
    setLoading('tasks', true);
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const result = await taskTemplates.getByFilters(user.uid, filters, pagination);
    setTaskTemplates(result.templates);
    setTaskTemplateFilters(filters);
    setTaskTemplatePagination({ ...pagination, hasMore: result.hasMore, total: result.total });
    console.log(`✅ Filtered templates: ${result.templates.length} results`);
    return result;
  } catch (error) {
    console.error('❌ Error filtering task templates:', error);
    throw error;
  } finally {
    setLoading('tasks', false);
  }
}

export async function getTaskTemplateStats() {
  try {
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const stats = await taskTemplates.getStats(user.uid);
    appState.taskTemplates.metadata = { ...appState.taskTemplates.metadata, ...stats, lastUpdated: new Date().toISOString() };
    notifyStateChange('taskTemplateMetadata', appState.taskTemplates.metadata);
    console.log('✅ Template statistics updated');
    return stats;
  } catch (error) {
    console.error('❌ Error getting template statistics:', error);
    throw error;
  }
}

export async function exportTaskTemplates(includeInactive = false) {
  try {
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const exportData = await taskTemplates.exportTemplates(user.uid, includeInactive);
    console.log(`✅ Exported ${exportData.templateCount} templates`);
    return exportData;
  } catch (error) {
    console.error('❌ Error exporting templates:', error);
    throw error;
  }
}

export async function importTaskTemplates(importData, options = {}) {
  try {
    setLoading('saving', true);
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const result = await taskTemplates.importTemplates(user.uid, importData, options);
    await loadTaskTemplates();
    console.log(`✅ Import completed: ${result.importedCount} imported, ${result.skippedCount} skipped`);
    return result;
  } catch (error) {
    console.error('❌ Error importing templates:', error);
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function processTemplateOperationQueue() {
  if (isOnline() && appState.templateOperationQueue.length > 0) {
    try {
      const operations = [...appState.templateOperationQueue];
      clearTemplateOperationQueue();
      for (const operation of operations) {
        try {
          switch (operation.type) {
            case 'CREATE_TEMPLATE':
              await createTaskTemplate(operation.data);
              break;
            case 'UPDATE_TEMPLATE':
              await updateTaskTemplate(operation.data.templateId, operation.data.updates);
              break;
            case 'DELETE_TEMPLATE':
              await deleteTaskTemplate(operation.data.templateId);
              break;
            case 'DUPLICATE_TEMPLATE':
              await duplicateTaskTemplate(operation.data.templateId, operation.data.customName);
              break;
            case 'LOAD_TEMPLATES':
              await loadTaskTemplates(operation.data);
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
}

export async function refreshTaskTemplates() {
  try {
    clearTaskTemplateCache();
    await loadTaskTemplates();
    console.log('✅ Task templates refreshed');
  } catch (error) {
    console.error('❌ Error refreshing task templates:', error);
    throw error;
  }
}

