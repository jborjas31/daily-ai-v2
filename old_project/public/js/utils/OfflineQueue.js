/**
 * Offline Queue Manager
 * 
 * Enhanced offline operation queue system with prioritization, retry logic,
 * and comprehensive recovery mechanisms for robust offline functionality
 */

import { offlineStorage } from './OfflineStorage.js';
import { SimpleErrorHandler } from './SimpleErrorHandler.js';

/**
 * Operation priorities
 */
export const OPERATION_PRIORITIES = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4,
  URGENT: 5
};

/**
 * Operation types
 */
export const OPERATION_TYPES = {
  // Task Template Operations
  CREATE_TEMPLATE: 'CREATE_TEMPLATE',
  UPDATE_TEMPLATE: 'UPDATE_TEMPLATE',
  DELETE_TEMPLATE: 'DELETE_TEMPLATE',
  DUPLICATE_TEMPLATE: 'DUPLICATE_TEMPLATE',
  ACTIVATE_TEMPLATE: 'ACTIVATE_TEMPLATE',
  DEACTIVATE_TEMPLATE: 'DEACTIVATE_TEMPLATE',
  BULK_ACTIVATE_TEMPLATES: 'BULK_ACTIVATE_TEMPLATES',
  BULK_DEACTIVATE_TEMPLATES: 'BULK_DEACTIVATE_TEMPLATES',
  
  // Task Instance Operations
  CREATE_INSTANCE: 'CREATE_INSTANCE',
  UPDATE_INSTANCE: 'UPDATE_INSTANCE',
  DELETE_INSTANCE: 'DELETE_INSTANCE',
  BATCH_CREATE_INSTANCES: 'BATCH_CREATE_INSTANCES',
  BATCH_UPDATE_INSTANCES: 'BATCH_UPDATE_INSTANCES',
  
  // Settings Operations
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  UPDATE_USER_DATA: 'UPDATE_USER_DATA',
  
  // Data Synchronization
  SYNC_TEMPLATES: 'SYNC_TEMPLATES',
  SYNC_INSTANCES: 'SYNC_INSTANCES',
  FULL_SYNC: 'FULL_SYNC'
};

/**
 * Operation statuses
 */
export const OPERATION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Offline Queue Manager Class
 */
export class OfflineQueue {
  constructor() {
    this.isProcessing = false;
    this.processingIntervalId = null;
    this.maxRetries = 5;
    this.baseRetryDelay = 1000; // 1 second
    this.maxRetryDelay = 30000; // 30 seconds
    this.processInterval = 5000; // 5 seconds
    this.operationHandlers = new Map();
    
    // Initialize storage
    this.storage = offlineStorage;
    
    // Setup operation handlers
    this.setupOperationHandlers();
  }

  /**
   * Initialize the queue system
   */
  async init() {
    try {
      await this.storage.init();
      this.startProcessing();
      console.log('✅ OfflineQueue: Queue system initialized');
    } catch (error) {
      console.error('❌ OfflineQueue: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Setup operation handlers
   */
  setupOperationHandlers() {
    // Import handlers dynamically to avoid circular dependencies
    this.operationHandlers.set(OPERATION_TYPES.CREATE_TEMPLATE, this.handleCreateTemplate.bind(this));
    this.operationHandlers.set(OPERATION_TYPES.UPDATE_TEMPLATE, this.handleUpdateTemplate.bind(this));
    this.operationHandlers.set(OPERATION_TYPES.DELETE_TEMPLATE, this.handleDeleteTemplate.bind(this));
    this.operationHandlers.set(OPERATION_TYPES.DUPLICATE_TEMPLATE, this.handleDuplicateTemplate.bind(this));
    this.operationHandlers.set(OPERATION_TYPES.ACTIVATE_TEMPLATE, this.handleActivateTemplate.bind(this));
    this.operationHandlers.set(OPERATION_TYPES.DEACTIVATE_TEMPLATE, this.handleDeactivateTemplate.bind(this));
    this.operationHandlers.set(OPERATION_TYPES.BULK_ACTIVATE_TEMPLATES, this.handleBulkActivateTemplates.bind(this));
    this.operationHandlers.set(OPERATION_TYPES.BULK_DEACTIVATE_TEMPLATES, this.handleBulkDeactivateTemplates.bind(this));
    
    this.operationHandlers.set(OPERATION_TYPES.CREATE_INSTANCE, this.handleCreateInstance.bind(this));
    this.operationHandlers.set(OPERATION_TYPES.UPDATE_INSTANCE, this.handleUpdateInstance.bind(this));
    this.operationHandlers.set(OPERATION_TYPES.DELETE_INSTANCE, this.handleDeleteInstance.bind(this));
    this.operationHandlers.set(OPERATION_TYPES.BATCH_CREATE_INSTANCES, this.handleBatchCreateInstances.bind(this));
    this.operationHandlers.set(OPERATION_TYPES.BATCH_UPDATE_INSTANCES, this.handleBatchUpdateInstances.bind(this));
    
    this.operationHandlers.set(OPERATION_TYPES.UPDATE_SETTINGS, this.handleUpdateSettings.bind(this));
    this.operationHandlers.set(OPERATION_TYPES.UPDATE_USER_DATA, this.handleUpdateUserData.bind(this));
  }

  /**
   * Add operation to queue
   */
  async enqueue(operation) {
    try {
      const queuedOperation = {
        type: operation.type,
        data: operation.data,
        priority: operation.priority || OPERATION_PRIORITIES.NORMAL,
        userId: operation.userId,
        resourceId: operation.resourceId,
        metadata: operation.metadata || {},
        dependsOn: operation.dependsOn || [],
        maxRetries: operation.maxRetries || this.maxRetries
      };

      const operationId = await this.storage.queueOperation(queuedOperation);
      
      console.log(`📝 OfflineQueue: Operation queued - ${operation.type} (ID: ${operationId})`);
      
      // Log for debugging
      await this.storage.logSyncOperation(
        `Queue ${operation.type}`,
        'queued',
        { operationId, priority: queuedOperation.priority }
      );

      return operationId;
    } catch (error) {
      console.error('❌ OfflineQueue: Failed to enqueue operation:', error);
      throw error;
    }
  }

  /**
   * Get queue status
   */
  async getQueueStatus() {
    try {
      const operations = await this.storage.getQueuedOperations();
      
      const status = {
        total: operations.length,
        pending: operations.filter(op => op.status === OPERATION_STATUS.PENDING).length,
        processing: operations.filter(op => op.status === OPERATION_STATUS.PROCESSING).length,
        failed: operations.filter(op => op.status === OPERATION_STATUS.FAILED).length,
        completed: operations.filter(op => op.status === OPERATION_STATUS.COMPLETED).length,
        operations: operations
      };

      return status;
    } catch (error) {
      console.error('❌ OfflineQueue: Failed to get queue status:', error);
      return { total: 0, pending: 0, processing: 0, failed: 0, completed: 0, operations: [] };
    }
  }

  /**
   * Start processing queue
   */
  startProcessing() {
    if (this.processingIntervalId) {
      return; // Already processing
    }

    this.processingIntervalId = setInterval(() => {
      this.processQueue().catch(error => {
        console.error('❌ OfflineQueue: Error in process loop:', error);
      });
    }, this.processInterval);

    console.log('🔄 OfflineQueue: Processing started');
  }

  /**
   * Stop processing queue
   */
  stopProcessing() {
    if (this.processingIntervalId) {
      clearInterval(this.processingIntervalId);
      this.processingIntervalId = null;
      console.log('⏸️ OfflineQueue: Processing stopped');
    }
  }

  /**
   * Process queue operations
   */
  async processQueue() {
    if (this.isProcessing || !navigator.onLine) {
      return; // Skip if already processing or offline
    }

    this.isProcessing = true;

    try {
      const operations = await this.storage.getQueuedOperations(20); // Process up to 20 operations
      const pendingOps = operations
        .filter(op => op.status === OPERATION_STATUS.PENDING || 
                     (op.status === OPERATION_STATUS.FAILED && op.attempts < op.maxRetries))
        .sort((a, b) => {
          // Sort by priority (higher first), then by creation time (older first)
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          return new Date(a.createdAt) - new Date(b.createdAt);
        });

      if (pendingOps.length === 0) {
        return; // No operations to process
      }

      console.log(`🔄 OfflineQueue: Processing ${pendingOps.length} operations`);

      for (const operation of pendingOps) {
        try {
          await this.processOperation(operation);
        } catch (error) {
          console.error(`❌ OfflineQueue: Failed to process operation ${operation.id}:`, error);
        }
      }

      // Clean up completed operations periodically
      await this.cleanupCompletedOperations();

    } catch (error) {
      console.error('❌ OfflineQueue: Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual operation
   */
  async processOperation(operation) {
    try {
      // Update operation status to processing
      await this.storage.updateQueuedOperation(operation.id, {
        status: OPERATION_STATUS.PROCESSING,
        processingAt: new Date().toISOString()
      });

      // Get operation handler
      const handler = this.operationHandlers.get(operation.type);
      if (!handler) {
        throw new Error(`No handler found for operation type: ${operation.type}`);
      }

      // Execute operation
      const result = await handler(operation);

      // Mark as completed
      await this.storage.updateQueuedOperation(operation.id, {
        status: OPERATION_STATUS.COMPLETED,
        completedAt: new Date().toISOString(),
        result: result
      });

      // Log success
      await this.storage.logSyncOperation(
        `Process ${operation.type}`,
        'completed',
        { operationId: operation.id, result }
      );

      console.log(`✅ OfflineQueue: Operation completed - ${operation.type} (ID: ${operation.id})`);

    } catch (error) {
      await this.handleOperationFailure(operation, error);
    }
  }

  /**
   * Handle operation failure
   */
  async handleOperationFailure(operation, error) {
    const newAttempts = (operation.attempts || 0) + 1;
    const shouldRetry = newAttempts < operation.maxRetries;

    const updates = {
      attempts: newAttempts,
      lastError: error.message,
      lastAttemptAt: new Date().toISOString()
    };

    if (shouldRetry) {
      // Calculate retry delay with exponential backoff
      const retryDelay = Math.min(
        this.baseRetryDelay * Math.pow(2, newAttempts - 1),
        this.maxRetryDelay
      );

      updates.status = OPERATION_STATUS.PENDING;
      updates.retryAfter = new Date(Date.now() + retryDelay).toISOString();

      console.warn(`⚠️ OfflineQueue: Operation failed, will retry in ${retryDelay}ms - ${operation.type} (attempt ${newAttempts}/${operation.maxRetries})`);
    } else {
      updates.status = OPERATION_STATUS.FAILED;
      updates.failedAt = new Date().toISOString();

      console.error(`❌ OfflineQueue: Operation permanently failed - ${operation.type} (max retries exceeded)`);
      
      // Show error to user for critical operations
      if (operation.priority >= OPERATION_PRIORITIES.HIGH) {
        SimpleErrorHandler.showError(
          `Failed to sync ${operation.type.toLowerCase().replace('_', ' ')}: ${error.message}`,
          error
        );
      }
    }

    await this.storage.updateQueuedOperation(operation.id, updates);
    
    // Log failure
    await this.storage.logSyncOperation(
      `Process ${operation.type}`,
      shouldRetry ? 'retry' : 'failed',
      { operationId: operation.id, error: error.message, attempts: newAttempts }
    );
  }

  /**
   * Clean up completed operations
   */
  async cleanupCompletedOperations() {
    try {
      const cleanedCount = await this.storage.clearCompletedOperations();
      if (cleanedCount > 0) {
        console.log(`🧹 OfflineQueue: Cleaned up ${cleanedCount} completed operations`);
      }
    } catch (error) {
      console.warn('⚠️ OfflineQueue: Failed to clean up completed operations:', error);
    }
  }

  /**
   * Force process queue immediately (useful for testing)
   */
  async forceProcess() {
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * Cancel operation
   */
  async cancelOperation(operationId) {
    try {
      await this.storage.updateQueuedOperation(operationId, {
        status: OPERATION_STATUS.CANCELLED,
        cancelledAt: new Date().toISOString()
      });
      
      console.log(`❌ OfflineQueue: Operation cancelled - ID: ${operationId}`);
    } catch (error) {
      console.error('❌ OfflineQueue: Failed to cancel operation:', error);
      throw error;
    }
  }

  /**
   * Retry failed operation
   */
  async retryOperation(operationId) {
    try {
      await this.storage.updateQueuedOperation(operationId, {
        status: OPERATION_STATUS.PENDING,
        attempts: 0, // Reset attempts
        retryAfter: null,
        lastError: null
      });
      
      console.log(`🔄 OfflineQueue: Operation reset for retry - ID: ${operationId}`);
    } catch (error) {
      console.error('❌ OfflineQueue: Failed to retry operation:', error);
      throw error;
    }
  }

  /**
   * Clear all operations
   */
  async clearQueue() {
    try {
      const operations = await this.storage.getQueuedOperations();
      for (const op of operations) {
        await this.storage.removeQueuedOperation(op.id);
      }
      console.log('🧹 OfflineQueue: Queue cleared');
    } catch (error) {
      console.error('❌ OfflineQueue: Failed to clear queue:', error);
      throw error;
    }
  }

  // === Operation Handlers ===
  // These would typically import and use the actual data layer functions

  async handleCreateTemplate(operation) {
    // Import dynamically to avoid circular dependencies
    const { taskTemplates } = await import('../data.js');
    return await taskTemplates.create(operation.userId, operation.data);
  }

  async handleUpdateTemplate(operation) {
    const { taskTemplates } = await import('../data.js');
    return await taskTemplates.update(operation.resourceId, operation.data);
  }

  async handleDeleteTemplate(operation) {
    const { taskTemplates } = await import('../data.js');
    return await taskTemplates.delete(operation.resourceId);
  }

  async handleDuplicateTemplate(operation) {
    const { taskTemplateManager } = await import('../taskLogic.js');
    const { state } = await import('../state.js');
    const uid = state.getUser()?.uid;
    return await taskTemplateManager.duplicate(uid, operation.resourceId);
  }

  async handleActivateTemplate(operation) {
    const { taskTemplateManager } = await import('../taskLogic.js');
    return await taskTemplateManager.activate(operation.resourceId);
  }

  async handleDeactivateTemplate(operation) {
    const { taskTemplateManager } = await import('../taskLogic.js');
    return await taskTemplateManager.deactivate(operation.resourceId);
  }

  async handleBulkActivateTemplates(operation) {
    const { taskTemplates } = await import('../data.js');
    return await taskTemplates.batchActivate(operation.data.templateIds);
  }

  async handleBulkDeactivateTemplates(operation) {
    const { taskTemplates } = await import('../data.js');
    return await taskTemplates.batchDeactivate(operation.data.templateIds);
  }

  async handleCreateInstance(operation) {
    const { taskInstances } = await import('../data.js');
    return await taskInstances.create(operation.data);
  }

  async handleUpdateInstance(operation) {
    const { taskInstances } = await import('../data.js');
    return await taskInstances.update(operation.resourceId, operation.data);
  }

  async handleDeleteInstance(operation) {
    const { taskInstances } = await import('../data.js');
    return await taskInstances.delete(operation.resourceId);
  }

  async handleBatchCreateInstances(operation) {
    const { taskInstances } = await import('../data.js');
    return await taskInstances.batchCreate(operation.data.instances);
  }

  async handleBatchUpdateInstances(operation) {
    const { taskInstances } = await import('../data.js');
    return await taskInstances.batchUpdate(operation.data.instanceIds, operation.data.updates);
  }

  async handleUpdateSettings(operation) {
    const { userSettings } = await import('../data.js');
    return await userSettings.save(operation.data);
  }

  async handleUpdateUserData(operation) {
    const { userSettings } = await import('../data.js');
    return await userSettings.save(operation.data);
  }

  /**
   * Destroy queue manager
   */
  destroy() {
    this.stopProcessing();
    this.operationHandlers.clear();
    this.isProcessing = false;
  }
}

// Create and export singleton instance
export const offlineQueue = new OfflineQueue();

console.log('✅ OfflineQueue system initialized');
