/**
 * Template Operations Service - Bulk and Advanced Operations
 * Phase 5 Step 5.2: Extracted from TaskTemplateManager
 * 
 * Handles bulk operations, advanced template manipulations, and complex
 * business operations that extend beyond basic CRUD functionality.
 */

export class TemplateOperationsService {
  constructor(templateManager) {
    this.templateManager = templateManager;
  }

  /**
   * Bulk activate multiple templates
   */
  async bulkActivate(templateIds) {
    try {
      if (!Array.isArray(templateIds) || templateIds.length === 0) {
        throw new Error('Template IDs array is required for bulk activate');
      }

      const results = [];
      const errors = [];
      
      for (const templateId of templateIds) {
        try {
          const result = await this.templateManager.activate(templateId);
          results.push({ templateId, success: true, result });
        } catch (error) {
          errors.push({ templateId, success: false, error: error.message });
        }
      }
      
      const summary = {
        total: templateIds.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      };
      
      console.log(`✅ Bulk activate completed: ${summary.successful}/${summary.total} successful`);
      return summary;
    } catch (error) {
      console.error('❌ Error in bulk activate:', error);
      throw error;
    }
  }

  /**
   * Split a recurring template at a given date and create a new template
   * starting from that date with the provided updates.
   * - Original template endDate is set to (date - 1 day)
   * - New template inherits original fields + updates and starts at `date`
   * @param {string} templateId
   * @param {string} date YYYY-MM-DD
   * @param {object} updates Full or partial template payload for the new template
   * @returns {Promise<{ original: object, created: object }>} updated original and new template
   */
  async splitAndCreateFromDate(templateId, date, updates = {}) {
    try {
      if (!templateId || !date) {
        throw new Error('templateId and date are required');
      }

      // Load original
      const original = await this.templateManager.get(templateId);
      if (!original) throw new Error(`Template not found: ${templateId}`);

      // Compute end date (date - 1 day)
      const { dataUtils } = await import('../dataOffline.js');
      const prevDay = dataUtils.formatDateString(dataUtils.addDaysToDate(date, -1));

      // Update original to end one day before the split date
      const updatedOriginal = await this.templateManager.update(templateId, {
        recurrenceRule: {
          ...(original.recurrenceRule || {}),
          endDate: prevDay
        }
      });

      // Build the new template payload: inherit original, apply updates, set startDate to split date and clear endDate
      const newPayload = {
        ...original,
        ...updates,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        deletedAt: undefined,
        recurrenceRule: {
          ...(original.recurrenceRule || {}),
          ...((updates && updates.recurrenceRule) || {}),
          startDate: date,
          endDate: (updates && updates.recurrenceRule && updates.recurrenceRule.endDate) ? updates.recurrenceRule.endDate : null
        }
      };

      // Create new template under current user
      const { state } = await import('../state.js');
      const user = state.getUser();
      if (!user || !user.uid) throw new Error('No authenticated user');
      const created = await this.templateManager.create(user.uid, newPayload);

      return { original: updatedOriginal, created };
    } catch (error) {
      console.error('❌ Error in splitAndCreateFromDate:', error);
      throw error;
    }
  }

  /**
   * Bulk deactivate multiple templates
   */
  async bulkDeactivate(templateIds) {
    try {
      if (!Array.isArray(templateIds) || templateIds.length === 0) {
        throw new Error('Template IDs array is required for bulk deactivate');
      }

      const results = [];
      const errors = [];
      
      for (const templateId of templateIds) {
        try {
          const result = await this.templateManager.deactivate(templateId);
          results.push({ templateId, success: true, result });
        } catch (error) {
          errors.push({ templateId, success: false, error: error.message });
        }
      }
      
      const summary = {
        total: templateIds.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      };
      
      console.log(`✅ Bulk deactivate completed: ${summary.successful}/${summary.total} successful`);
      return summary;
    } catch (error) {
      console.error('❌ Error in bulk deactivate:', error);
      throw error;
    }
  }

  /**
   * Bulk delete (soft delete) multiple templates
   */
  async bulkDelete(templateIds) {
    try {
      if (!Array.isArray(templateIds) || templateIds.length === 0) {
        throw new Error('Template IDs array is required for bulk delete');
      }

      const results = [];
      const errors = [];
      
      for (const templateId of templateIds) {
        try {
          const result = await this.templateManager.delete(templateId);
          results.push({ templateId, success: true, result });
        } catch (error) {
          errors.push({ templateId, success: false, error: error.message });
        }
      }
      
      const summary = {
        total: templateIds.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      };
      
      console.log(`✅ Bulk delete completed: ${summary.successful}/${summary.total} successful`);
      return summary;
    } catch (error) {
      console.error('❌ Error in bulk delete:', error);
      throw error;
    }
  }

  /**
   * Bulk update multiple templates with common changes
   */
  async bulkUpdate(templateIds, updates) {
    try {
      if (!Array.isArray(templateIds) || templateIds.length === 0) {
        throw new Error('Template IDs array is required for bulk update');
      }

      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('Updates object is required for bulk update');
      }

      const results = [];
      const errors = [];
      
      for (const templateId of templateIds) {
        try {
          const result = await this.templateManager.update(templateId, updates);
          results.push({ templateId, success: true, result });
        } catch (error) {
          errors.push({ templateId, success: false, error: error.message });
        }
      }
      
      const summary = {
        total: templateIds.length,
        successful: results.length,
        failed: errors.length,
        updates,
        results,
        errors
      };
      
      console.log(`✅ Bulk update completed: ${summary.successful}/${summary.total} successful`);
      return summary;
    } catch (error) {
      console.error('❌ Error in bulk update:', error);
      throw error;
    }
  }

  /**
   * Bulk duplicate templates with naming pattern
   */
  async bulkDuplicate(userId, templateIds, namingPattern = '(Copy)') {
    try {
      if (!userId) {
        throw new Error('User ID is required for bulk duplicate');
      }

      if (!Array.isArray(templateIds) || templateIds.length === 0) {
        throw new Error('Template IDs array is required for bulk duplicate');
      }

      const results = [];
      const errors = [];
      
      for (let i = 0; i < templateIds.length; i++) {
        const templateId = templateIds[i];
        try {
          // Generate unique name for each duplicate
          const customName = await this.generateUniqueDuplicateName(templateId, namingPattern, i + 1);
          const result = await this.templateManager.duplicate(userId, templateId, customName);
          results.push({ templateId, success: true, result });
        } catch (error) {
          errors.push({ templateId, success: false, error: error.message });
        }
      }
      
      const summary = {
        total: templateIds.length,
        successful: results.length,
        failed: errors.length,
        namingPattern,
        results,
        errors
      };
      
      console.log(`✅ Bulk duplicate completed: ${summary.successful}/${summary.total} successful`);
      return summary;
    } catch (error) {
      console.error('❌ Error in bulk duplicate:', error);
      throw error;
    }
  }

  /**
   * Generate unique name for duplicated template
   */
  async generateUniqueDuplicateName(templateId, namingPattern, index) {
    try {
      const originalTemplate = await this.templateManager.get(templateId);
      if (!originalTemplate) {
        throw new Error(`Template not found: ${templateId}`);
      }

      const baseName = originalTemplate.taskName;
      
      // Apply naming pattern
      if (index > 1) {
        return `${baseName} ${namingPattern} ${index}`;
      } else {
        return `${baseName} ${namingPattern}`;
      }
    } catch (error) {
      console.error('❌ Error generating duplicate name:', error);
      throw error;
    }
  }

  /**
   * Archive old templates (soft delete templates older than specified days)
   */
  async archiveOldTemplates(userId, daysOld = 365, dryRun = true) {
    try {
      if (!userId) {
        throw new Error('User ID is required for archive operation');
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const allTemplates = await this.templateManager.getAll(userId, true); // Include inactive
      const oldTemplates = allTemplates.filter(template => {
        const updatedAt = new Date(template.updatedAt || template.createdAt);
        return updatedAt < cutoffDate && template.isActive !== false; // Only active templates
      });

      if (dryRun) {
        console.log(`🔍 Archive dry run: Found ${oldTemplates.length} templates older than ${daysOld} days`);
        return {
          dryRun: true,
          candidateTemplates: oldTemplates.map(t => ({
            id: t.id,
            name: t.taskName,
            lastUpdated: t.updatedAt || t.createdAt,
            daysOld: Math.floor((new Date() - new Date(t.updatedAt || t.createdAt)) / (1000 * 60 * 60 * 24))
          }))
        };
      }

      // Perform actual archiving
      const templateIds = oldTemplates.map(t => t.id);
      const archiveResult = await this.bulkDeactivate(templateIds);
      
      console.log(`✅ Archived ${archiveResult.successful} templates older than ${daysOld} days`);
      return {
        dryRun: false,
        archived: archiveResult
      };
    } catch (error) {
      console.error('❌ Error in archive operation:', error);
      throw error;
    }
  }

  /**
   * Restore archived templates
   */
  async restoreArchivedTemplates(userId, templateIds) {
    try {
      if (!userId) {
        throw new Error('User ID is required for restore operation');
      }

      return await this.bulkActivate(templateIds);
    } catch (error) {
      console.error('❌ Error in restore operation:', error);
      throw error;
    }
  }

  /**
   * Export templates to JSON format for backup/migration
   */
  async exportTemplates(userId, templateIds = null) {
    try {
      if (!userId) {
        throw new Error('User ID is required for export');
      }

      let templates;
      if (templateIds) {
        // Export specific templates
        templates = [];
        for (const templateId of templateIds) {
          const template = await this.templateManager.get(templateId);
          if (template) {
            templates.push(template);
          }
        }
      } else {
        // Export all templates
        templates = await this.templateManager.getAll(userId, true); // Include inactive
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        userId,
        templateCount: templates.length,
        templates: templates.map(template => ({
          // Remove internal fields
          ...template,
          id: undefined, // Remove ID for import safety
          userId: undefined // Remove user ID for privacy
        }))
      };

      console.log(`✅ Exported ${templates.length} templates for user ${userId}`);
      return exportData;
    } catch (error) {
      console.error('❌ Error in export operation:', error);
      throw error;
    }
  }

  /**
   * Import templates from JSON format
   */
  async importTemplates(userId, exportData, options = {}) {
    try {
      if (!userId) {
        throw new Error('User ID is required for import');
      }

      if (!exportData || !exportData.templates) {
        throw new Error('Invalid export data format');
      }

      const { 
        skipDuplicates = true, 
        updateExisting = false, 
        nameSuffix = '(Imported)' 
      } = options;

      const results = [];
      const errors = [];
      const existingTemplates = await this.templateManager.getAll(userId, true);
      
      for (const templateData of exportData.templates) {
        try {
          // Check for duplicates by name
          const existingTemplate = existingTemplates.find(t => t.taskName === templateData.taskName);
          
          if (existingTemplate) {
            if (skipDuplicates) {
              console.log(`⏭️ Skipped duplicate template: ${templateData.taskName}`);
              continue;
            } else if (updateExisting) {
              const result = await this.templateManager.update(existingTemplate.id, templateData);
              results.push({ action: 'updated', template: result });
            } else {
              // Import with modified name
              const modifiedData = {
                ...templateData,
                taskName: `${templateData.taskName} ${nameSuffix}`
              };
              const result = await this.templateManager.create(userId, modifiedData);
              results.push({ action: 'created', template: result });
            }
          } else {
            // Create new template
            const result = await this.templateManager.create(userId, templateData);
            results.push({ action: 'created', template: result });
          }
        } catch (error) {
          errors.push({ templateName: templateData.taskName, error: error.message });
        }
      }

      const summary = {
        total: exportData.templates.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      };
      
      console.log(`✅ Import completed: ${summary.successful}/${summary.total} successful`);
      return summary;
    } catch (error) {
      console.error('❌ Error in import operation:', error);
      throw error;
    }
  }

  /**
   * Get templates usage statistics
   */
  async getTemplateStatistics(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required for statistics');
      }

      const allTemplates = await this.templateManager.getAll(userId, true); // Include inactive
      
      const stats = {
        total: allTemplates.length,
        active: allTemplates.filter(t => t.isActive !== false).length,
        inactive: allTemplates.filter(t => t.isActive === false).length,
        byPriority: this.groupTemplatesByField(allTemplates, 'priority'),
        byTimeWindow: this.groupTemplatesByField(allTemplates, 'timeWindow'),
        bySchedulingType: this.groupTemplatesByField(allTemplates, 'schedulingType'),
        byRecurrenceFrequency: this.groupTemplatesByField(allTemplates, template => template.recurrenceRule?.frequency || 'none'),
        averageDuration: this.calculateAverageDuration(allTemplates),
        oldestTemplate: this.findOldestTemplate(allTemplates),
        newestTemplate: this.findNewestTemplate(allTemplates)
      };

      console.log(`📊 Generated statistics for ${stats.total} templates`);
      return stats;
    } catch (error) {
      console.error('❌ Error generating statistics:', error);
      throw error;
    }
  }

  /**
   * Helper: Group templates by field
   */
  groupTemplatesByField(templates, fieldOrFunction) {
    const groups = {};
    
    templates.forEach(template => {
      const value = typeof fieldOrFunction === 'function' 
        ? fieldOrFunction(template) 
        : template[fieldOrFunction];
      
      const key = value || 'undefined';
      groups[key] = (groups[key] || 0) + 1;
    });
    
    return groups;
  }

  /**
   * Helper: Calculate average duration
   */
  calculateAverageDuration(templates) {
    const validDurations = templates
      .map(t => t.durationMinutes)
      .filter(d => d && d > 0);
    
    if (validDurations.length === 0) return 0;
    
    const sum = validDurations.reduce((acc, duration) => acc + duration, 0);
    return Math.round(sum / validDurations.length);
  }

  /**
   * Helper: Find oldest template
   */
  findOldestTemplate(templates) {
    if (templates.length === 0) return null;
    
    return templates.reduce((oldest, current) => {
      const currentDate = new Date(current.createdAt);
      const oldestDate = new Date(oldest.createdAt);
      return currentDate < oldestDate ? current : oldest;
    });
  }

  /**
   * Helper: Find newest template
   */
  findNewestTemplate(templates) {
    if (templates.length === 0) return null;
    
    return templates.reduce((newest, current) => {
      const currentDate = new Date(current.createdAt);
      const newestDate = new Date(newest.createdAt);
      return currentDate > newestDate ? current : newest;
    });
  }
}

console.log('✅ TemplateOperationsService loaded');
