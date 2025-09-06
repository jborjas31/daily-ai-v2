/**
 * TaskDisplayLogic
 *
 * Centralized calculations used by UI components when rendering tasks.
 * Keeps business rules out of components.
 */

import { state } from '../state.js';

export const taskDisplayLogic = {
  /**
   * Compute task status for schedule item rendering
   * Returns { className, isOverdue, overdueMinutes }
   */
  getTaskStatus(task, currentDate) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const taskStartMinutes = this.timeStringToMinutes(task.scheduledTime);
    const taskEndMinutes = taskStartMinutes + task.durationMinutes;

    // Completed check via instances
    const instances = state.getTaskInstancesForDate(currentDate);
    const instance = instances.find(i => i.templateId === task.id);
    if (instance && instance.status === 'completed') {
      return { className: 'completed', isOverdue: false };
    }

    // Overdue
    if (currentMinutes > taskEndMinutes) {
      const overdueMinutes = currentMinutes - taskEndMinutes;
      return {
        className: task.isMandatory ? 'overdue-mandatory' : 'overdue-skippable',
        isOverdue: true,
        overdueMinutes
      };
    }

    // In progress
    if (currentMinutes >= taskStartMinutes && currentMinutes <= taskEndMinutes) {
      return { className: 'in-progress', isOverdue: false };
    }

    return { className: 'normal', isOverdue: false };
  },

  /**
   * Compute in-progress percentage
   */
  getTaskProgress(task) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const taskStartMinutes = this.timeStringToMinutes(task.scheduledTime);
    const taskEndMinutes = taskStartMinutes + task.durationMinutes;

    if (currentMinutes >= taskStartMinutes && currentMinutes <= taskEndMinutes) {
      const elapsed = currentMinutes - taskStartMinutes;
      const progress = (elapsed / task.durationMinutes) * 100;
      return Math.max(0, Math.min(100, progress));
    }
    return 0;
  },

  /**
   * Derive category from task name/description
   */
  determineTaskCategory(task) {
    const categories = {
      work: ['meeting', 'call', 'email', 'report', 'project', 'deadline', 'presentation', 'review'],
      health: ['exercise', 'workout', 'gym', 'run', 'walk', 'yoga', 'meditation', 'doctor', 'appointment'],
      personal: ['grocery', 'shopping', 'chore', 'clean', 'laundry', 'cook', 'meal', 'family', 'friend'],
      creative: ['write', 'design', 'create', 'art', 'music', 'paint', 'draw', 'blog', 'video'],
      learning: ['read', 'study', 'course', 'tutorial', 'learn', 'practice', 'research', 'book'],
      social: ['dinner', 'party', 'social', 'visit', 'hangout', 'date', 'event', 'celebration'],
    };

    const text = `${task.taskName} ${task.description || ''}`.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) return category;
    }
    return 'general';
  },

  timeStringToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  },

  minutesToTimeString(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
};

