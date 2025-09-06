/**
 * Memory Leak Prevention Utility
 * 
 * Comprehensive system for preventing memory leaks in the Daily AI application.
 * Provides centralized management of intervals, timeouts, event listeners,
 * and integrates with Page Visibility API for efficient resource management.
 */

/**
 * Central Memory Management System
 */
class MemoryManager {
  constructor() {
    this.intervals = new Map();
    this.timeouts = new Map();
    this.eventListeners = new Map();
    this.components = new Set();
    this.isPageVisible = !document.hidden;
    this.pausedIntervals = new Set();
    
    // Initialize page visibility monitoring
    this.initPageVisibilityAPI();
    
    // Initialize beforeunload cleanup
    this.initBeforeUnloadCleanup();
    
    console.log('✅ Memory Manager initialized');
  }

  /**
   * Register an interval with automatic cleanup
   */
  registerInterval(callback, delay, options = {}) {
    const id = setInterval(() => {
      if (this.isPageVisible || options.runWhenHidden) {
        callback();
      }
    }, delay);
    
    const intervalInfo = {
      id,
      callback,
      delay,
      options,
      createdAt: new Date(),
      description: options.description || 'Unnamed interval'
    };
    
    this.intervals.set(id, intervalInfo);
    
    console.log(`📅 Registered interval: ${intervalInfo.description} (${delay}ms)`);
    return id;
  }

  /**
   * Register a timeout with automatic cleanup
   */
  registerTimeout(callback, delay, options = {}) {
    const id = setTimeout(() => {
      callback();
      this.timeouts.delete(id); // Auto-cleanup after execution
    }, delay);
    
    const timeoutInfo = {
      id,
      callback,
      delay,
      options,
      createdAt: new Date(),
      description: options.description || 'Unnamed timeout'
    };
    
    this.timeouts.set(id, timeoutInfo);
    
    console.log(`⏰ Registered timeout: ${timeoutInfo.description} (${delay}ms)`);
    return id;
  }

  /**
   * Register an event listener with automatic cleanup
   */
  registerEventListener(element, event, handler, options = {}) {
    const listenerId = `${element.tagName || 'window'}_${event}_${Date.now()}_${Math.random()}`;
    
    element.addEventListener(event, handler, options);
    
    const listenerInfo = {
      element,
      event,
      handler,
      options,
      createdAt: new Date(),
      description: options.description || `${event} on ${element.tagName || 'window'}`
    };
    
    this.eventListeners.set(listenerId, listenerInfo);
    
    console.log(`👂 Registered event listener: ${listenerInfo.description}`);
    return listenerId;
  }

  /**
   * Register a component for lifecycle management
   */
  registerComponent(component) {
    if (typeof component.destroy === 'function') {
      this.components.add(component);
      console.log(`🧩 Registered component for cleanup: ${component.constructor.name}`);
    } else {
      console.warn('Component registered without destroy method:', component);
    }
  }

  /**
   * Clear specific interval
   */
  clearInterval(intervalId) {
    if (this.intervals.has(intervalId)) {
      const info = this.intervals.get(intervalId);
      clearInterval(intervalId);
      this.intervals.delete(intervalId);
      this.pausedIntervals.delete(intervalId);
      console.log(`❌ Cleared interval: ${info.description}`);
    }
  }

  /**
   * Clear specific timeout
   */
  clearTimeout(timeoutId) {
    if (this.timeouts.has(timeoutId)) {
      const info = this.timeouts.get(timeoutId);
      clearTimeout(timeoutId);
      this.timeouts.delete(timeoutId);
      console.log(`❌ Cleared timeout: ${info.description}`);
    }
  }

  /**
   * Remove specific event listener
   */
  removeEventListener(listenerId) {
    if (this.eventListeners.has(listenerId)) {
      const info = this.eventListeners.get(listenerId);
      info.element.removeEventListener(info.event, info.handler, info.options);
      this.eventListeners.delete(listenerId);
      console.log(`❌ Removed event listener: ${info.description}`);
    }
  }

  /**
   * Unregister component and call its destroy method
   * Includes state guards to prevent infinite recursion
   */
  unregisterComponent(component) {
    if (!this.components.has(component)) return;
    if (component._isDestroying || component._isDestroyed) return;
    
    try {
      // Mark as destroying to prevent recursion
      component._isDestroying = true;
      
      // Remove from registry BEFORE calling destroy to prevent recursive calls
      this.components.delete(component);
      console.log(`🗑️ Unregistered component: ${component.constructor.name}`);
      
      // Call destroy method if it exists
      if (typeof component.destroy === 'function') {
        component.destroy();
      }
      
      // Mark as destroyed
      component._isDestroyed = true;
    } catch (error) {
      console.error('Error destroying component:', error);
      // Ensure component is still marked as destroyed even on error
      component._isDestroyed = true;
    }
  }

  /**
   * Initialize Page Visibility API monitoring
   */
  initPageVisibilityAPI() {
    const handleVisibilityChange = () => {
      const wasVisible = this.isPageVisible;
      this.isPageVisible = !document.hidden;
      
      if (wasVisible && !this.isPageVisible) {
        console.log('📱 Page hidden - pausing non-essential operations');
        this.pauseNonEssentialOperations();
      } else if (!wasVisible && this.isPageVisible) {
        console.log('📱 Page visible - resuming all operations');
        this.resumeAllOperations();
      }
    };

    this.registerEventListener(document, 'visibilitychange', handleVisibilityChange, {
      description: 'Page visibility monitoring'
    });
  }

  /**
   * Pause non-essential operations when page is hidden
   */
  pauseNonEssentialOperations() {
    this.intervals.forEach((info, id) => {
      if (!info.options.runWhenHidden) {
        this.pausedIntervals.add(id);
      }
    });
  }

  /**
   * Resume all operations when page becomes visible
   */
  resumeAllOperations() {
    this.pausedIntervals.clear();
  }

  /**
   * Initialize cleanup on page unload
   */
  initBeforeUnloadCleanup() {
    const handleBeforeUnload = () => {
      console.log('🧹 Page unloading - performing cleanup');
      this.cleanupAll();
    };

    this.registerEventListener(window, 'beforeunload', handleBeforeUnload, {
      description: 'Before unload cleanup'
    });
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    return {
      intervals: {
        active: this.intervals.size,
        paused: this.pausedIntervals.size,
        details: Array.from(this.intervals.values()).map(info => ({
          description: info.description,
          delay: info.delay,
          age: Date.now() - info.createdAt.getTime()
        }))
      },
      timeouts: {
        active: this.timeouts.size,
        details: Array.from(this.timeouts.values()).map(info => ({
          description: info.description,
          delay: info.delay,
          age: Date.now() - info.createdAt.getTime()
        }))
      },
      eventListeners: {
        active: this.eventListeners.size,
        details: Array.from(this.eventListeners.values()).map(info => ({
          description: info.description,
          age: Date.now() - info.createdAt.getTime()
        }))
      },
      components: {
        registered: this.components.size
      }
    };
  }

  /**
   * Log current memory usage
   */
  logMemoryStats() {
    const stats = this.getMemoryStats();
    console.group('🧠 Memory Manager Statistics');
    console.log('Intervals:', stats.intervals.active, '(', stats.intervals.paused, 'paused)');
    console.log('Timeouts:', stats.timeouts.active);
    console.log('Event Listeners:', stats.eventListeners.active);
    console.log('Components:', stats.components.registered);
    
    if (stats.intervals.active > 10 || stats.eventListeners.active > 50) {
      console.warn('⚠️ High memory usage detected - consider cleanup');
    }
    
    console.groupEnd();
  }

  /**
   * Clean up all registered resources
   */
  cleanupAll() {
    console.group('🧹 Memory Manager - Cleaning up all resources');
    
    // Clear all intervals
    this.intervals.forEach((info, id) => {
      clearInterval(id);
      console.log(`❌ Cleared interval: ${info.description}`);
    });
    this.intervals.clear();
    this.pausedIntervals.clear();
    
    // Clear all timeouts
    this.timeouts.forEach((info, id) => {
      clearTimeout(id);
      console.log(`❌ Cleared timeout: ${info.description}`);
    });
    this.timeouts.clear();
    
    // Remove all event listeners
    this.eventListeners.forEach((info, id) => {
      try {
        info.element.removeEventListener(info.event, info.handler, info.options);
        console.log(`❌ Removed event listener: ${info.description}`);
      } catch (error) {
        console.warn('Error removing event listener:', error);
      }
    });
    this.eventListeners.clear();
    
    // Destroy all components
    this.components.forEach(component => {
      try {
        if (typeof component.destroy === 'function') {
          component.destroy();
          console.log(`🗑️ Destroyed component: ${component.constructor.name}`);
        }
      } catch (error) {
        console.error('Error destroying component:', error);
      }
    });
    this.components.clear();
    
    console.log('✅ All resources cleaned up');
    console.groupEnd();
  }

  /**
   * Perform periodic cleanup of expired resources
   */
  performPeriodicCleanup() {
    const now = Date.now();
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
    
    // Clean up old completed timeouts
    this.timeouts.forEach((info, id) => {
      if (now - info.createdAt.getTime() > MAX_AGE) {
        this.clearTimeout(id);
        console.log(`🧹 Cleaned up expired timeout: ${info.description}`);
      }
    });
  }
}

// Create global memory manager instance
const memoryManager = new MemoryManager();

/**
 * Enhanced wrapper functions that use the memory manager
 */
export const SafeInterval = {
  /**
   * Create a managed interval
   */
  set(callback, delay, description = 'Unnamed interval') {
    return memoryManager.registerInterval(callback, delay, { description });
  },

  /**
   * Create a managed interval that runs even when page is hidden
   */
  setEssential(callback, delay, description = 'Essential interval') {
    return memoryManager.registerInterval(callback, delay, { 
      description, 
      runWhenHidden: true 
    });
  },

  /**
   * Clear a managed interval
   */
  clear(intervalId) {
    memoryManager.clearInterval(intervalId);
  }
};

export const SafeTimeout = {
  /**
   * Create a managed timeout
   */
  set(callback, delay, description = 'Unnamed timeout') {
    return memoryManager.registerTimeout(callback, delay, { description });
  },

  /**
   * Clear a managed timeout
   */
  clear(timeoutId) {
    memoryManager.clearTimeout(timeoutId);
  }
};

export const SafeEventListener = {
  /**
   * Add a managed event listener
   */
  add(element, event, handler, options = {}) {
    const description = options.description || `${event} on ${element.tagName || 'element'}`;
    return memoryManager.registerEventListener(element, event, handler, { 
      ...options, 
      description 
    });
  },

  /**
   * Remove a managed event listener
   */
  remove(listenerId) {
    memoryManager.removeEventListener(listenerId);
  }
};

/**
 * Component lifecycle management
 */
export const ComponentManager = {
  /**
   * Register component for automatic cleanup
   */
  register(component) {
    memoryManager.registerComponent(component);
  },

  /**
   * Unregister and destroy component
   */
  unregister(component) {
    memoryManager.unregisterComponent(component);
  }
};

/**
 * Memory monitoring utilities
 */
export const MemoryMonitor = {
  /**
   * Get current memory statistics
   */
  getStats() {
    return memoryManager.getMemoryStats();
  },

  /**
   * Log memory statistics to console
   */
  logStats() {
    memoryManager.logMemoryStats();
  },

  /**
   * Perform cleanup of expired resources
   */
  cleanup() {
    memoryManager.performPeriodicCleanup();
  }
};

/**
 * Global cleanup function
 */
export function cleanupAll() {
  memoryManager.cleanupAll();
}

/**
 * Initialize memory leak prevention system
 */
export function initMemoryLeakPrevention() {
  console.log('🛡️ Memory Leak Prevention System initialized');
  
  // Set up periodic memory monitoring
  const monitoringInterval = SafeInterval.set(() => {
    memoryManager.performPeriodicCleanup();
    
    // Log stats every 5 minutes in development
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('local'))) {
      memoryManager.logMemoryStats();
    }
  }, 5 * 60 * 1000, 'Memory monitoring');
  
  // Make memory manager available globally for debugging
  if (typeof window !== 'undefined') {
    window.memoryManager = memoryManager;
    window.MemoryMonitor = MemoryMonitor;
  }
  
  return memoryManager;
}

// Auto-initialize when module loads
const globalMemoryManager = initMemoryLeakPrevention();

export { globalMemoryManager as memoryManager };
export default {
  SafeInterval,
  SafeTimeout,
  SafeEventListener,
  ComponentManager,
  MemoryMonitor,
  cleanupAll,
  initMemoryLeakPrevention,
  memoryManager: globalMemoryManager
};

console.log('✅ Memory Leak Prevention utility loaded');