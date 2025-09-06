import { SafeInterval, SafeTimeout, SafeEventListener, ComponentManager } from './MemoryLeakPrevention.js';
import { state } from '../state.js';
import { stateListeners } from '../state/Store.js';

// Responsive Navigation Management
class ResponsiveNavigation {
  constructor() {
    this.currentView = 'today';
    this.mobileMenuOpen = false;
    this.clockInterval = null;
    
    // Memory leak prevention tracking
    this.eventListeners = [];
    this.timeouts = [];
    
    // Register with memory manager
    ComponentManager.register(this);
    
    this.init();
  }
  
  init() {
    console.log('🧭 Initializing responsive navigation...');

    // Setup navigation event listeners
    this.setupMobileMenuToggle();
    this.setupNavigationButtons();
    this.setupViewSwitching();
    this.setupLiveClock();
    this.setupResponsiveClasses();

    // Initialize current date display
    this.updateCurrentDate();

    // Keep in sync with global state changes
    stateListeners.on('view', (view) => {
      // Avoid loops: update DOM without re-setting state
      this.switchToView(view, true /* closeMobileMenu */, false /* propagateToState */);
    });

    console.log('✅ Responsive navigation initialized');
  }
  
  setupMobileMenuToggle() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mobileNavMenu = document.getElementById('mobile-nav-menu');
    
    if (menuToggle && mobileNavMenu) {
      const toggleListener = SafeEventListener.add(
        menuToggle,
        'click',
        () => this.toggleMobileMenu(),
        { description: 'Mobile menu toggle button' }
      );
      this.eventListeners.push(toggleListener);
      
      // Close mobile menu when clicking outside
      const clickOutsideListener = SafeEventListener.add(
        document,
        'click',
        (e) => {
          if (this.mobileMenuOpen && 
              !menuToggle.contains(e.target) && 
              !mobileNavMenu.contains(e.target)) {
            this.closeMobileMenu();
          }
        },
        { description: 'Mobile menu click outside' }
      );
      this.eventListeners.push(clickOutsideListener);
      
      // Close mobile menu on escape key
      const escapeListener = SafeEventListener.add(
        document,
        'keydown',
        (e) => {
          if (e.key === 'Escape' && this.mobileMenuOpen) {
            this.closeMobileMenu();
          }
        },
        { description: 'Mobile menu escape key' }
      );
      this.eventListeners.push(escapeListener);
    }
  }
  
  toggleMobileMenu() {
    if (this.mobileMenuOpen) {
      this.closeMobileMenu();
    } else {
      this.openMobileMenu();
    }
  }
  
  openMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mobileNavMenu = document.getElementById('mobile-nav-menu');
    const hamburgerIcon = menuToggle?.querySelector('.hamburger-icon');
    const closeIcon = menuToggle?.querySelector('.close-icon');
    
    if (mobileNavMenu) {
      mobileNavMenu.style.display = 'block';
      mobileNavMenu.style.animation = 'slideDown 0.3s ease-out forwards';
      
      // Update toggle button
      if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'true');
        if (hamburgerIcon) hamburgerIcon.style.display = 'none';
        if (closeIcon) closeIcon.style.display = 'block';
      }
      
      this.mobileMenuOpen = true;
      console.log('📱 Mobile menu opened');
    }
  }
  
  closeMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mobileNavMenu = document.getElementById('mobile-nav-menu');
    const hamburgerIcon = menuToggle?.querySelector('.hamburger-icon');
    const closeIcon = menuToggle?.querySelector('.close-icon');
    
    if (mobileNavMenu) {
      mobileNavMenu.style.animation = 'slideUp 0.3s ease-out forwards';
      
      const hideTimeout = SafeTimeout.set(() => {
        mobileNavMenu.style.display = 'none';
      }, 300, 'Hide mobile menu animation');
      this.timeouts.push(hideTimeout);
      
      // Update toggle button
      if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        if (hamburgerIcon) hamburgerIcon.style.display = 'block';
        if (closeIcon) closeIcon.style.display = 'none';
      }
      
      this.mobileMenuOpen = false;
      console.log('📱 Mobile menu closed');
    }
  }
  
  setupNavigationButtons() {
    // All navigation buttons across different components
    const navButtons = [
      // Mobile hamburger menu
      { id: 'mobile-today-btn', view: 'today' },
      { id: 'mobile-library-btn', view: 'library' },
      { id: 'mobile-settings-btn', view: 'settings' },
      
      // Desktop navigation
      { id: 'desktop-today-btn', view: 'today' },
      { id: 'desktop-library-btn', view: 'library' },
      { id: 'desktop-settings-btn', view: 'settings' },
      
      // Mobile bottom navigation
      { id: 'bottom-today-btn', view: 'today' },
      { id: 'bottom-library-btn', view: 'library' },
      { id: 'bottom-settings-btn', view: 'settings' }
    ];
    
    navButtons.forEach(({ id, view }) => {
      const button = document.getElementById(id);
      if (button) {
        const listener = SafeEventListener.add(
          button,
          'click',
          (e) => {
            e.preventDefault();
            this.switchToView(view);
          },
          { description: `Navigation button ${id}` }
        );
        this.eventListeners.push(listener);
      }
    });
    
    // Setup add task buttons
    const addTaskButtons = ['fab', 'desktop-add-task-btn'];
    addTaskButtons.forEach(id => {
      const button = document.getElementById(id);
      if (button) {
        const listener = SafeEventListener.add(
          button,
          'click',
          () => this.handleAddTask(),
          { description: `Add task button ${id}` }
        );
        this.eventListeners.push(listener);
      }
    });
  }
  
  setupViewSwitching() {
    // Initialize view state
    this.switchToView(this.currentView, false /* closeMobileMenu */);
  }

  switchToView(viewName, closeMobileMenu = true, propagateToState = true) {
    if (viewName === this.currentView && propagateToState) {
      // No state change needed; still ensure DOM reflects the current view
      // but avoid redundant state notifications
    }

    console.log(`🧭 Switching to view: ${viewName}`);
    
    const views = ['today', 'library', 'settings'];
    const viewMap = {
      'today': 'today-view',
      'library': 'task-library-view', 
      'settings': 'settings-view'
    };
    
    // Hide all views
    views.forEach(view => {
      const viewElement = document.getElementById(viewMap[view]);
      if (viewElement) {
        viewElement.style.display = 'none';
        viewElement.classList.remove('active');
      }
    });
    
    // Show target view
    const targetView = document.getElementById(viewMap[viewName]);
    if (targetView) {
      targetView.style.display = 'block';
      targetView.classList.add('active');
    }
    
    // Update navigation states
    this.updateNavigationStates(viewName);
    
    // Update current view
    const previousView = this.currentView;
    this.currentView = viewName;

    // Close mobile menu if requested
    if (closeMobileMenu && this.mobileMenuOpen) {
      this.closeMobileMenu();
    }

    // Emit view change event
    this.emitViewChangeEvent(viewName, previousView);

    // Propagate to global state so the rest of the app renders
    if (propagateToState) {
      state.setCurrentView(viewName);
    }

    console.log(`✅ View switched to: ${viewName}`);
  }
  
  updateNavigationStates(activeView) {
    // All navigation buttons with their view mappings
    const navButtonGroups = [
      {
        today: 'mobile-today-btn',
        library: 'mobile-library-btn', 
        settings: 'mobile-settings-btn'
      },
      {
        today: 'desktop-today-btn',
        library: 'desktop-library-btn',
        settings: 'desktop-settings-btn'
      },
      {
        today: 'bottom-today-btn',
        library: 'bottom-library-btn',
        settings: 'bottom-settings-btn'
      }
    ];
    
    navButtonGroups.forEach(group => {
      Object.entries(group).forEach(([view, buttonId]) => {
        const button = document.getElementById(buttonId);
        if (button) {
          if (view === activeView) {
            button.classList.add('active');
            button.setAttribute('aria-current', 'page');
          } else {
            button.classList.remove('active');
            button.removeAttribute('aria-current');
          }
        }
      });
    });
  }
  
  setupLiveClock() {
    this.updateLiveClock();
    
    // Update clock every 30 seconds (as per specs)
    this.clockInterval = SafeInterval.set(() => {
      this.updateLiveClock();
    }, 30000, 'Navigation live clock updates');
    
    console.log('🕐 Live clock started (updates every 30 seconds)');
  }
  
  updateLiveClock() {
    const clockElement = document.getElementById('live-clock');
    if (clockElement) {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      clockElement.textContent = timeString;
    }
  }
  
  updateCurrentDate() {
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
      const today = new Date();
      const dateString = today.toLocaleDateString([], {
        weekday: 'short',
        month: 'short', 
        day: 'numeric'
      });
      dateElement.textContent = dateString;
    }
  }
  
  setupResponsiveClasses() {
    // Add responsive visibility classes based on screen size
    this.updateResponsiveVisibility();
    
    // Update on window resize with debouncing
    let resizeTimeout;
    const resizeListener = SafeEventListener.add(
      window,
      'resize',
      () => {
        if (resizeTimeout) {
          SafeTimeout.clear(resizeTimeout);
        }
        resizeTimeout = SafeTimeout.set(() => {
          this.updateResponsiveVisibility();
        }, 100, 'Responsive visibility update debounce');
        this.timeouts.push(resizeTimeout);
      },
      { description: 'Window resize for responsive navigation' }
    );
    this.eventListeners.push(resizeListener);
  }
  
  updateResponsiveVisibility() {
    const isMobile = window.innerWidth < 768;
    const elements = document.querySelectorAll('.mobile-only, .tablet-up-hidden, .mobile-only-hidden, .tablet-up');
    
    elements.forEach(element => {
      if (element.classList.contains('mobile-only') || 
          element.classList.contains('tablet-up-hidden')) {
        element.style.display = isMobile ? '' : 'none';
      } else if (element.classList.contains('mobile-only-hidden') || 
                 element.classList.contains('tablet-up')) {
        element.style.display = isMobile ? 'none' : '';
      }
    });
  }
  
  handleAddTask() {
    console.log('➕ Add task button clicked');
    
    // Emit add task event that can be handled by task management system
    const addTaskEvent = new CustomEvent('addTask', {
      detail: { 
        source: 'navigation',
        currentView: this.currentView 
      }
    });
    
    document.dispatchEvent(addTaskEvent);
  }
  
  emitViewChangeEvent(newView, previousView) {
    const viewChangeEvent = new CustomEvent('viewChange', {
      detail: {
        newView,
        previousView,
        timestamp: Date.now()
      }
    });
    
    document.dispatchEvent(viewChangeEvent);
  }
  
  // Public API methods
  getCurrentView() {
    return this.currentView;
  }
  
  isMobileMenuOpen() {
    return this.mobileMenuOpen;
  }
  
  // Cleanup method
  cleanup() {
    if (this.clockInterval) {
      SafeInterval.clear(this.clockInterval);
      this.clockInterval = null;
    }
    
    // Clear all tracked event listeners
    this.eventListeners.forEach(listenerId => {
      SafeEventListener.remove(listenerId);
    });
    this.eventListeners = [];
    
    // Clear all tracked timeouts
    this.timeouts.forEach(timeoutId => {
      SafeTimeout.clear(timeoutId);
    });
    this.timeouts = [];
    
    console.log('🧭 Navigation cleanup completed');
  }
  
  // Destroy method for ComponentManager compatibility
  destroy() {
    this.cleanup();
    
    // Unregister from memory manager
    ComponentManager.unregister(this);
    
    console.log('🧭 Navigation component destroyed');
  }
}

// Auto-cleanup on page unload (handled by MemoryLeakPrevention system)
// The global memory manager will automatically clean up all components
// No need for manual beforeunload listener here

export { ResponsiveNavigation };
