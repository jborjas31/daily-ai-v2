/**
 * SchedulingEngine.js
 * 
 * Advanced Task Scheduling System
 * 
 * This module implements the core scheduling algorithms for automatic task arrangement.
 * It provides intelligent task placement considering:
 * - Time constraints and availability windows
 * - Task dependencies and execution order
 * - Priority-based optimization
 * - Conflict detection and resolution
 * 
 * The scheduling engine follows a 5-step process:
 * 1. Place Anchors (mandatory fixed-time tasks)
 * 2. Resolve Dependencies (topological ordering)  
 * 3. Slot Flexible Tasks (optimal time placement)
 * 4. Crunch-Time Adjustments (future enhancement)
 * 5. Detect and Mark Conflicts (comprehensive validation)
 */

import { RecurrenceEngine } from './Recurrence.js';
import { DependencyResolver } from './DependencyResolver.js';
import { state } from '../state.js';
import { TIME_WINDOWS } from '../constants/timeWindows.js';

// Time windows imported from constants module

/**
 * Advanced Scheduling Engine for Intelligent Task Arrangement
 * 
 * Provides comprehensive scheduling capabilities with dependency resolution,
 * conflict detection, and optimization algorithms for daily task management.
 */
export class SchedulingEngine {
  /**
   * Initialize SchedulingEngine with dependency injection
   * @param {RecurrenceEngine} recurrenceEngine - Engine for recurrence pattern evaluation
   * @param {DependencyResolver} dependencyResolver - Resolver for task dependencies (future integration)
   */
  constructor(recurrenceEngine = null, dependencyResolver = null) {
    this.recurrenceEngine = recurrenceEngine || new RecurrenceEngine();
    this.dependencyResolver = dependencyResolver || new DependencyResolver();
  }

  /**
   * Smart scheduling: find optimal time slots for a new task
   * Returns array of { startTime, endTime, availableDuration, score, timeBlock, reason }
   */
  findOptimalTimeSlots(durationMinutes, schedule, preferences = {}) {
    if (!Array.isArray(schedule) || schedule.length === 0) return [];

    const {
      preferredTimeBlocks = ['morning', 'afternoon', 'evening'],
      avoidConflicts = true,
      bufferMinutes = 15,
      maxSuggestions = 5
    } = preferences;

    const timeBlocks = {
      morning: { start: 6, end: 12 },
      afternoon: { start: 12, end: 18 },
      evening: { start: 18, end: 23 }
    };

    const suggestions = [];
    for (const blockName of preferredTimeBlocks) {
      const block = timeBlocks[blockName];
      if (!block) continue;
      const slots = this.findAvailableSlots(
        block.start * 60,
        block.end * 60,
        durationMinutes,
        schedule,
        bufferMinutes,
        avoidConflicts
      );
      suggestions.push(
        ...slots.map(slot => ({
          ...slot,
          timeBlock: blockName,
          reason: this.getRecommendationReason(slot, blockName, schedule)
        }))
      );
    }
    return suggestions.sort((a, b) => b.score - a.score).slice(0, maxSuggestions);
  }

  findAvailableSlots(startMinutes, endMinutes, durationMinutes, schedule, bufferMinutes, avoidConflicts) {
    const slots = [];
    const busyPeriods = [];
    if (avoidConflicts) {
      schedule.forEach(task => {
        const taskStart = this.timeStringToMinutes(task.scheduledTime);
        const taskEnd = taskStart + (task.durationMinutes || 0);
        busyPeriods.push({ start: taskStart - bufferMinutes, end: taskEnd + bufferMinutes });
      });
      busyPeriods.sort((a, b) => a.start - b.start);
    }
    let currentTime = startMinutes;
    for (const busy of busyPeriods) {
      if (busy.start > currentTime) {
        const gap = busy.start - currentTime;
        if (gap >= durationMinutes) {
          slots.push({
            startTime: this.minutesToTimeString(currentTime),
            endTime: this.minutesToTimeString(currentTime + durationMinutes),
            availableDuration: gap,
            score: this.calculateSlotScore(currentTime, durationMinutes, schedule)
          });
        }
      }
      currentTime = Math.max(currentTime, busy.end);
    }
    if (currentTime < endMinutes) {
      const gap = endMinutes - currentTime;
      if (gap >= durationMinutes) {
        slots.push({
          startTime: this.minutesToTimeString(currentTime),
          endTime: this.minutesToTimeString(currentTime + durationMinutes),
          availableDuration: gap,
          score: this.calculateSlotScore(currentTime, durationMinutes, schedule)
        });
      }
    }
    return slots;
  }

  calculateSlotScore(startMinutes, durationMinutes, schedule) {
    let score = 100;
    const hour = Math.floor(startMinutes / 60);
    if (hour >= 9 && hour < 17) score += 20;
    else if (hour >= 8 && hour < 19) score += 10;
    if (hour < 7 || hour > 21) score -= 30;

    const endMinutes = startMinutes + durationMinutes;
    const nextTask = schedule.find(t => this.timeStringToMinutes(t.scheduledTime) > endMinutes);
    if (nextTask) {
      const buffer = this.timeStringToMinutes(nextTask.scheduledTime) - endMinutes;
      if (buffer > 30) score += 15;
      else if (buffer > 15) score += 5;
    }
    if (startMinutes % 15 === 0) score += 5;
    return score;
  }

  getRecommendationReason(slot, timeBlock, schedule) {
    const reasons = [];
    const startMinutes = this.timeStringToMinutes(slot.startTime);
    const hour = Math.floor(startMinutes / 60);
    if (timeBlock === 'morning' && hour >= 9) reasons.push('Good morning focus time');
    else if (timeBlock === 'afternoon' && hour >= 13 && hour < 16) reasons.push('Peak afternoon productivity');
    else if (timeBlock === 'evening' && hour >= 18) reasons.push('Evening availability');
    if (slot.availableDuration > 120) reasons.push('Plenty of buffer time');
    if (slot.score > 120) reasons.push('Optimal schedule fit');
    return reasons.length ? reasons.join(' • ') : 'Available time slot';
  }

  timeStringToMinutes(str) {
    const [h, m] = str.split(':').map(Number);
    return (h * 60) + m;
  }

  minutesToTimeString(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  /**
   * Generate optimized schedule for a specific date
   * 
   * Main entry point for schedule generation. Orchestrates the entire
   * scheduling process from task filtering to conflict detection.
   * 
   * @param {string} date - Target date in YYYY-MM-DD format
   * @returns {Object} Schedule generation result with success status and schedule data
   */
  generateScheduleForDate(date) {
    try {
      const settings = state.getSettings();
      const templates = state.getTaskTemplates();
      const instances = state.getTaskInstancesForDate(date);
      const dailySchedule = state.getDailyScheduleForDate(date);
      
      // Get effective sleep schedule (daily override or default)
      const sleepSchedule = this.getEffectiveSleepSchedule(settings, dailySchedule);
      
      // Filter active tasks for this date
      const activeTasks = this.getActiveTasksForDate(templates, instances, date);
      
      // Run impossibility check first
      const impossibilityCheck = this.checkScheduleImpossibility(activeTasks, sleepSchedule);
      if (!impossibilityCheck.possible) {
        return {
          success: false,
          error: 'impossible_schedule',
          message: impossibilityCheck.message,
          suggestions: impossibilityCheck.suggestions,
          schedule: []
        };
      }
      
      // Generate schedule using the 5-step process
      const schedule = this.runSchedulingAlgorithm(activeTasks, sleepSchedule);
      
      return {
        success: true,
        schedule: schedule,
        sleepSchedule: sleepSchedule,
        totalTasks: activeTasks.length,
        scheduledTasks: schedule.length
      };
      
    } catch (error) {
      console.error('❌ Error generating schedule:', error);
      return {
        success: false,
        error: 'scheduling_error',
        message: 'Failed to generate schedule',
        schedule: []
      };
    }
  }

  /**
   * Get effective sleep schedule (daily override or default settings)
   * 
   * @param {Object} settings - User settings with default sleep times
   * @param {Object} dailySchedule - Daily schedule override (optional)
   * @returns {Object} Effective sleep schedule with wake/sleep times and duration
   */
  getEffectiveSleepSchedule(settings, dailySchedule) {
    if (dailySchedule) {
      return {
        wakeTime: dailySchedule.wakeTime,
        sleepTime: dailySchedule.sleepTime,
        duration: settings.desiredSleepDuration // Keep the same duration
      };
    }
    
    return {
      wakeTime: settings.defaultWakeTime,
      sleepTime: settings.defaultSleepTime,
      duration: settings.desiredSleepDuration
    };
  }

  /**
   * Get active tasks for specific date (excluding completed/skipped instances)
   * 
   * Filters task templates to include only those that should occur on the given
   * date and haven't been completed or skipped.
   * 
   * @param {Array} templates - Task template collection
   * @param {Array} instances - Task instance collection for the date
   * @param {string} date - Target date in YYYY-MM-DD format
   * @returns {Array} Filtered array of active task templates
   */
  getActiveTasksForDate(templates, instances, date) {
    const completedTaskIds = new Set();
    const skippedTaskIds = new Set();
    
    // Track which tasks are completed or skipped for this date
    instances.forEach(instance => {
      if (instance.status === 'completed') {
        completedTaskIds.add(instance.templateId);
      } else if (instance.status === 'skipped') {
        skippedTaskIds.add(instance.templateId);
      }
    });
    
    // Return only active tasks (not completed or skipped)
    return templates.filter(task => {
      // Check if task should occur on this date using RecurrenceEngine
      const shouldOccur = this.shouldTaskOccurOnDate(task, date);
      
      return shouldOccur && 
             !completedTaskIds.has(task.id) && 
             !skippedTaskIds.has(task.id);
    });
  }

  /**
   * Check if task should occur on specific date using recurrence rules
   * 
   * @param {Object} task - Task template with recurrence configuration
   * @param {string} date - Target date in YYYY-MM-DD format
   * @returns {boolean} True if task should occur on the specified date
   */
  shouldTaskOccurOnDate(task, date) {
    // Use RecurrenceEngine for comprehensive recurrence logic
    return this.recurrenceEngine.shouldGenerateForDate(task, date);
  }

  /**
   * Check if schedule generation is impossible due to time constraints
   * 
   * Performs early validation to detect impossible schedules where mandatory
   * tasks exceed available time capacity.
   * 
   * @param {Array} tasks - Collection of active tasks for scheduling
   * @param {Object} sleepSchedule - Sleep schedule with duration constraints
   * @returns {Object} Possibility check result with suggestions if impossible
   */
  checkScheduleImpossibility(tasks, sleepSchedule) {
    const mandatoryTasks = tasks.filter(task => task.isMandatory);
    const totalMandatoryMinutes = mandatoryTasks.reduce((sum, task) => sum + task.durationMinutes, 0);
    
    // Calculate available waking hours (assume 24 - sleep duration)
    const availableMinutes = (24 - sleepSchedule.duration) * 60;
    
    if (totalMandatoryMinutes > availableMinutes) {
      return {
        possible: false,
        message: `${mandatoryTasks.length} mandatory tasks require ${Math.round(totalMandatoryMinutes/60)} hours, but only ${Math.round(availableMinutes/60)} hours available.`,
        suggestions: [
          'Reduce sleep duration in settings',
          'Make some tasks skippable instead of mandatory',
          'Reduce duration of mandatory tasks',
          'Postpone some tasks to another day'
        ]
      };
    }
    
    return { possible: true };
  }

  /**
   * Execute the comprehensive 5-step scheduling algorithm
   * 
   * Core scheduling orchestrator that applies the complete scheduling process:
   * 1. Place Anchors - Fixed-time mandatory tasks
   * 2. Resolve Dependencies - Topological ordering with constraints
   * 3. Slot Flexible Tasks - Optimal placement in available windows  
   * 4. Crunch-Time Adjustments - Future optimization phase
   * 5. Detect Conflicts - Comprehensive validation and marking
   * 
   * @param {Array} tasks - Collection of tasks to schedule
   * @param {Object} sleepSchedule - Sleep constraints and available time windows
   * @returns {Array} Fully scheduled task collection with conflict detection
   */
  runSchedulingAlgorithm(tasks, sleepSchedule) {
    // Step 1: Place Anchors (mandatory fixed-time tasks)
    const anchors = this.placeAnchors(tasks);
    
    // Step 2: Resolve Dependencies
    const dependencyOrder = this.resolveDependencies(tasks);
    
    // Step 3: Slot Flexible Tasks
    const schedule = this.slotFlexibleTasks(tasks, anchors, dependencyOrder, sleepSchedule);
    
    // Step 4: Crunch-Time Adjustments (will be implemented in later phases)
    
    // Step 5: Conflict Detection
    const scheduleWithConflicts = this.detectAndMarkConflicts(schedule);
    
    return scheduleWithConflicts;
  }

  /**
   * Step 1: Place mandatory fixed-time tasks as scheduling anchors
   * 
   * Identifies and places tasks that have mandatory fixed times, creating
   * immovable anchor points around which flexible tasks will be scheduled.
   * 
   * @param {Array} tasks - Collection of tasks to evaluate for anchor placement
   * @returns {Array} Sorted collection of anchor tasks with scheduled times
   */
  placeAnchors(tasks) {
    const anchors = tasks
      .filter(task => task.isMandatory && task.schedulingType === 'fixed' && task.defaultTime)
      .map(task => ({
        ...task,
        scheduledTime: task.defaultTime,
        isAnchor: true
      }))
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    
    console.log(`📍 Placed ${anchors.length} anchor tasks`);
    return anchors;
  }

  /**
   * Step 2: Resolve task dependencies and determine execution order
   * 
   * Implements topological sorting using Kahn's algorithm to establish
   * proper task execution order while respecting dependency constraints.
   * 
   * @param {Array} tasks - Collection of tasks with potential dependencies
   * @returns {Array} Topologically sorted task collection respecting all dependencies
   */
  resolveDependencies(tasks) {
    // Build dependency graph for task templates
    const dependencyGraph = new Map();
    const taskMap = new Map();
    
    // Initialize graph nodes
    tasks.forEach(task => {
      taskMap.set(task.id, task);
      dependencyGraph.set(task.id, {
        task,
        dependencies: [],
        dependents: []
      });
    });
    
    // Build dependency relationships (supports multiple dependencies)
    tasks.forEach(task => {
      if (!task.dependsOn) return;
      const node = dependencyGraph.get(task.id);
      const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [task.dependsOn];
      deps.forEach(depId => {
        if (taskMap.has(depId)) {
          node.dependencies.push(depId);
          const depNode = dependencyGraph.get(depId);
          if (depNode) depNode.dependents.push(task.id);
        }
      });
    });
    
    // Perform topological sort using Kahn's algorithm
    const result = [];
    const inDegree = new Map();
    const queue = [];
    
    // Calculate in-degrees
    dependencyGraph.forEach((node, taskId) => {
      inDegree.set(taskId, node.dependencies.length);
      if (node.dependencies.length === 0) {
        queue.push(taskId);
      }
    });
    
    // Process queue
    while (queue.length > 0) {
      // Sort queue by priority for stable ordering
      queue.sort((a, b) => {
        const taskA = taskMap.get(a);
        const taskB = taskMap.get(b);
        return taskB.priority - taskA.priority;
      });
      
      const currentId = queue.shift();
      const currentTask = taskMap.get(currentId);
      result.push(currentTask);
      
      // Update dependents
      const node = dependencyGraph.get(currentId);
      node.dependents.forEach(dependentId => {
        const newInDegree = inDegree.get(dependentId) - 1;
        inDegree.set(dependentId, newInDegree);
        if (newInDegree === 0) {
          queue.push(dependentId);
        }
      });
    }
    
    // Check for circular dependencies
    if (result.length !== tasks.length) {
      console.warn('⚠️ Circular dependencies detected in task templates');
      // Fall back to priority-based sorting for remaining tasks
      const remainingTasks = tasks.filter(task => !result.some(r => r.id === task.id));
      remainingTasks.sort((a, b) => b.priority - a.priority);
      result.push(...remainingTasks);
    }
    
    console.log('🔗 Resolved task dependencies with topological sort');
    return result;
  }

  /**
   * Step 3: Slot flexible tasks into available time windows with dependency awareness
   * 
   * Implements intelligent task placement considering time windows, dependencies,
   * and existing schedule constraints. Uses dependency-aware earliest start time
   * calculation and conflict avoidance algorithms.
   * 
   * @param {Array} tasks - All tasks for scheduling
   * @param {Array} anchors - Pre-placed anchor tasks
   * @param {Array} orderedTasks - Dependency-ordered task sequence  
   * @param {Object} sleepSchedule - Sleep constraints and available windows
   * @returns {Array} Complete schedule with flexible tasks optimally placed
   */
  slotFlexibleTasks(tasks, anchors, orderedTasks, sleepSchedule) {
    const schedule = [...anchors];
    const taskMap = new Map();
    
    // Create lookup map for all tasks
    tasks.forEach(task => taskMap.set(task.id, task));
    
    // Build dependency map for quick lookups (taskId -> string[])
    const dependencyMap = new Map();
    orderedTasks.forEach(task => {
      if (task.dependsOn) {
        const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [task.dependsOn];
        if (deps.length > 0) dependencyMap.set(task.id, deps);
      }
    });
    
    const flexibleTasks = orderedTasks.filter(task => 
      task.schedulingType === 'flexible' || (!task.isMandatory || !task.defaultTime)
    );
    
    // Process tasks in dependency order (topological order already established)
    flexibleTasks.forEach(task => {
      const timeWindow = TIME_WINDOWS[task.timeWindow] || TIME_WINDOWS.anytime;
      
      // Calculate earliest possible start time based on dependencies
      const earliestStart = this.calculateEarliestStartTime(task, schedule, dependencyMap);
      
      // Find best available slot considering dependencies
      const bestSlot = this.findBestTimeSlot(task, schedule, timeWindow, sleepSchedule, earliestStart);
      
      if (bestSlot) {
        const scheduledTask = {
          ...task,
          scheduledTime: bestSlot,
          isFlexible: true
        };
        
        // Validate dependency constraints
        if (this.validateDependencyConstraints(scheduledTask, schedule, dependencyMap)) {
          schedule.push(scheduledTask);
        } else {
          // Fall back to a safe slot if dependency validation fails
          const safeSlot = this.findSafeSlot(task, schedule, timeWindow, sleepSchedule, earliestStart);
          if (safeSlot) {
            schedule.push({
              ...task,
              scheduledTime: safeSlot,
              isFlexible: true,
              dependencyAdjusted: true
            });
          }
        }
      }
    });
    
    // Sort final schedule by time
    return schedule.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }

  /**
   * Calculate earliest possible start time based on task dependencies
   * 
   * Determines the minimum start time for a task by analyzing its dependencies
   * and ensuring proper execution order with appropriate buffers.
   * 
   * @param {Object} task - Task requiring earliest start time calculation
   * @param {Array} schedule - Current schedule with placed tasks
   * @param {Map} dependencyMap - Map of task IDs to their dependency IDs
   * @returns {string|null} Earliest start time in HH:MM format, or null if no dependencies
   */
  calculateEarliestStartTime(task, schedule, dependencyMap) {
    if (!dependencyMap.has(task.id)) return null; // No dependencies

    const depIds = dependencyMap.get(task.id) || [];
    let maxEnd = null;
    depIds.forEach(depId => {
      const dep = schedule.find(t => t.id === depId);
      if (!dep || !dep.scheduledTime) return;
      const start = this.timeStringToMinutes(dep.scheduledTime);
      const end = start + (dep.durationMinutes || 30);
      if (maxEnd === null || end > maxEnd) maxEnd = end;
    });

    if (maxEnd === null) return null; // Dependencies not scheduled yet

    // Add 5-minute buffer after the latest dependency completes
    return this.minutesToTimeString(maxEnd + 5);
  }

  /**
   * Find optimal time slot for flexible task with dependency awareness
   * 
   * Implements intelligent time slot selection considering time windows,
   * dependency constraints, and existing schedule conflicts.
   * 
   * @param {Object} task - Task requiring time slot placement
   * @param {Array} existingSchedule - Current schedule to avoid conflicts
   * @param {Object} timeWindow - Preferred time window constraints
   * @param {Object} sleepSchedule - Sleep schedule constraints
   * @param {string|null} earliestStart - Minimum start time due to dependencies
   * @returns {string|null} Optimal time slot in HH:MM format, or null if unavailable
   */
  findBestTimeSlot(task, existingSchedule, timeWindow, sleepSchedule, earliestStart = null) {
    const durationMinutes = task.durationMinutes || 30;
    const windowStartMinutes = this.timeStringToMinutes(timeWindow.start);
    const windowEndMinutes = this.timeStringToMinutes(timeWindow.end);
    
    // Determine actual start time considering dependencies
    let actualStartMinutes = windowStartMinutes;
    if (earliestStart) {
      const earliestStartMinutes = this.timeStringToMinutes(earliestStart);
      actualStartMinutes = Math.max(windowStartMinutes, earliestStartMinutes);
    }
    
    // If earliest start is beyond window, return null
    if (actualStartMinutes >= windowEndMinutes) {
      return null;
    }
    
    // Find first available slot starting from actual start time
    for (let startTime = actualStartMinutes; startTime <= windowEndMinutes - durationMinutes; startTime += 15) {
      const endTime = startTime + durationMinutes;
      
      // Check if this slot conflicts with existing schedule
      const hasConflict = existingSchedule.some(scheduledTask => {
        if (!scheduledTask.scheduledTime) return false;
        
        const schedStartMinutes = this.timeStringToMinutes(scheduledTask.scheduledTime);
        const schedEndMinutes = schedStartMinutes + (scheduledTask.durationMinutes || 30);
        
        return this.hasTimeOverlap(startTime, endTime, schedStartMinutes, schedEndMinutes);
      });
      
      if (!hasConflict) {
        return this.minutesToTimeString(startTime);
      }
    }
    
    return null; // No available slot found
  }

  /**
   * Validate that a scheduled task respects its dependency constraints
   * 
   * Ensures that the proposed task scheduling maintains proper dependency
   * execution order and timing requirements.
   * 
   * @param {Object} scheduledTask - Task with proposed scheduled time
   * @param {Array} schedule - Current schedule for dependency lookup
   * @param {Map} dependencyMap - Map of task dependencies
   * @returns {boolean} True if dependency constraints are satisfied
   */
  validateDependencyConstraints(scheduledTask, schedule, dependencyMap) {
    if (!dependencyMap.has(scheduledTask.id)) return true; // No dependencies to validate

    const depIds = dependencyMap.get(scheduledTask.id) || [];
    const taskStart = this.timeStringToMinutes(scheduledTask.scheduledTime);

    // All dependencies must be scheduled and completed before this task starts
    for (const depId of depIds) {
      const dep = schedule.find(t => t.id === depId);
      if (!dep || !dep.scheduledTime) return false;
      const depStart = this.timeStringToMinutes(dep.scheduledTime);
      const depEnd = depStart + (dep.durationMinutes || 30);
      if (taskStart < depEnd) return false;
    }
    return true;
  }

  /**
   * Find a safe time slot with guaranteed dependency constraint satisfaction
   * 
   * Fallback slot finder that ensures dependency constraints are met by
   * adding additional time buffers for conflict resolution.
   * 
   * @param {Object} task - Task requiring safe slot placement
   * @param {Array} schedule - Current schedule
   * @param {Object} timeWindow - Time window constraints
   * @param {Object} sleepSchedule - Sleep schedule constraints
   * @param {string|null} earliestStart - Dependency-based earliest start time
   * @returns {string|null} Safe time slot in HH:MM format
   */
  findSafeSlot(task, schedule, timeWindow, sleepSchedule, earliestStart) {
    if (!earliestStart) {
      return this.findBestTimeSlot(task, schedule, timeWindow, sleepSchedule);
    }
    
    // Start searching from earliest start time with larger buffer
    const earliestStartMinutes = this.timeStringToMinutes(earliestStart);
    const safeStartMinutes = earliestStartMinutes + 10; // 10-minute buffer
    const safeStartTime = this.minutesToTimeString(safeStartMinutes);
    
    return this.findBestTimeSlot(task, schedule, timeWindow, sleepSchedule, safeStartTime);
  }

  /**
   * Step 5: Comprehensive conflict detection and marking system
   * 
   * Analyzes the complete schedule to identify and categorize conflicts:
   * - Time overlap conflicts between tasks
   * - Dependency violation conflicts
   * - Missing dependency conflicts
   * 
   * Provides detailed conflict information for resolution and user feedback.
   * 
   * @param {Array} schedule - Complete schedule for conflict analysis
   * @returns {Array} Schedule with comprehensive conflict detection and marking
   */
  detectAndMarkConflicts(schedule) {
    if (!schedule || schedule.length === 0) {
      return schedule;
    }

    // Create a copy of schedule to avoid mutating original
    const scheduleWithConflicts = schedule.map(task => ({ ...task }));
    
    // Sort by scheduled time for easier conflict detection
    const sortedSchedule = [...scheduleWithConflicts].sort((a, b) => {
      if (!a.scheduledTime || !b.scheduledTime) return 0;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });

    // Build task lookup map for dependency checking
    const taskMap = new Map();
    sortedSchedule.forEach(task => taskMap.set(task.id, task));

    // Check each task for conflicts
    for (let i = 0; i < sortedSchedule.length; i++) {
      const taskA = sortedSchedule[i];
      if (!taskA.scheduledTime) continue;

      const taskAStart = this.timeStringToMinutes(taskA.scheduledTime);
      const taskAEnd = taskAStart + (taskA.durationMinutes || 0);

      const conflicts = [];
      const dependencyConflicts = [];

      // Check for time overlap conflicts
      for (let j = 0; j < sortedSchedule.length; j++) {
        if (i === j) continue; // Don't compare task with itself
        
        const taskB = sortedSchedule[j];
        if (!taskB.scheduledTime) continue;

        const taskBStart = this.timeStringToMinutes(taskB.scheduledTime);
        const taskBEnd = taskBStart + (taskB.durationMinutes || 0);

        // Check for time overlap
        if (this.hasTimeOverlap(taskAStart, taskAEnd, taskBStart, taskBEnd)) {
          conflicts.push({
            type: 'time_overlap',
            conflictWith: taskB.id,
            conflictWithName: taskB.taskName,
            overlapStart: Math.max(taskAStart, taskBStart),
            overlapEnd: Math.min(taskAEnd, taskBEnd),
            overlapMinutes: Math.min(taskAEnd, taskBEnd) - Math.max(taskAStart, taskBStart)
          });
        }
      }

      // Check for dependency conflicts (support multiple dependencies)
      if (taskA.dependsOn) {
        const deps = Array.isArray(taskA.dependsOn) ? taskA.dependsOn : [taskA.dependsOn];
        deps.forEach(depId => {
          const dependency = taskMap.get(depId);
          if (dependency && dependency.scheduledTime) {
            const depStart = this.timeStringToMinutes(dependency.scheduledTime);
            const depEnd = depStart + (dependency.durationMinutes || 30);
            if (taskAStart < depEnd) {
              dependencyConflicts.push({
                type: 'dependency_violation',
                conflictWith: dependency.id,
                conflictWithName: dependency.taskName,
                issue: 'Task starts before dependency completes',
                taskStart: taskA.scheduledTime,
                dependencyEnd: this.minutesToTimeString(depEnd),
                violationMinutes: depEnd - taskAStart
              });
            }
          } else {
            dependencyConflicts.push({
              type: 'missing_dependency',
              conflictWith: depId,
              conflictWithName: 'Unknown Task',
              issue: 'Required dependency not scheduled'
            });
          }
        });
      }

      // Combine all conflicts
      const allConflicts = [...conflicts, ...dependencyConflicts];

      // Mark task with conflicts
      if (allConflicts.length > 0) {
        taskA.hasConflicts = true;
        taskA.conflicts = allConflicts;
        
        // Determine primary conflict type
        if (dependencyConflicts.length > 0) {
          taskA.conflictType = 'dependency_violation';
        } else {
          taskA.conflictType = 'time_overlap';
        }
        
        taskA.conflictSeverity = this.calculateConflictSeverity(allConflicts);
      } else {
        taskA.hasConflicts = false;
        taskA.conflicts = [];
        taskA.conflictType = null;
      }
    }

    const totalConflicts = sortedSchedule.filter(t => t.hasConflicts).length;
    const dependencyConflictCount = sortedSchedule.filter(t => t.conflictType === 'dependency_violation').length;
    const timeOverlapCount = totalConflicts - dependencyConflictCount;
    
    console.log(`✅ Conflict detection complete: ${totalConflicts} total conflicts (${timeOverlapCount} time overlaps, ${dependencyConflictCount} dependency violations)`);
    return scheduleWithConflicts;
  }

  /**
   * Check if two time ranges have any temporal overlap
   * 
   * @param {number} start1 - Start time of first range (minutes)
   * @param {number} end1 - End time of first range (minutes)
   * @param {number} start2 - Start time of second range (minutes)
   * @param {number} end2 - End time of second range (minutes)
   * @returns {boolean} True if ranges overlap
   */
  hasTimeOverlap(start1, end1, start2, end2) {
    return Math.max(start1, start2) < Math.min(end1, end2);
  }

  /**
   * Calculate conflict severity based on conflict types and impact level
   * 
   * Provides intelligent severity assessment for conflict prioritization
   * and user attention direction.
   * 
   * @param {Array} conflicts - Array of conflict objects
   * @returns {string} Severity level: 'none', 'low', 'medium', or 'high'
   */
  calculateConflictSeverity(conflicts) {
    if (!conflicts || conflicts.length === 0) return 'none';
    
    // Check for dependency violations (always high severity)
    const hasDependencyViolation = conflicts.some(c => 
      c.type === 'dependency_violation' || c.type === 'missing_dependency'
    );
    
    if (hasDependencyViolation) return 'high';
    
    // For time overlap conflicts, use duration-based severity
    const timeOverlapConflicts = conflicts.filter(c => c.type === 'time_overlap');
    if (timeOverlapConflicts.length === 0) return 'low';
    
    const maxOverlap = Math.max(...timeOverlapConflicts.map(c => c.overlapMinutes || 0));
    
    if (maxOverlap >= 60) return 'high';     // 1+ hour overlap
    if (maxOverlap >= 30) return 'medium';   // 30+ minute overlap
    return 'low';                            // Less than 30 minutes
  }

  /**
   * Convert time string (HH:MM format) to minutes since midnight
   * 
   * @param {string} timeString - Time in HH:MM format
   * @returns {number} Minutes since midnight (0-1439)
   */
  timeStringToMinutes(timeString) {
    if (!timeString || typeof timeString !== 'string') return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return (hours * 60) + (minutes || 0);
  }

  /**
   * Convert minutes since midnight to time string (HH:MM format)
   * 
   * @param {number} minutes - Minutes since midnight
   * @returns {string} Time string in HH:MM format
   */
  minutesToTimeString(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Get current time as formatted time string
   * 
   * @returns {string} Current time in HH:MM format
   */
  getCurrentTimeString() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }
}
