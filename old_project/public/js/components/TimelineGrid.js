/**
 * TimelineGrid Component
 * 
 * Handles the main timeline grid rendering including:
 * - 24-hour hourly grid with adaptive sizing
 * - Real-time indicator (red line)
 * - Sleep blocks visualization
 * - Task blocks with drag-and-drop interactions
 * - Click-to-create functionality
 * 
 * This is a "dumb" presentational component that receives data from parent
 * and emits events instead of directly manipulating state.
 */

import { SafeEventListener } from '../utils/MemoryLeakPrevention.js';
import { SimpleErrorHandler } from '../utils/SimpleErrorHandler.js';
import { TIME_WINDOWS as TL_TIME_WINDOWS } from '../constants/timeWindows.js';
import { taskDisplayLogic } from '../logic/TaskDisplayLogic.js';
import { TimelineDragDrop } from '../features/TimelineDragDrop.js';
import { TimelineContextMenu } from '../features/TimelineContextMenu.js';
import { TimelineInlineEdit } from '../features/TimelineInlineEdit.js';

export class TimelineGrid {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      hourHeight: 80,
      enableRealTimeIndicator: true,
      showIndicatorOnlyForToday: false,
      enableClickToCreate: true,
      enableDragDrop: true,
      ...options
    };
    
    // Event listeners array for cleanup
    this.eventListeners = [];
    
    // Component state (receives from parent)
    this.currentDate = null;
    this.timeFilter = 'all';
    this.scheduleData = null;
    
    // Performance tracking
    this.renderCount = 0;
    this.lastRenderTime = 0;

    // Minimal reconciliation state
    this.initialized = false;
    this.taskNodeMap = new Map(); // Map<taskId, HTMLElement>
    this.listenerMap = new Map(); // Map<taskId, Array<listenerToken>>
    this._prevDate = null;
    this._prevFilter = null;

    // Minimal reconciliation enhancements
    this.taskFieldCache = new Map(); // Map<taskId, string> of watched fields key
    this._rafPending = false;

    // Feature modules
    this.dragDropFeature = null;
    this.contextMenuFeature = null;
    this.inlineEditFeature = null;
  }

  /**
   * Update component with new data
   */
  update(data = {}) {
    const oldDate = this.currentDate;
    const oldFilter = this.timeFilter;

    this.currentDate = data.currentDate ?? this.currentDate;
    this.timeFilter = data.timeFilter ?? this.timeFilter;
    this.scheduleData = data.scheduleData ?? this.scheduleData;

    const canReconcile = this.initialized &&
      oldDate === this.currentDate &&
      oldFilter === this.timeFilter &&
      this.scheduleData?.schedule &&
      this.container?.querySelector('.timeline-grid-container');

    if (canReconcile) {
      this.reconcileTasks(this.scheduleData.schedule);
      this.updateTimeIndicator();
    } else {
      this.render();
    }
  }

  /**
   * Render the complete timeline grid
   */
  render() {
    if (!this.container) return;
    
    const startTime = performance.now();
    
    // Clean up existing event listeners
    this.cleanup();
    
    // Clear container and append new DOM element
    this.container.innerHTML = '';
    const gridElement = this.renderTimelineGrid();
    this.container.appendChild(gridElement);
    
    this.setupEventListeners();
    
    // Build task node map after initial render
    this.buildTaskNodeMap();
    this.initialized = true;

    // Performance tracking
    this.renderCount++;
    this.lastRenderTime = performance.now() - startTime;
    
    // Debug logging
    if (window.DEBUG_TIMELINE) {
      console.log(`TimelineGrid render #${this.renderCount} took ${this.lastRenderTime.toFixed(2)}ms`);
    }
  }

  /**
   * Render timeline grid with hours and tasks using DOM manipulation
   */
  renderTimelineGrid() {
    if (!this.scheduleData) {
      const loadingContainer = document.createElement('div');
      loadingContainer.className = 'timeline-grid-container';
      
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'timeline-loading';
      
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      
      const loadingText = document.createElement('p');
      loadingText.textContent = 'Loading schedule...';
      
      loadingDiv.appendChild(spinner);
      loadingDiv.appendChild(loadingText);
      loadingContainer.appendChild(loadingDiv);
      
      return loadingContainer;
    }
    
    // Create main container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'timeline-grid-container';
    
    // Create hours grid
    const hoursGrid = document.createElement('div');
    hoursGrid.className = 'timeline-hours-grid';
    
    // Generate 24-hour grid with time filtering
    for (let hour = 0; hour < 24; hour++) {
      const hourHTML = this.renderHourRow(hour, this.isHourInTimeBlock(hour));
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = hourHTML;
      hoursGrid.appendChild(tempDiv.firstElementChild);
    }
    
    gridContainer.appendChild(hoursGrid);
    
    // Add real-time indicator
    if (this.options.enableRealTimeIndicator) {
      const indicatorHTML = this.renderTimeIndicator();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = indicatorHTML;
      gridContainer.appendChild(tempDiv.firstElementChild);
    }
    
    // Add sleep blocks
    if (this.scheduleData.sleepSchedule) {
      const sleepBlocksHTML = this.renderSleepBlocks(this.scheduleData.sleepSchedule);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = sleepBlocksHTML;
      while (tempDiv.firstElementChild) {
        gridContainer.appendChild(tempDiv.firstElementChild);
      }
    }
    
    // Add task blocks using new DOM-based method
    if (this.scheduleData.schedule && this.scheduleData.schedule.length > 0) {
      const taskBlocksFragment = this.renderTaskBlocks(this.scheduleData.schedule);
      gridContainer.appendChild(taskBlocksFragment);
    }
    
    return gridContainer;
  }

  /**
   * Render single hour row
   */
  renderHourRow(hour, isHighlighted = true) {
    const hourString = hour.toString().padStart(2, '0') + ':00';
    const hourDisplay = new Date(`2000-01-01T${hourString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true
    });
    
    const filterClass = isHighlighted ? 'is-highlighted' : 'is-dimmed';
    
    return `
      <div class="timeline-hour ${filterClass}" data-hour="${hour}" style="height: ${this.options.hourHeight}px;">
        <div class="hour-marker tl-hour-marker">
          <span class="hour-label">${hourDisplay}</span>
          <span class="hour-time">${hourString}</span>
        </div>
        <div class="hour-content" data-hour="${hour}">
          ${this.options.enableClickToCreate ? 
            `<div class="click-to-create" data-hour="${hour}" title="Click to create task at ${hourString}">+</div>` : 
            ''
          }
        </div>
      </div>
    `;
  }

  /**
   * Render real-time indicator
   */
  renderTimeIndicator() {
    // Optionally hide indicator when not viewing today's date
    if (this.options.showIndicatorOnlyForToday && !this.isCurrentDateToday()) {
      return '';
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const topPosition = (currentMinutes / 60) * this.options.hourHeight;
    
    return `
      <div class="time-indicator" id="time-indicator" style="top: ${topPosition}px;">
        <div class="time-indicator-dot"></div>
        <div class="time-indicator-line"></div>
      </div>
    `;
  }

  /**
   * Check if the currentDate equals today's local date
   */
  isCurrentDateToday() {
    if (!this.currentDate) return true; // Default to true when unknown
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    return this.currentDate === todayStr;
  }

  /**
   * Render sleep blocks
   */
  renderSleepBlocks(sleepSchedule) {
    const sleepStart = this.timeStringToMinutes(sleepSchedule.sleepTime);
    const sleepEnd = this.timeStringToMinutes(sleepSchedule.wakeTime);
    
    // Handle sleep that crosses midnight
    if (sleepStart > sleepEnd) {
      // Sleep from sleepTime to midnight, then from midnight to wakeTime
      return `
        <div class="sleep-block" style="
          top: ${(sleepStart / 60) * this.options.hourHeight}px;
          height: ${((1440 - sleepStart) / 60) * this.options.hourHeight}px;
        ">
          <div class="sleep-label">💤 Sleep</div>
        </div>
        <div class="sleep-block" style="
          top: 0px;
          height: ${(sleepEnd / 60) * this.options.hourHeight}px;
        ">
          <div class="sleep-label">💤 Sleep</div>
        </div>
      `;
    } else {
      // Normal sleep within same day
      return `
        <div class="sleep-block" style="
          top: ${(sleepStart / 60) * this.options.hourHeight}px;
          height: ${((sleepEnd - sleepStart) / 60) * this.options.hourHeight}px;
        ">
          <div class="sleep-label">💤 Sleep</div>
        </div>
      `;
    }
  }

  /**
   * Render task blocks using DOM manipulation instead of HTML strings
   */
  renderTaskBlocks(scheduledTasks) {
    const fragment = document.createDocumentFragment();
    
    scheduledTasks.forEach(task => {
      const taskElement = this.createTaskBlockElement(task);
      fragment.appendChild(taskElement);
    });
    
    return fragment;
  }

  /**
   * Build the initial map of taskId -> element for reconciliation
   */
  buildTaskNodeMap() {
    this.taskNodeMap.clear();
    const nodes = this.container.querySelectorAll('.task-block[data-task-id]');
    nodes.forEach(node => {
      const id = node.getAttribute('data-task-id');
      this.taskNodeMap.set(id, node);
    });

    // Initialize field cache from current schedule data
    if (this.scheduleData?.schedule) {
      this.scheduleData.schedule.forEach(task => {
        this.taskFieldCache.set(task.id, this.getWatchedFieldsKey(task));
      });
    }
  }

  /**
   * Reconcile task DOM nodes with the provided schedule
   */
  reconcileTasks(scheduledTasks = []) {
    const grid = this.container.querySelector('.timeline-grid-container');
    if (!grid) {
      this.render();
      return;
    }

    const nextIds = new Set(scheduledTasks.map(t => t.id));

    // Compute removals
    const toRemove = [];
    for (const [taskId, node] of this.taskNodeMap.entries()) {
      if (!nextIds.has(taskId)) {
        toRemove.push({ taskId, node });
      }
    }

    // Compute additions and updates
    const toAdd = [];
    const toUpdate = [];
    for (const task of scheduledTasks) {
      const existing = this.taskNodeMap.get(task.id);
      if (!existing) {
        toAdd.push(task);
      } else {
        const newKey = this.getWatchedFieldsKey(task);
        const prevKey = this.taskFieldCache.get(task.id);
        if (newKey !== prevKey) {
          toUpdate.push({ node: existing, task, newKey });
        }
      }
    }

    // Batch DOM writes with requestAnimationFrame
    if (this._rafPending) return; // coalesce multiple calls per frame
    this._rafPending = true;
    requestAnimationFrame(() => {
      // Removals
      toRemove.forEach(({ taskId, node }) => {
        const tokens = this.listenerMap.get(taskId) || [];
        tokens.forEach(tok => { try { tok.remove && tok.remove(); } catch (_) {} });
        this.listenerMap.delete(taskId);
        this._pruneEventListeners(tokens);
        node.remove();
        this.taskNodeMap.delete(taskId);
        this.taskFieldCache.delete(taskId);
      });

      // Additions (use fragment)
      if (toAdd.length > 0) {
        const fragment = document.createDocumentFragment();
        toAdd.forEach(task => {
          const el = this.createTaskBlockElement(task);
          fragment.appendChild(el);
          this.taskNodeMap.set(task.id, el);
          this.bindTaskBlockListeners(el);
          this.taskFieldCache.set(task.id, this.getWatchedFieldsKey(task));
        });
        grid.appendChild(fragment);
      }

      // Updates
      toUpdate.forEach(({ node, task, newKey }) => {
        this.updateTaskBlockElement(node, task);
        this.taskFieldCache.set(task.id, newKey);
      });

      // Update time indicator after layout changes
      this.updateTimeIndicator();
      this._rafPending = false;
    });
  }

  /**
   * Compute watched field key for minimal reconciliation
   */
  getWatchedFieldsKey(task) {
    const status = taskDisplayLogic.getTaskStatus(task, this.currentDate)?.className || '';
    const scheduledTime = task.scheduledTime || '';
    const duration = String(task.durationMinutes ?? '');
    const priority = String(task.priority ?? '');
    return `${status}|${scheduledTime}|${duration}|${priority}`;
  }

  /**
   * Remove tokens from component-level eventListeners array
   */
  _pruneEventListeners(tokens) {
    if (!tokens || tokens.length === 0) return;
    const tokenSet = new Set(tokens);
    this.eventListeners = this.eventListeners.filter(t => !tokenSet.has(t));
  }

  /**
   * Update an existing task block element in place
   */
  updateTaskBlockElement(taskBlock, task) {
    // Update data attributes
    taskBlock.setAttribute('data-conflict-severity', task.conflictSeverity || 'none');
    taskBlock.setAttribute('data-priority', task.priority || 0);
    taskBlock.setAttribute('data-category', this.determineTaskCategory(task));
    taskBlock.setAttribute('data-scheduled-time', task.scheduledTime);
    taskBlock.setAttribute('data-duration-minutes', task.durationMinutes);

    // Update classes (status + other computed classes)
    const status = taskDisplayLogic.getTaskStatus(task, this.currentDate);
    const conflictClasses = this.getConflictClasses(task);
    const priorityClasses = this.getPriorityClasses(task);
    const filterClasses = this.getFilterClasses(task);
    const categoryClasses = this.getCategoryClasses(task);
    taskBlock.className = `tl-task task-block ${status.className} ${conflictClasses} ${priorityClasses} ${filterClasses} ${categoryClasses}`;

    // Update positioning
    const startMinutes = this.timeStringToMinutes(task.scheduledTime);
    const topPosition = (startMinutes / 60) * this.options.hourHeight;
    const height = (task.durationMinutes / 60) * this.options.hourHeight;
    taskBlock.style.top = `${topPosition}px`;
    taskBlock.style.height = `${height}px`;

    // Update content (name, time, duration, indicators)
    const nameEl = taskBlock.querySelector('.task-name');
    if (nameEl) nameEl.textContent = task.taskName;
    const timeEl = taskBlock.querySelector('.task-time');
    if (timeEl) timeEl.textContent = task.scheduledTime;
    const durEl = taskBlock.querySelector('.task-duration');
    if (durEl) durEl.textContent = `${task.durationMinutes}min`;

    // Overdue indicator
    const existingIndicator = taskBlock.querySelector('.overdue-indicator');
    if (status.isOverdue && !existingIndicator) {
      const indicator = this.createOverdueIndicator(status.overdueMinutes);
      taskBlock.appendChild(indicator);
    } else if (!status.isOverdue && existingIndicator) {
      existingIndicator.remove();
    }
  }

  /**
   * Create individual task block DOM element
   */
  createTaskBlockElement(task) {
    const startMinutes = this.timeStringToMinutes(task.scheduledTime);
    const topPosition = (startMinutes / 60) * this.options.hourHeight;
    const height = (task.durationMinutes / 60) * this.options.hourHeight;
    
    // Get task status for styling
    const status = taskDisplayLogic.getTaskStatus(task, this.currentDate);
    
    // Get styling classes
    const conflictClasses = this.getConflictClasses(task);
    const priorityClasses = this.getPriorityClasses(task);
    const filterClasses = this.getFilterClasses(task);
    const categoryClasses = this.getCategoryClasses(task);
    
    // Create main task block element
    const taskBlock = document.createElement('div');
    taskBlock.className = `tl-task task-block ${status.className} ${conflictClasses} ${priorityClasses} ${filterClasses} ${categoryClasses}`;
    
    // Set data attributes
    taskBlock.setAttribute('data-task-id', task.id);
    taskBlock.setAttribute('data-conflict-severity', task.conflictSeverity || 'none');
    taskBlock.setAttribute('data-priority', task.priority || 0);
    taskBlock.setAttribute('data-category', taskDisplayLogic.determineTaskCategory(task));
    taskBlock.setAttribute('data-scheduled-time', task.scheduledTime);
    taskBlock.setAttribute('data-duration-minutes', task.durationMinutes);
    
    // Set drag and drop if enabled
    if (this.options.enableDragDrop) {
      taskBlock.draggable = true;
    }
    
    // Set styles
    taskBlock.style.top = `${topPosition}px`;
    taskBlock.style.height = `${height}px`;
    taskBlock.style.zIndex = '20';
    taskBlock.style.cursor = this.options.enableDragDrop ? 'grab' : 'pointer';
    
    // Create content structure
    const content = this.createTaskBlockContent(task);
    const actions = this.createTaskBlockActions(task);
    
    taskBlock.appendChild(content);
    taskBlock.appendChild(actions);
    
    // Add overdue indicator if needed
    if (status.isOverdue) {
      const overdueIndicator = this.createOverdueIndicator(status.overdueMinutes);
      taskBlock.appendChild(overdueIndicator);
    }
    
    return taskBlock;
  }

  /**
   * Create task block content section
   */
  createTaskBlockContent(task) {
    const content = document.createElement('div');
    content.className = 'task-block-content';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'task-block-header';
    
    const taskName = document.createElement('span');
    taskName.className = 'task-name';
    taskName.textContent = task.taskName;
    
    const taskTime = document.createElement('span');
    taskTime.className = 'task-time';
    taskTime.textContent = task.scheduledTime;
    
    header.appendChild(taskName);
    header.appendChild(taskTime);
    content.appendChild(header);
    
    // Add description if exists
    if (task.description) {
      const description = document.createElement('div');
      description.className = 'task-description';
      description.textContent = task.description;
      content.appendChild(description);
    }
    
    // Add progress bar
    const progressBar = this.createProgressBarElement(task);
    if (progressBar) {
      content.appendChild(progressBar);
    }
    
    // Create meta section
    const meta = this.createTaskBlockMeta(task);
    content.appendChild(meta);
    
    return content;
  }

  /**
   * Create task block meta section
   */
  createTaskBlockMeta(task) {
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    
    // Duration
    const duration = document.createElement('span');
    duration.className = 'task-duration';
    duration.textContent = `${task.durationMinutes}min`;
    meta.appendChild(duration);
    
    // Mandatory indicator
    if (task.isMandatory) {
      const mandatory = document.createElement('span');
      mandatory.className = 'task-mandatory';
      mandatory.textContent = '🔒';
      meta.appendChild(mandatory);
    }
    
    // Anchor indicator
    if (task.isAnchor) {
      const anchor = document.createElement('span');
      anchor.className = 'task-anchor';
      anchor.textContent = '⚓';
      meta.appendChild(anchor);
    }
    
    // Conflict indicator
    if (task.hasConflicts) {
      const conflict = document.createElement('span');
      conflict.className = `task-conflict ${task.conflictSeverity}`;
      conflict.title = `Scheduling conflict: ${task.conflicts?.length || 0} overlapping task(s)`;
      conflict.textContent = '⚠️';
      meta.appendChild(conflict);
    }
    
    // Priority indicator
    const priorityIndicator = this.createPriorityIndicatorElement(task);
    if (priorityIndicator) {
      meta.appendChild(priorityIndicator);
    }
    
    return meta;
  }

  /**
   * Create task block actions section
   */
  createTaskBlockActions(task) {
    const actions = document.createElement('div');
    actions.className = 'task-actions';
    
    // Complete button
    const completeBtn = document.createElement('button');
    completeBtn.className = 'task-action-btn complete-btn';
    completeBtn.title = 'Mark complete';
    completeBtn.textContent = '✓';
    completeBtn.dataset.action = 'toggle-task-completion';
    completeBtn.dataset.taskId = task.id;
    actions.appendChild(completeBtn);
    
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'task-action-btn edit-btn';
    editBtn.title = 'Edit task';
    editBtn.textContent = '✏️';
    editBtn.dataset.action = 'edit-task';
    editBtn.dataset.taskId = task.id;
    actions.appendChild(editBtn);

    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.className = 'task-action-btn skip-btn';
    skipBtn.title = 'Skip today';
    skipBtn.textContent = '⏭️';
    skipBtn.dataset.action = 'skip-task';
    skipBtn.dataset.taskId = task.id;
    actions.appendChild(skipBtn);

    // Postpone button
    const postponeBtn = document.createElement('button');
    postponeBtn.className = 'task-action-btn postpone-btn';
    postponeBtn.title = 'Postpone';
    postponeBtn.textContent = '⏰';
    postponeBtn.dataset.action = 'postpone-task';
    postponeBtn.dataset.taskId = task.id;
    actions.appendChild(postponeBtn);

    // Soft delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-action-btn delete-btn';
    deleteBtn.title = 'Delete';
    deleteBtn.textContent = '🗑️';
    deleteBtn.dataset.action = 'soft-delete-task';
    deleteBtn.dataset.taskId = task.id;
    actions.appendChild(deleteBtn);
    
    return actions;
  }

  /**
   * Create overdue indicator element
   */
  createOverdueIndicator(overdueMinutes) {
    const indicator = document.createElement('div');
    indicator.className = 'overdue-indicator';
    indicator.title = `Task is overdue by ${overdueMinutes} minutes`;
    indicator.textContent = '⚠️';
    return indicator;
  }

  /**
   * Create priority indicator element
   */
  createPriorityIndicatorElement(task) {
    if (!task.priority || task.priority < 2) return null;
    
    const priority = Math.min(task.priority, 10);
    const stars = Math.ceil(priority / 2);
    
    const indicator = document.createElement('span');
    indicator.className = 'task-priority';
    indicator.title = `Priority: ${priority}/10`;
    indicator.textContent = '★'.repeat(stars);
    
    return indicator;
  }

  /**
   * Create progress bar element
   */
  createProgressBarElement(task) {
    const progress = taskDisplayLogic.getTaskProgress(task);
    
    if (progress === 0) {
      return null;
    }
    
    const progressBar = document.createElement('div');
    progressBar.className = 'task-progress-bar';
    progressBar.title = `${Math.round(progress)}% complete`;
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.width = `${progress}%`;
    
    progressBar.appendChild(progressFill);
    return progressBar;
  }


  /**
   * Get task completion progress as percentage
   */
  getTaskProgress(task) { return taskDisplayLogic.getTaskProgress(task); }


  /**
   * Check if hour is in the current time block filter
   */
  isHourInTimeBlock(hour) {
    if (this.timeFilter === 'all') return true;
    
    switch (this.timeFilter) {
      case 'morning': return hour >= 6 && hour < 12;
      case 'afternoon': return hour >= 12 && hour < 18;
      case 'evening': return hour >= 18;
      default: return true;
    }
  }

  /**
   * Get task status for styling and indicators
   */
  getTaskStatus(task) { return taskDisplayLogic.getTaskStatus(task, this.currentDate); }

  /**
   * Get conflict-related CSS classes for a task
   */
  getConflictClasses(task) {
    if (!task.hasConflicts) {
      return '';
    }

    const classes = ['is-conflict'];

    // Add severity class (legacy + new alias)
    if (task.conflictSeverity) {
      classes.push(`is-conflict--${task.conflictSeverity}`);
    }

    // Add conflict type class (legacy retained)
    if (task.conflictType) {
      classes.push(`conflict-type-${task.conflictType}`);
    }

    return classes.join(' ');
  }

  /**
   * Get priority-related CSS classes for a task
   */
  getPriorityClasses(task) {
    const classes = [];

    // Add priority level class + tl-task alias
    if (task.priority !== undefined && task.priority !== null) {
      let tlLevel = 1;
      if (task.priority >= 8) { tlLevel = 5; }
      else if (task.priority >= 6) { tlLevel = 4; }
      else if (task.priority >= 4) { tlLevel = 3; }
      else if (task.priority >= 2) { tlLevel = 2; }

      classes.push(`tl-task--priority-${tlLevel}`);
    }

    // Add mandatory class
    if (task.isMandatory) {
      classes.push('task-mandatory');
    }

    // Add anchor class
    if (task.isAnchor) {
      classes.push('task-anchor');
    }

    return classes.join(' ');
  }

  /**
   * Get filter-related CSS classes for a task
   */
  getFilterClasses(task) {
    if (this.timeFilter === 'all') {
      return '';
    }

    const hour = parseInt(task.scheduledTime.split(':')[0]);
    const isInTimeBlock = this.isHourInTimeBlock(hour);
    
    return isInTimeBlock ? 'is-highlighted' : 'is-dimmed';
  }

  /**
   * Get category-related CSS classes for a task
   */
  getCategoryClasses(task) {
    const category = taskDisplayLogic.determineTaskCategory(task);
    return `category-${category}`;
  }

  /**
   * Determine task category based on name and description
   */
  determineTaskCategory(task) { return taskDisplayLogic.determineTaskCategory(task); }

  /**
   * Convert time string (HH:MM) to minutes since midnight
   */
  timeStringToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to time string (HH:MM)
   */
  minutesToTimeString(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Setup event listeners for grid interactions
   */
  setupEventListeners() {
    if (!this.container) return;

    // Click-to-create functionality
    if (this.options.enableClickToCreate) {
      const createButtons = this.container.querySelectorAll('.click-to-create');
      createButtons.forEach(button => {
        const listener = SafeEventListener.add(
          button,
          'click',
          (e) => this.handleCreateClick(e),
          { description: 'TimelineGrid create task button' }
        );
        this.eventListeners.push(listener);
      });
    }

    // Task block interactions
    const taskBlocks = this.container.querySelectorAll('.task-block');
    taskBlocks.forEach(taskBlock => this.bindTaskBlockListeners(taskBlock));

    // Drag & Drop feature (delegated)
    if (this.options.enableDragDrop && !this.dragDropFeature) {
      this.dragDropFeature = new TimelineDragDrop(this.container, {
        emit: (type, detail) => this.emitEvent(type, detail)
      });
    }

    // Context Menu feature (delegated)
    if (!this.contextMenuFeature) {
      this.contextMenuFeature = new TimelineContextMenu(this.container, {
        emit: (type, detail) => this.emitEvent(type, detail)
      });
    }

    // Inline Edit feature (delegated)
    if (!this.inlineEditFeature) {
      this.inlineEditFeature = new TimelineInlineEdit(this.container, {
        emit: (type, detail) => this.emitEvent(type, detail)
      });
    }
  }

  /**
   * Bind listeners for a task block and track tokens for cleanup
   */
  bindTaskBlockListeners(taskBlock) {
    const taskId = taskBlock.getAttribute('data-task-id');
    const tokens = [];

    // Task click/tap
    tokens.push(SafeEventListener.add(
      taskBlock,
      'click',
      (e) => this.handleTaskClick(e),
      { description: 'TimelineGrid task block click' }
    ));

    // Task action buttons
    const completeBtn = taskBlock.querySelector('.complete-btn');
    const editBtn = taskBlock.querySelector('.edit-btn');

    if (completeBtn) {
      tokens.push(SafeEventListener.add(
        completeBtn,
        'click',
        (e) => this.handleTaskComplete(e),
        { description: 'TimelineGrid task complete button' }
      ));
    }

    if (editBtn) {
      tokens.push(SafeEventListener.add(
        editBtn,
        'click',
        (e) => this.handleTaskEdit(e),
        { description: 'TimelineGrid task edit button' }
      ));
    }

    if (this.options.enableDragDrop && !this.dragDropFeature) {
      tokens.push(SafeEventListener.add(
        taskBlock,
        'dragstart',
        (e) => this.handleDragStart(e),
        { description: 'TimelineGrid task drag start' }
      ));
    }

    // Track for component-level cleanup as well
    tokens.forEach(t => this.eventListeners.push(t));
    this.listenerMap.set(taskId, tokens);
  }

  /**
   * Handle create task click
   */
  handleCreateClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const hour = event.target.dataset.hour;
    const timeString = `${hour.padStart(2, '0')}:00`;
    const minutes = parseInt(hour, 10) * 60;
    const timeWindow = this._getTimeWindowForMinutes(minutes);
    
    const detail = {
      scheduledTime: timeString,
      hour: parseInt(hour, 10),
      defaultTime: timeString,
      clickPosition: { x: event.clientX, y: event.clientY }
    };
    if (timeWindow) detail.timeWindow = timeWindow;

    // Emit local event for timeline features
    this.emitEvent('create-task', detail);

    // Also dispatch global addTask event for app-level handler
    try {
      const evt = new CustomEvent('addTask', { detail });
      document.dispatchEvent(evt);
    } catch (_) {
      // no-op
    }
  }

  /**
   * Determine time window key for given minutes since midnight
   * Returns 'morning' | 'afternoon' | 'evening' | null
   */
  _getTimeWindowForMinutes(mins) {
    try {
      const windows = TL_TIME_WINDOWS;
      const candidates = ['morning', 'afternoon', 'evening'];
      for (const key of candidates) {
        const w = windows[key];
        if (!w) continue;
        if (mins >= (w.startMin ?? 0) && mins < (w.endMin ?? 1440)) return key;
      }
      return null; // outside defined windows (late night/early morning)
    } catch (_) {
      return null;
    }
  }

  /**
   * Handle task block click
   */
  handleTaskClick(event) {
    // Don't trigger on action button clicks
    if (event.target.closest('.task-action-btn')) return;
    
    const taskBlock = event.currentTarget;
    const taskId = taskBlock.dataset.taskId;
    
    this.emitEvent('task-click', {
      taskId,
      element: taskBlock,
      clickPosition: { x: event.clientX, y: event.clientY }
    });
  }

  /**
   * Handle task complete button
   */
  handleTaskComplete(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const taskBlock = event.target.closest('.task-block');
    const taskId = taskBlock.dataset.taskId;
    
    // Emit for container; container toggles and shows toast via TaskActions
    this.emitEvent('task-complete', { taskId });
  }

  /**
   * Handle task edit button
   */
  handleTaskEdit(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const taskBlock = event.target.closest('.task-block');
    const taskId = taskBlock.dataset.taskId;
    
    this.emitEvent('task-edit', { taskId });
  }

  /**
   * Handle drag start
   */
  handleDragStart(event) {
    const taskBlock = event.currentTarget;
    const taskId = taskBlock.dataset.taskId;
    
    event.dataTransfer.setData('text/plain', taskId);
    event.dataTransfer.effectAllowed = 'move';
    
    taskBlock.style.cursor = 'grabbing';
    taskBlock.classList.add('is-dragging');
    
    this.emitEvent('task-drag-start', { taskId, element: taskBlock });
  }

  /**
   * Handle drag over
   */
  handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    const hourContent = event.currentTarget;
    hourContent.classList.add('is-drop-target');
  }

  /**
   * Handle drop
   */
  handleDrop(event) {
    event.preventDefault();
    
    const hourContent = event.currentTarget;
    const hour = hourContent.dataset.hour;
    const taskId = event.dataTransfer.getData('text/plain');
    
    // Clean up visual indicators
    hourContent.classList.remove('is-drop-target');
    const draggingTask = this.container.querySelector('.is-dragging');
    if (draggingTask) {
      draggingTask.classList.remove('is-dragging');
      draggingTask.style.cursor = 'grab';
    }
    
    this.emitEvent('task-drop', {
      taskId,
      newHour: parseInt(hour),
      newTime: `${hour.padStart(2, '0')}:00`
    });
  }

  /**
   * Update the time indicator position (called from parent for real-time updates)
   */
  updateTimeIndicator() {
    const timeIndicator = this.container?.querySelector('#time-indicator');
    if (timeIndicator) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const topPosition = (currentMinutes / 60) * this.options.hourHeight;
      timeIndicator.style.top = `${topPosition}px`;
    }
  }

  /**
   * Update task status display (for real-time overdue detection)
   */
  updateTaskStatuses() {
    if (!this.scheduleData || !this.scheduleData.schedule) return;
    
    const taskBlocks = this.container.querySelectorAll('.task-block');
    taskBlocks.forEach(taskBlock => {
      const taskId = taskBlock.dataset.taskId;
      const task = this.scheduleData.schedule.find(t => t.id === taskId);
      
      if (task) {
        const status = this.getTaskStatus(task);
        
        // Update classes
        taskBlock.className = `task-block ${status.className}`;
        
        // Update overdue indicator
        const existingIndicator = taskBlock.querySelector('.overdue-indicator');
        if (status.isOverdue && !existingIndicator) {
          const indicator = document.createElement('div');
          indicator.className = 'overdue-indicator';
          indicator.innerHTML = '⚠️';
          indicator.title = `Task is overdue by ${status.overdueMinutes} minutes`;
          taskBlock.appendChild(indicator);
        } else if (!status.isOverdue && existingIndicator) {
          existingIndicator.remove();
        }
      }
    });
  }

  /**
   * Emit custom events to parent components
   */
  emitEvent(eventType, data = {}) {
    const customEvent = new CustomEvent(eventType, {
      detail: data,
      bubbles: true
    });
    this.container.dispatchEvent(customEvent);
  }

  /**
   * Get performance metrics for this grid instance
   */
  getPerformanceMetrics() {
    return {
      renderCount: this.renderCount,
      lastRenderTime: this.lastRenderTime,
      totalTasks: this.scheduleData?.schedule?.length || 0,
      activeListeners: this.eventListeners.length
    };
  }

  /**
   * Clean up event listeners
   */
  cleanup() {
    this.eventListeners.forEach(listener => {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    });
    this.eventListeners = [];
  }

  /**
   * Destroy the component
   */
  destroy() {
    this.cleanup();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.scheduleData = null;

    if (this.dragDropFeature) {
      this.dragDropFeature.destroy();
      this.dragDropFeature = null;
    }

    if (this.contextMenuFeature) {
      this.contextMenuFeature.destroy();
      this.contextMenuFeature = null;
    }

    if (this.inlineEditFeature) {
      this.inlineEditFeature.destroy();
      this.inlineEditFeature = null;
    }
  }
}
