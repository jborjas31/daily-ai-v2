/**
 * TaskQuery Module
 * 
 * Centralized task filtering, sorting, and querying functionality.
 * Extracted from taskLogic.js as part of Phase 1 refactoring.
 */

export const TaskQuery = {
  /**
   * Query task templates using a single criteria object.
   * Mirrors legacy TaskList filtering/sorting to preserve behavior.
   *
   * @param {Object} criteria - { search, view, filters, sort }
   * @param {Array<Object>} templatesInput - Optional list of templates to query
   * @returns {Array<Object>} resulting templates after filtering and sorting
   */
  queryTemplates(criteria = {}, templatesInput = []) {
    let templates = Array.isArray(templatesInput) ? [...templatesInput] : [];

    const search = (criteria.search || '').trim();
    const view = criteria.view || 'library';
    const filters = criteria.filters || {};
    const sort = criteria.sort || { field: 'name', direction: 'asc' };

    // Apply view filter first (active/inactive)
    if (view === 'active') {
      templates = templates.filter(t => t.isActive !== false);
    } else if (view === 'inactive') {
      templates = templates.filter(t => t.isActive === false);
    }

    // Apply search (centralized)
    if (search) {
      templates = this.search(templates, search);
    }

    // Apply detailed filters (replicates TaskList.applyDetailedFilters)
    templates = templates.filter(template => {
      // Priority filter
      if (filters.priority && filters.priority !== 'all') {
        if (template.priority !== parseInt(filters.priority)) return false;
      }

      // Time window filter
      if (filters.timeWindow && filters.timeWindow !== 'all') {
        if (template.timeWindow !== filters.timeWindow) return false;
      }

      // Scheduling type filter
      if (filters.schedulingType && filters.schedulingType !== 'all') {
        if (template.schedulingType !== filters.schedulingType) return false;
      }

      // Mandatory filter
      if (filters.isMandatory && filters.isMandatory !== 'all') {
        const isMandatory = filters.isMandatory === 'true';
        if (!!template.isMandatory !== isMandatory) return false;
      }

      // Active status filter
      if (filters.isActive && filters.isActive !== 'all') {
        const isActive = filters.isActive === 'true';
        const templateIsActive = template.isActive !== false;
        if (templateIsActive !== isActive) return false;
      }

      return true;
    });

    // Apply sorting (replicates TaskList.sortTemplates)
    const multiplier = (sort.direction === 'asc' ? 1 : -1);
    templates.sort((a, b) => {
      let comparison = 0;
      switch (sort.field) {
        case 'name':
          comparison = (a.taskName || '').localeCompare(b.taskName || '');
          break;
        case 'priority':
          comparison = (b.priority || 3) - (a.priority || 3); // High priority first
          break;
        case 'created':
          comparison = new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          break;
        case 'modified':
          comparison = new Date(b.modifiedAt || 0) - new Date(a.modifiedAt || 0);
          break;
        default:
          comparison = (a.taskName || '').localeCompare(b.taskName || '');
      }
      return comparison * multiplier;
    });

    return templates;
  },
  /**
   * Filter tasks based on search query and filters
   */
  filterTasks(tasks, searchQuery, filters) {
    let filteredTasks = [...tasks];
    
    // Apply search query
    if (searchQuery && searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      filteredTasks = filteredTasks.filter(task => 
        task.taskName.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query))
      );
    }
    
    // Apply time window filter
    if (filters.timeWindow && filters.timeWindow !== 'all') {
      filteredTasks = filteredTasks.filter(task => 
        task.timeWindow === filters.timeWindow
      );
    }
    
    // Apply mandatory filter
    if (filters.mandatory && filters.mandatory !== 'all') {
      const isMandatory = filters.mandatory === 'mandatory';
      filteredTasks = filteredTasks.filter(task => 
        task.isMandatory === isMandatory
      );
    }
    
    return filteredTasks;
  },

  /**
   * Sort tasks by priority and other criteria
   */
  sortTasks(tasks, sortBy = 'priority', direction = 'desc') {
    const sorted = [...tasks];
    const multiplier = direction === 'asc' ? 1 : -1;
    
    switch (sortBy) {
      case 'priority':
        return sorted.sort((a, b) => (b.priority - a.priority) * multiplier);
      case 'name':
        return sorted.sort((a, b) => a.taskName.localeCompare(b.taskName) * multiplier);
      case 'duration':
        return sorted.sort((a, b) => (a.durationMinutes - b.durationMinutes) * multiplier);
      case 'created':
        return sorted.sort((a, b) => 
          (new Date(b.createdAt) - new Date(a.createdAt)) * multiplier
        );
      default:
        return sorted;
    }
  },

  /**
   * Categorize tasks by different criteria
   */
  categorize(tasks) {
    return {
      byTimeWindow: this._groupBy(tasks, 'timeWindow'),
      byPriority: this._groupBy(tasks, task => {
        if (task.priority >= 8) return 'High';
        if (task.priority >= 5) return 'Medium';
        return 'Low';
      }),
      byMandatory: this._groupBy(tasks, task => task.isMandatory ? 'Mandatory' : 'Optional'),
      byDuration: this._groupBy(tasks, task => {
        if (task.durationMinutes <= 30) return 'Short (≤30min)';
        if (task.durationMinutes <= 60) return 'Medium (31-60min)';
        return 'Long (>60min)';
      })
    };
  },

  /**
   * Enhanced search with support for multiple search terms and field-specific searches
   */
  search(tasks, query) {
    if (!query || query.trim() === '') {
      return tasks;
    }

    const searchTerms = query.toLowerCase().trim().split(/\s+/);
    
    return tasks.filter(task => {
      const searchableText = [
        task.taskName,
        task.description || '',
        task.timeWindow || '',
        task.priority.toString()
      ].join(' ').toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    });
  },

  /**
   * Get statistical information about tasks
   */
  getTaskStats(tasks) {
    if (!tasks || tasks.length === 0) {
      return {
        total: 0,
        totalDuration: 0,
        averageDuration: 0,
        averagePriority: 0,
        mandatoryCount: 0,
        byTimeWindow: {},
        byPriority: { high: 0, medium: 0, low: 0 }
      };
    }

    const totalDuration = tasks.reduce((sum, task) => sum + (task.durationMinutes || 0), 0);
    const totalPriority = tasks.reduce((sum, task) => sum + (task.priority || 0), 0);
    const mandatoryCount = tasks.filter(task => task.isMandatory).length;
    
    const timeWindowStats = {};
    const priorityStats = { high: 0, medium: 0, low: 0 };

    tasks.forEach(task => {
      // Time window stats
      const timeWindow = task.timeWindow || 'unspecified';
      timeWindowStats[timeWindow] = (timeWindowStats[timeWindow] || 0) + 1;

      // Priority stats
      if (task.priority >= 8) priorityStats.high++;
      else if (task.priority >= 5) priorityStats.medium++;
      else priorityStats.low++;
    });

    return {
      total: tasks.length,
      totalDuration,
      averageDuration: Math.round(totalDuration / tasks.length),
      averagePriority: Math.round((totalPriority / tasks.length) * 10) / 10,
      mandatoryCount,
      mandatoryPercentage: Math.round((mandatoryCount / tasks.length) * 100),
      byTimeWindow: timeWindowStats,
      byPriority: priorityStats
    };
  },

  /**
   * Helper method to group tasks by a key or function
   */
  _groupBy(tasks, keyOrFunction) {
    return tasks.reduce((groups, task) => {
      const key = typeof keyOrFunction === 'function' 
        ? keyOrFunction(task) 
        : task[keyOrFunction];
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(task);
      return groups;
    }, {});
  }
};
