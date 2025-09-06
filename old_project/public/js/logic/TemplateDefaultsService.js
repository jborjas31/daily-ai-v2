/**
 * Template Defaults Service - Smart Default Value Generation
 * Phase 5 Step 5.2: Extracted from TaskTemplateManager
 * 
 * Handles intelligent default value assignment for task templates
 * based on creation context, user patterns, and time-of-day heuristics.
 */

import { TIME_WINDOWS } from '../constants/timeWindows.js';

export class TemplateDefaultsService {
  constructor() {
    this.timeWindowThresholds = {
      morning: { start: 6, end: 12 },
      afternoon: { start: 12, end: 18 },
      evening: { start: 18, end: 23 }
    };
  }

  /**
   * Apply smart defaults based on creation context
   */
  applySmartDefaults(taskData) {
    const currentTimeContext = this.getCurrentTimeContext();
    
    // Resolve time window first so it can inform defaultTime
    const resolvedWindow = this.determineTimeWindow(taskData, currentTimeContext);
    const resolvedDefaultTime = this.resolveDefaultTime(taskData, resolvedWindow);

    return {
      // Task basics
      taskName: taskData.taskName || '',
      description: taskData.description || '',
      
      // Priority and mandatory status with intelligent defaults
      priority: this.determinePriority(taskData),
      isMandatory: taskData.isMandatory || false,
      
      // Duration with intelligent min duration calculation
      durationMinutes: taskData.durationMinutes || 30,
      minDurationMinutes: this.calculateMinDuration(taskData),
      
      // Scheduling with context-aware defaults
      schedulingType: taskData.schedulingType || 'flexible',
      defaultTime: resolvedDefaultTime,
      timeWindow: resolvedWindow,
      
      // Dependencies
      dependsOn: taskData.dependsOn || null,
      
      // Recurrence with sensible defaults
      recurrenceRule: this.generateDefaultRecurrenceRule(taskData),
      
      // Status
      isActive: taskData.isActive !== undefined ? taskData.isActive : true
    };
  }

  /**
   * Determine a sensible default time based on explicit input or window
   * If scheduling is fixed and no explicit time, choose the start of the timeWindow.
   */
  resolveDefaultTime(taskData, timeWindow) {
    if (taskData && taskData.defaultTime) return taskData.defaultTime;
    const isFixed = taskData && taskData.schedulingType === 'fixed';
    if (!isFixed) return null;
    // Choose start of the window when known; fallback to 09:00
    const start = (TIME_WINDOWS[timeWindow]?.start) || '09:00';
    return start;
  }

  /**
   * Get current time context for intelligent defaults
   */
  getCurrentTimeContext() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = currentDay === 0 || currentDay === 6;
    
    // Determine time window based on current hour
    let timeWindow = 'anytime';
    if (currentHour >= this.timeWindowThresholds.morning.start && 
        currentHour < this.timeWindowThresholds.morning.end) {
      timeWindow = 'morning';
    } else if (currentHour >= this.timeWindowThresholds.afternoon.start && 
               currentHour < this.timeWindowThresholds.afternoon.end) {
      timeWindow = 'afternoon';
    } else if (currentHour >= this.timeWindowThresholds.evening.start && 
               currentHour < this.timeWindowThresholds.evening.end) {
      timeWindow = 'evening';
    }
    
    return {
      currentHour,
      currentDay,
      isWeekend,
      timeWindow,
      isBusinessHours: currentHour >= 9 && currentHour <= 17 && !isWeekend
    };
  }

  /**
   * Determine intelligent priority based on task characteristics
   */
  determinePriority(taskData) {
    if (taskData.priority !== undefined) {
      return taskData.priority;
    }

    // Default priority heuristics
    let priority = 3; // Default medium priority

    // Higher priority for shorter tasks (easier to fit in)
    if (taskData.durationMinutes && taskData.durationMinutes <= 15) {
      priority = Math.min(priority + 1, 5);
    }

    // Higher priority for mandatory tasks
    if (taskData.isMandatory) {
      priority = Math.min(priority + 1, 5);
    }

    // Lower priority for longer tasks (more flexible scheduling)
    if (taskData.durationMinutes && taskData.durationMinutes >= 120) {
      priority = Math.max(priority - 1, 1);
    }

    return priority;
  }

  /**
   * Calculate intelligent minimum duration for crunch time
   */
  calculateMinDuration(taskData) {
    if (taskData.minDurationMinutes !== undefined) {
      return taskData.minDurationMinutes;
    }

    const baseDuration = taskData.durationMinutes || 30;
    
    // Minimum duration is typically 50% of normal duration, with a floor of 15 minutes
    const calculatedMin = Math.floor(baseDuration * 0.5);
    return Math.max(15, calculatedMin);
  }

  /**
   * Determine optimal time window based on task characteristics and current context
   */
  determineTimeWindow(taskData, currentTimeContext) {
    if (taskData.timeWindow) {
      return taskData.timeWindow;
    }

    // Use current time context as default
    let timeWindow = currentTimeContext.timeWindow;

    // Override based on task characteristics
    if (taskData.taskName) {
      const taskName = taskData.taskName.toLowerCase();
      
      // Morning tasks
      if (taskName.includes('exercise') || taskName.includes('workout') || 
          taskName.includes('meditation') || taskName.includes('planning')) {
        timeWindow = 'morning';
      }
      
      // Afternoon tasks
      else if (taskName.includes('meeting') || taskName.includes('call') || 
               taskName.includes('work') || taskName.includes('project')) {
        timeWindow = 'afternoon';
      }
      
      // Evening tasks
      else if (taskName.includes('review') || taskName.includes('reflection') || 
               taskName.includes('reading') || taskName.includes('learning')) {
        timeWindow = 'evening';
      }
    }

    // Override for mandatory tasks during business hours
    if (taskData.isMandatory && currentTimeContext.isBusinessHours) {
      timeWindow = 'afternoon';
    }

    return timeWindow;
  }

  /**
   * Generate intelligent default recurrence rule
   */
  generateDefaultRecurrenceRule(taskData) {
    if (taskData.recurrenceRule) {
      return taskData.recurrenceRule;
    }

    // Default to no recurrence
    const defaultRule = {
      frequency: 'none',
      interval: 1,
      endDate: null,
      endAfterOccurrences: null,
      daysOfWeek: []
    };

    // Smart recurrence detection based on task name
    if (taskData.taskName) {
      const taskName = taskData.taskName.toLowerCase();
      
      // Daily tasks
      if (taskName.includes('daily') || taskName.includes('everyday') ||
          taskName.includes('habit') || taskName.includes('routine')) {
        defaultRule.frequency = 'daily';
      }
      
      // Weekly tasks
      else if (taskName.includes('weekly') || taskName.includes('every week') ||
               taskName.includes('meeting') || taskName.includes('review')) {
        defaultRule.frequency = 'weekly';
        defaultRule.daysOfWeek = [1]; // Default to Monday
      }
      
      // Workday tasks
      else if (taskName.includes('work') || taskName.includes('office') ||
               taskName.includes('business')) {
        defaultRule.frequency = 'custom';
        defaultRule.daysOfWeek = [1, 2, 3, 4, 5]; // Weekdays only
      }
    }

    return defaultRule;
  }

  /**
   * Apply context-aware defaults for specific task types
   */
  applyTaskTypeDefaults(taskData, taskType) {
    const baseDefaults = this.applySmartDefaults(taskData);
    
    switch (taskType) {
      case 'habit':
        return {
          ...baseDefaults,
          priority: 4, // High priority for habits
          recurrenceRule: { ...baseDefaults.recurrenceRule, frequency: 'daily' },
          durationMinutes: Math.min(baseDefaults.durationMinutes, 30), // Keep habits short
          timeWindow: 'morning' // Most habits work best in the morning
        };
        
      case 'meeting':
        return {
          ...baseDefaults,
          schedulingType: 'fixed', // Meetings are typically fixed
          priority: 5, // Highest priority
          isMandatory: true,
          timeWindow: 'afternoon' // Most meetings are in afternoon
        };
        
      case 'exercise':
        return {
          ...baseDefaults,
          timeWindow: 'morning', // Exercise works best in morning
          durationMinutes: Math.max(baseDefaults.durationMinutes, 45), // Exercise needs time
          priority: 4 // High priority for health
        };
        
      case 'learning':
        return {
          ...baseDefaults,
          timeWindow: 'evening', // Learning often works better in evening
          priority: 3, // Medium priority
          durationMinutes: Math.max(baseDefaults.durationMinutes, 60) // Learning needs focus time
        };
        
      default:
        return baseDefaults;
    }
  }

  /**
   * Detect task type from task name and description
   */
  detectTaskType(taskData) {
    const text = (taskData.taskName + ' ' + (taskData.description || '')).toLowerCase();
    
    if (text.match(/(habit|routine|daily|everyday)/)) return 'habit';
    if (text.match(/(meeting|call|appointment|interview)/)) return 'meeting';
    if (text.match(/(exercise|workout|gym|run|fitness)/)) return 'exercise';
    if (text.match(/(learn|study|course|tutorial|reading)/)) return 'learning';
    if (text.match(/(work|project|task|job)/)) return 'work';
    if (text.match(/(plan|review|reflect|organize)/)) return 'planning';
    
    return 'general';
  }

  /**
   * Apply intelligent defaults with task type detection
   */
  applyIntelligentDefaults(taskData) {
    const taskType = this.detectTaskType(taskData);
    return this.applyTaskTypeDefaults(taskData, taskType);
  }

  /**
   * Get default suggestions for user interface
   */
  getDefaultSuggestions(partialTaskData) {
    const currentContext = this.getCurrentTimeContext();
    const taskType = this.detectTaskType(partialTaskData);
    
    return {
      suggestedTimeWindow: this.determineTimeWindow(partialTaskData, currentContext),
      suggestedPriority: this.determinePriority(partialTaskData),
      suggestedDuration: partialTaskData.durationMinutes || this.getTypicalDurationForType(taskType),
      suggestedRecurrence: this.generateDefaultRecurrenceRule(partialTaskData),
      detectedTaskType: taskType,
      contextInfo: {
        currentTimeWindow: currentContext.timeWindow,
        isBusinessHours: currentContext.isBusinessHours,
        isWeekend: currentContext.isWeekend
      }
    };
  }

  /**
   * Get typical duration for task types
   */
  getTypicalDurationForType(taskType) {
    const typicalDurations = {
      habit: 15,
      meeting: 60,
      exercise: 45,
      learning: 90,
      work: 120,
      planning: 30,
      general: 30
    };
    
    return typicalDurations[taskType] || 30;
  }
}

console.log('✅ TemplateDefaultsService loaded');
