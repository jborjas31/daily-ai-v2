/**
 * Performance Test Demonstration
 * 
 * Demonstration script showing how the performance monitoring and testing systems work
 * This can be run in the browser console to test timeline performance
 */

// Import statements would normally be at the top, but for demo purposes
// we'll assume the modules are already loaded

/**
 * Demo function to test rapid date navigation performance
 */
export async function demoRapidNavigationTest() {
  console.log('🚀 Demo: Rapid Date Navigation Performance Test');
  
  // Simulate finding a timeline instance
  const mockTimeline = createMockTimeline();
  
  // Test rapid navigation
  const navigationCount = 20; // Smaller count for demo
  const navigationTimes = [];
  
  console.log(`⚡ Testing ${navigationCount} rapid navigations...`);
  
  for (let i = 0; i < navigationCount; i++) {
    const start = performance.now();
    
    // Simulate navigation (in real app, this would call actual timeline methods)
    await simulateNavigation(i % 2 === 0 ? 1 : -1);
    
    const navTime = performance.now() - start;
    navigationTimes.push(navTime);
    
    // Small delay to prevent blocking
    if (i % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  // Analyze results
  const results = {
    navigationCount,
    averageTime: navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length,
    minTime: Math.min(...navigationTimes),
    maxTime: Math.max(...navigationTimes),
    slowNavigations: navigationTimes.filter(time => time > 50).length
  };
  
  console.log('✅ Rapid navigation test results:');
  console.table({
    'Total Navigations': results.navigationCount,
    'Average Time': `${results.averageTime.toFixed(2)}ms`,
    'Fastest': `${results.minTime.toFixed(2)}ms`,
    'Slowest': `${results.maxTime.toFixed(2)}ms`,
    'Slow Navigations (>50ms)': results.slowNavigations
  });
  
  // Performance assessment
  if (results.averageTime < 20) {
    console.log('🎯 Excellent: Navigation performance is very fast');
  } else if (results.averageTime < 50) {
    console.log('✅ Good: Navigation performance is acceptable');
  } else {
    console.warn('⚠️ Warning: Navigation performance may need optimization');
  }
  
  return results;
}

/**
 * Demo function to test memory usage monitoring
 */
export async function demoMemoryMonitoring() {
  console.log('🧠 Demo: Memory Usage Monitoring');
  
  if (!performance.memory) {
    console.warn('⚠️ Memory monitoring not available in this browser');
    return { error: 'Memory API not available' };
  }
  
  const initialMemory = performance.memory.usedJSHeapSize;
  const snapshots = [];
  
  console.log(`📊 Initial memory usage: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
  
  // Simulate memory usage over time
  for (let i = 0; i < 10; i++) {
    // Simulate some memory-intensive operations
    const testData = new Array(10000).fill(0).map(() => ({
      id: Math.random(),
      data: new Array(100).fill('test-data-' + Math.random())
    }));
    
    const currentMemory = performance.memory.usedJSHeapSize;
    snapshots.push({
      iteration: i,
      memory: currentMemory,
      memoryMB: (currentMemory / 1024 / 1024).toFixed(2),
      delta: currentMemory - initialMemory,
      deltaMB: ((currentMemory - initialMemory) / 1024 / 1024).toFixed(2)
    });
    
    // Clean up test data (to prevent actual memory leaks in demo)
    testData.length = 0;
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const finalMemory = performance.memory.usedJSHeapSize;
  const totalGrowth = finalMemory - initialMemory;
  
  console.log('📈 Memory usage over time:');
  console.table(snapshots);
  
  console.log(`📊 Final memory usage: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
  console.log(`📊 Total memory growth: ${(totalGrowth / 1024 / 1024).toFixed(2)}MB`);
  
  if (totalGrowth < 5 * 1024 * 1024) { // 5MB
    console.log('✅ Good: Memory usage is stable');
  } else if (totalGrowth < 20 * 1024 * 1024) { // 20MB
    console.log('⚠️ Warning: Moderate memory growth detected');
  } else {
    console.warn('🚨 Alert: High memory growth - potential leak');
  }
  
  return {
    initialMemory,
    finalMemory,
    totalGrowth,
    totalGrowthMB: (totalGrowth / 1024 / 1024).toFixed(2),
    snapshots: snapshots.length
  };
}

/**
 * Demo function to test performance metrics collection
 */
export function demoPerformanceMetrics() {
  console.log('📊 Demo: Performance Metrics Collection');
  
  // Simulate performance metrics
  const metrics = {
    renders: {
      count: 45,
      averageTime: 23.7,
      maxTime: 67.2,
      minTime: 8.1
    },
    dataLoading: {
      count: 15,
      averageTime: 12.3,
      maxTime: 28.9,
      minTime: 5.2
    },
    eventHandling: {
      count: 238,
      averageTime: 2.1,
      maxTime: 15.7,
      minTime: 0.3
    },
    memory: {
      currentMB: 45.2,
      peakMB: 52.8,
      averageMB: 47.1
    }
  };
  
  console.log('📈 Performance Metrics Summary:');
  console.table(metrics);
  
  // Performance budget checks
  const budgets = {
    renderTime: 50, // ms
    dataLoadTime: 30, // ms
    eventHandleTime: 10 // ms
  };
  
  const budgetResults = {
    'Render Budget': metrics.renders.averageTime <= budgets.renderTime ? '✅ PASS' : '❌ FAIL',
    'Data Load Budget': metrics.dataLoading.averageTime <= budgets.dataLoadTime ? '✅ PASS' : '❌ FAIL',
    'Event Handle Budget': metrics.eventHandling.averageTime <= budgets.eventHandleTime ? '✅ PASS' : '❌ FAIL'
  };
  
  console.log('🎯 Performance Budget Results:');
  console.table(budgetResults);
  
  // Overall health score
  let healthScore = 100;
  if (metrics.renders.averageTime > budgets.renderTime) healthScore -= 20;
  if (metrics.dataLoading.averageTime > budgets.dataLoadTime) healthScore -= 15;
  if (metrics.eventHandling.averageTime > budgets.eventHandleTime) healthScore -= 10;
  if (metrics.memory.currentMB > 100) healthScore -= 15;
  
  console.log(`🏆 Overall Health Score: ${healthScore}/100`);
  
  return {
    metrics,
    budgetResults,
    healthScore
  };
}

/**
 * Demo function to test cross-browser compatibility
 */
export function demoCrossBrowserCompatibility() {
  console.log('🌐 Demo: Cross-Browser Compatibility Test');
  
  const features = {
    'Performance API': typeof performance !== 'undefined',
    'Performance Memory': !!performance.memory,
    'Performance Observer': typeof PerformanceObserver !== 'undefined',
    'Local Storage': typeof localStorage !== 'undefined',
    'Session Storage': typeof sessionStorage !== 'undefined',
    'Request Animation Frame': typeof requestAnimationFrame !== 'undefined',
    'Touch Events': 'ontouchstart' in window,
    'ES6 Classes': (() => { try { eval('class Test {}'); return true; } catch(e) { return false; } })(),
    'Async/Await': (() => { try { eval('async function test() {}'); return true; } catch(e) { return false; } })(),
    'CSS Grid': window.CSS && CSS.supports('display', 'grid'),
    'CSS Flexbox': window.CSS && CSS.supports('display', 'flex')
  };
  
  const browserInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown'
  };
  
  console.log('🖥️ Browser Information:');
  console.table(browserInfo);
  
  console.log('✨ Feature Support:');
  console.table(features);
  
  const supportedFeatures = Object.values(features).filter(Boolean).length;
  const totalFeatures = Object.keys(features).length;
  const compatibilityScore = (supportedFeatures / totalFeatures * 100).toFixed(1);
  
  console.log(`📊 Compatibility Score: ${compatibilityScore}% (${supportedFeatures}/${totalFeatures})`);
  
  let recommendation;
  if (compatibilityScore >= 90) {
    recommendation = '🎯 Excellent - Full feature support';
  } else if (compatibilityScore >= 80) {
    recommendation = '✅ Good - Most features supported';
  } else if (compatibilityScore >= 70) {
    recommendation = '⚠️ Fair - Some limitations expected';
  } else {
    recommendation = '❌ Poor - Significant limitations';
  }
  
  console.log(`💡 Recommendation: ${recommendation}`);
  
  return {
    browserInfo,
    features,
    compatibilityScore: parseFloat(compatibilityScore),
    supportedFeatures,
    totalFeatures,
    recommendation
  };
}

/**
 * Run all demo tests
 */
export async function runAllDemos() {
  console.log('🚀 Running All Performance Demo Tests');
  console.log('=====================================');
  
  const results = {};
  
  try {
    results.rapidNavigation = await demoRapidNavigationTest();
    console.log('');
    
    results.memoryMonitoring = await demoMemoryMonitoring();
    console.log('');
    
    results.performanceMetrics = demoPerformanceMetrics();
    console.log('');
    
    results.crossBrowser = demoCrossBrowserCompatibility();
    console.log('');
    
    console.log('✅ All demo tests completed successfully!');
    console.log('📊 Use the individual demo functions to test specific areas:');
    console.log('  - demoRapidNavigationTest()');
    console.log('  - demoMemoryMonitoring()');
    console.log('  - demoPerformanceMetrics()');
    console.log('  - demoCrossBrowserCompatibility()');
    
    return results;
    
  } catch (error) {
    console.error('❌ Demo test failed:', error);
    return { error: error.message, partialResults: results };
  }
}

/**
 * Helper functions for demo
 */

function createMockTimeline() {
  return {
    currentDate: '2025-01-15',
    navigateDate: (days) => {
      // Mock navigation
      const currentDate = new Date(this.currentDate);
      currentDate.setDate(currentDate.getDate() + days);
      this.currentDate = currentDate.toISOString().split('T')[0];
    },
    refresh: () => {
      // Mock refresh
    }
  };
}

async function simulateNavigation(direction) {
  // Simulate DOM manipulation and rendering time
  const complexity = Math.random() * 20 + 5; // 5-25ms
  await new Promise(resolve => setTimeout(resolve, complexity));
}

// Make demo functions available globally for easy console access
if (typeof window !== 'undefined') {
  window.demoRapidNavigationTest = demoRapidNavigationTest;
  window.demoMemoryMonitoring = demoMemoryMonitoring;
  window.demoPerformanceMetrics = demoPerformanceMetrics;
  window.demoCrossBrowserCompatibility = demoCrossBrowserCompatibility;
  window.runAllDemos = runAllDemos;
  
  console.log('🎮 Performance Demo functions loaded!');
  console.log('💡 Try running: runAllDemos()');
}

console.log('📝 Performance Test Demonstration loaded');