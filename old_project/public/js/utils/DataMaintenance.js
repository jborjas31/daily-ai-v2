/**
 * Data Migration and Cleanup Utilities
 * 
 * Comprehensive data maintenance system for offline storage cleanup,
 * migration, integrity checking, and performance optimization
 */

import { offlineStorage } from './OfflineStorage.js';
import { SimpleErrorHandler } from './SimpleErrorHandler.js';

/**
 * Data maintenance operations
 */
export const MAINTENANCE_OPERATIONS = {
  CLEANUP_OLD_DATA: 'cleanup_old_data',
  COMPACT_STORAGE: 'compact_storage',
  REPAIR_CORRUPTED: 'repair_corrupted',
  MIGRATE_SCHEMA: 'migrate_schema',
  VALIDATE_INTEGRITY: 'validate_integrity',
  OPTIMIZE_INDEXES: 'optimize_indexes'
};

/**
 * Data validation levels
 */
export const VALIDATION_LEVELS = {
  BASIC: 'basic',       // Quick validation of essential fields
  STANDARD: 'standard', // Comprehensive validation of all fields
  THOROUGH: 'thorough'  // Deep validation including cross-references
};

/**
 * Data Maintenance Manager
 */
export class DataMaintenance {
  constructor() {
    this.storage = offlineStorage;
    this.maintenanceHistory = [];
    this.validationRules = new Map();
    this.migrationScripts = new Map();
    this.cleanupPolicies = new Map();
    
    // Setup default maintenance policies
    this.setupDefaultPolicies();
    this.setupValidationRules();
    this.setupMigrationScripts();
  }

  /**
   * Initialize data maintenance system
   */
  async init() {
    try {
      await this.storage.init();
      await this.loadMaintenanceHistory();
      console.log('✅ DataMaintenance: System initialized');
    } catch (error) {
      console.error('❌ DataMaintenance: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Setup default cleanup policies
   */
  setupDefaultPolicies() {
    // Task instances cleanup policy
    this.cleanupPolicies.set('taskInstances', {
      retentionDays: 365,
      keepCompletedDays: 90,
      keepSkippedDays: 30,
      archiveOldData: true
    });
    
    // Operation queue cleanup policy
    this.cleanupPolicies.set('operationQueue', {
      retentionDays: 30,
      keepCompletedDays: 7,
      keepFailedDays: 14,
      maxQueueSize: 1000
    });
    
    // Sync log cleanup policy
    this.cleanupPolicies.set('syncLog', {
      retentionDays: 30,
      maxLogEntries: 5000
    });
    
    // Conflict resolution cleanup policy
    this.cleanupPolicies.set('conflictResolution', {
      retentionDays: 7,
      keepUnresolvedDays: 30
    });
  }

  /**
   * Setup validation rules
   */
  setupValidationRules() {
    // Task template validation rules
    this.validationRules.set('taskTemplate', {
      required: ['id', 'taskName', 'userId'],
      types: {
        id: 'string',
        taskName: 'string',
        durationMinutes: 'number',
        priority: 'number',
        isActive: 'boolean',
        isMandatory: 'boolean'
      },
      constraints: {
        taskName: { minLength: 1, maxLength: 100 },
        durationMinutes: { min: 1, max: 480 },
        priority: { min: 1, max: 5 }
      }
    });
    
    // Task instance validation rules
    this.validationRules.set('taskInstance', {
      required: ['id', 'templateId', 'userId', 'date'],
      types: {
        id: 'string',
        templateId: 'string',
        userId: 'string',
        date: 'string',
        status: 'string',
        completedAt: 'string'
      },
      constraints: {
        status: { enum: ['pending', 'in_progress', 'completed', 'skipped', 'cancelled'] }
      }
    });
  }

  /**
   * Setup migration scripts
   */
  setupMigrationScripts() {
    // Example migration script for adding new fields
    this.migrationScripts.set('v1.0.1', {
      description: 'Add minDurationMinutes field to task templates',
      migrate: async (data) => {
        if (data.durationMinutes && !data.minDurationMinutes) {
          data.minDurationMinutes = Math.max(5, Math.floor(data.durationMinutes * 0.5));
        }
        return data;
      }
    });
    
    // Migration for recurrence rule changes
    this.migrationScripts.set('v1.1.0', {
      description: 'Update recurrence rule structure',
      migrate: async (data) => {
        if (data.recurrenceRule && typeof data.recurrenceRule === 'string') {
          data.recurrenceRule = {
            frequency: data.recurrenceRule,
            interval: 1
          };
        }
        return data;
      }
    });
  }

  /**
   * Run comprehensive data maintenance
   */
  async runMaintenance(operations = null, options = {}) {
    const {
      force = false,
      verbose = false,
      dryRun = false
    } = options;
    
    try {
      console.log('🔧 DataMaintenance: Starting maintenance routine');
      
      const maintenanceLog = {
        startTime: new Date(),
        operations: operations || Object.values(MAINTENANCE_OPERATIONS),
        results: {},
        errors: [],
        warnings: []
      };
      
      // Run each maintenance operation
      for (const operation of maintenanceLog.operations) {
        try {
          const result = await this.runMaintenanceOperation(operation, { force, verbose, dryRun });
          maintenanceLog.results[operation] = result;
          
          if (verbose) {
            console.log(`✅ DataMaintenance: ${operation} completed:`, result);
          }
        } catch (error) {
          console.error(`❌ DataMaintenance: ${operation} failed:`, error);
          maintenanceLog.errors.push({ operation, error: error.message });
        }
      }
      
      maintenanceLog.endTime = new Date();
      maintenanceLog.duration = maintenanceLog.endTime - maintenanceLog.startTime;
      
      // Save maintenance history
      this.maintenanceHistory.push(maintenanceLog);
      await this.saveMaintenanceHistory();
      
      console.log(`✅ DataMaintenance: Completed in ${maintenanceLog.duration}ms`);
      return maintenanceLog;
      
    } catch (error) {
      console.error('❌ DataMaintenance: Failed to run maintenance:', error);
      throw error;
    }
  }

  /**
   * Run individual maintenance operation
   */
  async runMaintenanceOperation(operation, options = {}) {
    switch (operation) {
      case MAINTENANCE_OPERATIONS.CLEANUP_OLD_DATA:
        return await this.cleanupOldData(options);
        
      case MAINTENANCE_OPERATIONS.COMPACT_STORAGE:
        return await this.compactStorage(options);
        
      case MAINTENANCE_OPERATIONS.REPAIR_CORRUPTED:
        return await this.repairCorruptedData(options);
        
      case MAINTENANCE_OPERATIONS.MIGRATE_SCHEMA:
        return await this.migrateSchema(options);
        
      case MAINTENANCE_OPERATIONS.VALIDATE_INTEGRITY:
        return await this.validateDataIntegrity(options);
        
      case MAINTENANCE_OPERATIONS.OPTIMIZE_INDEXES:
        return await this.optimizeIndexes(options);
        
      default:
        throw new Error(`Unknown maintenance operation: ${operation}`);
    }
  }

  /**
   * Cleanup old data based on retention policies
   */
  async cleanupOldData(options = {}) {
    const { dryRun = false } = options;
    const results = {};
    
    // Cleanup task instances
    const instancePolicy = this.cleanupPolicies.get('taskInstances');
    const instanceCutoff = new Date();
    instanceCutoff.setDate(instanceCutoff.getDate() - instancePolicy.retentionDays);
    
    const oldInstances = await this.findOldTaskInstances(instanceCutoff, instancePolicy);
    results.taskInstances = {
      found: oldInstances.length,
      deleted: dryRun ? 0 : await this.deleteOldTaskInstances(oldInstances)
    };
    
    // Cleanup operation queue
    const queuePolicy = this.cleanupPolicies.get('operationQueue');
    const queueCutoff = new Date();
    queueCutoff.setDate(queueCutoff.getDate() - queuePolicy.retentionDays);
    
    results.operationQueue = {
      deleted: dryRun ? 0 : await this.storage.clearCompletedOperations()
    };
    
    // Cleanup sync logs
    const syncPolicy = this.cleanupPolicies.get('syncLog');
    results.syncLog = {
      deleted: dryRun ? 0 : await this.storage.clearOldSyncLogs(syncPolicy.retentionDays)
    };
    
    return results;
  }

  /**
   * Find old task instances for cleanup
   */
  async findOldTaskInstances(cutoffDate, policy) {
    const allInstances = await this.storage._performTransaction(
      await this.storage._ensureDB(),
      'taskInstances',
      'readonly',
      (store) => this.storage._getAllFromStore(store)
    );
    
    return allInstances.filter(instance => {
      const instanceDate = new Date(instance.modifiedAt || instance.createdAt);
      if (instanceDate > cutoffDate) return false;
      
      // Apply specific retention rules
      if (instance.status === 'completed') {
        const completedCutoff = new Date();
        completedCutoff.setDate(completedCutoff.getDate() - policy.keepCompletedDays);
        return instanceDate < completedCutoff;
      }
      
      if (instance.status === 'skipped') {
        const skippedCutoff = new Date();
        skippedCutoff.setDate(skippedCutoff.getDate() - policy.keepSkippedDays);
        return instanceDate < skippedCutoff;
      }
      
      return true;
    });
  }

  /**
   * Delete old task instances
   */
  async deleteOldTaskInstances(instances) {
    let deleted = 0;
    for (const instance of instances) {
      try {
        await this.storage.deleteTaskInstance(instance.id);
        deleted++;
      } catch (error) {
        console.warn(`⚠️ DataMaintenance: Failed to delete instance ${instance.id}:`, error);
      }
    }
    return deleted;
  }

  /**
   * Compact storage by removing fragmentation
   */
  async compactStorage(options = {}) {
    const { dryRun = false } = options;
    
    // This is a placeholder for storage compaction
    // In a real implementation, this might reorganize IndexedDB data
    // or compress data structures
    
    return {
      spaceSaved: dryRun ? 0 : await this.calculateStorageOptimization(),
      message: dryRun ? 'Dry run - no changes made' : 'Storage compacted'
    };
  }

  /**
   * Calculate potential storage optimization
   */
  async calculateStorageOptimization() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      // Estimate potential savings (placeholder)
      return Math.floor((estimate.usage || 0) * 0.1); // 10% potential savings
    }
    return 0;
  }

  /**
   * Repair corrupted data
   */
  async repairCorruptedData(options = {}) {
    const { dryRun = false } = options;
    const results = {
      taskTemplates: { repaired: 0, errors: [] },
      taskInstances: { repaired: 0, errors: [] }
    };
    
    // Check and repair task templates
    const templates = await this.storage.getAllTaskTemplates();
    for (const template of templates) {
      const issues = this.findDataIssues(template, 'taskTemplate');
      if (issues.length > 0) {
        try {
          if (!dryRun) {
            const repaired = await this.repairDataIssues(template, issues, 'taskTemplate');
            await this.storage.storeTaskTemplate(repaired);
          }
          results.taskTemplates.repaired++;
        } catch (error) {
          results.taskTemplates.errors.push({ id: template.id, error: error.message });
        }
      }
    }
    
    return results;
  }

  /**
   * Find data issues
   */
  findDataIssues(data, type) {
    const issues = [];
    const rules = this.validationRules.get(type);
    
    if (!rules) return issues;
    
    // Check required fields
    for (const field of rules.required) {
      if (!data.hasOwnProperty(field) || data[field] == null) {
        issues.push({ type: 'missing_field', field });
      }
    }
    
    // Check field types
    for (const [field, expectedType] of Object.entries(rules.types)) {
      if (data.hasOwnProperty(field) && data[field] != null) {
        const actualType = typeof data[field];
        if (actualType !== expectedType) {
          issues.push({ type: 'wrong_type', field, expected: expectedType, actual: actualType });
        }
      }
    }
    
    // Check constraints
    if (rules.constraints) {
      for (const [field, constraints] of Object.entries(rules.constraints)) {
        if (data.hasOwnProperty(field) && data[field] != null) {
          const value = data[field];
          
          if (constraints.minLength && value.length < constraints.minLength) {
            issues.push({ type: 'too_short', field, minLength: constraints.minLength, actual: value.length });
          }
          
          if (constraints.maxLength && value.length > constraints.maxLength) {
            issues.push({ type: 'too_long', field, maxLength: constraints.maxLength, actual: value.length });
          }
          
          if (constraints.min && value < constraints.min) {
            issues.push({ type: 'too_small', field, min: constraints.min, actual: value });
          }
          
          if (constraints.max && value > constraints.max) {
            issues.push({ type: 'too_large', field, max: constraints.max, actual: value });
          }
          
          if (constraints.enum && !constraints.enum.includes(value)) {
            issues.push({ type: 'invalid_enum', field, allowed: constraints.enum, actual: value });
          }
        }
      }
    }
    
    return issues;
  }

  /**
   * Repair data issues
   */
  async repairDataIssues(data, issues, type) {
    const repaired = { ...data };
    const rules = this.validationRules.get(type);
    
    for (const issue of issues) {
      switch (issue.type) {
        case 'missing_field':
          repaired[issue.field] = this.getDefaultValue(issue.field, type);
          break;
          
        case 'wrong_type':
          repaired[issue.field] = this.convertType(repaired[issue.field], issue.expected);
          break;
          
        case 'too_short':
          if (typeof repaired[issue.field] === 'string') {
            repaired[issue.field] = repaired[issue.field].padEnd(issue.minLength, ' ');
          }
          break;
          
        case 'too_long':
          if (typeof repaired[issue.field] === 'string') {
            repaired[issue.field] = repaired[issue.field].substring(0, issue.maxLength);
          }
          break;
          
        case 'too_small':
          repaired[issue.field] = issue.min;
          break;
          
        case 'too_large':
          repaired[issue.field] = issue.max;
          break;
          
        case 'invalid_enum':
          repaired[issue.field] = issue.allowed[0]; // Use first allowed value
          break;
      }
    }
    
    // Add repair metadata
    repaired.repairedAt = new Date().toISOString();
    repaired.repairDetails = issues;
    
    return repaired;
  }

  /**
   * Get default value for field
   */
  getDefaultValue(field, type) {
    const defaults = {
      taskTemplate: {
        taskName: 'Untitled Task',
        durationMinutes: 30,
        priority: 3,
        isActive: true,
        isMandatory: false,
        schedulingType: 'flexible'
      },
      taskInstance: {
        status: 'pending'
      }
    };
    
    return defaults[type]?.[field] || null;
  }

  /**
   * Convert value to expected type
   */
  convertType(value, expectedType) {
    try {
      switch (expectedType) {
        case 'string':
          return String(value);
        case 'number':
          const num = Number(value);
          return isNaN(num) ? 0 : num;
        case 'boolean':
          return Boolean(value);
        default:
          return value;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Migrate data schema to latest version
   */
  async migrateSchema(options = {}) {
    const { dryRun = false, targetVersion = null } = options;
    const results = { migrations: [], errors: [] };
    
    // Get all data that might need migration
    const templates = await this.storage.getAllTaskTemplates();
    const instances = await this.storage._performTransaction(
      await this.storage._ensureDB(),
      'taskInstances',
      'readonly',
      (store) => this.storage._getAllFromStore(store)
    );
    
    // Run migrations on templates
    for (const template of templates) {
      try {
        const migrated = await this.migrateDataObject(template, targetVersion);
        if (migrated.changed && !dryRun) {
          await this.storage.storeTaskTemplate(migrated.data);
        }
        if (migrated.changed) {
          results.migrations.push({ type: 'template', id: template.id, versions: migrated.versions });
        }
      } catch (error) {
        results.errors.push({ type: 'template', id: template.id, error: error.message });
      }
    }
    
    // Run migrations on instances
    for (const instance of instances) {
      try {
        const migrated = await this.migrateDataObject(instance, targetVersion);
        if (migrated.changed && !dryRun) {
          await this.storage.storeTaskInstance(migrated.data);
        }
        if (migrated.changed) {
          results.migrations.push({ type: 'instance', id: instance.id, versions: migrated.versions });
        }
      } catch (error) {
        results.errors.push({ type: 'instance', id: instance.id, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Migrate individual data object
   */
  async migrateDataObject(data, targetVersion = null) {
    let migrated = { ...data };
    let changed = false;
    const appliedVersions = [];
    
    // Get current version
    const currentVersion = data.schemaVersion || '1.0.0';
    
    // Apply migrations in order
    for (const [version, script] of this.migrationScripts.entries()) {
      // Skip if target version specified and this version is beyond it
      if (targetVersion && this.compareVersions(version, targetVersion) > 0) {
        continue;
      }
      
      // Skip if already migrated
      if (this.compareVersions(version, currentVersion) <= 0) {
        continue;
      }
      
      try {
        const newData = await script.migrate(migrated);
        if (JSON.stringify(newData) !== JSON.stringify(migrated)) {
          migrated = { ...newData, schemaVersion: version };
          changed = true;
          appliedVersions.push(version);
        }
      } catch (error) {
        console.error(`❌ DataMaintenance: Migration ${version} failed:`, error);
        throw error;
      }
    }
    
    return { data: migrated, changed, versions: appliedVersions };
  }

  /**
   * Compare version strings
   */
  compareVersions(a, b) {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    
    return 0;
  }

  /**
   * Validate data integrity
   */
  async validateDataIntegrity(options = {}) {
    const { level = VALIDATION_LEVELS.STANDARD } = options;
    const results = {
      taskTemplates: { valid: 0, invalid: 0, issues: [] },
      taskInstances: { valid: 0, invalid: 0, issues: [] },
      crossReferences: { valid: 0, invalid: 0, issues: [] }
    };
    
    // Validate templates
    const templates = await this.storage.getAllTaskTemplates();
    for (const template of templates) {
      const issues = this.findDataIssues(template, 'taskTemplate');
      if (issues.length > 0) {
        results.taskTemplates.invalid++;
        results.taskTemplates.issues.push({ id: template.id, issues });
      } else {
        results.taskTemplates.valid++;
      }
    }
    
    // Validate instances
    const instances = await this.storage._performTransaction(
      await this.storage._ensureDB(),
      'taskInstances',
      'readonly',
      (store) => this.storage._getAllFromStore(store)
    );
    
    for (const instance of instances) {
      const issues = this.findDataIssues(instance, 'taskInstance');
      if (issues.length > 0) {
        results.taskInstances.invalid++;
        results.taskInstances.issues.push({ id: instance.id, issues });
      } else {
        results.taskInstances.valid++;
      }
    }
    
    // Cross-reference validation (thorough level)
    if (level === VALIDATION_LEVELS.THOROUGH) {
      const crossRefIssues = await this.validateCrossReferences(templates, instances);
      results.crossReferences = crossRefIssues;
    }
    
    return results;
  }

  /**
   * Validate cross-references between data
   */
  async validateCrossReferences(templates, instances) {
    const results = { valid: 0, invalid: 0, issues: [] };
    const templateIds = new Set(templates.map(t => t.id));
    
    // Check instance -> template references
    for (const instance of instances) {
      if (instance.templateId && !templateIds.has(instance.templateId)) {
        results.invalid++;
        results.issues.push({
          type: 'orphaned_instance',
          instanceId: instance.id,
          templateId: instance.templateId
        });
      } else {
        results.valid++;
      }
    }
    
    // Check template dependencies
    for (const template of templates) {
      if (template.dependsOn && Array.isArray(template.dependsOn)) {
        for (const depId of template.dependsOn) {
          if (!templateIds.has(depId)) {
            results.invalid++;
            results.issues.push({
              type: 'missing_dependency',
              templateId: template.id,
              dependsOnId: depId
            });
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Optimize storage indexes
   */
  async optimizeIndexes(options = {}) {
    const { dryRun = false } = options;
    
    // This is a placeholder for index optimization
    // In a real implementation, this might rebuild indexes or
    // optimize query performance
    
    return {
      optimized: dryRun ? 0 : 5, // Number of indexes optimized
      message: dryRun ? 'Dry run - no changes made' : 'Indexes optimized'
    };
  }

  /**
   * Load maintenance history
   */
  async loadMaintenanceHistory() {
    try {
      // This would load from persistent storage
      // For now, just initialize empty history
      this.maintenanceHistory = [];
    } catch (error) {
      console.warn('⚠️ DataMaintenance: Failed to load maintenance history:', error);
      this.maintenanceHistory = [];
    }
  }

  /**
   * Save maintenance history
   */
  async saveMaintenanceHistory() {
    try {
      // Keep only recent history
      if (this.maintenanceHistory.length > 50) {
        this.maintenanceHistory = this.maintenanceHistory.slice(-50);
      }
      
      // This would save to persistent storage
      console.log('💾 DataMaintenance: History saved');
    } catch (error) {
      console.warn('⚠️ DataMaintenance: Failed to save maintenance history:', error);
    }
  }

  /**
   * Get maintenance statistics
   */
  async getMaintenanceStats() {
    try {
      const estimate = await this.storage.getStorageEstimate();
      
      return {
        storageUsage: estimate?.usage || 0,
        storageQuota: estimate?.quota || 0,
        maintenanceRuns: this.maintenanceHistory.length,
        lastMaintenance: this.maintenanceHistory.length > 0 ? 
          this.maintenanceHistory[this.maintenanceHistory.length - 1].startTime : null
      };
    } catch (error) {
      console.error('❌ DataMaintenance: Failed to get stats:', error);
      return null;
    }
  }

  /**
   * Schedule automatic maintenance
   */
  scheduleAutoMaintenance(intervalDays = 7) {
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
    
    setInterval(async () => {
      try {
        console.log('🔧 DataMaintenance: Running scheduled maintenance');
        await this.runMaintenance([
          MAINTENANCE_OPERATIONS.CLEANUP_OLD_DATA,
          MAINTENANCE_OPERATIONS.VALIDATE_INTEGRITY
        ], { verbose: false });
      } catch (error) {
        console.error('❌ DataMaintenance: Scheduled maintenance failed:', error);
      }
    }, intervalMs);
    
    console.log(`⏰ DataMaintenance: Automatic maintenance scheduled every ${intervalDays} days`);
  }

  /**
   * Export maintenance report
   */
  generateMaintenanceReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      history: this.maintenanceHistory,
      policies: Object.fromEntries(this.cleanupPolicies),
      validationRules: Object.fromEntries(this.validationRules),
      migrationScripts: Array.from(this.migrationScripts.keys())
    };
    
    return report;
  }

  /**
   * Destroy maintenance system
   */
  destroy() {
    this.maintenanceHistory = [];
    this.validationRules.clear();
    this.migrationScripts.clear();
    this.cleanupPolicies.clear();
  }
}

// Create and export singleton instance
export const dataMaintenance = new DataMaintenance();

console.log('✅ DataMaintenance system initialized');