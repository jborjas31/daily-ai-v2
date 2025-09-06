/**
 * Task Block Component
 * 
 * Reusable component for rendering individual task blocks
 * Used in timeline, task lists, and other views
 */

import { state } from '../state.js';
import { taskInstanceManager } from '../taskLogic.js';
import { SafeEventListener, ComponentManager } from '../utils/MemoryLeakPrevention.js';
import { SimpleErrorHandler } from '../utils/SimpleErrorHandler.js';
import { editTask, duplicateTask } from '../logic/TaskActions.js';

/**
 * Task Block Component Class
 */
export class TaskBlock {
  constructor(task, options = {}) {
    this.task = task;
    this.options = {
      showActions: true,
      showMeta: true,
      showStatus: true,
      size: 'normal', // 'compact', 'normal', 'large'
      interactive: true,
      ...options
    };
    
    this.element = null;
    this.eventListeners = [];
    
    // Register with memory manager for automatic cleanup
    ComponentManager.register(this);
  }

  /**
   * Render task block element
   */
  render() {
    this.element = document.createElement('div');
    this.element.className = this.getBlockClasses();
    this.element.dataset.taskId = this.task.id;
    this.element.innerHTML = this.getBlockHTML();
    
    if (this.options.interactive) {
      this.setupEventListeners();
    }
    
    return this.element;
  }

  /**
   * Get CSS classes for task block
   */
  getBlockClasses() {
    let classes = ['tl-task', 'task-block', `task-block-${this.options.size}`];
    
    // Add status classes
    if (this.options.showStatus) {
      const status = this.getTaskStatus();
      classes.push(...status.classes);
    }
    
    // Add interaction class
    if (this.options.interactive) {
      classes.push('interactive');
    }
    
    return classes.join(' ');
  }

  /**
   * Get task block HTML content
   */
  getBlockHTML() {
    const status = this.getTaskStatus();
    
    return `
      <div class="task-block-content">
        <div class="task-block-header">
          <div class="task-name-section">
            <h4 class="task-name">${this.escapeHtml(this.task.taskName)}</h4>
            ${this.options.showStatus && status.indicator ? 
              `<span class="task-status-indicator">${status.indicator}</span>` : 
              ''
            }
          </div>
          ${this.options.showActions ? this.renderActions() : ''}
        </div>
        
        ${this.task.description && this.options.showMeta ? 
          `<p class="task-description">${this.escapeHtml(this.task.description)}</p>` : 
          ''
        }
        
        ${this.options.showMeta ? this.renderMeta() : ''}
      </div>
      
      ${status.badge ? `<div class="task-status-badge">${status.badge}</div>` : ''}
    `;
  }

  /**
   * Render action buttons
   */
  renderActions() {
    const id = this.task.id;
    return `
      <div class="task-actions">
        <button class="task-action-btn complete-btn" data-action="toggle-task-completion" data-task-id="${id}" title="Toggle completion" aria-label="Mark complete">✓</button>
        <button class="task-action-btn edit-btn" data-action="edit-task" data-task-id="${id}" title="Edit task" aria-label="Edit task">✏️</button>
        <button class="task-action-btn skip-btn" data-action="skip-task" data-task-id="${id}" title="Skip today" aria-label="Skip today">⏭️</button>
        <button class="task-action-btn postpone-btn" data-action="postpone-task" data-task-id="${id}" title="Postpone" aria-label="Postpone">⏰</button>
        <button class="task-action-btn delete-btn" data-action="soft-delete-task" data-task-id="${id}" title="Delete" aria-label="Delete">🗑️</button>
      </div>
    `;
  }

  /**
   * Render task metadata
   */
  renderMeta() {
    const metaItems = [];
    
    // Duration
    metaItems.push(`⏱️ ${this.task.durationMinutes}min`);
    
    // Priority
    metaItems.push(`📊 Priority ${this.task.priority}`);
    
    // Type
    metaItems.push(this.task.isMandatory ? '🔒 Mandatory' : '📝 Skippable');
    
    // Scheduling type
    if (this.task.schedulingType === 'fixed' && this.task.defaultTime) {
      metaItems.push(`🕐 ${this.task.defaultTime}`);
    } else {
      metaItems.push(`🕐 ${this.task.timeWindow}`);
    }
    
    // Dependencies (support multiple)
    if (this.task.dependsOn) {
      const depLabel = this.getDependencyLabel();
      if (depLabel) metaItems.push(`🔗 After: ${depLabel}`);
    }
    
    // Recurrence
    if (this.task.recurrenceRule?.frequency && this.task.recurrenceRule.frequency !== 'none') {
      metaItems.push(`🔄 ${this.formatRecurrence()}`);
    }
    
    return `
      <div class="task-meta">
        ${metaItems.map(item => `<span class="task-meta-item">${item}</span>`).join('')}
      </div>
    `;
  }

  /**
   * Get task status information
   */
  getTaskStatus() {
    const currentDate = state.getCurrentDate();
    const instances = state.getTaskInstancesForDate(currentDate);
    const instance = instances.find(i => i.templateId === this.task.id);
    
    // Check if completed
    if (instance && instance.status === 'completed') {
      return {
        classes: ['completed'],
        indicator: '✓',
        badge: 'Completed',
        isCompleted: true
      };
    }
    
    // Check if skipped
    if (instance && instance.status === 'skipped') {
      return {
        classes: ['skipped'],
        indicator: '⏭️',
        badge: 'Skipped',
        isSkipped: true
      };
    }
    
    // Check if overdue (basic implementation)
    const now = new Date();
    if (this.task.schedulingType === 'fixed' && this.task.defaultTime) {
      const taskTime = new Date(`${currentDate}T${this.task.defaultTime}:00`);
      const taskEndTime = new Date(taskTime.getTime() + this.task.durationMinutes * 60000);
      
      if (now > taskEndTime) {
        return {
          classes: ['overdue', this.task.isMandatory ? 'mandatory' : 'skippable'],
          indicator: '⚠️',
          badge: 'Overdue',
          isOverdue: true
        };
      }
      
      // Check if in progress
      if (now >= taskTime && now <= taskEndTime) {
        return {
          classes: ['in-progress'],
          indicator: '▶️',
          badge: 'In Progress',
          isInProgress: true
        };
      }
    }
    
    return {
      classes: ['normal'],
      indicator: null,
      badge: null,
      isNormal: true
    };
  }

  /**
   * Get dependency label for display (handles arrays or single id)
   */
  getDependencyLabel() {
    if (!this.task.dependsOn) return null;
    const ids = Array.isArray(this.task.dependsOn) ? this.task.dependsOn : [this.task.dependsOn];
    if (ids.length === 0) return null;
    const names = this.getDependencyNames(ids);
    if (names.length === 0) return null;
    // Join names; for many deps, show up to 3 for brevity
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
  }

  getDependencyNames(ids) {
    const allTasks = state.getTaskTemplates();
    const byId = new Map(allTasks.map(t => [t.id, t.taskName]));
    return ids.map(id => byId.get(id) || 'Unknown Task');
  }

  /**
   * Format recurrence rule for display
   */
  formatRecurrence() {
    const rule = this.task.recurrenceRule;
    if (!rule || rule.frequency === 'none') return '';
    
    const frequency = rule.frequency;
    const interval = rule.interval || 1;
    
    if (interval === 1) {
      return frequency.charAt(0).toUpperCase() + frequency.slice(1);
    } else {
      return `Every ${interval} ${frequency}s`;
    }
  }

  /**
   * Setup event listeners for interactive blocks
   */
  setupEventListeners() {
    if (!this.element) return;
    
    // Complete button
    const completeBtn = this.element.querySelector('.complete-btn');
    if (completeBtn) {
      const listenerId = SafeEventListener.add(
        completeBtn,
        'click',
        (e) => {
          e.stopPropagation();
          this.handleComplete();
        },
        { description: `TaskBlock complete button for ${this.task.taskName}` }
      );
      this.eventListeners.push(listenerId);
    }
    
    // Edit button
    const editBtn = this.element.querySelector('.edit-btn');
    if (editBtn) {
      const listenerId = SafeEventListener.add(
        editBtn,
        'click',
        (e) => {
          e.stopPropagation();
          this.handleEdit();
        },
        { description: `TaskBlock edit button for ${this.task.taskName}` }
      );
      this.eventListeners.push(listenerId);
    }
    
    // More actions button
    const moreBtn = this.element.querySelector('.more-btn');
    if (moreBtn) {
      const listenerId = SafeEventListener.add(
        moreBtn,
        'click',
        (e) => {
          e.stopPropagation();
          this.handleMore();
        },
        { description: `TaskBlock more button for ${this.task.taskName}` }
      );
      this.eventListeners.push(listenerId);
    }
    
    // Click on task block (for general interaction)
    const clickListenerId = SafeEventListener.add(
      this.element,
      'click',
      (e) => {
        // Only handle clicks on the content area, not buttons
        if (e.target.closest('.task-actions')) return;
        this.handleClick();
      },
      { description: `TaskBlock content click for ${this.task.taskName}` }
    );
    this.eventListeners.push(clickListenerId);
    
    // Keyboard accessibility
    this.element.setAttribute('tabindex', '0');
    this.element.setAttribute('role', 'button');
    this.element.setAttribute('aria-label', `Task: ${this.task.taskName}`);
    
    const keyListenerId = SafeEventListener.add(
      this.element,
      'keydown',
      (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleClick();
        }
      },
      { description: `TaskBlock keyboard for ${this.task.taskName}` }
    );
    this.eventListeners.push(keyListenerId);
  }

  /**
   * Handle task completion toggle
   */
  async handleComplete() {
    try {
      const currentDate = state.getCurrentDate();
      await taskInstanceManager.toggleByTemplateAndDate(this.task.id, currentDate);
      
      // Update the block appearance
      this.updateStatus();
      
      // Emit custom event for external listeners
      this.emitEvent('task-completed', { task: this.task });
      SimpleErrorHandler.showSuccess('Task status updated!');
      
    } catch (error) {
      console.error('Error toggling task completion:', error);
      this.emitEvent('task-error', { task: this.task, error });
      SimpleErrorHandler.showError('Failed to update task status. Please try again.', error);
    }
  }

  /**
   * Handle task edit
   */
  handleEdit() {
    this.emitEvent('task-edit', { taskId: this.task.id });
    
    // Call edit function
    editTask(this.task.id);
  }

  /**
   * Handle more actions menu
   */
  handleMore() {
    this.emitEvent('task-more', { task: this.task });
    
    // Simple implementation - could be expanded to show context menu
    const actions = ['Copy Task', 'Skip Today', 'Postpone', 'Delete'];
    const choice = prompt('Choose action:\n' + actions.map((a, i) => `${i + 1}. ${a}`).join('\n'));
    
    if (choice) {
      const index = parseInt(choice) - 1;
      if (index >= 0 && index < actions.length) {
        this.handleMoreAction(actions[index]);
      }
    }
  }

  /**
   * Handle more action selection
   */
  handleMoreAction(action) {
    switch (action) {
      case 'Copy Task':
        duplicateTask(this.task.id);
        break;
      case 'Skip Today':
        this.handleSkipToday();
        break;
      case 'Postpone':
        this.handlePostpone();
        break;
      case 'Delete':
        this.handleDelete();
        break;
    }
  }

  /**
   * Handle skip today
   */
  async handleSkipToday() {
    try {
      const currentDate = state.getCurrentDate();
      await taskInstanceManager.skipByTemplateAndDate(this.task.id, currentDate, 'Skipped by user');
      this.updateStatus();
      this.emitEvent('task-skipped', { task: this.task });
    } catch (error) {
      console.error('Error skipping task:', error);
      this.emitEvent('task-error', { task: this.task, error });
    }
  }

  /**
   * Handle postpone
   */
  async handlePostpone() {
    try {
      const currentDate = state.getCurrentDate();
      await taskInstanceManager.postponeByTemplateAndDate(this.task.id, currentDate);
      this.updateStatus();
      this.emitEvent('task-postponed', { task: this.task });
    } catch (error) {
      console.error('Error postponing task:', error);
      this.emitEvent('task-error', { task: this.task, error });
    }
  }

  /**
   * Handle delete
   */
  handleDelete() {
    const confirmed = confirm(`Are you sure you want to delete "${this.task.taskName}"?`);
    if (confirmed) {
      this.emitEvent('task-delete', { taskId: this.task.id });
    }
  }

  /**
   * Handle general click on task block
   */
  handleClick() {
    this.emitEvent('task-click', { taskId: this.task.id });
    
    // Default action: edit task
    this.handleEdit();
  }

  /**
   * Update task status appearance
   */
  updateStatus() {
    if (!this.element) return;
    
    // Update classes
    this.element.className = this.getBlockClasses();
    
    // Update content
    const content = this.element.querySelector('.task-block-content');
    if (content) {
      content.innerHTML = this.getBlockHTML().match(/<div class="task-block-content">(.*?)<\/div>/s)?.[1] || '';
    }
  }

  /**
   * Emit custom event
   */
  emitEvent(eventName, detail) {
    if (!this.element) return;
    
    const event = new CustomEvent(eventName, {
      detail,
      bubbles: true,
      cancelable: true
    });
    
    this.element.dispatchEvent(event);
  }

  /**
   * Escape HTML for safe rendering
   */
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Update task data
   */
  updateTask(newTaskData) {
    this.task = { ...this.task, ...newTaskData };
    
    if (this.element) {
      this.element.innerHTML = this.getBlockHTML();
      this.element.className = this.getBlockClasses();
    }
  }

  /**
   * Destroy task block and clean up
   */
  destroy() {
    // Remove all tracked event listeners
    this.eventListeners.forEach(listenerId => {
      SafeEventListener.remove(listenerId);
    });
    this.eventListeners = [];
    
    // Remove element from DOM
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    // Unregister from memory manager
    ComponentManager.unregister(this);
    
    this.element = null;
  }
}

/**
 * Utility functions for working with task blocks
 */
export const taskBlockUtils = {
  /**
   * Create task block element
   */
  createElement(task, options = {}) {
    const taskBlock = new TaskBlock(task, options);
    return taskBlock.render();
  },

  /**
   * Create multiple task block elements
   */
  createElements(tasks, options = {}) {
    return tasks.map(task => this.createElement(task, options));
  },

  /**
   * Render task blocks into container
   */
  renderIntoContainer(container, tasks, options = {}) {
    if (typeof container === 'string') {
      container = document.getElementById(container);
    }
    
    if (!container) {
      console.error('Container not found');
      return [];
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Create and append task blocks
    const taskBlocks = tasks.map(task => {
      const taskBlock = new TaskBlock(task, options);
      const element = taskBlock.render();
      container.appendChild(element);
      return taskBlock;
    });
    
    return taskBlocks;
  }
};

export default TaskBlock;

console.log('✅ Task Block component initialized');
