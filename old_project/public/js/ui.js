/**
 * UI Management Module
 * 
 * Handles all DOM manipulation, rendering, and UI state management
 * Separation of concerns: UI rendering separate from business logic
 */

import { state, stateListeners } from './state.js';
import { schedulingEngine } from './taskLogic.js';
import { SimpleErrorHandler } from './utils/SimpleErrorHandler.js';
import { dataUtils } from './dataOffline.js';
import { taskList } from './components/TaskList.js';
import { TimelineContainer } from './components/TimelineContainer.js';
import { ComponentManager } from './utils/MemoryLeakPrevention.js';
import { taskModal } from './app.js';

/**
 * UI State Management
 */
const uiState = {
  currentModal: null,
  isLoading: false,
  lastRenderedView: null,
  renderCache: new Map(),
  viewMode: localStorage.getItem('preferredView') || 'list', // 'timeline' or 'list'
  
  /**
   * Get current view mode
   */
  getViewMode() {
    return this.viewMode;
  },
  
  /**
   * Set view mode and persist to localStorage
   */
  setViewMode(mode) {
    if (mode !== 'timeline' && mode !== 'list') {
      console.warn('Invalid view mode:', mode);
      return;
    }
    this.viewMode = mode;
    localStorage.setItem('preferredView', mode);
  }
};

/**
 * DOM Element Selectors
 */
const SELECTORS = {
  loadingScreen: '#loading-screen',
  authContainer: '#auth-container',
  mainApp: '#main-app',
  appHeader: '#app-header',
  appMain: '#app-main',
  appNav: '#app-nav'
};

/**
 * Main UI Controller
 */
export const uiController = {
  /**
   * Initialize UI system
   */
  init() {
    this.setupGlobalEventListeners();
    this.setupStateChangeListeners();
    console.log('✅ UI system initialized');
  },

  /**
   * Setup global UI event listeners
   */
  setupGlobalEventListeners() {
    // Handle window resize for responsive updates
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Handle visibility change for performance
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
  },

  /**
   * Setup state change listeners for automatic UI updates
   */
  setupStateChangeListeners() {
    // Listen for view changes
    stateListeners.on('view', (view) => {
      this.renderCurrentView();
    });

    // Listen for task template changes
    stateListeners.on('taskTemplates', () => {
      if (state.getCurrentView() === 'today' || state.getCurrentView() === 'library') {
        this.renderCurrentView();
      }
    });

    // Listen for task instance changes
    stateListeners.on('taskInstances', () => {
      if (state.getCurrentView() === 'today') {
        this.renderCurrentView();
      }
    });

    // Listen for settings changes
    stateListeners.on('settings', () => {
      this.renderCurrentView();
    });

    // Listen for loading state changes
    stateListeners.on('loading', (loadingData) => {
      this.updateLoadingStates(loadingData);
    });
  },

  /**
   * Handle window resize events
   */
  handleResize() {
    // Trigger responsive layout updates
    this.updateResponsiveElements();
  },

  /**
   * Handle visibility change events
   */
  handleVisibilityChange() {
    if (document.hidden) {
      // Pause non-critical UI updates when tab is hidden
      this.pauseUIUpdates();
    } else {
      // Resume UI updates when tab becomes visible
      this.resumeUIUpdates();
    }
  },

  /**
   * Pause non-critical UI updates
   */
  pauseUIUpdates() {
    console.log('⏸️ UI updates paused (tab hidden)');
  },

  /**
   * Resume UI updates
   */
  resumeUIUpdates() {
    console.log('▶️ UI updates resumed (tab visible)');
    this.renderCurrentView(); // Refresh current view
  },

  /**
   * Update responsive elements based on screen size
   */
  updateResponsiveElements() {
    // This will be expanded in future phases with specific responsive logic
    console.log('📱 Updating responsive elements');
  },

  /**
   * Render current view based on application state
   */
  renderCurrentView() {
    const currentView = state.getCurrentView();
    const previousView = uiState.lastRenderedView;
    
    // Prevent unnecessary re-renders
    if (previousView === currentView && !this.shouldForceRender()) {
      return;
    }

    try {
      // Clean up previous view if switching views
      if (previousView && previousView !== currentView) {
        this.cleanupPreviousView(previousView);
      }
      
      // Render new view
      switch (currentView) {
        case 'today':
          this.renderTodayView();
          break;
        case 'library':
          this.renderTaskLibraryView();
          break;
        case 'settings':
          this.renderSettingsView();
          break;
        default:
          console.warn('Unknown view:', currentView);
      }
      
      uiState.lastRenderedView = currentView;
    } catch (error) {
      console.error('❌ Error rendering view:', error);
      SimpleErrorHandler.showError('Failed to render view. Please try refreshing the page.', error);
    }
  },

  /**
   * Clean up resources from the previous view
   */
  cleanupPreviousView(previousView) {
    try {
      switch (previousView) {
        case 'library':
          if (taskLibraryUI.destroy) {
            taskLibraryUI.destroy();
          }
          break;
        // Add cleanup for other views as needed
      }
    } catch (error) {
      console.warn('⚠️ Warning during view cleanup:', error);
    }
  },

  /**
   * Check if UI should force re-render
   */
  shouldForceRender() {
    // Force render if data has been updated recently
    return true; // For now, always render to ensure consistency
  },

  /**
   * Update loading states in UI
   */
  updateLoadingStates(loadingData) {
    const { type, isLoading } = loadingData;
    
    // Update specific loading indicators
    const loadingElements = document.querySelectorAll(`[data-loading-type="${type}"]`);
    loadingElements.forEach(element => {
      if (isLoading) {
        element.classList.add('loading');
      } else {
        element.classList.remove('loading');
      }
    });
  }
};

/**
 * Authentication UI Management
 */
export const authUI = {
  /**
   * Show authentication container
   */
  show() {
    const authContainer = document.getElementById('auth-container');
    const mainApp = document.getElementById('main-app');
    
    authContainer.style.display = 'block';
    mainApp.style.display = 'none';
    
    this.renderAuthForm();
  },

  /**
   * Hide authentication container
   */
  hide() {
    const authContainer = document.getElementById('auth-container');
    authContainer.style.display = 'none';
  },

  /**
   * Render authentication form
   */
  renderAuthForm() {
    const authContainer = document.getElementById('auth-container');
    authContainer.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 1rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      ">
        <div style="
          background: white;
          border-radius: 1rem;
          padding: 2rem;
          max-width: 400px;
          width: 100%;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        ">
          <div style="text-align: center; margin-bottom: 2rem;">
            <h1 style="font-size: 2rem; color: #3B82F6; margin-bottom: 0.5rem;">
              📋 Daily AI
            </h1>
            <p style="color: #6B7280;">
              Your intelligent task manager
            </p>
          </div>
          
          <form id="auth-form">
            <div style="margin-bottom: 1rem;">
              <label class="label" for="email">Email</label>
              <input 
                type="email" 
                id="email" 
                class="input"
                required
                placeholder="Enter your email"
              />
            </div>
            
            <div style="margin-bottom: 1.5rem;">
              <label class="label" for="password">Password</label>
              <input 
                type="password" 
                id="password" 
                class="input"
                required
                placeholder="Enter your password"
              />
            </div>
            
            <div style="margin-bottom: 1rem;">
              <button type="submit" id="login-btn" class="btn btn-primary" style="width: 100%;">
                Sign In
              </button>
            </div>
            
            <div>
              <button type="button" id="signup-btn" class="btn btn-secondary" style="width: 100%;">
                Create Account
              </button>
            </div>
            
            <div id="auth-error" class="hidden" style="
              margin-top: 1rem;
              padding: 0.75rem;
              background: #FEF2F2;
              border: 1px solid #FECACA;
              border-radius: 0.5rem;
              color: #DC2626;
            "></div>
          </form>
        </div>
      </div>
    `;
  }
};

/**
 * Main App UI Management
 */
export const mainAppUI = {
  /**
   * Show main application using existing layout in index.html
   */
  show() {
    const authContainer = document.getElementById('auth-container');
    const mainApp = document.getElementById('main-app');
    
    authContainer.style.display = 'none';
    mainApp.style.display = 'block';
    
    this.initializeNavigationBindings();
    uiController.renderCurrentView();
  },

  /**
   * Initialize nav/menu bindings without rebuilding DOM
   */
  initializeNavigationBindings() {
    // Initialize responsive navigation to manage visibility/active states
    import('./utils/ResponsiveNavigation.js').then(({ ResponsiveNavigation }) => {
      if (!window.__responsiveNavInstance) {
        window.__responsiveNavInstance = new ResponsiveNavigation();
      }
    }).catch(() => {});
  },

  /**
   * Render application header
   */
  renderHeader() {
    const header = document.getElementById('app-header');
    const user = state.getUser();
    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    header.innerHTML = `
      <div class="header-content">
        <div class="header-left">
          <h1 class="app-title">📋 Daily AI</h1>
          <p class="header-date">${today}</p>
        </div>
        <div class="header-right">
          <span class="user-email">${user?.email || 'User'}</span>
          <button id="sign-out-btn" class="btn btn-secondary btn-sm">
            Sign Out
          </button>
        </div>
      </div>
    `;
    
    // Add sign out functionality
    document.getElementById('sign-out-btn')?.addEventListener('click', () => {
      firebase.auth().signOut();
    });
  },

  /**
   * Render navigation
   */
  renderNavigation() {
    const nav = document.getElementById('app-nav');
    const currentView = state.getCurrentView();
    
    nav.innerHTML = `
      <div class="nav-content">
        <button class="nav-btn ${currentView === 'today' ? 'active' : ''}" data-view="today">
          🏠 Today
        </button>
        <button class="nav-btn ${currentView === 'library' ? 'active' : ''}" data-view="library">
          📚 Library
        </button>
        <button class="nav-btn ${currentView === 'settings' ? 'active' : ''}" data-view="settings">
          ⚙️ Settings
        </button>
        <button class="nav-btn add-task-btn" id="nav-add-task">
          ➕ Add Task
        </button>
      </div>
    `;
    
    // Add navigation event listeners
    nav.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        state.setCurrentView(view);
      });
    });
    
    // Add task button
    document.getElementById('nav-add-task')?.addEventListener('click', () => {
      this.showAddTaskModal();
    });
  },

  /**
   * Show add task modal (placeholder for now)
   */
  showAddTaskModal() {
    try {
      if (taskModal && typeof taskModal.showCreate === 'function') {
        taskModal.showCreate({}, (savedTask) => {
          // UI updates propagate via state listeners
          console.log('Task created:', savedTask);
        });
      } else {
        import('./utils/Toast.js').then(({ Toast }) => 
          Toast.info('Task modal not ready yet', { duration: 2500 })
        ).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to open Add Task modal:', e);
    }
  }
};

/**
 * Today View UI Management
 */
export const todayViewUI = {
  timelineInstance: null,
  
  /**
   * Render Today View
   */
  render() {
    const mainContent = document.querySelector('#today-view .view-content');
    const settings = state.getSettings();
    const taskTemplates = state.getTaskTemplates();
    const currentDate = state.getCurrentDate();
    const taskInstances = state.getTaskInstancesForDate(currentDate);
    
    // Generate schedule for today
    const scheduleResult = schedulingEngine.generateScheduleForDate(currentDate);
    
    if (!mainContent) return;
    mainContent.innerHTML = `
      <div class="container">
        <div class="view-container">
          ${this.renderDateNavigation(currentDate)}
          ${this.renderScheduleOverview(settings, taskTemplates, taskInstances, scheduleResult)}
          ${this.renderQuickActions()}
          ${this.renderContentArea(taskTemplates, scheduleResult)}
        </div>
      </div>
    `;
    
    this.setupEventListeners();
  },
  
  /**
   * Render content area based on current view mode
   */
  renderContentArea(taskTemplates, scheduleResult) {
    const currentView = uiState.getViewMode();
    
    if (currentView === 'timeline') {
      return `
        <div class="content-area card" data-view="timeline">
          <div id="timeline-container" class="timeline-container"></div>
        </div>
      `;
    } else {
      return `
        <div class="content-area card" data-view="list">
          ${this.renderTasksList(taskTemplates, scheduleResult)}
        </div>
      `;
    }
  },

  /**
   * Render date navigation
   */
  renderDateNavigation(currentDate) {
    return `
      <div class="date-navigation">
        <div class="date-controls">
          <button id="prev-day" class="btn btn-secondary">← Previous</button>
          <h2 class="current-date">${this.formatDate(currentDate)}</h2>
          <button id="next-day" class="btn btn-secondary">Next →</button>
          <button id="today-btn" class="btn btn-primary">Today</button>
        </div>
        ${this.renderViewToggle()}
      </div>
    `;
  },
  
  /**
   * Render view toggle buttons
   */
  renderViewToggle() {
    const currentView = uiState.getViewMode();
    return `
      <div class="view-toggle">
        <button class="toggle-btn ${currentView === 'timeline' ? 'active' : ''}" 
                data-view="timeline" id="view-timeline-btn">
          📅 Timeline
        </button>
        <button class="toggle-btn ${currentView === 'list' ? 'active' : ''}" 
                data-view="list" id="view-list-btn">
          📝 List
        </button>
      </div>
    `;
  },

  /**
   * Render schedule overview
   */
  renderScheduleOverview(settings, taskTemplates, taskInstances, scheduleResult) {
    const sleepSchedule = `${settings.defaultSleepTime} - ${settings.defaultWakeTime} (${settings.desiredSleepDuration}h)`;
    
    return `
      <div class="schedule-overview card">
        <div class="overview-card">
          <h3>Today's Schedule</h3>
          <p class="sleep-info">Sleep: ${sleepSchedule}</p>
          ${scheduleResult.success ? 
            `<p class="schedule-status success">✅ Schedule generated successfully</p>` :
            `<p class="schedule-status error">❌ ${scheduleResult.message}</p>`
          }
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <h4>Task Templates</h4>
            <span class="stat-number">${taskTemplates.length}</span>
            <span class="stat-label">Active tasks</span>
          </div>
          
          <div class="stat-card">
            <h4>Today's Instances</h4>
            <span class="stat-number">${taskInstances.length}</span>
            <span class="stat-label">Modified for today</span>
          </div>
          
          ${scheduleResult.success ? `
            <div class="stat-card">
              <h4>Scheduled</h4>
              <span class="stat-number">${scheduleResult.scheduledTasks}</span>
              <span class="stat-label">Tasks scheduled</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Render quick actions
   */
  renderQuickActions() {
    return `
      <div class="quick-actions card">
        <h3>Quick Actions</h3>
        <div class="action-buttons">
          <button id="add-task-btn" class="btn btn-primary">
            ➕ Add Task
          </button>
          <button id="view-library-btn" class="btn btn-secondary">
            📚 View Library
          </button>
          <button id="refresh-schedule-btn" class="btn btn-secondary">
            🔄 Refresh Schedule
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Render tasks list
   */
  renderTasksList(taskTemplates, scheduleResult) {
    if (taskTemplates.length === 0) {
      return `
        <div class="tasks-section">
          <h3>Your Tasks</h3>
          <div class="empty-state">
            <div class="empty-icon">🗓️</div>
            <p>No tasks yet. Create your first task to get started.</p>
            <button id="empty-add-task-btn" class="btn btn-primary">➕ Add Task</button>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="tasks-section">
        <h3>Your Tasks (${taskTemplates.length})</h3>
        <div class="tasks-list">
          ${taskTemplates.map(task => this.renderTaskItem(task)).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Render individual task item
   */
  renderTaskItem(task) {
    return `
      <div class="task-item" data-task-id="${task.id}">
        <div class="task-content">
          <h4 class="task-name">${task.taskName}</h4>
          ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
          <div class="task-meta">
            <span class="task-duration">⏱️ ${task.durationMinutes}min</span>
            <span class="task-priority">📊 Priority ${task.priority}</span>
            <span class="task-type">${task.isMandatory ? '🔒 Mandatory' : '📝 Skippable'}</span>
            <span class="task-window">🕐 ${task.timeWindow}</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="btn btn-sm btn-secondary" data-action="edit-task" data-task-id="${task.id}">
            Edit
          </button>
          <button class="btn btn-sm btn-primary" data-action="toggle-task-completion" data-task-id="${task.id}">
            ✓ Complete
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Setup event listeners for Today view
   */
  setupEventListeners() {
    // Date navigation
    document.getElementById('prev-day')?.addEventListener('click', () => {
      this.navigateDate(-1);
    });
    
    document.getElementById('next-day')?.addEventListener('click', () => {
      this.navigateDate(1);
    });
    
    document.getElementById('today-btn')?.addEventListener('click', () => {
      state.setCurrentDate(dataUtils.getTodayDateString());
    });
    
    // Quick actions
    document.getElementById('add-task-btn')?.addEventListener('click', () => {
      mainAppUI.showAddTaskModal();
    });
    document.getElementById('empty-add-task-btn')?.addEventListener('click', () => {
      mainAppUI.showAddTaskModal();
    });
    
    document.getElementById('view-library-btn')?.addEventListener('click', () => {
      state.setCurrentView('library');
    });
    
    document.getElementById('refresh-schedule-btn')?.addEventListener('click', () => {
      uiController.renderCurrentView();
      SimpleErrorHandler.showSuccess('Schedule refreshed!');
    });
    
    // View toggle listeners
    document.getElementById('view-timeline-btn')?.addEventListener('click', () => {
      this.switchView('timeline');
    });
    
    document.getElementById('view-list-btn')?.addEventListener('click', () => {
      this.switchView('list');
    });
    
    // Initialize Timeline component if in timeline view
    this.initializeTimeline();
  },
  
  /**
   * Switch between timeline and list views
   */
  switchView(newView) {
    const currentView = uiState.getViewMode();
    
    if (newView === currentView) {
      return; // Already in this view
    }
    
    // Set new view mode
    uiState.setViewMode(newView);
    
    // Re-render the entire view to update content
    this.render();
  },
  
  /**
   * Get mobile-responsive hour height for timeline
   */
  getResponsiveHourHeight() {
    const isMobile = window.innerWidth <= 767;
    const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1023;
    
    if (isMobile) {
      return 60; // Reduced height for mobile
    } else if (isTablet) {
      return 70; // Medium height for tablet
    } else {
      return 80; // Full height for desktop
    }
  },
  
  /**
   * Initialize Timeline component
   */
  initializeTimeline() {
    // Only initialize if we're in timeline view and container exists
    const isTimelineView = uiState.getViewMode() === 'timeline';
    const containerExists = document.getElementById('timeline-container');
    
    if (!isTimelineView || !containerExists) {
      return;
    }
    
    if (this.timelineInstance) {
      this.timelineInstance.destroy(); // Clean up existing instance
    }
    
    this.timelineInstance = new TimelineContainer('timeline-container', {
      hourHeight: this.getResponsiveHourHeight(),
      enableClickToCreate: true,
      enableRealTimeIndicator: true,
      showIndicatorOnlyForToday: true
    });
    
    ComponentManager.register(this.timelineInstance);

    // Ensure the time indicator is positioned immediately after render
    requestAnimationFrame(() => {
      try {
        this.timelineInstance?.timelineGrid?.updateTimeIndicator?.();
      } catch (_) {}
    });
  },

  /**
   * Navigate date by number of days
   */
  navigateDate(days) {
    const currentDate = new Date(state.getCurrentDate());
    currentDate.setDate(currentDate.getDate() + days);
    state.setCurrentDate(dataUtils.formatDate(currentDate));
  },

  /**
   * Format date for display
   */
  formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
};

/**
 * Task Library View UI Management
 */
export const taskLibraryUI = {
  /**
   * Render Task Library View using the new TaskList component
   */
  render() {
    const mainContent = document.querySelector('#task-library-view .view-content');
    if (!mainContent) return;
    // Create container for the TaskList component
    mainContent.innerHTML = `
      <div class="view-container task-library-view">
        <div id="task-library-container"></div>
      </div>
    `;
    
    // Initialize the TaskList component
    try {
      taskList.init('#task-library-container');
      console.log('✅ Task Library view rendered with TaskList component');
    } catch (error) {
      console.error('❌ Error initializing TaskList component:', error);
      SimpleErrorHandler.showError('Failed to load task library. Please try refreshing the page.', error);
      
      // Fallback content
      mainContent.innerHTML = `
        <div class="view-container">
          <div class="error-state">
            <h3>⚠️ Task Library Unavailable</h3>
            <p>There was an error loading the task library. Please refresh the page to try again.</p>
            <button class="btn btn-primary" onclick="location.reload()">
              🔄 Refresh Page
            </button>
          </div>
        </div>
      `;
    }
  },

  /**
   * Clean up TaskList component when leaving this view
   */
  destroy() {
    try {
      taskList.destroy();
      console.log('✅ Task Library view cleaned up');
    } catch (error) {
      console.warn('⚠️ Warning cleaning up TaskList component:', error);
    }
  }
};

/**
 * Settings View UI Management
 */
export const settingsUI = {
  /**
   * Render Settings View
   */
  render() {
    const mainContent = document.querySelector('#settings-view .view-content');
    const settings = state.getSettings();
    
    if (!mainContent) return;
    mainContent.innerHTML = `
      <div class="view-container">
        <div class="settings-header">
          <h2>Settings</h2>
          <p>Configure your Daily AI preferences</p>
        </div>
        
        <div class="settings-content">
          ${this.renderSleepConfiguration(settings)}
          ${this.renderSettingsEmptyCTA()}
        </div>
      </div>
    `;

    // Bind CTA button
    document.getElementById('settings-edit-btn')?.addEventListener('click', () => {
      import('./utils/Toast.js').then(({ Toast }) => 
        Toast.info('Settings editing is coming soon!', { duration: 2500 })
      ).catch(() => {});
    });
  },

  /**
   * Render sleep configuration section
   */
  renderSleepConfiguration(settings) {
    return `
      <div class="settings-section card">
        <h3>Sleep Configuration</h3>
        <div class="settings-grid">
          <div class="setting-item">
            <label class="label">Sleep Duration (hours)</label>
            <span class="setting-value">${settings.desiredSleepDuration}</span>
          </div>
          <div class="setting-item">
            <label class="label">Default Wake Time</label>
            <span class="setting-value">${settings.defaultWakeTime}</span>
          </div>
          <div class="setting-item">
            <label class="label">Default Sleep Time</label>
            <span class="setting-value">${settings.defaultSleepTime}</span>
          </div>
        </div>
        <p class="settings-note">
          Settings editing will be implemented in a future phase.
        </p>
      </div>
    `;
  }
  ,
  /**
   * Render settings empty state CTA with icon
   */
  renderSettingsEmptyCTA() {
    return `
      <div class="card" style="text-align:center;">
        <div class="empty-state">
          <div class="empty-icon">⚙️</div>
          <p>More preferences and editing controls are on the way.</p>
          <div class="empty-actions">
            <button id="settings-edit-btn" class="btn btn-primary">Edit Settings</button>
          </div>
        </div>
      </div>
    `;
  }
};

/**
 * Add UI controller methods to main uiController
 */
uiController.renderTodayView = todayViewUI.render.bind(todayViewUI);
uiController.renderTaskLibraryView = taskLibraryUI.render.bind(taskLibraryUI);
uiController.renderSettingsView = settingsUI.render.bind(settingsUI);


console.log('✅ UI management system initialized');
