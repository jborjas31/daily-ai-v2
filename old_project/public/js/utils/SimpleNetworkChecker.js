import { SafeEventListener } from './MemoryLeakPrevention.js';
import { Toast } from './Toast.js';

// Simple network connection checking
class SimpleNetworkChecker {
  static eventListeners = [];
  
  static isOnline() {
    return navigator.onLine;
  }
  
  static setupNetworkMonitoring() {
    const onlineListener = SafeEventListener.add(
      window,
      'online',
      () => {
        Toast.success('Internet connection restored');
        console.log('Back online');
      },
      { description: 'Network checker online listener' }
    );
    this.eventListeners.push(onlineListener);
    
    const offlineListener = SafeEventListener.add(
      window,
      'offline',
      () => {
        Toast.error('Internet connection lost. Changes will be saved locally.', { duration: 5000 });
        console.log('Gone offline');
      },
      { description: 'Network checker offline listener' }
    );
    this.eventListeners.push(offlineListener);
  }
  
  static cleanup() {
    this.eventListeners.forEach(listenerId => {
      SafeEventListener.remove(listenerId);
    });
    this.eventListeners = [];
  }
  
  static checkConnectionBeforeAction(action) {
    if (!this.isOnline()) {
      Toast.error('No internet connection. Please check your network and try again.', { duration: 5000 });
      return false;
    }
    
    return true;
  }
  
  static getNetworkStatus() {
    return {
      online: this.isOnline(),
      message: this.isOnline() ? 'Connected' : 'Offline'
    };
  }
  
  static showNetworkStatus() {
    const status = this.getNetworkStatus();
    console.log(`Network Status: ${status.message}`);
    return status;
  }
}

export { SimpleNetworkChecker };
