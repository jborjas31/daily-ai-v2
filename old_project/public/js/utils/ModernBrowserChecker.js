// Simple modern browser feature detection
class ModernBrowserChecker {
  static checkSupport() {
    const results = {
      supported: true,
      missing: []
    };
    
    // Check critical features
    const criticalFeatures = {
      'ES6 Modules': () => {
        try {
          new Function('import("")');
          return true;
        } catch (e) {
          return false;
        }
      },
      
      'Service Worker': () => 'serviceWorker' in navigator,
      
      'IndexedDB': () => 'indexedDB' in window,
      
      'BroadcastChannel': () => 'BroadcastChannel' in window,
      
      'Fetch API': () => 'fetch' in window,
      
      'Local Storage': () => {
        try {
          localStorage.setItem('test', 'test');
          localStorage.removeItem('test');
          return true;
        } catch (e) {
          return false;
        }
      },
      
      'CSS Custom Properties': () => {
        return CSS.supports && CSS.supports('color', 'var(--test)');
      },
      
      'CSS Grid': () => {
        return CSS.supports && CSS.supports('display', 'grid');
      }
    };
    
    // Test each feature
    Object.entries(criticalFeatures).forEach(([name, test]) => {
      if (!test()) {
        results.supported = false;
        results.missing.push(name);
      }
    });
    
    return results;
  }
  
  static checkBrowserVersion() {
    const ua = navigator.userAgent;
    const browser = this.detectBrowser(ua);
    
    const minimumVersions = {
      chrome: 100,
      firefox: 100,
      safari: 15.4,
      edge: 100
    };
    
    if (browser.name && minimumVersions[browser.name]) {
      const minVersion = minimumVersions[browser.name];
      const currentVersion = parseFloat(browser.version);
      
      return {
        browser: browser.name,
        version: currentVersion,
        minimum: minVersion,
        supported: currentVersion >= minVersion
      };
    }
    
    return { supported: true }; // Unknown browser, assume OK
  }
  
  static detectBrowser(ua) {
    let browser = { name: 'unknown', version: '0' };
    
    if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
      const match = ua.match(/Chrome\/(\d+)/);
      browser = { name: 'chrome', version: match ? match[1] : '0' };
    } else if (ua.includes('Firefox/')) {
      const match = ua.match(/Firefox\/(\d+)/);
      browser = { name: 'firefox', version: match ? match[1] : '0' };
    } else if (ua.includes('Safari/') && ua.includes('Version/')) {
      const match = ua.match(/Version\/(\d+\.?\d*)/);
      browser = { name: 'safari', version: match ? match[1] : '0' };
    } else if (ua.includes('Edg/')) {
      const match = ua.match(/Edg\/(\d+)/);
      browser = { name: 'edge', version: match ? match[1] : '0' };
    }
    
    return browser;
  }
  
  static showUnsupportedMessage() {
    document.body.innerHTML = `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        background: #f8f9fa;
        margin: 0;
        padding: 20px;
      ">
        <div style="
          background: white;
          border-radius: 8px;
          padding: 40px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 500px;
        ">
          <h1 style="color: #dc3545; margin-bottom: 16px;">Browser Not Supported</h1>
          <p style="margin-bottom: 24px; color: #666; line-height: 1.5;">
            Daily AI requires a modern browser to run properly. 
            Please update your browser or use one of the supported browsers below.
          </p>
          
          <div style="margin-bottom: 24px;">
            <h3 style="margin-bottom: 12px; color: #333;">Supported Browsers:</h3>
            <ul style="text-align: left; display: inline-block; color: #666;">
              <li>Chrome 100+ (Recommended)</li>
              <li>Firefox 100+</li>
              <li>Safari 15.4+</li>
              <li>Edge 100+</li>
            </ul>
          </div>
          
          <p style="color: #888; font-size: 14px;">
            All browsers should be updated to versions from March 2022 or newer.
          </p>
        </div>
      </div>
    `;
  }
  
  static logBrowserInfo() {
    const support = this.checkSupport();
    const browserVersion = this.checkBrowserVersion();
    
    console.log('🌐 Browser Compatibility Check:');
    console.log('  Features supported:', support.supported);
    if (support.missing.length > 0) {
      console.log('  Missing features:', support.missing);
    }
    console.log('  Browser:', browserVersion.browser || 'unknown');
    console.log('  Version:', browserVersion.version || 'unknown');
    console.log('  Version supported:', browserVersion.supported);
    
    return { support, browserVersion };
  }
}

export { ModernBrowserChecker };