/**
 * Task Logic and Scheduling Engine
 * 
 * This module contains the core "Secret Sauce" intelligent scheduling logic
 * and all task-related business logic operations.
 */

import { RecurrenceEngine } from './logic/Recurrence.js';
import { DependencyResolver } from './logic/DependencyResolver.js';
import { SchedulingEngine } from './logic/SchedulingEngine.js';
import { TaskInstanceManager } from './logic/TaskInstanceManager.js';
import { TaskTemplateManager } from './logic/TaskTemplateManager.js';
export { TIME_WINDOWS } from './constants/timeWindows.js';

// Time windows now sourced from constants/timeWindows.js

/**
 * Streamlined Task Template Manager - Using Extracted Logic Module
 * Phase 5 Step 5.2: Business logic extracted to separate services
 * 
 * Note: Complex systems extracted to services:
 * - Smart defaults -> TemplateDefaultsService
 * - Bulk operations -> TemplateOperationsService 
 * - Validation -> TaskValidation utils (direct usage)
 */

// Create singleton instance
export const taskTemplateManager = new TaskTemplateManager();

/**
 * Task Instance Manager - Singleton Instance
 * Will be instantiated after class definition to avoid initialization errors
 */

/**
 * Intelligent Scheduling Engine - "Secret Sauce"
 * 
 * This is the core scheduling logic that automatically arranges tasks
 * based on priorities, dependencies, and time constraints.
 */
export const schedulingEngine = new SchedulingEngine(new RecurrenceEngine(), new DependencyResolver());

/**
 * Search and Filter Logic
 */

/**
 * Real-time Task State Logic
 */
export const realTimeTaskLogic = {
  /**
   * Check for overdue tasks based on current time
   */
  checkOverdueTasks(schedule, currentTime) {
    const overdueTasks = [];
    const currentTimeMinutes = this.timeStringToMinutes(currentTime);
    
    schedule.forEach(task => {
      const taskStartMinutes = this.timeStringToMinutes(task.scheduledTime);
      const taskEndMinutes = taskStartMinutes + task.durationMinutes;
      
      if (currentTimeMinutes > taskEndMinutes) {
        overdueTasks.push({
          ...task,
          isOverdue: true,
          overdueMinutes: currentTimeMinutes - taskEndMinutes
        });
      }
    });
    
    return overdueTasks;
  },

  /**
   * Convert time string (HH:MM) to minutes since midnight
   */
  timeStringToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  },

  /**
   * Convert minutes since midnight to time string (HH:MM)
   */
  minutesToTimeString(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  },

  /**
   * Get current time as HH:MM string
   */
  getCurrentTimeString() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }
};

/**
 * Streamlined Task Instance Manager - Using Extracted Logic Module
 * Phase 5 Step 5.1: Manager classes now use extracted logic components
 * 
 * Note: Complex systems extracted to separate services:
 * - Bulk generation -> InstanceGenerationService (future)
 * - Conflict resolution -> ConflictResolutionService (future) 
 * - Optimization -> SchedulingOptimizationService (future)
 */

// Streamlined TaskInstanceManager singleton with RecurrenceEngine dependency injection
export const taskInstanceManager = new TaskInstanceManager(new RecurrenceEngine());

console.log('✅ Task logic and scheduling engine initialized');
