/**
 * Timeline Test Runner
 * 
 * Easy-to-use interface for running timeline performance tests
 * Provides both programmatic API and console commands for testing
 */

import { TimelineLoadTester } from './TimelineLoadTester.js';
import { performanceMonitor } from './PerformanceMonitor.js';

export class TimelineTestRunner {
  constructor() {
    this.activeTests = new Map();
    this.testHistory = [];
    this.isRunning = false;
    
    // Add global console commands for easy testing
    this.addConsoleCommands();
    
    console.log('🧪 Timeline Test Runner initialized');
    console.log('💡 Use runTimelineTests() in console to start testing');
  }

  /**
   * Add global console commands for easy testing
   */
  addConsoleCommands() {
    // Main test runner command
    window.runTimelineTests = async (options = {}) => {
      return await this.runQuickTest(options);
    };

    // Individual test commands
    window.testTimelineLoad = async (taskCount = 75) => {
      return await this.runLoadTestOnly(taskCount);
    };

    window.testTimelineNavigation = async (navCount = 100) => {
      return await this.runNavigationTestOnly(navCount);
    };

    window.testTimelineMemory = async () => {
      return await this.runMemoryTestOnly();
    };

    window.testViewSwitching = async (switchCount = 100) => {
      return await this.runViewSwitchingTestOnly(switchCount);
    };

    window.testUserScenarios = async () => {
      return await this.runUserScenariosTestOnly();
    };

    window.startExtendedTest = async (durationMinutes = 5) => {
      return await this.runExtendedTestOnly(durationMinutes);
    };

    // Performance monitoring commands
    window.getTimelineMetrics = () => {
      return this.getPerformanceSnapshot();
    };

    window.clearTimelineMetrics = () => {
      performanceMonitor.clearMetrics();
      console.log('📊 Performance metrics cleared');
    };

    window.exportTimelineMetrics = () => {
      const data = performanceMonitor.exportMetrics();
      console.log('📋 Copy this data to save metrics:');
      console.log(data);
      return data;
    };

    // Browser compatibility test
    window.testBrowserCompatibility = () => {
      return this.runBrowserCompatibilityTest();
    };

    console.log('🎛️ Timeline test commands added to window:');
    console.log('  runTimelineTests() - Run quick test suite');
    console.log('  testTimelineLoad(100) - Test with N tasks');
    console.log('  testTimelineNavigation(100) - Test rapid navigation');
    console.log('  testTimelineMemory() - Test for memory leaks');
    console.log('  testViewSwitching(100) - Test rapid view switching');
    console.log('  testUserScenarios() - Test user interaction scenarios');
    console.log('  startExtendedTest(5) - Extended session test (minutes)');
    console.log('  getTimelineMetrics() - Get performance snapshot');
    console.log('  clearTimelineMetrics() - Clear metrics');
    console.log('  exportTimelineMetrics() - Export metrics data');
  }

  /**
   * Find active timeline instance
   */
  findTimelineInstance() {
    // Look for timeline in common locations
    if (window.todayViewUI && window.todayViewUI.timelineInstance) {
      return window.todayViewUI.timelineInstance;
    }
    
    // Look for timeline in DOM
    const timelineContainer = document.getElementById('timeline-container');
    if (timelineContainer && timelineContainer._timelineInstance) {
      return timelineContainer._timelineInstance;
    }

    // Check global variables
    if (window.timelineInstance) {
      return window.timelineInstance;
    }

    return null;
  }

  /**
   * Run a quick test suite (5 minute version)
   */
  async runQuickTest(options = {}) {
    if (this.isRunning) {
      console.warn('⚠️ Test already running. Please wait...');
      return;
    }

    const timeline = this.findTimelineInstance();
    if (!timeline) {
      console.error('❌ No timeline instance found. Make sure timeline is initialized.');
      return { error: 'No timeline instance found' };
    }

    console.log('🚀 Starting Quick Timeline Test Suite');
    this.isRunning = true;

    const testOptions = {
      extendedSessionDuration: 2 * 60 * 1000, // 2 minutes for quick test
      loadTestTaskCount: 50,
      rapidNavigationCount: 50,
      ...options
    };

    try {
      const tester = new TimelineLoadTester(timeline, testOptions);
      const results = await tester.runFullTestSuite();
      
      this.testHistory.push({
        timestamp: new Date().toISOString(),
        type: 'quickTest',
        results,
        options: testOptions
      });

      this.displayResults(results);
      return results;

    } catch (error) {
      console.error('❌ Quick test failed:', error);
      return { error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run only load testing
   */
  async runLoadTestOnly(taskCount = 75) {
    const timeline = this.findTimelineInstance();
    if (!timeline) {
      console.error('❌ No timeline instance found');
      return { error: 'No timeline instance found' };
    }

    console.log(`📊 Running load test with ${taskCount} tasks`);
    
    try {
      const tester = new TimelineLoadTester(timeline);
      const result = await tester.runLoadTest(taskCount);
      
      console.log('✅ Load test completed');
      console.table({
        'Task Count': result.testTaskCount,
        'Average Render Time': `${result.renderTimes.average.toFixed(1)}ms`,
        'Max Render Time': `${result.renderTimes.max.toFixed(1)}ms`,
        'Memory Delta': `${(result.memoryUsage.delta / 1024 / 1024).toFixed(2)}MB`
      });

      return result;

    } catch (error) {
      console.error('❌ Load test failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Run only navigation testing
   */
  async runNavigationTestOnly(navCount = 100) {
    const timeline = this.findTimelineInstance();
    if (!timeline) {
      console.error('❌ No timeline instance found');
      return { error: 'No timeline instance found' };
    }

    console.log(`⚡ Running navigation test with ${navCount} navigations`);
    
    try {
      const tester = new TimelineLoadTester(timeline, { rapidNavigationCount: navCount });
      const result = await tester.runRapidNavigationTest();
      
      console.log('✅ Navigation test completed');
      console.table({
        'Navigation Count': result.navigationCount,
        'Average Time': `${result.navigationTimes.average.toFixed(1)}ms`,
        'Max Time': `${result.navigationTimes.max.toFixed(1)}ms`,
        'Slow Navigations': result.slowNavigations,
        'Memory Delta': `${(result.memoryUsage.delta / 1024 / 1024).toFixed(2)}MB`
      });

      return result;

    } catch (error) {
      console.error('❌ Navigation test failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Run only memory leak testing
   */
  async runMemoryTestOnly() {
    const timeline = this.findTimelineInstance();
    if (!timeline) {
      console.error('❌ No timeline instance found');
      return { error: 'No timeline instance found' };
    }

    console.log('🔍 Running memory leak test');
    
    try {
      const tester = new TimelineLoadTester(timeline);
      const result = await tester.runMemoryLeakTest();
      
      console.log('✅ Memory leak test completed');
      
      if (result.suspiciousScenarios.length > 0) {
        console.warn('⚠️ Suspicious memory growth detected:');
        console.table(result.suspiciousScenarios.map(s => ({
          Scenario: s.name,
          'Memory Growth': `${s.memoryDeltaMB.toFixed(2)}MB`,
          Duration: `${s.duration.toFixed(1)}ms`
        })));
      } else {
        console.log('✅ No significant memory leaks detected');
      }

      console.table({
        'Total Memory Growth': `${result.totalMemoryGrowthMB.toFixed(2)}MB`,
        'Suspicious Scenarios': result.suspiciousScenarios.length,
        'Total Scenarios': result.scenarios.length
      });

      return result;

    } catch (error) {
      console.error('❌ Memory test failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Run extended session test
   */
  async runExtendedTestOnly(durationMinutes = 5) {
    const timeline = this.findTimelineInstance();
    if (!timeline) {
      console.error('❌ No timeline instance found');
      return { error: 'No timeline instance found' };
    }

    console.log(`⏰ Starting extended session test for ${durationMinutes} minutes`);
    console.log('💡 This test will run in the background. You can continue using the timeline.');
    
    try {
      const tester = new TimelineLoadTester(timeline, {
        extendedSessionDuration: durationMinutes * 60 * 1000
      });
      
      const result = await tester.runExtendedSessionTest();
      
      console.log('✅ Extended session test completed');
      console.table({
        'Duration': `${(result.duration / 60000).toFixed(1)} minutes`,
        'Total Interactions': result.totalInteractions,
        'Memory Growth': `${result.memoryAnalysis.growth.toFixed(2)}MB`,
        'Memory Growth/Hour': `${result.memoryAnalysis.growthPerHour.toFixed(2)}MB/h`,
        'Memory Spikes': result.memoryAnalysis.spikes,
        'Total Renders': result.performanceAnalysis.totalRenders,
        'Health Score': `${result.healthScore}/100`
      });

      if (result.healthScore < 70) {
        console.warn('⚠️ Extended session health score is concerning. Consider investigating performance issues.');
      }

      return result;

    } catch (error) {
      console.error('❌ Extended session test failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Run only view switching testing
   */
  async runViewSwitchingTestOnly(switchCount = 100) {
    const timeline = this.findTimelineInstance();
    if (!timeline) {
      console.error('❌ No timeline instance found');
      return { error: 'No timeline instance found' };
    }

    console.log(`🔄 Running view switching test with ${switchCount} switches`);
    
    try {
      const tester = new TimelineLoadTester(timeline, { rapidViewSwitchCount: switchCount });
      const result = await tester.runRapidViewSwitchingTest();
      
      console.log('✅ View switching test completed');
      console.table({
        'Switch Count': result.switchCount,
        'Average Time': `${result.switchTimes.average.toFixed(1)}ms`,
        'Max Time': `${result.switchTimes.max.toFixed(1)}ms`,
        'Slow Switches': result.slowSwitches,
        'Memory Delta': `${(result.memoryUsage.delta / 1024 / 1024).toFixed(2)}MB`
      });

      return result;

    } catch (error) {
      console.error('❌ View switching test failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Run only user scenarios testing
   */
  async runUserScenariosTestOnly() {
    const timeline = this.findTimelineInstance();
    if (!timeline) {
      console.error('❌ No timeline instance found');
      return { error: 'No timeline instance found' };
    }

    console.log('👤 Running user scenarios test');
    
    try {
      const tester = new TimelineLoadTester(timeline);
      const result = await tester.runUserScenarioTest();
      
      console.log('✅ User scenarios test completed');
      console.table({
        'Total Scenarios': result.totalScenarios,
        'Successful': result.successfulScenarios,
        'Average Duration': `${result.averageScenarioDuration.toFixed(1)}ms`,
        'Total Duration': `${result.totalDuration.toFixed(1)}ms`,
        'Memory Growth': `${(result.totalMemoryGrowth / 1024 / 1024).toFixed(2)}MB`
      });

      if (result.successfulScenarios < result.totalScenarios) {
        console.warn(`⚠️ ${result.totalScenarios - result.successfulScenarios} scenarios failed`);
      }

      return result;

    } catch (error) {
      console.error('❌ User scenarios test failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Get current performance snapshot
   */
  getPerformanceSnapshot() {
    const timeline = this.findTimelineInstance();
    const globalMetrics = performanceMonitor.getSummary();
    const timelineMetrics = timeline ? timeline.getPerformanceMetrics() : null;

    const snapshot = {
      timestamp: new Date().toISOString(),
      browser: this.getBrowserInfo(),
      global: globalMetrics,
      timeline: timelineMetrics,
      memory: performance.memory ? {
        used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
        total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
        limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + 'MB'
      } : null
    };

    console.group('📊 Timeline Performance Snapshot');
    console.log('Timestamp:', snapshot.timestamp);
    if (snapshot.memory) {
      console.log('Memory Usage:', snapshot.memory);
    }
    if (snapshot.timeline) {
      console.log('Timeline Metrics:', snapshot.timeline.renderEfficiency);
    }
    if (snapshot.global.recent) {
      console.log('Recent Performance:', snapshot.global.recent);
    }
    if (snapshot.global.alerts.length > 0) {
      console.warn('Recent Alerts:', snapshot.global.alerts);
    }
    console.groupEnd();

    return snapshot;
  }

  /**
   * Run browser compatibility test
   */
  runBrowserCompatibilityTest() {
    const features = {
      'Performance API': typeof performance !== 'undefined',
      'Performance Memory': !!performance.memory,
      'Performance Observer': typeof PerformanceObserver !== 'undefined',
      'Request Animation Frame': typeof requestAnimationFrame !== 'undefined',
      'Local Storage': typeof localStorage !== 'undefined',
      'Session Storage': typeof sessionStorage !== 'undefined',
      'IndexedDB': typeof indexedDB !== 'undefined',
      'Web Workers': typeof Worker !== 'undefined',
      'Service Workers': 'serviceWorker' in navigator,
      'Touch Events': 'ontouchstart' in window,
      'Pointer Events': typeof PointerEvent !== 'undefined',
      'Intersection Observer': typeof IntersectionObserver !== 'undefined',
      'Mutation Observer': typeof MutationObserver !== 'undefined',
      'ES6 Classes': (() => { try { eval('class Test {}'); return true; } catch(e) { return false; } })(),
      'ES6 Modules': typeof import !== 'undefined',
      'Async/Await': (() => { try { eval('async function test() {}'); return true; } catch(e) { return false; } })(),
      'CSS Grid': CSS.supports('display', 'grid'),
      'CSS Flexbox': CSS.supports('display', 'flex'),
      'CSS Custom Properties': CSS.supports('--test', 'red')
    };

    const browserInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
      deviceMemory: navigator.deviceMemory || 'Unknown',
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth
      }
    };

    console.group('🌐 Browser Compatibility Report');
    console.log('Browser Information:', browserInfo);
    console.log('Feature Support:');
    console.table(features);
    
    const supportedFeatures = Object.values(features).filter(Boolean).length;
    const totalFeatures = Object.keys(features).length;
    const compatibilityScore = (supportedFeatures / totalFeatures * 100).toFixed(1);
    
    console.log(`✅ Compatibility Score: ${compatibilityScore}% (${supportedFeatures}/${totalFeatures} features supported)`);
    
    if (compatibilityScore < 80) {
      console.warn('⚠️ Some features are not supported. Timeline performance may be limited.');
    }
    
    console.groupEnd();

    return {
      browserInfo,
      features,
      compatibilityScore: parseFloat(compatibilityScore),
      recommendation: compatibilityScore >= 90 ? 'Excellent' :
                     compatibilityScore >= 80 ? 'Good' :
                     compatibilityScore >= 70 ? 'Fair' : 'Limited'
    };
  }

  /**
   * Display test results in a formatted way
   */
  displayResults(results) {
    console.group('🎯 Timeline Test Results Summary');
    
    if (results.success) {
      console.log(`✅ Test Suite Completed in ${(results.duration / 1000).toFixed(1)}s`);
      
      if (results.results.loadTesting?.success) {
        console.log(`📊 Load Test: ${results.results.loadTesting.renderTimes.average.toFixed(1)}ms avg render`);
      }
      
      if (results.results.rapidNavigation?.success) {
        console.log(`⚡ Navigation: ${results.results.rapidNavigation.navigationTimes.average.toFixed(1)}ms avg navigation`);
      }
      
      if (results.results.extendedSession?.success) {
        console.log(`⏰ Extended Session: ${results.results.extendedSession.memoryAnalysis.growth.toFixed(2)}MB memory growth`);
      }
      
      if (results.results.memoryLeakTest?.success) {
        console.log(`🔍 Memory Test: ${results.results.memoryLeakTest.totalMemoryGrowthMB.toFixed(2)}MB total growth`);
      }

      if (results.report?.recommendations?.length > 0) {
        console.warn('💡 Recommendations:');
        results.report.recommendations.forEach(rec => console.warn(`  • ${rec}`));
      }

      console.log(`🏆 Overall Health: ${results.report?.summary?.overallHealth || 'N/A'}`);
      
    } else {
      console.error('❌ Test Suite Failed:', results.error);
    }
    
    console.groupEnd();
  }

  /**
   * Get browser information
   */
  getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      onLine: navigator.onLine,
      memorySupported: !!performance.memory,
      performanceObserverSupported: typeof PerformanceObserver !== 'undefined'
    };
  }

  /**
   * Get test history
   */
  getTestHistory() {
    return [...this.testHistory];
  }

  /**
   * Clear test history
   */
  clearTestHistory() {
    this.testHistory = [];
    console.log('🗑️ Test history cleared');
  }
}

// Create global instance
export const timelineTestRunner = new TimelineTestRunner();

console.log('🧪 Timeline Test Runner loaded and ready!');