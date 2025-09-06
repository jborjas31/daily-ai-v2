/**
 * TimelineContainer Component
 * 
 * Smart container component that orchestrates TimelineHeader and TimelineGrid.
 * Handles state management, data loading, and event coordination between child components.
 * 
 * This is the main entry point that replaces the monolithic Timeline.js component.
 */

import { state } from '../state.js';
import { schedulingEngine, realTimeTaskLogic, taskInstanceManager } from '../taskLogic.js';
import { taskModal } from '../app.js';
import { toggleTaskCompletion } from '../logic/TaskActions.js';
import { dataUtils } from '../dataOffline.js';
import { SafeInterval, SafeEventListener, ComponentManager } from '../utils/MemoryLeakPrevention.js';
import { performanceMonitor } from '../utils/PerformanceMonitor.js';
import { TimelineHeader } from './TimelineHeader.js';
import { TimelineGrid } from './TimelineGrid.js';

export class TimelineContainer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      hourHeight: 80,
      showSeconds: false,
      enableClickToCreate: true,
      enableRealTimeIndicator: true,
      enableDragDrop: true,
      renderThrottleMs: 100,
      ...options
    };
    
    // Current state
    this.currentDate = dataUtils.getTodayDateString();
    this.timeFilter = 'all';
    this.scheduleData = null;
    
    // Child components
    this.timelineHeader = null;
    this.timelineGrid = null;
    
    // Performance tracking
    this.componentId = `timeline-container-${Date.now()}`;
    this.performanceMetrics = {
      renderCount: 0,
      refreshCount: 0,
      dataLoadCount: 0
    };
    this.lastRenderTime = 0;
    
    // Memory management
    this.eventListeners = [];
    this.realTimeTimer = null;
    this.isDestroyed = false;
    
    // Register with component manager for memory leak prevention
    ComponentManager.register(this, this.componentId);
    
    // Initialize component
    performanceMonitor.startTimer(`${this.componentId}-init`, 'initialization');
    this.init();
    performanceMonitor.endTimer(`${this.componentId}-init`, {
      containerId,
      optionsCount: Object.keys(options).length
    });
  }

  /**
   * Initialize timeline container
   */
  init() {
    if (!this.container) {
      console.error('Timeline container not found');
      return;
    }
    
    this.setupStateListeners();
    this.setupWindowListeners();
    this.createChildComponents();
    this.loadScheduleData();
    this.render();
    this.startRealTimeUpdates();
    
    console.log('✅ TimelineContainer initialized');
  }

  /**
   * Setup state listeners
   */
  setupStateListeners() {
    // Listen for date changes
    state.stateListeners?.on('date', (newDate) => {
      this.setDate(newDate);
    });
    
    // Listen for task changes
    state.stateListeners?.on('taskTemplates', () => {
      this.refresh();
    });
    
    state.stateListeners?.on('taskInstances', () => {
      this.refresh();
    });
    
    // Listen for user settings changes
    state.stateListeners?.on('userSettings', () => {
      this.refresh();
    });
  }

  /**
   * Setup window-level event listeners
   */
  setupWindowListeners() {
    // Window resize for responsive updates
    const resizeListener = SafeEventListener.add(
      window, 
      'resize', 
      this.handleResize.bind(this),
      { description: 'TimelineContainer window resize' }
    );
    this.eventListeners.push(resizeListener);
    
    // Page visibility for performance optimization
    const visibilityListener = SafeEventListener.add(
      document, 
      'visibilitychange', 
      this.handleVisibilityChange.bind(this),
      { description: 'TimelineContainer visibility change' }
    );
    this.eventListeners.push(visibilityListener);
  }

  /**
   * Create and initialize child components
   */
  createChildComponents() {
    // Create container structure
    this.container.innerHTML = `
      <div class="timeline-wrapper" id="timeline-wrapper">
        <div class="timeline-header-container" id="timeline-header-container"></div>
        <div class="timeline-grid-container" id="timeline-grid-container"></div>
      </div>
    `;
    
    // Initialize child components
    const headerContainer = this.container.querySelector('#timeline-header-container');
    const gridContainer = this.container.querySelector('#timeline-grid-container');
    
    this.timelineHeader = new TimelineHeader(headerContainer, {
      showSeconds: this.options.showSeconds
    });
    
    this.timelineGrid = new TimelineGrid(gridContainer, {
      hourHeight: this.options.hourHeight,
      enableRealTimeIndicator: this.options.enableRealTimeIndicator,
      enableClickToCreate: this.options.enableClickToCreate,
      enableDragDrop: this.options.enableDragDrop
    });
    
    // Setup event listeners for child components
    this.setupChildComponentListeners();
  }

  /**
   * Setup event listeners for child component events
   */
  setupChildComponentListeners() {
    // TimelineHeader events
    if (this.timelineHeader) {
      const headerContainer = this.timelineHeader.container;
      
      // Navigation events
      const navigateListener = SafeEventListener.add(
        headerContainer,
        'navigate-day',
        (e) => this.handleNavigateDay(e.detail),
        { description: 'TimelineContainer navigate day' }
      );
      this.eventListeners.push(navigateListener);
      
      // Today button
      const todayListener = SafeEventListener.add(
        headerContainer,
        'go-to-today',
        () => this.handleGoToToday(),
        { description: 'TimelineContainer go to today' }
      );
      this.eventListeners.push(todayListener);
      
      // Time filter changes
      const filterListener = SafeEventListener.add(
        headerContainer,
        'time-filter-change',
        (e) => this.handleTimeFilterChange(e.detail),
        { description: 'TimelineContainer time filter change' }
      );
      this.eventListeners.push(filterListener);
    }
    
    // TimelineGrid events
    if (this.timelineGrid) {
      const gridContainer = this.timelineGrid.container;
      
      // Task creation
      const createListener = SafeEventListener.add(
        gridContainer,
        'create-task',
        (e) => this.handleCreateTask(e.detail),
        { description: 'TimelineContainer create task' }
      );
      this.eventListeners.push(createListener);
      
      // Task interactions
      const taskClickListener = SafeEventListener.add(
        gridContainer,
        'task-click',
        (e) => this.handleTaskClick(e.detail),
        { description: 'TimelineContainer task click' }
      );
      this.eventListeners.push(taskClickListener);
      
      const taskCompleteListener = SafeEventListener.add(
        gridContainer,
        'task-complete',
        (e) => this.handleTaskComplete(e.detail),
        { description: 'TimelineContainer task complete' }
      );
      this.eventListeners.push(taskCompleteListener);
      
      const taskEditListener = SafeEventListener.add(
        gridContainer,
        'task-edit',
        (e) => this.handleTaskEdit(e.detail),
        { description: 'TimelineContainer task edit' }
      );
      this.eventListeners.push(taskEditListener);

      // Context menu actions
      const taskSkipListener = SafeEventListener.add(
        gridContainer,
        'task-skip',
        (e) => this.handleTaskSkip(e.detail),
        { description: 'TimelineContainer task skip' }
      );
      this.eventListeners.push(taskSkipListener);

      const taskPostponeListener = SafeEventListener.add(
        gridContainer,
        'task-postpone',
        (e) => this.handleTaskPostpone(e.detail),
        { description: 'TimelineContainer task postpone' }
      );
      this.eventListeners.push(taskPostponeListener);

      const taskDeleteListener = SafeEventListener.add(
        gridContainer,
        'task-delete',
        (e) => this.handleTaskDelete(e.detail),
        { description: 'TimelineContainer task delete' }
      );
      this.eventListeners.push(taskDeleteListener);

      // Inline edit: rename
      const taskRenameListener = SafeEventListener.add(
        gridContainer,
        'task-rename',
        (e) => this.handleTaskRename(e.detail),
        { description: 'TimelineContainer task rename' }
      );
      this.eventListeners.push(taskRenameListener);
      
      // Drag and drop events
      const dragStartListener = SafeEventListener.add(
        gridContainer,
        'task-drag-start',
        (e) => this.handleTaskDragStart(e.detail),
        { description: 'TimelineContainer task drag start' }
      );
      this.eventListeners.push(dragStartListener);
      
      const taskDropListener = SafeEventListener.add(
        gridContainer,
        'task-drop',
        (e) => this.handleTaskDrop(e.detail),
        { description: 'TimelineContainer task drop' }
      );
      this.eventListeners.push(taskDropListener);
    }
  }

  /**
   * Load schedule data for current date
   */
  loadScheduleData() {
    const timerId = `${this.componentId}-loadScheduleData`;
    performanceMonitor.startTimer(timerId, 'dataLoading');
    
    try {
      this.scheduleData = schedulingEngine.generateScheduleForDate(this.currentDate);
      this.performanceMetrics.dataLoadCount++;
      
      performanceMonitor.endTimer(timerId, {
        date: this.currentDate,
        taskCount: this.scheduleData?.schedule?.length || 0,
        success: this.scheduleData?.success || false,
        hasConflicts: this.scheduleData?.schedule?.some(task => task.hasConflicts) || false,
        dataLoadCount: this.performanceMetrics.dataLoadCount
      });
      
      console.log('📅 Schedule loaded for', this.currentDate);
    } catch (error) {
      console.error('❌ Error loading schedule data:', error);
      this.scheduleData = {
        success: false,
        error: 'loading_error',
        message: 'Failed to load schedule',
        schedule: [],
        sleepSchedule: null
      };
      
      performanceMonitor.endTimer(timerId, {
        date: this.currentDate,
        error: error.message,
        success: false
      });
    }
  }

  /**
   * Render timeline container
   */
  render() {
    if (!this.container || this.isDestroyed) return;
    
    const timerId = `${this.componentId}-render-${this.performanceMetrics.renderCount}`;
    performanceMonitor.startTimer(timerId, 'renders');
    
    // Load schedule data if not loaded
    if (!this.scheduleData) {
      this.loadScheduleData();
    }
    
    // Update child components with current data
    const componentData = {
      currentDate: this.currentDate,
      timeFilter: this.timeFilter,
      scheduleData: this.scheduleData
    };
    
    // Update header
    if (this.timelineHeader) {
      this.timelineHeader.update(componentData);
    }
    
    // Update grid
    if (this.timelineGrid) {
      this.timelineGrid.update(componentData);
    }
    
    this.performanceMetrics.renderCount++;
    this.lastRenderTime = Date.now();
    
    performanceMonitor.endTimer(timerId, {
      renderCount: this.performanceMetrics.renderCount,
      hasScheduleData: !!this.scheduleData,
      taskCount: this.scheduleData?.schedule?.length || 0,
      timeFilter: this.timeFilter
    });
  }

  /**
   * Refresh timeline data and re-render
   */
  refresh() {
    if (this.isDestroyed) return;
    
    const timerId = `${this.componentId}-refresh-${this.performanceMetrics.refreshCount}`;
    performanceMonitor.startTimer(timerId, 'refreshes');
    
    // Throttle renders to prevent excessive updates
    const now = Date.now();
    if (now - this.lastRenderTime < this.options.renderThrottleMs) {
      performanceMonitor.endTimer(timerId, { 
        throttled: true,
        timeSinceLastRender: now - this.lastRenderTime 
      });
      return;
    }
    
    this.performanceMetrics.refreshCount++;
    
    this.loadScheduleData();
    this.render();
    
    performanceMonitor.endTimer(timerId, {
      refreshCount: this.performanceMetrics.refreshCount,
      scheduleTaskCount: this.scheduleData?.schedule?.length || 0,
      throttled: false
    });
  }

  /**
   * Set current date and refresh
   */
  setDate(date) {
    if (this.currentDate === date) return;
    
    this.currentDate = date;
    this.refresh();
  }

  /**
   * Set time filter and re-render
   */
  setTimeFilter(filter) {
    if (this.timeFilter === filter) return;
    
    this.timeFilter = filter;
    this.render();
  }

  /**
   * Start real-time updates
   */
  startRealTimeUpdates() {
    if (this.realTimeTimer) {
      SafeInterval.clear(this.realTimeTimer);
    }
    
    this.realTimeTimer = SafeInterval.set(() => {
      if (this.isDestroyed) return;
      
      // Update time displays
      if (this.timelineHeader) {
        this.timelineHeader.updateCurrentTime();
      }
      
      // Update time indicator and task statuses
      if (this.timelineGrid) {
        this.timelineGrid.updateTimeIndicator();
        this.timelineGrid.updateTaskStatuses();
      }
    }, 30000, 'Timeline real-time updates');
  }

  /**
   * Pause real-time updates (for performance)
   */
  pauseRealTimeUpdates() {
    if (this.realTimeTimer) {
      SafeInterval.clear(this.realTimeTimer);
      this.realTimeTimer = null;
    }
  }

  /**
   * Resume real-time updates
   */
  resumeRealTimeUpdates() {
    this.startRealTimeUpdates();
    this.refresh(); // Refresh on resume to catch up
  }

  // ==================== Event Handlers ====================

  /**
   * Handle date navigation
   */
  handleNavigateDay({ direction, days }) {
    const currentDate = new Date(this.currentDate + 'T00:00:00');
    currentDate.setDate(currentDate.getDate() + days);
    const newDate = dataUtils.formatDate(currentDate);
    state.setCurrentDate(newDate);
  }

  /**
   * Handle go to today
   */
  handleGoToToday() {
    const today = dataUtils.getTodayDateString();
    state.setCurrentDate(today);
  }

  /**
   * Handle time filter change
   */
  handleTimeFilterChange({ filter, previousFilter }) {
    this.setTimeFilter(filter);
  }

  /**
   * Handle task creation
   */
  handleCreateTask({ scheduledTime, hour, clickPosition }) {
    const payload = { schedulingType: 'fixed', defaultTime: scheduledTime };
    taskModal.showCreate(payload, () => this.refresh());
  }

  /**
   * Handle task click
   */
  handleTaskClick({ taskId, element, clickPosition }) {
    // For now, same as edit - can be customized later
    this.handleTaskEdit({ taskId });
  }

  /**
   * Handle task completion toggle
   */
  async handleTaskComplete({ taskId }) {
    try {
      await toggleTaskCompletion(taskId);
      this.refresh();
    } catch (error) {
      console.error('Error toggling task completion:', error);
    }
  }

  /**
   * Handle task edit
   */
  handleTaskEdit({ taskId }) {
    const taskTemplates = state.getTaskTemplates();
    const task = taskTemplates.find(t => t.id === taskId);
    
    if (task) {
      taskModal.showEdit(task, () => this.refresh());
    }
  }

  /**
   * Handle task skip today
   */
  async handleTaskSkip({ taskId }) {
    try {
      const date = this.currentDate;
      await taskInstanceManager.skipByTemplateAndDate(taskId, date, 'Skipped from context menu');
      this.refresh();
    } catch (error) {
      console.error('Error skipping task:', error);
    }
  }

  /**
   * Handle task postpone by delta minutes (default 15)
   */
  async handleTaskPostpone({ taskId, deltaMinutes }) {
    try {
      const date = this.currentDate;
      const minutes = Number(deltaMinutes) || 15;
      await taskInstanceManager.postponeByTemplateAndDate(taskId, date, minutes);
      this.refresh();
    } catch (error) {
      console.error('Error postponing task:', error);
    }
  }

  /**
   * Handle task delete (template)
   */
  async handleTaskDelete({ taskId }) {
    try {
      await state.deleteTaskTemplate(taskId);
      this.refresh();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  }

  /**
   * Handle inline rename and persist to template
   */
  async handleTaskRename({ taskId, newName }) {
    try {
      const trimmed = (newName || '').trim();
      if (!trimmed) return;
      await state.updateTaskTemplate(taskId, { taskName: trimmed });
      this.refresh();
    } catch (error) {
      console.error('Error renaming task:', error);
    }
  }

  /**
   * Handle task drag start
   */
  handleTaskDragStart({ taskId, element }) {
    // Visual feedback could be added here
    console.log('Task drag started:', taskId);
  }

  /**
   * Handle task drop (rescheduling)
   */
  async handleTaskDrop({ taskId, newHour, newTime }) {
    try {
      // Validate the new time
      if (!this.validateTaskReschedule(taskId, newTime)) {
        return;
      }

      // Find the task template
      const taskTemplate = await state.getTaskTemplate(taskId);
      if (!taskTemplate) {
        throw new Error('Task template not found');
      }

      // Update the scheduled time
      const updatedTemplate = {
        ...taskTemplate,
        scheduledTime: newTime
      };

      // Save the updated template
      await state.updateTaskTemplate(taskId, updatedTemplate);

      // Show success feedback
      this.showRescheduleSuccess(taskTemplate.taskName, newTime);

      // Re-render timeline to reflect changes
      this.refresh();

    } catch (error) {
      console.error('Error rescheduling task:', error);
      this.showValidationError('Failed to reschedule task. Please try again.');
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    // Throttle resize handling
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    
    this.resizeTimeout = setTimeout(() => {
      this.render();
    }, 150);
  }

  /**
   * Handle page visibility change
   */
  handleVisibilityChange() {
    if (document.hidden) {
      this.pauseRealTimeUpdates();
    } else {
      this.resumeRealTimeUpdates();
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Validate task reschedule
   */
  validateTaskReschedule(taskId, newTime) {
    // Basic validation - can be expanded
    const scheduledTasks = this.scheduleData?.schedule || [];
    const draggedTask = scheduledTasks.find(task => task.id === taskId);
    
    if (!draggedTask) return false;

    // Check for conflicts (basic validation)
    const newStartMinutes = this.timeStringToMinutes(newTime);
    const newEndMinutes = newStartMinutes + draggedTask.durationMinutes;

    // Validate within business hours (6 AM to 11 PM)
    if (newStartMinutes < 360 || newEndMinutes > 1380) {
      this.showValidationError('Cannot schedule outside business hours (6 AM - 11 PM)');
      return false;
    }

    return true;
  }

  /**
   * Convert time string (HH:MM) to minutes since midnight
   */
  timeStringToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Show validation error message
   */
  showValidationError(message) {
    // Simple alert for now - can be replaced with better UI
        import('../utils/Toast.js').then(({ Toast }) => Toast.info(message, { duration: 3000 })).catch(() => {});
  }

  /**
   * Show reschedule success message
   */
  showRescheduleSuccess(taskName, newTime) {
    // Simple alert for now - can be replaced with better UI
    console.log(`✅ "${taskName}" rescheduled to ${newTime}`);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const baseMetrics = {
      renderCount: this.performanceMetrics.renderCount,
      refreshCount: this.performanceMetrics.refreshCount,
      dataLoadCount: this.performanceMetrics.dataLoadCount,
      hasRealTimeTimer: !!this.realTimeTimer,
      activeListeners: this.eventListeners.length,
      childComponents: {
        header: !!this.timelineHeader,
        grid: !!this.timelineGrid
      }
    };

    // Add child component metrics
    if (this.timelineHeader) {
      baseMetrics.childComponents.headerMetrics = this.timelineHeader.getPerformanceMetrics?.() || {};
    }
    
    if (this.timelineGrid) {
      baseMetrics.childComponents.gridMetrics = this.timelineGrid.getPerformanceMetrics?.() || {};
    }

    return baseMetrics;
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
    
    // Clear timers
    if (this.realTimeTimer) {
      SafeInterval.clear(this.realTimeTimer);
      this.realTimeTimer = null;
    }
    
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // Clean up child components
    if (this.timelineHeader) {
      this.timelineHeader.destroy();
      this.timelineHeader = null;
    }
    
    if (this.timelineGrid) {
      this.timelineGrid.destroy();
      this.timelineGrid = null;
    }
    
    // Clean up event listeners and timers
    this.cleanup();
    
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    
    // Unregister from component manager
    ComponentManager.unregister(this.componentId);
    
    // Clear data
    this.scheduleData = null;
    
    console.log('🗑️ TimelineContainer destroyed');
  }
}
