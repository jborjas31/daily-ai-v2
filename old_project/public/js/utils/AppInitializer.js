// Simple app initialization with browser check
import { ModernBrowserChecker } from './ModernBrowserChecker.js';

class AppInitializer {
  static async initialize() {
    try {
      console.log('🚀 Starting Daily AI initialization...');
      
      // Check browser support first
      const browserInfo = ModernBrowserChecker.logBrowserInfo();
      const { support, browserVersion } = browserInfo;
      
      if (!support.supported || !browserVersion.supported) {
        console.error('❌ Browser not supported:', browserInfo);
        ModernBrowserChecker.showUnsupportedMessage();
        return false;
      }
      
      console.log('✅ Browser compatibility check passed');
      
      // Show loading screen if not already shown
      this.showLoadingScreen();
      
      // Initialize the main app
      await this.initializeMainApp();
      
      console.log('✅ App initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ App initialization failed:', error);
      this.showErrorScreen(error);
      return false;
    }
  }
  
  static showLoadingScreen() {
    // Only show loading screen if app container exists and is empty
    const appContainer = document.getElementById('app') || document.body;
    
    if (!appContainer.querySelector('.loading-screen')) {
      const loadingHTML = `
        <div class="loading-screen" style="
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          background: #f8f9fa;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
        ">
          <div style="text-align: center;">
            <div style="
              width: 50px;
              height: 50px;
              border: 3px solid #e0e0e0;
              border-top: 3px solid #007bff;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto 20px;
            "></div>
            <p style="color: #666; margin: 0;">Loading Daily AI...</p>
          </div>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      
      appContainer.insertAdjacentHTML('afterbegin', loadingHTML);
    }
  }
  
  static hideLoadingScreen() {
    const loadingScreen = document.querySelector('.loading-screen');
    if (loadingScreen) {
      loadingScreen.remove();
    }
  }
  
  static async initializeMainApp() {
    try {
      // Import and initialize the main app
      const { initApp } = await import('../app.js');
      await initApp();
      
      // Hide loading screen after successful initialization
      this.hideLoadingScreen();
      
    } catch (error) {
      console.error('❌ Main app initialization failed:', error);
      this.hideLoadingScreen();
      throw error;
    }
  }
  
  static showErrorScreen(error) {
    // Clear the body and show error screen
    document.body.innerHTML = `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        background: #f8f9fa;
        padding: 20px;
        margin: 0;
      ">
        <div style="
          background: white;
          border-radius: 8px;
          padding: 40px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 500px;
        ">
          <h1 style="color: #dc3545; margin-bottom: 16px;">⚠️ Loading Error</h1>
          <p style="margin-bottom: 24px; color: #666; line-height: 1.5;">
            Daily AI failed to load properly. Please refresh the page and try again.
          </p>
          <button 
            onclick="window.location.reload()" 
            style="
              background: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              padding: 12px 24px;
              cursor: pointer;
              font-size: 16px;
              margin-bottom: 20px;
            "
          >
            Refresh Page
          </button>
          <details style="text-align: left; margin-top: 20px;">
            <summary style="cursor: pointer; color: #666; margin-bottom: 10px;">Show Technical Details</summary>
            <pre style="
              background: #f8f9fa;
              padding: 10px;
              border-radius: 4px;
              overflow: auto;
              font-size: 12px;
              color: #666;
              white-space: pre-wrap;
            ">${error.stack || error.message || 'Unknown error occurred'}</pre>
          </details>
        </div>
      </div>
    `;
  }
}

export { AppInitializer };