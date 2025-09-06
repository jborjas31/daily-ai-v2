/**
 * selectors.js
 * Pure read-only selectors extracted from state.js (ST-09).
 * No side effects; returns snapshots or derived values.
 */

import { appState } from './Store.js';
import { dataUtils } from '../dataOffline.js';

// Lightweight memoization for expensive instance queries (ST-12)
// Uses taskInstances.metadata.lastUpdated as an invalidation version.
const __memo = {
  range: { key: null, version: null, result: [] },
  byTemplate: { key: null, version: null, result: [] },
  byStatus: { key: null, version: null, result: [] }
};

function __version() {
  return appState.taskInstances?.metadata?.lastUpdated || appState.lastUpdated;
}

function __key(...parts) {
  return parts.join('|');
}

export function get() {
  return { ...appState };
}

// User and settings
export function getUser() {
  return appState.user;
}

export function getSettings() {
  return { ...appState.settings };
}

// App meta
export function getCurrentDate() {
  return appState.currentDate;
}

export function getCurrentView() {
  return appState.currentView;
}

export function isLoading(type) {
  return appState.loading[type] || false;
}

export function isOnline() {
  return appState.isOnline;
}

export function getSearchQuery() {
  return appState.searchQuery;
}

export function getActiveFilters() {
  return { ...appState.activeFilters };
}

// Templates
export function getTaskTemplates() {
  return [...appState.taskTemplates.data];
}

export function getTaskTemplateById(templateId) {
  return appState.taskTemplates.cache.get(templateId) || null;
}

export function getTaskTemplateMetadata() {
  return { ...appState.taskTemplates.metadata };
}

export function getTaskTemplateFilters() {
  return { ...appState.taskTemplates.filters };
}

export function getTaskTemplatePagination() {
  return { ...appState.taskTemplates.pagination };
}

export function getTaskTemplateSearchResults() {
  return { ...appState.taskTemplates.searchResults };
}

export function getTemplateOperationQueue() {
  return [...appState.templateOperationQueue];
}

// Instances
export function getTaskInstancesForDate(date) {
  return appState.taskInstances.data.get(date) || [];
}

export function getTaskInstanceById(instanceId) {
  return appState.taskInstances.cache.get(instanceId) || null;
}

export function getTaskInstanceMetadata() {
  return { ...appState.taskInstances.metadata };
}

export function getTaskInstanceFilters() {
  return { ...appState.taskInstances.filters };
}

export function getTaskInstanceSearchResults() {
  return { ...appState.taskInstances.searchResults };
}

export function getTaskInstanceCurrentDate() {
  return appState.taskInstances.currentDate;
}

export function getTaskInstanceNavigationHistory() {
  return [...appState.taskInstances.navigationHistory];
}

export function getTaskInstanceStats(period = 'daily', identifier = null) {
  const statsMap = appState.taskInstances.stats[period];
  return identifier ? (statsMap?.get(identifier) || null) : new Map(statsMap);
}

export function getLoadedInstanceDates() {
  return new Set(appState.taskInstances.dateRange.loadedDates);
}

export function getInstanceDateRange() {
  return { ...appState.taskInstances.dateRange };
}

export function getInstancesForDateRange(startDate, endDate) {
  const v = __version();
  const key = __key('range', startDate, endDate);
  if (__memo.range.key === key && __memo.range.version === v) {
    console.debug('[selectors] memo hit: getInstancesForDateRange');
    return __memo.range.result.slice();
  }
  const out = [];
  const dates = dataUtils.getDateRange(startDate, endDate);
  dates.forEach(date => {
    const dateInstances = appState.taskInstances.data.get(date) || [];
    out.push(...dateInstances);
  });
  __memo.range = { key, version: v, result: out };
  return out.slice();
}

export function getInstancesByTemplateId(templateId) {
  const v = __version();
  const key = __key('byTemplate', templateId);
  if (__memo.byTemplate.key === key && __memo.byTemplate.version === v) {
    console.debug('[selectors] memo hit: getInstancesByTemplateId');
    return __memo.byTemplate.result.slice();
  }
  const out = [];
  appState.taskInstances.data.forEach(dateInstances => {
    const templateInstances = dateInstances.filter(inst => inst.templateId === templateId);
    out.push(...templateInstances);
  });
  __memo.byTemplate = { key, version: v, result: out };
  return out.slice();
}

export function getInstancesByStatus(status, dateFilter = null) {
  const v = __version();
  const key = __key('byStatus', status, dateFilter || '*');
  if (__memo.byStatus.key === key && __memo.byStatus.version === v) {
    console.debug('[selectors] memo hit: getInstancesByStatus');
    return __memo.byStatus.result.slice();
  }
  const out = [];
  appState.taskInstances.data.forEach((dateInstances, date) => {
    if (dateFilter && date !== dateFilter) return;
    const statusInstances = dateInstances.filter(inst => inst.status === status);
    out.push(...statusInstances);
  });
  __memo.byStatus = { key, version: v, result: out };
  return out.slice();
}

export function getInstanceOperationQueue() {
  return [...appState.instanceOperationQueue];
}

// Daily schedules
export function getDailyScheduleForDate(date) {
  return appState.dailySchedules.get(date) || null;
}
