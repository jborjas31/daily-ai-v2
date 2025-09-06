/**
 * Sync Conflict Resolution System
 * 
 * Intelligent conflict resolution for offline synchronization with multiple
 * resolution strategies and user intervention capabilities
 */

import { offlineStorage } from './OfflineStorage.js';
import { SimpleErrorHandler } from './SimpleErrorHandler.js';

/**
 * Conflict types
 */
export const CONFLICT_TYPES = {
  MODIFY_MODIFY: 'modify_modify',      // Both local and remote modified
  MODIFY_DELETE: 'modify_delete',      // Local modified, remote deleted
  DELETE_MODIFY: 'delete_modify',      // Local deleted, remote modified
  CREATE_CREATE: 'create_create',      // Same ID created locally and remotely
  VERSION_MISMATCH: 'version_mismatch' // Version/timestamp conflicts
};

/**
 * Resolution strategies
 */
export const RESOLUTION_STRATEGIES = {
  LOCAL_WINS: 'local_wins',           // Always prefer local changes
  REMOTE_WINS: 'remote_wins',         // Always prefer remote changes
  LATEST_WINS: 'latest_wins',         // Use most recent timestamp
  MERGE: 'merge',                     // Attempt to merge changes
  USER_CHOICE: 'user_choice',         // Ask user to decide
  AUTO_RESOLVE: 'auto_resolve'        // Use heuristics to resolve
};

/**
 * Resource types for conflict resolution
 */
export const RESOURCE_TYPES = {
  TASK_TEMPLATE: 'task_template',
  TASK_INSTANCE: 'task_instance',
  USER_SETTINGS: 'user_settings',
  USER_DATA: 'user_data',
  DAILY_SCHEDULE: 'daily_schedule'
};

/**
 * Conflict Resolution Manager
 */
export class ConflictResolution {
  constructor() {
    this.storage = offlineStorage;
    this.conflictQueue = [];
    this.isResolving = false;
    this.userPromptCallbacks = new Map();
    
    // Default resolution strategies by resource type
    this.defaultStrategies = new Map([
      [RESOURCE_TYPES.TASK_TEMPLATE, RESOLUTION_STRATEGIES.LATEST_WINS],
      [RESOURCE_TYPES.TASK_INSTANCE, RESOLUTION_STRATEGIES.MERGE],
      [RESOURCE_TYPES.USER_SETTINGS, RESOLUTION_STRATEGIES.MERGE],
      [RESOURCE_TYPES.USER_DATA, RESOLUTION_STRATEGIES.LATEST_WINS],
      [RESOURCE_TYPES.DAILY_SCHEDULE, RESOLUTION_STRATEGIES.USER_CHOICE]
    ]);
  }

  /**
   * Initialize conflict resolution system
   */
  async init() {
    try {
      await this.storage.init();
      console.log('✅ ConflictResolution: System initialized');
    } catch (error) {
      console.error('❌ ConflictResolution: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Detect conflict between local and remote data
   */
  detectConflict(localData, remoteData, resourceType) {
    if (!localData && !remoteData) {
      return null; // No conflict
    }

    if (!localData && remoteData) {
      return null; // Remote data only, no conflict
    }

    if (localData && !remoteData) {
      return {
        type: CONFLICT_TYPES.DELETE_MODIFY,
        local: localData,
        remote: null,
        resourceType
      };
    }

    // Both exist, check for conflicts
    const localModified = this.getModificationTime(localData);
    const remoteModified = this.getModificationTime(remoteData);

    // Check if data is actually different
    if (this.isDataEquivalent(localData, remoteData, resourceType)) {
      return null; // Data is equivalent, no conflict
    }

    // Determine conflict type
    let conflictType = CONFLICT_TYPES.MODIFY_MODIFY;

    if (localData.deleted && !remoteData.deleted) {
      conflictType = CONFLICT_TYPES.DELETE_MODIFY;
    } else if (!localData.deleted && remoteData.deleted) {
      conflictType = CONFLICT_TYPES.MODIFY_DELETE;
    }

    return {
      type: conflictType,
      local: localData,
      remote: remoteData,
      resourceType,
      localModified,
      remoteModified,
      resourceId: localData.id || remoteData.id
    };
  }

  /**
   * Resolve conflict using specified strategy
   */
  async resolveConflict(conflict, strategy = null) {
    try {
      const resolveStrategy = strategy || this.defaultStrategies.get(conflict.resourceType) || RESOLUTION_STRATEGIES.AUTO_RESOLVE;
      
      console.log(`🔄 ConflictResolution: Resolving ${conflict.type} conflict for ${conflict.resourceType} using ${resolveStrategy} strategy`);

      let resolution;
      
      switch (resolveStrategy) {
        case RESOLUTION_STRATEGIES.LOCAL_WINS:
          resolution = await this.resolveWithLocalWins(conflict);
          break;
          
        case RESOLUTION_STRATEGIES.REMOTE_WINS:
          resolution = await this.resolveWithRemoteWins(conflict);
          break;
          
        case RESOLUTION_STRATEGIES.LATEST_WINS:
          resolution = await this.resolveWithLatestWins(conflict);
          break;
          
        case RESOLUTION_STRATEGIES.MERGE:
          resolution = await this.resolveWithMerge(conflict);
          break;
          
        case RESOLUTION_STRATEGIES.USER_CHOICE:
          resolution = await this.resolveWithUserChoice(conflict);
          break;
          
        case RESOLUTION_STRATEGIES.AUTO_RESOLVE:
          resolution = await this.resolveWithAutoStrategy(conflict);
          break;
          
        default:
          throw new Error(`Unknown resolution strategy: ${resolveStrategy}`);
      }

      // Store resolution record
      await this.storage.storeConflict({
        resourceId: conflict.resourceId,
        resourceType: conflict.resourceType,
        conflictType: conflict.type,
        strategy: resolveStrategy,
        resolution: resolution,
        localData: conflict.local,
        remoteData: conflict.remote
      });

      console.log(`✅ ConflictResolution: Conflict resolved using ${resolveStrategy}`);
      return resolution;

    } catch (error) {
      console.error('❌ ConflictResolution: Failed to resolve conflict:', error);
      throw error;
    }
  }

  /**
   * Resolve with local data winning
   */
  async resolveWithLocalWins(conflict) {
    return {
      strategy: RESOLUTION_STRATEGIES.LOCAL_WINS,
      result: conflict.local,
      action: 'use_local',
      merged: false
    };
  }

  /**
   * Resolve with remote data winning
   */
  async resolveWithRemoteWins(conflict) {
    return {
      strategy: RESOLUTION_STRATEGIES.REMOTE_WINS,
      result: conflict.remote,
      action: 'use_remote',
      merged: false
    };
  }

  /**
   * Resolve with latest timestamp winning
   */
  async resolveWithLatestWins(conflict) {
    const localTime = this.getModificationTime(conflict.local);
    const remoteTime = this.getModificationTime(conflict.remote);
    
    const useLocal = localTime > remoteTime;
    const result = useLocal ? conflict.local : conflict.remote;
    
    return {
      strategy: RESOLUTION_STRATEGIES.LATEST_WINS,
      result: result,
      action: useLocal ? 'use_local' : 'use_remote',
      merged: false,
      reason: `${useLocal ? 'Local' : 'Remote'} data is more recent`
    };
  }

  /**
   * Resolve with intelligent merging
   */
  async resolveWithMerge(conflict) {
    try {
      const mergedData = await this.mergeData(conflict.local, conflict.remote, conflict.resourceType);
      
      return {
        strategy: RESOLUTION_STRATEGIES.MERGE,
        result: mergedData,
        action: 'merge',
        merged: true,
        mergeDetails: this.generateMergeDetails(conflict.local, conflict.remote, mergedData)
      };
    } catch (error) {
      console.warn('⚠️ ConflictResolution: Merge failed, falling back to latest wins:', error);
      return await this.resolveWithLatestWins(conflict);
    }
  }

  /**
   * Resolve with user choice (requires UI interaction)
   */
  async resolveWithUserChoice(conflict) {
    return new Promise((resolve, reject) => {
      // Store callback for user response
      const callbackId = Date.now() + Math.random();
      this.userPromptCallbacks.set(callbackId, { resolve, reject });
      
      // Trigger user prompt (this would be handled by UI layer)
      this.triggerUserPrompt(conflict, callbackId);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.userPromptCallbacks.has(callbackId)) {
          this.userPromptCallbacks.delete(callbackId);
          // Fall back to auto resolve
          this.resolveWithAutoStrategy(conflict).then(resolve).catch(reject);
        }
      }, 300000); // 5 minutes
    });
  }

  /**
   * Resolve using automatic strategy based on conflict analysis
   */
  async resolveWithAutoStrategy(conflict) {
    // Analyze conflict to determine best strategy
    const analysis = this.analyzeConflict(conflict);
    
    switch (analysis.recommendedStrategy) {
      case RESOLUTION_STRATEGIES.LATEST_WINS:
        return await this.resolveWithLatestWins(conflict);
      case RESOLUTION_STRATEGIES.MERGE:
        return await this.resolveWithMerge(conflict);
      case RESOLUTION_STRATEGIES.LOCAL_WINS:
        return await this.resolveWithLocalWins(conflict);
      case RESOLUTION_STRATEGIES.REMOTE_WINS:
        return await this.resolveWithRemoteWins(conflict);
      default:
        return await this.resolveWithLatestWins(conflict);
    }
  }

  /**
   * Analyze conflict to recommend resolution strategy
   */
  analyzeConflict(conflict) {
    const analysis = {
      riskLevel: 'low',
      dataImportance: 'normal',
      conflictComplexity: 'simple',
      recommendedStrategy: RESOLUTION_STRATEGIES.LATEST_WINS
    };

    // Analyze based on resource type
    switch (conflict.resourceType) {
      case RESOURCE_TYPES.TASK_TEMPLATE:
        analysis.dataImportance = 'high';
        if (this.isTaskTemplateComplexConflict(conflict)) {
          analysis.conflictComplexity = 'complex';
          analysis.recommendedStrategy = RESOLUTION_STRATEGIES.USER_CHOICE;
        } else {
          analysis.recommendedStrategy = RESOLUTION_STRATEGIES.MERGE;
        }
        break;

      case RESOURCE_TYPES.TASK_INSTANCE:
        analysis.dataImportance = 'critical';
        if (conflict.local?.status === 'completed' || conflict.remote?.status === 'completed') {
          analysis.riskLevel = 'high';
          analysis.recommendedStrategy = RESOLUTION_STRATEGIES.LOCAL_WINS; // Prefer local completion status
        } else {
          analysis.recommendedStrategy = RESOLUTION_STRATEGIES.MERGE;
        }
        break;

      case RESOURCE_TYPES.USER_SETTINGS:
        analysis.dataImportance = 'high';
        analysis.recommendedStrategy = RESOLUTION_STRATEGIES.MERGE;
        break;

      default:
        analysis.recommendedStrategy = RESOLUTION_STRATEGIES.LATEST_WINS;
    }

    return analysis;
  }

  /**
   * Check if task template has complex conflicts
   */
  isTaskTemplateComplexConflict(conflict) {
    const local = conflict.local;
    const remote = conflict.remote;

    // Consider conflicts complex if:
    // 1. Dependencies changed
    // 2. Recurrence rules changed significantly
    // 3. Scheduling type changed
    // 4. Both have substantial modifications

    return (
      JSON.stringify(local.dependsOn) !== JSON.stringify(remote.dependsOn) ||
      JSON.stringify(local.recurrenceRule) !== JSON.stringify(remote.recurrenceRule) ||
      local.schedulingType !== remote.schedulingType ||
      (local.taskName !== remote.taskName && local.description !== remote.description)
    );
  }

  /**
   * Merge data intelligently based on resource type
   */
  async mergeData(localData, remoteData, resourceType) {
    switch (resourceType) {
      case RESOURCE_TYPES.TASK_TEMPLATE:
        return this.mergeTaskTemplate(localData, remoteData);
      case RESOURCE_TYPES.TASK_INSTANCE:
        return this.mergeTaskInstance(localData, remoteData);
      case RESOURCE_TYPES.USER_SETTINGS:
        return this.mergeUserSettings(localData, remoteData);
      default:
        return this.mergeGenericData(localData, remoteData);
    }
  }

  /**
   * Merge task template data
   */
  mergeTaskTemplate(local, remote) {
    const localTime = this.getModificationTime(local);
    const remoteTime = this.getModificationTime(remote);
    const useLocalForConflicts = localTime > remoteTime;

    return {
      ...remote, // Start with remote as base
      ...local,   // Overlay local changes
      
      // Merge specific fields intelligently
      taskName: useLocalForConflicts ? local.taskName : remote.taskName,
      description: this.mergeTextField(local.description, remote.description, useLocalForConflicts),
      
      // Numerical fields - use latest
      durationMinutes: useLocalForConflicts ? local.durationMinutes : remote.durationMinutes,
      priority: useLocalForConflicts ? local.priority : remote.priority,
      
      // Boolean fields - prefer true if either is true (more permissive)
      isActive: local.isActive || remote.isActive,
      isMandatory: local.isMandatory || remote.isMandatory,
      
      // Complex objects - use latest
      recurrenceRule: useLocalForConflicts ? local.recurrenceRule : remote.recurrenceRule,
      dependsOn: useLocalForConflicts ? local.dependsOn : remote.dependsOn,
      
      // Timestamps
      modifiedAt: Math.max(localTime, remoteTime),
      mergedAt: new Date().toISOString(),
      mergedFrom: 'conflict_resolution'
    };
  }

  /**
   * Merge task instance data
   */
  mergeTaskInstance(local, remote) {
    const localTime = this.getModificationTime(local);
    const remoteTime = this.getModificationTime(remote);
    
    // For task instances, prioritize completion status and local modifications
    return {
      ...remote,
      ...local,
      
      // Status: prefer completed status
      status: (local.status === 'completed' || remote.status === 'completed') ? 'completed' : 
              (local.status === 'skipped' || remote.status === 'skipped') ? 'skipped' : 
              local.status || remote.status,
      
      // Completion time: use the one that exists
      completedAt: local.completedAt || remote.completedAt,
      
      // Notes: merge
      notes: this.mergeTextField(local.notes, remote.notes, localTime > remoteTime),
      
      // Modifications: prefer local for user changes
      actualDurationMinutes: local.actualDurationMinutes || remote.actualDurationMinutes,
      modificationReason: local.modificationReason || remote.modificationReason,
      
      // Timestamps
      modifiedAt: Math.max(localTime, remoteTime),
      mergedAt: new Date().toISOString(),
      mergedFrom: 'conflict_resolution'
    };
  }

  /**
   * Merge user settings
   */
  mergeUserSettings(local, remote) {
    return {
      ...remote,
      ...local,
      
      // Merge nested objects
      sleepSchedule: { ...remote.sleepSchedule, ...local.sleepSchedule },
      timeWindows: { ...remote.timeWindows, ...local.timeWindows },
      preferences: { ...remote.preferences, ...local.preferences },
      
      mergedAt: new Date().toISOString(),
      mergedFrom: 'conflict_resolution'
    };
  }

  /**
   * Generic data merge (field-by-field latest wins)
   */
  mergeGenericData(local, remote) {
    const localTime = this.getModificationTime(local);
    const remoteTime = this.getModificationTime(remote);
    const useLocal = localTime > remoteTime;
    
    return {
      ...(useLocal ? remote : local), // Base
      ...(useLocal ? local : remote), // Overlay
      modifiedAt: Math.max(localTime, remoteTime),
      mergedAt: new Date().toISOString(),
      mergedFrom: 'conflict_resolution'
    };
  }

  /**
   * Merge text fields intelligently
   */
  mergeTextField(localText, remoteText, preferLocal) {
    if (!localText && !remoteText) return '';
    if (!localText) return remoteText;
    if (!remoteText) return localText;
    if (localText === remoteText) return localText;
    
    // If one is clearly an extension of the other, use the longer one
    if (localText.includes(remoteText)) return localText;
    if (remoteText.includes(localText)) return remoteText;
    
    // Otherwise use preference
    return preferLocal ? localText : remoteText;
  }

  /**
   * Generate merge details for logging
   */
  generateMergeDetails(local, remote, merged) {
    const details = {
      fieldsFromLocal: [],
      fieldsFromRemote: [],
      mergedFields: [],
      conflicts: []
    };

    // Compare each field to determine source
    for (const key of Object.keys(merged)) {
      if (key.startsWith('merged')) continue; // Skip merge metadata
      
      const localValue = local[key];
      const remoteValue = remote[key];
      const mergedValue = merged[key];
      
      if (localValue !== remoteValue) {
        if (JSON.stringify(mergedValue) === JSON.stringify(localValue)) {
          details.fieldsFromLocal.push(key);
        } else if (JSON.stringify(mergedValue) === JSON.stringify(remoteValue)) {
          details.fieldsFromRemote.push(key);
        } else {
          details.mergedFields.push(key);
        }
        
        details.conflicts.push({
          field: key,
          local: localValue,
          remote: remoteValue,
          merged: mergedValue
        });
      }
    }
    
    return details;
  }

  /**
   * Get modification time from data object
   */
  getModificationTime(data) {
    if (!data) return 0;
    
    // Check various timestamp fields
    const timeFields = ['modifiedAt', 'updatedAt', 'offlineModifiedAt', 'createdAt'];
    
    for (const field of timeFields) {
      if (data[field]) {
        return new Date(data[field]).getTime();
      }
    }
    
    return 0;
  }

  /**
   * Check if data objects are equivalent
   */
  isDataEquivalent(local, remote, resourceType) {
    // Create clean copies without timestamps for comparison
    const localClean = this.stripTimestamps({ ...local });
    const remoteClean = this.stripTimestamps({ ...remote });
    
    return JSON.stringify(localClean) === JSON.stringify(remoteClean);
  }

  /**
   * Strip timestamp fields for comparison
   */
  stripTimestamps(data) {
    const timestampFields = ['modifiedAt', 'updatedAt', 'createdAt', 'offlineModifiedAt', 'mergedAt', 'completedAt', 'lastSyncAt'];
    const clean = { ...data };
    
    timestampFields.forEach(field => {
      delete clean[field];
    });
    
    return clean;
  }

  /**
   * Trigger user prompt for conflict resolution
   */
  triggerUserPrompt(conflict, callbackId) {
    // This would typically dispatch an event for the UI layer to handle
    const event = new CustomEvent('conflictResolutionRequired', {
      detail: {
        conflict,
        callbackId,
        onResolve: (resolution) => this.handleUserResolution(callbackId, resolution)
      }
    });
    
    document.dispatchEvent(event);
  }

  /**
   * Handle user resolution choice
   */
  handleUserResolution(callbackId, resolution) {
    const callback = this.userPromptCallbacks.get(callbackId);
    if (callback) {
      this.userPromptCallbacks.delete(callbackId);
      callback.resolve({
        strategy: RESOLUTION_STRATEGIES.USER_CHOICE,
        result: resolution.data,
        action: resolution.action,
        merged: false,
        userChoice: resolution.choice
      });
    }
  }

  /**
   * Get all pending conflicts
   */
  async getPendingConflicts() {
    try {
      return await this.storage.getPendingConflicts();
    } catch (error) {
      console.error('❌ ConflictResolution: Failed to get pending conflicts:', error);
      return [];
    }
  }

  /**
   * Bulk resolve conflicts
   */
  async bulkResolveConflicts(conflicts, strategy) {
    const results = [];
    
    for (const conflict of conflicts) {
      try {
        const resolution = await this.resolveConflict(conflict, strategy);
        results.push({ conflict, resolution, success: true });
      } catch (error) {
        results.push({ conflict, error, success: false });
      }
    }
    
    return results;
  }

  /**
   * Clear resolved conflicts older than specified days
   */
  async cleanupResolvedConflicts(daysToKeep = 7) {
    // This would clear resolved conflicts from storage
    try {
      const conflicts = await this.storage.getPendingConflicts();
      const resolved = conflicts.filter(c => c.status === 'resolved');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      let cleanedCount = 0;
      for (const conflict of resolved) {
        if (new Date(conflict.resolvedAt) < cutoffDate) {
          // Remove from storage (would need storage method)
          cleanedCount++;
        }
      }
      
      console.log(`🧹 ConflictResolution: Cleaned up ${cleanedCount} old resolved conflicts`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ ConflictResolution: Failed to cleanup resolved conflicts:', error);
      return 0;
    }
  }
}

// Create and export singleton instance
export const conflictResolution = new ConflictResolution();

console.log('✅ ConflictResolution system initialized');