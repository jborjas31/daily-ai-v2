// Simple Error Handling System
import { Toast } from './Toast.js';

class SimpleErrorHandler {
  static showError(message, details = null) {
    // Non-blocking toast error
    Toast.error(`⚠️ ${message}`, { duration: 4000 });
    
    // Log technical details to console for debugging
    if (details) {
      console.error('Error details:', details);
    }
  }
  
  static showSuccess(message) {
    // Non-blocking toast success
    Toast.success(`✅ ${message}`, { duration: 2500 });
  }
  
  static handleFirebaseError(error) {
    console.error('Firebase error:', error);
    
    // Convert Firebase errors to simple messages
    const friendlyMessage = this.getFriendlyMessage(error);
    this.showError(friendlyMessage, error);
  }
  
  static getFriendlyMessage(error) {
    const errorCode = error.code || '';
    
    // Simple error message mapping
    if (errorCode.includes('network')) {
      return 'Network error. Please check your internet connection.';
    }
    
    if (errorCode.includes('permission-denied')) {
      return 'Permission denied. Please try logging in again.';
    }
    
    if (errorCode.includes('not-found')) {
      return 'Data not found. This item may have been deleted.';
    }
    
    if (errorCode.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.';
    }
    
    if (errorCode.includes('auth/user-not-found')) {
      return 'No account found with this email address.';
    }
    
    if (errorCode.includes('auth/wrong-password')) {
      return 'Incorrect password. Please try again.';
    }
    
    if (errorCode.includes('auth/email-already-in-use')) {
      return 'An account with this email already exists.';
    }
    
    // Default message for unknown errors
    return 'Something went wrong. Please try again.';
  }
  
  static async withErrorHandling(operation, loadingMessage = null) {
    try {
      // Show simple loading if message provided
      if (loadingMessage) {
        this.showLoading(loadingMessage);
      }
      
      const result = await operation();
      
      // Hide loading
      this.hideLoading();
      
      return { success: true, data: result };
    } catch (error) {
      this.hideLoading();
      this.handleFirebaseError(error);
      return { success: false, error };
    }
  }
  
  static showLoading(message) {
    // Simple loading indicator
    const existingLoader = document.getElementById('simple-loader');
    if (existingLoader) return;
    
    const loader = document.createElement('div');
    loader.id = 'simple-loader';
    loader.innerHTML = `
      <div style="
        position: fixed; 
        top: 50%; 
        left: 50%; 
        transform: translate(-50%, -50%);
        background: white; 
        padding: 20px; 
        border-radius: 8px; 
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 9999;
        text-align: center;
        font-family: Arial, sans-serif;
      ">
        <div style="margin-bottom: 10px;">⏳</div>
        <div>${message}</div>
      </div>
    `;
    
    document.body.appendChild(loader);
  }
  
  static hideLoading() {
    const loader = document.getElementById('simple-loader');
    if (loader) {
      loader.remove();
    }
  }
}

export { SimpleErrorHandler };
