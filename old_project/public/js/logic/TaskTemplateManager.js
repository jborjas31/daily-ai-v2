/**
 * Streamlined Task Template Manager - Core CRUD Operations for Task Templates
 * Phase 5 Step 5.2: Focused on Single Responsibility Principle
 * 
 * Handles task template CRUD operations with comprehensive validation,
 * error handling, and performance caching. Business logic extracted to services:
 * - Smart defaults -> TemplateDefaultsService
 * - Bulk operations -> TemplateOperationsService
 * - Validation -> TaskValidation utils (direct usage)
 */

import { state } from '../state.js';
import { taskTemplates } from '../dataOffline.js';
import { taskValidation } from '../utils/TaskValidation.js';
import { TemplateDefaultsService } from './TemplateDefaultsService.js';
import { TemplateOperationsService } from './TemplateOperationsService.js';

export class TaskTemplateManager {
  constructor(templateDefaultsService = null, templateOperationsService = null) {
    this.templates = new Map(); // Local cache for performance
    this.initialized = false;
    
    // Dependency injection with defaults
    this.templateDefaultsService = templateDefaultsService || new TemplateDefaultsService();
    this.templateOperationsService = templateOperationsService || new TemplateOperationsService(this);
  }

  /**
   * Initialize the manager (load existing templates)
   */
  async initialize() {
    try {
      const templates = await taskTemplates.getAll();
      templates.forEach(template => {
        this.templates.set(template.id, template);
      });
      this.initialized = true;
      console.log(`✅ TaskTemplateManager initialized with ${templates.length} templates`);
    } catch (error) {
      console.error('❌ Error initializing TaskTemplateManager:', error);
      throw error;
    }
  }

  /**
   * ========================================================================
   * CORE CRUD OPERATIONS
   * ========================================================================
   */

  /**
   * Create new task template with defaults and validation
   */
  async create(userId, taskData) {
    try {
      if (!userId) {
        throw new Error('User ID is required to create task template');
      }

      // Apply intelligent defaults using service
      const templateWithDefaults = this.templateDefaultsService.applyIntelligentDefaults(taskData);
      
      // Comprehensive validation using taskValidation directly
      const existingTemplates = await taskTemplates.getAll(userId);
      const validationResult = taskValidation.validateTemplate(templateWithDefaults, existingTemplates);
      if (!validationResult.isValid) {
        throw new Error(`Template validation failed: ${validationResult.getErrorMessages().join(', ')}`);
      }
      
      // Add metadata
      const templateData = {
        ...templateWithDefaults,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Create task template in database
      const newTemplate = await taskTemplates.create(userId, templateData);
      
      // Cache locally
      this.templates.set(newTemplate.id, newTemplate);
      
      // Update application state
      state.updateTaskTemplate(newTemplate);
      
      console.log('✅ Task template created:', newTemplate.taskName);
      return newTemplate;
    } catch (error) {
      console.error('❌ Error creating task template:', error);
      throw error;
    }
  }

  /**
   * Read/Get task template by ID
   */
  async get(templateId) {
    try {
      if (!templateId) {
        throw new Error('Template ID is required');
      }

      // Check local cache first
      if (this.templates.has(templateId)) {
        return this.templates.get(templateId);
      }

      // Fetch from database if not cached
      const template = await taskTemplates.get(templateId);
      if (template) {
        this.templates.set(templateId, template);
      }
      
      return template;
    } catch (error) {
      console.error('❌ Error retrieving task template:', error);
      throw error;
    }
  }

  /**
   * Get all active task templates for a user
   */
  async getAll(userId, includeInactive = false) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const templates = await taskTemplates.getAll(userId);
      
      // Filter by active status unless includeInactive is true
      const filteredTemplates = includeInactive 
        ? templates 
        : templates.filter(template => template.isActive !== false);
      
      // Update local cache
      filteredTemplates.forEach(template => {
        this.templates.set(template.id, template);
      });
      
      return filteredTemplates;
    } catch (error) {
      console.error('❌ Error retrieving task templates:', error);
      throw error;
    }
  }

  /**
   * Update existing task template with validation
   */
  async update(templateId, updates) {
    try {
      if (!templateId) {
        throw new Error('Template ID is required');
      }

      // Get current template for merging
      const currentTemplate = await this.get(templateId);
      if (!currentTemplate) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Merge updates with current template
      const updatedData = {
        ...currentTemplate,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Validate merged data using taskValidation directly
      const existingTemplates = await taskTemplates.getAll();
      const validationResult = taskValidation.validateTemplate(updatedData, existingTemplates);
      if (!validationResult.isValid) {
        throw new Error(`Template validation failed: ${validationResult.getErrorMessages().join(', ')}`);
      }
      
      // Update in database
      const updatedTemplate = await taskTemplates.update(templateId, updatedData);
      
      // Update local cache
      this.templates.set(templateId, updatedTemplate);
      
      // Update application state
      state.updateTaskTemplate(updatedTemplate);
      
      console.log('✅ Task template updated:', templateId);
      return updatedTemplate;
    } catch (error) {
      console.error('❌ Error updating task template:', error);
      throw error;
    }
  }

  /**
   * Delete task template (soft delete - deactivate)
   */
  async delete(templateId) {
    try {
      if (!templateId) {
        throw new Error('Template ID is required');
      }

      // Soft delete by deactivating
      const updatedTemplate = await this.update(templateId, { 
        isActive: false,
        deletedAt: new Date().toISOString()
      });
      
      // Remove from local cache
      this.templates.delete(templateId);
      
      // Remove from application state
      state.removeTaskTemplate(templateId);
      
      console.log('✅ Task template deleted (deactivated):', templateId);
      return updatedTemplate;
    } catch (error) {
      console.error('❌ Error deleting task template:', error);
      throw error;
    }
  }

  /**
   * Permanently delete task template (hard delete)
   */
  async permanentDelete(templateId) {
    try {
      if (!templateId) {
        throw new Error('Template ID is required');
      }

      await taskTemplates.permanentDelete(templateId);
      
      // Remove from local cache
      this.templates.delete(templateId);
      
      // Remove from application state
      state.removeTaskTemplate(templateId);
      
      console.log('✅ Task template permanently deleted:', templateId);
    } catch (error) {
      console.error('❌ Error permanently deleting task template:', error);
      throw error;
    }
  }

  /**
   * ========================================================================
   * TEMPLATE LIFECYCLE OPERATIONS
   * ========================================================================
   */

  /**
   * Duplicate task template with modified name
   */
  async duplicate(userId, templateId, customName = null) {
    try {
      if (!templateId) {
        throw new Error('Template ID is required');
      }

      const originalTemplate = await this.get(templateId);
      if (!originalTemplate) {
        throw new Error(`Template not found: ${templateId}`);
      }
      
      // Create duplicate data
      const duplicateData = {
        ...originalTemplate,
        taskName: customName || `${originalTemplate.taskName} (Copy)`,
        // Remove metadata that should not be copied
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        deletedAt: undefined
      };
      
      return await this.create(userId, duplicateData);
    } catch (error) {
      console.error('❌ Error duplicating task template:', error);
      throw error;
    }
  }

  /**
   * Activate task template
   */
  async activate(templateId) {
    try {
      return await this.update(templateId, { 
        isActive: true,
        deletedAt: null
      });
    } catch (error) {
      console.error('❌ Error activating task template:', error);
      throw error;
    }
  }

  /**
   * Deactivate task template
   */
  async deactivate(templateId) {
    try {
      return await this.update(templateId, { 
        isActive: false,
        deactivatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error deactivating task template:', error);
      throw error;
    }
  }

  /**
   * ========================================================================
   * CACHING SYSTEM
   * ========================================================================
   */

  /**
   * Clear local cache (useful for testing or forced refresh)
   */
  clearCache() {
    this.templates.clear();
    console.log('✅ TaskTemplateManager cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cachedTemplates: this.templates.size,
      initialized: this.initialized
    };
  }

  /**
   * ========================================================================
   * SERVICE INTEGRATION METHODS
   * ========================================================================
   */

  /**
   * Get bulk operations service for advanced template operations
   */
  getBulkOperations() {
    return this.templateOperationsService;
  }

  /**
   * Get defaults service for template default generation and suggestions
   */
  getDefaultsService() {
    return this.templateDefaultsService;
  }

  /**
   * Apply smart defaults to task data (delegates to service)
   */
  applySmartDefaults(taskData) {
    return this.templateDefaultsService.applySmartDefaults(taskData);
  }

  /**
   * Apply intelligent defaults with task type detection (delegates to service)
   */
  applyIntelligentDefaults(taskData) {
    return this.templateDefaultsService.applyIntelligentDefaults(taskData);
  }

  /**
   * Get default suggestions for UI (delegates to service)
   */
  getDefaultSuggestions(partialTaskData) {
    return this.templateDefaultsService.getDefaultSuggestions(partialTaskData);
  }

  /**
   * ========================================================================
   * VALIDATION METHODS (Direct taskValidation usage - no redundant wrappers)
   * ========================================================================
   */

  /**
   * Note: Removed redundant validateTemplate() and quickValidateTemplate() methods.
   * Use taskValidation.validateTemplate() and taskValidation.quickValidateTemplate() directly.
   * This eliminates unnecessary wrapper methods and follows DRY principle.
   */

  /**
   * ========================================================================
   * BULK OPERATIONS DELEGATION
   * ========================================================================
   */

  /**
   * Bulk operations are delegated to TemplateOperationsService
   * Use templateManager.getBulkOperations().bulkActivate(ids) etc.
   * This maintains single responsibility while providing convenient access.
   */
}

console.log('✅ Streamlined TaskTemplateManager class loaded');