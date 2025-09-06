/**
 * actions.app.js
 * App UI/meta actions extracted from state.js (ST-07).
 * Manages view/date/loading/online/search/filters and daily schedules.
 */

import { appState, notifyStateChange } from './Store.js';
import { dailySchedules } from '../data.js';

// --- Mutators ---
export function setCurrentView(view) {
  appState.currentView = view;
  notifyStateChange('view', view);
}

export function setCurrentDate(date) {
  appState.currentDate = date;
  notifyStateChange('date', date);
}

export function setLoading(type, isLoading) {
  // Guard against external references by replacing the object shallowly
  appState.loading = { ...appState.loading, [type]: isLoading };
  notifyStateChange('loading', { type, isLoading });
}

export function setOnline(isOnline) {
  appState.isOnline = isOnline;
  notifyStateChange('online', isOnline);
}

export function setSearchQuery(query) {
  appState.searchQuery = query;
  notifyStateChange('search', query);
}

export function setFilter(filterType, value) {
  // Replace filters object to avoid shared references
  appState.activeFilters = { ...appState.activeFilters, [filterType]: value };
  notifyStateChange('filters', appState.activeFilters);
}

// Convenience: merge multiple filters at once (non-breaking addition)
export function setActiveFilters(filters) {
  appState.activeFilters = { ...appState.activeFilters, ...filters };
  notifyStateChange('filters', appState.activeFilters);
}

export function setDailyScheduleForDate(date, schedule) {
  if (schedule) {
    appState.dailySchedules.set(date, { ...schedule });
  } else {
    appState.dailySchedules.delete(date);
  }
  appState.lastUpdated = new Date().toISOString();
  notifyStateChange('dailySchedules', { date, schedule });
}

export function addPendingSyncAction(action) {
  appState.pendingSyncActions.push({ ...action, timestamp: new Date().toISOString() });
  notifyStateChange('pendingSync', appState.pendingSyncActions);
}

export function clearPendingSyncActions() {
  appState.pendingSyncActions = [];
  notifyStateChange('pendingSync', []);
}

// --- Actions ---
export async function loadDailyScheduleForDate(date) {
  try {
    const schedule = await dailySchedules.getForDate(date);
    setDailyScheduleForDate(date, schedule);
    console.log(`✅ Daily schedule loaded for ${date}`);
  } catch (error) {
    console.error(`❌ Error loading daily schedule for ${date}:`, error);
    throw error;
  }
}
