/**
 * Store.js
 * Single source of truth + state event bus
 *
 * Includes:
 * - appState: global state object (moved from public/js/state.js)
 * - notifyStateChange/stateListeners: event system with BroadcastChannel sync
 * - Domain mapping and event contract documentation (from ST-02/ST-03)
 */

import { dataUtils } from '../dataOffline.js';

// Global Application State (moved intact from public/js/state.js)
export let appState = {
  // User authentication
  user: null,
  isAuthenticated: false,
  
  // User settings
  settings: {
    desiredSleepDuration: 7.5,
    defaultWakeTime: "06:30",
    defaultSleepTime: "23:00"
  },
  
  // Current view
  currentView: 'today', // 'today', 'library', 'settings'
  currentDate: dataUtils.getTodayDateString(),
  
  // Task template data with enhanced caching
  taskTemplates: {
    data: [],
    cache: new Map(), // Template ID -> template object for fast lookups
    lastLoaded: null,
    metadata: {
      total: 0,
      active: 0,
      inactive: 0,
      byPriority: {},
      byTimeWindow: {},
      lastUpdated: null
    },
    filters: {
      includeInactive: false,
      timeWindow: null,
      priority: null,
      isMandatory: null,
      schedulingType: null
    },
    pagination: {
      limit: 50,
      offset: 0,
      hasMore: false,
      total: 0
    },
    searchResults: {
      query: '',
      results: [],
      lastSearch: null
    }
  },
  
  // Task instance data with enhanced date-based management
  taskInstances: {
    data: new Map(), // Date string -> array of instances for fast date lookups
    cache: new Map(), // Instance ID -> instance object for fast instance lookups
    dateRange: {
      startDate: null,
      endDate: null,
      loadedDates: new Set() // Track which dates have been loaded
    },
    metadata: {
      totalInstances: 0,
      dateCount: 0,
      byStatus: {},
      byDate: {},
      completionRate: 0,
      averageCompletionTime: null,
      lastUpdated: null
    },
    filters: {
      status: null, // 'pending', 'completed', 'skipped', 'postponed'
      templateId: null,
      dateRange: {
        start: null,
        end: null
      }
    },
    searchResults: {
      query: '',
      results: [],
      dateFilter: null,
      lastSearch: null
    },
    currentDate: dataUtils.getTodayDateString(), // Currently viewed date for instances
    navigationHistory: [], // For date navigation history
    preloadDates: [], // Dates to preload for performance
    stats: {
      daily: new Map(), // Date -> daily stats
      weekly: new Map(), // Week -> weekly stats  
      monthly: new Map() // Month -> monthly stats
    }
  },
  dailySchedules: new Map(), // Date string -> schedule override
  
  // UI state
  loading: {
    tasks: false,
    settings: false,
    saving: false
  },
  
  // Offline state
  isOnline: navigator.onLine,
  pendingSyncActions: [],
  templateOperationQueue: [], // Queue for offline template operations
  instanceOperationQueue: [], // Queue for offline instance operations
  
  // Multi-tab synchronization
  tabSyncEnabled: true,
  lastSyncTimestamp: new Date().toISOString(),
  
  // Real-time updates
  lastUpdated: new Date().toISOString(),
  
  // Search and filters
  searchQuery: '',
  activeFilters: {
    showCompleted: true,
    showSkipped: true,
    timeWindow: 'all', // 'all', 'morning', 'afternoon', 'evening'
    mandatory: 'all' // 'all', 'mandatory', 'skippable'
  }
};

/**
 * Event Contract (unchanged)
 *
 * Emission:
 * - `notifyStateChange(type: string, payload: any)`
 *   - Broadcasts to specific listeners and global (`*`) listeners.
 *   - Also mirrors via BroadcastChannel using `state-${type}`.
 *
 * Subscription:
 * - `stateListeners.on(type: string, fn: (payload) => void)`
 * - `stateListeners.off(type: string, fn)`
 * - `stateListeners.onAll(fn: ({ type, data }) => void)` — wildcard for all events
 *
 * Supported event types (from current state.js usage):
 * - user, settings, view, date, taskTemplates, taskTemplateMetadata,
 *   templateUpdate, templateRemove, taskTemplateFilters,
 *   taskTemplatePagination, taskTemplateSearch, taskTemplateCacheCleared,
 *   templateOperationQueued, templateOperationQueueCleared, taskInstances,
 *   taskInstanceMetadata, instanceUpdate, instanceRemove, taskInstanceFilters,
 *   taskInstanceSearch, taskInstanceCurrentDate, taskInstanceNavigation,
 *   taskInstancePreloadDates, taskInstanceCacheCleared, instanceOperationQueued,
 *   instanceOperationQueueCleared, taskInstanceStats, instanceBatchUpdate,
 *   dailySchedules, loading, online, search, filters, pendingSync
 */

// --- Event bus implementation (moved from public/js/state.js) ---
function sanitizeDataForBroadcast(data) {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    try {
      JSON.stringify(data);
      return data.map(item => sanitizeDataForBroadcast(item));
    } catch (e) {
      return [];
    }
  }
  if (typeof data !== 'object') return data;
  if (data instanceof Map) {
    const obj = {};
    data.forEach((value, key) => {
      obj[key] = sanitizeDataForBroadcast(value);
    });
    return obj;
  }
  if (data instanceof Set) {
    return Array.from(data);
  }
  // Handle plain objects, avoid circular refs
  try {
    JSON.stringify(data);
    return data;
  } catch (e) {
    const sanitized = {};
    for (const key in data) {
      try {
        const value = data[key];
        if (typeof value !== 'function' && value !== undefined) {
          const serializedValue = sanitizeDataForBroadcast(value);
          JSON.stringify(serializedValue);
          sanitized[key] = serializedValue;
        }
      } catch (e2) {
        continue;
      }
    }
    return sanitized;
  }
}

function broadcastStateChange(type, data) {
  if (appState.tabSyncEnabled && typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('daily-ai-state');
      // Special-case 'user' payloads (Firebase Auth user has non-cloneable functions)
      const payload = (type === 'user' && data) ? {
        uid: data.uid,
        email: data.email || null,
        displayName: data.displayName || null,
        photoURL: data.photoURL || null,
        emailVerified: !!data.emailVerified
      } : data;
      const sanitizedData = sanitizeDataForBroadcast(payload);
      channel.postMessage({
        type: `state-${type}`,
        data: sanitizedData,
        timestamp: new Date().toISOString(),
        source: 'state-manager'
      });
    } catch (error) {
      console.warn('Failed to broadcast state change:', error);
    }
  }
}

const stateChangeListeners = new Map();

export function notifyStateChange(type, data) {
  const listeners = stateChangeListeners.get(type) || [];
  listeners.forEach(callback => {
    try {
      callback(data);
    } catch (error) {
      console.error(`Error in state change listener for ${type}:`, error);
    }
  });

  const globalListeners = stateChangeListeners.get('*') || [];
  globalListeners.forEach(callback => {
    try {
      callback({ type, data });
    } catch (error) {
      console.error('Error in global state change listener:', error);
    }
  });

  broadcastStateChange(type, data);
}

export const stateListeners = {
  on: (type, callback) => {
    if (!stateChangeListeners.has(type)) {
      stateChangeListeners.set(type, []);
    }
    stateChangeListeners.get(type).push(callback);
  },
  off: (type, callback) => {
    const listeners = stateChangeListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index >= 0) listeners.splice(index, 1);
    }
  },
  onAll: (callback) => {
    // wildcard subscription
    stateListeners.on('*', callback);
  }
};
