import { SafeEventListener, ComponentManager } from './MemoryLeakPrevention.js';

// Simple Tab Synchronization
class SimpleTabSync {
  constructor() {
    this.channel = new BroadcastChannel('daily-ai-sync');
    this.tabId = this.generateTabId();
    this.isActive = true;
    
    // Memory leak prevention tracking
    this.eventListeners = [];
    
    // Register with memory manager
    ComponentManager.register(this);
    
    this.setupChannelListener();
    this.setupVisibilityListener();
    
    console.log(`Tab ${this.tabId} initialized`);
  }
  
  generateTabId() {
    return 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  setupChannelListener() {
    const channelListener = SafeEventListener.add(
      this.channel,
      'message',
      (event) => {
        const { type, data, fromTab } = event.data;
        
        // Don't process messages from this same tab
        if (fromTab === this.tabId) return;
        
        console.log(`Tab ${this.tabId} received:`, type, 'from', fromTab);
        
        // Handle different message types
        switch (type) {
          case 'data-changed':
            this.handleDataChanged(data);
            break;
          case 'refresh-needed':
            this.handleRefreshNeeded();
            break;
          case 'user-action':
            this.handleUserAction(data);
            break;
        }
      },
      { description: `Tab sync channel listener for ${this.tabId}` }
    );
    this.eventListeners.push(channelListener);
  }
  
  setupVisibilityListener() {
    const visibilityListener = SafeEventListener.add(
      document,
      'visibilitychange',
      () => {
        this.isActive = !document.hidden;
        
        if (this.isActive) {
          console.log(`Tab ${this.tabId} became active - refreshing data`);
          this.requestDataRefresh();
        }
      },
      { description: `Tab sync visibility listener for ${this.tabId}` }
    );
    this.eventListeners.push(visibilityListener);
  }
  
  // Send message to other tabs
  broadcastMessage(type, data = null) {
    const message = {
      type,
      data,
      fromTab: this.tabId,
      timestamp: Date.now()
    };
    
    this.channel.postMessage(message);
    console.log(`Tab ${this.tabId} sent:`, type, data);
  }
  
  // Handle when data changes in another tab
  handleDataChanged(data) {
    if (!this.isActive) return; // Only refresh active tabs
    
    const { dataType } = data;
    
    switch (dataType) {
      case 'tasks':
        this.refreshTasks();
        break;
      case 'settings':
        this.refreshSettings();
        break;
      case 'schedule':
        this.refreshSchedule();
        break;
      default:
        this.refreshAllData();
    }
  }
  
  handleRefreshNeeded() {
    if (this.isActive) {
      this.refreshAllData();
    }
  }
  
  handleUserAction(data) {
    const { action, details } = data;
    
    // Show simple notification about actions in other tabs
    if (action === 'task-created') {
      this.showTabNotification('Task created in another tab');
    } else if (action === 'task-completed') {
      this.showTabNotification('Task completed in another tab');
    }
  }
  
  // Refresh functions
  async refreshTasks() {
    try {
      if (window.taskManager) {
        await window.taskManager.loadTasks();
        console.log('Tasks refreshed from another tab');
      }
    } catch (error) {
      console.error('Error refreshing tasks:', error);
    }
  }
  
  async refreshSettings() {
    try {
      if (window.settingsManager) {
        await window.settingsManager.loadSettings();
        console.log('Settings refreshed from another tab');
      }
    } catch (error) {
      console.error('Error refreshing settings:', error);
    }
  }
  
  async refreshSchedule() {
    try {
      if (window.scheduleManager) {
        await window.scheduleManager.loadSchedule();
        console.log('Schedule refreshed from another tab');
      }
    } catch (error) {
      console.error('Error refreshing schedule:', error);
    }
  }
  
  async refreshAllData() {
    console.log('Refreshing all data from tab sync');
    await this.refreshTasks();
    await this.refreshSettings();
    await this.refreshSchedule();
  }
  
  requestDataRefresh() {
    // Ask other tabs if there have been any changes
    this.broadcastMessage('refresh-check');
  }
  
  showTabNotification(message) {
    // Simple notification using console for now (could be enhanced with actual notification UI)
    console.log('📢 Tab notification:', message);
  }
  
  // Methods to call when data changes in this tab
  notifyTaskChanged() {
    this.broadcastMessage('data-changed', { dataType: 'tasks' });
  }
  
  notifySettingsChanged() {
    this.broadcastMessage('data-changed', { dataType: 'settings' });
  }
  
  notifyScheduleChanged() {
    this.broadcastMessage('data-changed', { dataType: 'schedule' });
  }
  
  notifyUserAction(action, details = null) {
    this.broadcastMessage('user-action', { action, details });
  }
  
  // Cleanup when tab closes
  cleanup() {
    // Clear all tracked event listeners
    this.eventListeners.forEach(listenerId => {
      SafeEventListener.remove(listenerId);
    });
    this.eventListeners = [];
    
    if (this.channel) {
      this.channel.close();
    }
  }
  
  // Destroy method for ComponentManager compatibility
  destroy() {
    this.cleanup();
    
    // Unregister from memory manager
    ComponentManager.unregister(this);
    
    console.log(`Tab ${this.tabId} destroyed`);
  }
}

// Auto-cleanup handled by MemoryLeakPrevention system
// ComponentManager will automatically clean up all registered components

export { SimpleTabSync };