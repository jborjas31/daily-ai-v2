/**
 * Offline Detection and UI Feedback System
 * 
 * Comprehensive offline state management with visual feedback, 
 * sync status indicators, and smooth online/offline transitions
 */

import { offlineQueue } from './OfflineQueue.js';
import { conflictResolution } from './ConflictResolution.js';
import { SimpleErrorHandler } from './SimpleErrorHandler.js';

/**
 * Connection states
 */
export const CONNECTION_STATES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  RECONNECTING: 'reconnecting',
  SYNCING: 'syncing',
  SYNC_ERROR: 'sync_error'
};

/**
 * Sync states
 */
export const SYNC_STATES = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  CONFLICT: 'conflict',
  ERROR: 'error',
  COMPLETED: 'completed'
};

/**
 * Offline Detection and UI Feedback Manager
 */
export class OfflineDetection {
  constructor() {
    this.currentState = CONNECTION_STATES.ONLINE;
    this.syncState = SYNC_STATES.IDLE;
    this.listeners = new Set();
    this.uiElements = new Map();
    this.statusBar = null;
    this.syncIndicator = null;
    this.offlineIndicator = null;
    this.queueStatus = null;
    this.isInitialized = false;
    
    // Sync monitoring
    this.queueSize = 0;
    this.syncProgress = 0;
    this.lastSyncTime = null;
    this.syncInterval = null;
    
    // UI update throttling
    this.uiUpdateTimeout = null;
    this.updateThrottleMs = 250;
  }

  /**
   * Initialize offline detection and UI feedback
   */
  async init() {
    try {
      await this.setupNetworkDetection();
      await this.createUIElements();
      this.startSyncMonitoring();
      
      this.isInitialized = true;
      this.updateConnectionState(navigator.onLine ? CONNECTION_STATES.ONLINE : CONNECTION_STATES.OFFLINE);
      
      console.log('✅ OfflineDetection: System initialized');
    } catch (error) {
      console.error('❌ OfflineDetection: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Setup network detection listeners
   */
  async setupNetworkDetection() {
    // Standard online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Enhanced connection monitoring
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', () => this.handleConnectionChange());
    }
    
    // Periodic connectivity check
    this.startConnectivityCheck();
  }

  /**
   * Handle online event
   */
  async handleOnline() {
    console.log('🌐 OfflineDetection: Network connection restored');
    
    this.updateConnectionState(CONNECTION_STATES.RECONNECTING);
    
    try {
      // Verify actual connectivity
      const isReallyOnline = await this.verifyConnectivity();
      
      if (isReallyOnline) {
        this.updateConnectionState(CONNECTION_STATES.ONLINE);
        await this.triggerSync();
      } else {
        this.updateConnectionState(CONNECTION_STATES.OFFLINE);
      }
    } catch (error) {
      console.error('❌ OfflineDetection: Error handling online event:', error);
      this.updateConnectionState(CONNECTION_STATES.SYNC_ERROR);
    }
  }

  /**
   * Handle offline event
   */
  handleOffline() {
    console.log('📴 OfflineDetection: Network connection lost');
    this.updateConnectionState(CONNECTION_STATES.OFFLINE);
    this.showOfflineNotification();
  }

  /**
   * Handle connection change (for enhanced API)
   */
  handleConnectionChange() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      console.log(`📶 OfflineDetection: Connection change - ${connection.effectiveType}, downlink: ${connection.downlink}`);
      
      // Update UI based on connection quality
      this.updateConnectionQuality(connection);
    }
  }

  /**
   * Start periodic connectivity check
   */
  startConnectivityCheck() {
    // Check connectivity every 30 seconds when offline
    setInterval(() => {
      if (!navigator.onLine || this.currentState === CONNECTION_STATES.OFFLINE) {
        this.verifyConnectivity().then(isOnline => {
          if (isOnline && this.currentState === CONNECTION_STATES.OFFLINE) {
            this.handleOnline();
          }
        }).catch(() => {
          // Ignore connectivity check errors
        });
      }
    }, 30000);
  }

  /**
   * Verify actual connectivity (not just network interface)
   */
  async verifyConnectivity(timeout = 5000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // Try to fetch a small resource from the server
      const response = await fetch('/api/ping', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      // If fetch fails, try with a more basic check
      try {
        const response = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache'
        });
        return true;
      } catch (fallbackError) {
        return false;
      }
    }
  }

  /**
   * Trigger sync when coming back online
   */
  async triggerSync() {
    try {
      this.updateSyncState(SYNC_STATES.SYNCING);
      
      // Process offline queue
      await offlineQueue.forceProcess();
      
      // Check for conflicts
      const conflicts = await conflictResolution.getPendingConflicts();
      if (conflicts.length > 0) {
        this.updateSyncState(SYNC_STATES.CONFLICT);
        this.showConflictNotification(conflicts.length);
      } else {
        this.updateSyncState(SYNC_STATES.COMPLETED);
        this.lastSyncTime = new Date();
        this.showSyncSuccessNotification();
      }
      
    } catch (error) {
      console.error('❌ OfflineDetection: Sync failed:', error);
      this.updateSyncState(SYNC_STATES.ERROR);
      this.showSyncErrorNotification(error);
    }
  }

  /**
   * Update connection state and notify listeners
   */
  updateConnectionState(newState) {
    if (this.currentState !== newState) {
      const previousState = this.currentState;
      this.currentState = newState;
      
      console.log(`🔄 OfflineDetection: State changed from ${previousState} to ${newState}`);
      
      // Notify listeners
      this.notifyListeners('connection', { state: newState, previousState });
      
      // Update UI
      this.scheduleUIUpdate();
    }
  }

  /**
   * Update sync state
   */
  updateSyncState(newState, metadata = {}) {
    if (this.syncState !== newState) {
      const previousState = this.syncState;
      this.syncState = newState;
      
      // Notify listeners
      this.notifyListeners('sync', { state: newState, previousState, ...metadata });
      
      // Update UI
      this.scheduleUIUpdate();
    }
  }

  /**
   * Update connection quality information
   */
  updateConnectionQuality(connection) {
    const quality = this.categorizeConnectionQuality(connection);
    this.notifyListeners('connectionQuality', { connection, quality });
    this.scheduleUIUpdate();
  }

  /**
   * Categorize connection quality
   */
  categorizeConnectionQuality(connection) {
    if (!connection) return 'unknown';
    
    const { effectiveType, downlink } = connection;
    
    if (effectiveType === '4g' && downlink > 10) return 'excellent';
    if (effectiveType === '4g' || downlink > 1.5) return 'good';
    if (effectiveType === '3g' || downlink > 0.5) return 'fair';
    return 'poor';
  }

  /**
   * Start sync monitoring
   */
  startSyncMonitoring() {
    // Monitor queue status every few seconds
    this.syncInterval = setInterval(async () => {
      try {
        const queueStatus = await offlineQueue.getQueueStatus();
        
        if (queueStatus.total !== this.queueSize) {
          this.queueSize = queueStatus.total;
          this.notifyListeners('queueUpdate', queueStatus);
          this.scheduleUIUpdate();
        }
        
        // Update sync progress
        if (queueStatus.total > 0) {
          this.syncProgress = (queueStatus.completed / queueStatus.total) * 100;
        } else {
          this.syncProgress = 0;
        }
        
      } catch (error) {
        console.warn('⚠️ OfflineDetection: Queue monitoring error:', error);
      }
    }, 2000);
  }

  /**
   * Create UI elements for offline feedback
   */
  async createUIElements() {
    // Create status bar
    this.statusBar = this.createStatusBar();
    document.body.appendChild(this.statusBar);
    
    // Create sync indicator
    this.syncIndicator = this.createSyncIndicator();
    document.body.appendChild(this.syncIndicator);
    
    // Store UI elements for easy access
    this.uiElements.set('statusBar', this.statusBar);
    this.uiElements.set('syncIndicator', this.syncIndicator);
  }

  /**
   * Create offline status bar
   */
  createStatusBar() {
    const statusBar = document.createElement('div');
    statusBar.className = 'offline-status-bar';
    statusBar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      background: #ff4444;
      color: white;
      padding: 8px 16px;
      text-align: center;
      font-size: 14px;
      font-weight: 500;
      display: none;
      transition: all 0.3s ease;
    `;
    
    statusBar.innerHTML = `
      <span class="status-text">You're offline. Changes will sync when connection is restored.</span>
      <button class="retry-btn" style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        padding: 4px 12px;
        border-radius: 4px;
        margin-left: 16px;
        cursor: pointer;
      ">Retry</button>
    `;
    
    // Add retry button handler
    statusBar.querySelector('.retry-btn').addEventListener('click', () => {
      this.handleOnline();
    });
    
    return statusBar;
  }

  /**
   * Create sync indicator
   */
  createSyncIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'sync-indicator';
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      background: #4CAF50;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      display: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.3s ease;
      cursor: pointer;
    `;
    
    indicator.innerHTML = `
      <div class="sync-content">
        <span class="sync-icon">✅</span>
        <span class="sync-text">All synced</span>
        <div class="sync-progress" style="
          width: 100%;
          height: 3px;
          background: rgba(255,255,255,0.3);
          border-radius: 2px;
          margin-top: 4px;
          display: none;
        ">
          <div class="sync-progress-bar" style="
            height: 100%;
            background: white;
            border-radius: 2px;
            width: 0%;
            transition: width 0.3s ease;
          "></div>
        </div>
      </div>
    `;
    
    // Add click handler to show queue details
    indicator.addEventListener('click', () => {
      this.showSyncDetails();
    });
    
    return indicator;
  }

  /**
   * Schedule UI update (throttled)
   */
  scheduleUIUpdate() {
    if (this.uiUpdateTimeout) {
      clearTimeout(this.uiUpdateTimeout);
    }
    
    this.uiUpdateTimeout = setTimeout(() => {
      this.updateUI();
    }, this.updateThrottleMs);
  }

  /**
   * Update all UI elements
   */
  updateUI() {
    this.updateStatusBar();
    this.updateSyncIndicator();
  }

  /**
   * Update status bar
   */
  updateStatusBar() {
    if (!this.statusBar) return;
    
    const statusText = this.statusBar.querySelector('.status-text');
    const retryBtn = this.statusBar.querySelector('.retry-btn');
    
    switch (this.currentState) {
      case CONNECTION_STATES.OFFLINE:
        this.statusBar.style.display = 'block';
        this.statusBar.style.background = '#ff4444';
        statusText.textContent = `You're offline. ${this.queueSize > 0 ? `${this.queueSize} changes waiting to sync.` : 'Changes will sync when connection is restored.'}`;
        retryBtn.style.display = 'inline-block';
        break;
        
      case CONNECTION_STATES.RECONNECTING:
        this.statusBar.style.display = 'block';
        this.statusBar.style.background = '#ff9800';
        statusText.textContent = 'Reconnecting...';
        retryBtn.style.display = 'none';
        break;
        
      case CONNECTION_STATES.SYNCING:
        this.statusBar.style.display = 'block';
        this.statusBar.style.background = '#2196f3';
        statusText.textContent = `Syncing ${this.queueSize} changes...`;
        retryBtn.style.display = 'none';
        break;
        
      case CONNECTION_STATES.SYNC_ERROR:
        this.statusBar.style.display = 'block';
        this.statusBar.style.background = '#ff5722';
        statusText.textContent = 'Sync error occurred. Click retry to try again.';
        retryBtn.style.display = 'inline-block';
        break;
        
      case CONNECTION_STATES.ONLINE:
      default:
        this.statusBar.style.display = 'none';
        break;
    }
  }

  /**
   * Update sync indicator
   */
  updateSyncIndicator() {
    if (!this.syncIndicator) return;
    
    const icon = this.syncIndicator.querySelector('.sync-icon');
    const text = this.syncIndicator.querySelector('.sync-text');
    const progress = this.syncIndicator.querySelector('.sync-progress');
    const progressBar = this.syncIndicator.querySelector('.sync-progress-bar');
    
    switch (this.syncState) {
      case SYNC_STATES.SYNCING:
        this.syncIndicator.style.display = 'block';
        this.syncIndicator.style.background = '#2196f3';
        icon.textContent = '🔄';
        text.textContent = `Syncing (${Math.round(this.syncProgress)}%)`;
        progress.style.display = 'block';
        progressBar.style.width = `${this.syncProgress}%`;
        break;
        
      case SYNC_STATES.CONFLICT:
        this.syncIndicator.style.display = 'block';
        this.syncIndicator.style.background = '#ff9800';
        icon.textContent = '⚠️';
        text.textContent = 'Conflicts need resolution';
        progress.style.display = 'none';
        break;
        
      case SYNC_STATES.ERROR:
        this.syncIndicator.style.display = 'block';
        this.syncIndicator.style.background = '#ff5722';
        icon.textContent = '❌';
        text.textContent = 'Sync error';
        progress.style.display = 'none';
        break;
        
      case SYNC_STATES.COMPLETED:
        this.syncIndicator.style.display = 'block';
        this.syncIndicator.style.background = '#4CAF50';
        icon.textContent = '✅';
        text.textContent = 'All synced';
        progress.style.display = 'none';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
          if (this.syncState === SYNC_STATES.COMPLETED) {
            this.syncIndicator.style.display = 'none';
          }
        }, 3000);
        break;
        
      case SYNC_STATES.IDLE:
      default:
        if (this.queueSize > 0) {
          this.syncIndicator.style.display = 'block';
          this.syncIndicator.style.background = '#607d8b';
          icon.textContent = '⏸️';
          text.textContent = `${this.queueSize} changes pending`;
          progress.style.display = 'none';
        } else {
          this.syncIndicator.style.display = 'none';
        }
        break;
    }
  }

  /**
   * Show offline notification
   */
  showOfflineNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Daily AI - Offline', {
        body: 'You\'re now offline. Changes will be saved and synced when you\'re back online.',
        icon: '/favicon.ico',
        tag: 'offline-status'
      });
    }
  }

  /**
   * Show sync success notification
   */
  showSyncSuccessNotification() {
    SimpleErrorHandler.showSuccess('All changes synced successfully!');
  }

  /**
   * Show sync error notification
   */
  showSyncErrorNotification(error) {
    SimpleErrorHandler.showError(`Sync failed: ${error.message}`, error);
  }

  /**
   * Show conflict notification
   */
  showConflictNotification(conflictCount) {
    SimpleErrorHandler.showWarning(`${conflictCount} conflicts need resolution. Click the sync indicator for details.`);
  }

  /**
   * Show sync details modal
   */
  async showSyncDetails() {
    try {
      const queueStatus = await offlineQueue.getQueueStatus();
      const conflicts = await conflictResolution.getPendingConflicts();
      
      // This would typically open a modal with detailed sync information
      console.log('Sync Details:', { queueStatus, conflicts });
      
      // For now, show a simple alert
      const message = [
        `Queue: ${queueStatus.total} operations`,
        `- Pending: ${queueStatus.pending}`,
        `- Processing: ${queueStatus.processing}`,
        `- Failed: ${queueStatus.failed}`,
        `- Completed: ${queueStatus.completed}`,
        ``,
        `Conflicts: ${conflicts.length} pending`
      ].join('\n');
      
      import('./Toast.js').then(({ Toast }) => Toast.info('Sync Status: ' + message, { duration: 5000 })).catch(() => {});
    } catch (error) {
      console.error('❌ OfflineDetection: Failed to show sync details:', error);
    }
  }

  /**
   * Add event listener
   */
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(type, callback) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).delete(callback);
    }
  }

  /**
   * Notify listeners
   */
  notifyListeners(type, data) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ OfflineDetection: Listener error for ${type}:`, error);
        }
      });
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      connectionState: this.currentState,
      syncState: this.syncState,
      queueSize: this.queueSize,
      syncProgress: this.syncProgress,
      lastSyncTime: this.lastSyncTime,
      isOnline: navigator.onLine
    };
  }

  /**
   * Request notification permissions
   */
  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log(`📱 OfflineDetection: Notification permission: ${permission}`);
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }

  /**
   * Destroy offline detection system
   */
  destroy() {
    // Clear intervals
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.uiUpdateTimeout) {
      clearTimeout(this.uiUpdateTimeout);
      this.uiUpdateTimeout = null;
    }
    
    // Remove UI elements
    this.uiElements.forEach(element => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    // Clear listeners
    this.listeners.clear();
    
    this.isInitialized = false;
  }
}

// Create and export singleton instance
export const offlineDetection = new OfflineDetection();

console.log('✅ OfflineDetection system initialized');
