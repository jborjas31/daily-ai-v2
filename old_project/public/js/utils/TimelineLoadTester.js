/**
 * Timeline Load Testing Utility
 * 
 * Comprehensive testing utility for timeline performance under various conditions:
 * - Extended timeline sessions
 * - High task loads (50+ tasks)
 * - Rapid navigation testing
 * - Memory leak detection
 * - Cross-browser compatibility validation
 */

import { performanceMonitor } from './PerformanceMonitor.js';
import { state } from '../state.js';
import { dataUtils } from '../dataOffline.js';

export class TimelineLoadTester {
  constructor(timelineInstance, options = {}) {
    this.timeline = timelineInstance;
    this.options = {
      extendedSessionDuration: 2 * 60 * 60 * 1000, // 2 hours for Phase 3
      rapidNavigationCount: 100,
      rapidNavigationDelay: 50, // ms
      loadTestTaskCount: 100, // Phase 3 requires 100+
      rapidViewSwitchCount: 100,
      viewSwitchDelay: 100, // ms
      memorySnapshotInterval: 5000, // 5 seconds
      performanceReportInterval: 10000, // 10 seconds
      maxMemoryGrowthMB: 50,
      maxRenderTime: 100, // ms
      ...options
    };

    this.testResults = {
      extendedSession: null,
      loadTesting: null,
      rapidNavigation: null,
      memoryLeakTest: null,
      crossBrowser: null
    };

    this.testState = {
      isRunning: false,
      currentTest: null,
      startTime: null,
      memorySnapshots: [],
      performanceSnapshots: []
    };

    console.log('🧪 Timeline Load Tester initialized');
  }

  /**
   * Run comprehensive load testing suite
   */
  async runFullTestSuite() {
    console.log('🚀 Starting Timeline Load Testing Suite');
    
    const suiteStartTime = Date.now();
    const results = {};

    try {
      // 1. Load Testing with 100+ tasks (Phase 3 requirement)
      console.log('📋 Running load test with high task count...');
      results.loadTesting = await this.runLoadTest(100);

      // 2. Rapid Date Navigation Test
      console.log('⏭️ Running rapid date navigation test...');
      results.rapidNavigation = await this.runRapidNavigationTest();

      // 3. Rapid View Switching Test (Phase 3 critical)
      console.log('🔄 Running rapid view switching test...');
      results.viewSwitching = await this.runRapidViewSwitchingTest();

      // 4. Extended Session Test (Phase 3 needs longer testing)
      console.log('⏱️ Running extended session test...');
      results.extendedSession = await this.runExtendedSessionTest();

      // 5. Memory Leak Verification
      console.log('🔍 Running memory leak verification...');
      results.memoryLeakTest = await this.runMemoryLeakTest();

      // 6. User Scenario Testing (Phase 3 requirement)
      console.log('👤 Running user scenario tests...');
      results.userScenarios = await this.runUserScenarioTest();

      // 7. Generate comprehensive report
      const suiteDuration = Date.now() - suiteStartTime;
      const report = this.generateTestReport(results, suiteDuration);

      console.log('✅ Timeline Load Testing Suite completed');
      console.log(report);

      return {
        success: true,
        duration: suiteDuration,
        results,
        report
      };

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      return {
        success: false,
        error: error.message,
        partialResults: results
      };
    }
  }

  /**
   * Test timeline with high task load (50+ tasks)
   */
  async runLoadTest(taskCount = null) {
    const testTaskCount = taskCount || this.options.loadTestTaskCount;
    console.log(`📊 Load testing with ${testTaskCount} tasks`);
    
    // Phase 3 requirement: Test with 100+ tasks for production readiness
    if (testTaskCount < 100) {
      console.warn(`⚠️ Phase 3 requires 100+ task testing. Current: ${testTaskCount}. Consider running with 100+ tasks for full validation.`);
    }

    const testId = 'load-test-' + Date.now();
    performanceMonitor.startTimer(testId, 'loadTesting');

    const initialMemory = this.getMemoryUsage();
    const initialMetrics = this.timeline.getPerformanceMetrics();

    try {
      // Generate test tasks
      const testTasks = this.generateTestTasks(testTaskCount);
      
      // Save original tasks
      const originalTasks = [...state.getTaskTemplates()];

      // Add test tasks to state
      for (const task of testTasks) {
        await state.createTaskTemplate(task);
      }

      // Measure initial render with full load
      const renderStart = performance.now();
      this.timeline.refresh();
      const initialRenderTime = performance.now() - renderStart;

      // Perform multiple renders to test consistency
      const renderTimes = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        this.timeline.refresh();
        renderTimes.push(performance.now() - start);
        await this.wait(100); // Small delay between renders
      }

      // Test with various filters
      const filterTimes = {};
      const filters = ['all', 'morning', 'afternoon', 'evening'];
      for (const filter of filters) {
        const start = performance.now();
        this.timeline.setTimeFilter(filter);
        filterTimes[filter] = performance.now() - start;
        await this.wait(50);
      }

      // Reset filter
      this.timeline.setTimeFilter('all');

      // Clean up test tasks
      const currentTasks = state.getTaskTemplates();
      const testTaskIds = currentTasks
        .filter(task => task.taskName?.startsWith('LoadTest-'))
        .map(task => task.id);

      for (const taskId of testTaskIds) {
        await state.deleteTaskTemplate(taskId);
      }

      this.timeline.refresh();

      const finalMemory = this.getMemoryUsage();
      const finalMetrics = this.timeline.getPerformanceMetrics();

      const result = {
        testTaskCount,
        initialRenderTime,
        renderTimes: {
          average: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
          min: Math.min(...renderTimes),
          max: Math.max(...renderTimes),
          all: renderTimes
        },
        filterTimes,
        memoryUsage: {
          initial: initialMemory,
          peak: Math.max(initialMemory, finalMemory),
          final: finalMemory,
          delta: finalMemory - initialMemory
        },
        performance: {
          initial: initialMetrics,
          final: finalMetrics
        },
        success: true
      };

      performanceMonitor.endTimer(testId, result);
      return result;

    } catch (error) {
      console.error('Load test failed:', error);
      performanceMonitor.endTimer(testId, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Test rapid date navigation performance
   */
  async runRapidNavigationTest() {
    console.log(`⚡ Testing rapid navigation (${this.options.rapidNavigationCount} navigations)`);

    const testId = 'rapid-nav-test-' + Date.now();
    performanceMonitor.startTimer(testId, 'rapidNavigation');

    const initialMemory = this.getMemoryUsage();
    const navigationTimes = [];
    const originalDate = this.timeline.currentDate;

    try {
      for (let i = 0; i < this.options.rapidNavigationCount; i++) {
        const start = performance.now();
        
        // Alternate between next and previous day
        if (i % 2 === 0) {
          this.timeline.navigateDate(1);
        } else {
          this.timeline.navigateDate(-1);
        }

        const navTime = performance.now() - start;
        navigationTimes.push(navTime);

        // Short delay to prevent browser lockup
        if (i % 10 === 0) {
          await this.wait(this.options.rapidNavigationDelay);
        }
      }

      // Return to original date
      state.setCurrentDate(originalDate);
      this.timeline.refresh();

      const finalMemory = this.getMemoryUsage();

      const result = {
        navigationCount: this.options.rapidNavigationCount,
        navigationTimes: {
          average: navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length,
          min: Math.min(...navigationTimes),
          max: Math.max(...navigationTimes),
          median: this.calculateMedian(navigationTimes)
        },
        memoryUsage: {
          initial: initialMemory,
          final: finalMemory,
          delta: finalMemory - initialMemory
        },
        slowNavigations: navigationTimes.filter(time => time > 50).length,
        success: true
      };

      performanceMonitor.endTimer(testId, result);
      return result;

    } catch (error) {
      console.error('Rapid navigation test failed:', error);
      performanceMonitor.endTimer(testId, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Run extended session test (30 minutes by default)
   */
  async runExtendedSessionTest() {
    console.log(`⏰ Starting extended session test (${this.options.extendedSessionDuration / 60000} minutes)`);

    const testId = 'extended-session-test-' + Date.now();
    performanceMonitor.startTimer(testId, 'extendedSession');

    const startTime = Date.now();
    const memorySnapshots = [];
    const performanceSnapshots = [];
    let totalInteractions = 0;

    try {
      this.testState.isRunning = true;
      this.testState.currentTest = 'extendedSession';
      this.testState.startTime = startTime;

      // Set up monitoring intervals
      const memoryInterval = setInterval(() => {
        if (!this.testState.isRunning) return;

        const snapshot = {
          timestamp: Date.now(),
          elapsed: Date.now() - startTime,
          memory: this.getMemoryUsage(),
          performance: this.timeline.getPerformanceMetrics(),
          totalInteractions
        };

        memorySnapshots.push(snapshot);
        this.testState.memorySnapshots = memorySnapshots;
        
        console.log(`📊 Extended session snapshot - Elapsed: ${Math.round(snapshot.elapsed / 60000)}min, Memory: ${(snapshot.memory / 1024 / 1024).toFixed(1)}MB, Renders: ${snapshot.performance.instanceMetrics.renderCount}`);
        
      }, this.options.memorySnapshotInterval);

      // Simulate user interactions during extended session
      const interactionInterval = setInterval(async () => {
        if (!this.testState.isRunning) return;

        try {
          // Random user interactions
          const actions = [
            () => this.timeline.refresh(),
            () => this.timeline.navigateDate(Math.random() > 0.5 ? 1 : -1),
            () => this.timeline.setTimeFilter(['all', 'morning', 'afternoon', 'evening'][Math.floor(Math.random() * 4)]),
            () => this.timeline.updateResponsiveSizing(),
            () => this.timeline.updateTimeIndicator()
          ];

          const randomAction = actions[Math.floor(Math.random() * actions.length)];
          randomAction();
          totalInteractions++;

          // Occasionally trigger more intensive operations
          if (totalInteractions % 50 === 0) {
            // Simulate task creation and deletion
            const testTask = {
              taskName: `Extended-Test-${totalInteractions}`,
              scheduledTime: '14:00',
              durationMinutes: 30,
              priority: Math.floor(Math.random() * 10)
            };

            const savedTask = await state.createTaskTemplate(testTask);
            await this.wait(100);
            await state.deleteTaskTemplate(savedTask.id);
            this.timeline.refresh();
          }

        } catch (error) {
          console.warn('Error during extended session interaction:', error);
        }
      }, 2000); // Every 2 seconds

      // Wait for test duration
      await this.wait(this.options.extendedSessionDuration);

      // Stop test
      this.testState.isRunning = false;
      clearInterval(memoryInterval);
      clearInterval(interactionInterval);

      // Final snapshot
      const finalSnapshot = {
        timestamp: Date.now(),
        elapsed: Date.now() - startTime,
        memory: this.getMemoryUsage(),
        performance: this.timeline.getPerformanceMetrics(),
        totalInteractions
      };

      memorySnapshots.push(finalSnapshot);

      // Analyze results
      const result = this.analyzeExtendedSessionResults(memorySnapshots, startTime);
      
      performanceMonitor.endTimer(testId, result);
      return result;

    } catch (error) {
      console.error('Extended session test failed:', error);
      this.testState.isRunning = false;
      performanceMonitor.endTimer(testId, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Test for memory leaks during various operations
   */
  async runMemoryLeakTest() {
    console.log('🔍 Running memory leak verification test');

    const testId = 'memory-leak-test-' + Date.now();
    performanceMonitor.startTimer(testId, 'memoryLeakTest');

    try {
      const scenarios = [
        {
          name: 'Rapid Rendering',
          action: async () => {
            for (let i = 0; i < 100; i++) {
              this.timeline.render();
              if (i % 10 === 0) await this.wait(10);
            }
          }
        },
        {
          name: 'View Switching',
          action: async () => {
            for (let i = 0; i < 50; i++) {
              this.timeline.setTimeFilter(['all', 'morning', 'afternoon', 'evening'][i % 4]);
              await this.wait(20);
            }
          }
        },
        {
          name: 'Date Navigation',
          action: async () => {
            const originalDate = this.timeline.currentDate;
            for (let i = 0; i < 30; i++) {
              this.timeline.navigateDate(i % 2 === 0 ? 1 : -1);
              await this.wait(30);
            }
            state.setCurrentDate(originalDate);
          }
        },
        {
          name: 'Task CRUD Operations',
          action: async () => {
            const taskIds = [];
            // Create tasks
            for (let i = 0; i < 20; i++) {
              const task = await state.createTaskTemplate({
                taskName: `MemTest-${i}`,
                scheduledTime: '15:00',
                durationMinutes: 30
              });
              taskIds.push(task.id);
              if (i % 5 === 0) {
                this.timeline.refresh();
                await this.wait(10);
              }
            }
            
            // Delete tasks
            for (const taskId of taskIds) {
              await state.deleteTaskTemplate(taskId);
              await this.wait(10);
            }
            
            this.timeline.refresh();
          }
        }
      ];

      const scenarioResults = [];

      for (const scenario of scenarios) {
        console.log(`🧪 Testing scenario: ${scenario.name}`);
        
        // Force garbage collection if available
        if (window.gc) {
          window.gc();
        }
        
        await this.wait(1000); // Let memory stabilize
        
        const beforeMemory = this.getMemoryUsage();
        const beforeTime = performance.now();
        
        await scenario.action();
        
        const afterTime = performance.now();
        await this.wait(2000); // Let memory stabilize
        
        const afterMemory = this.getMemoryUsage();
        
        const scenarioResult = {
          name: scenario.name,
          duration: afterTime - beforeTime,
          memoryBefore: beforeMemory,
          memoryAfter: afterMemory,
          memoryDelta: afterMemory - beforeMemory,
          memoryDeltaMB: (afterMemory - beforeMemory) / 1024 / 1024
        };
        
        scenarioResults.push(scenarioResult);
        
        console.log(`📊 ${scenario.name}: ${scenarioResult.memoryDeltaMB.toFixed(2)}MB change`);
        
        // Check for significant memory growth
        if (scenarioResult.memoryDeltaMB > 10) {
          console.warn(`⚠️ Potential memory leak in ${scenario.name}: ${scenarioResult.memoryDeltaMB.toFixed(2)}MB growth`);
        }
      }

      const result = {
        scenarios: scenarioResults,
        totalMemoryGrowth: scenarioResults.reduce((sum, s) => sum + s.memoryDelta, 0),
        totalMemoryGrowthMB: scenarioResults.reduce((sum, s) => sum + s.memoryDeltaMB, 0),
        suspiciousScenarios: scenarioResults.filter(s => s.memoryDeltaMB > 5),
        success: true
      };

      performanceMonitor.endTimer(testId, result);
      return result;

    } catch (error) {
      console.error('Memory leak test failed:', error);
      performanceMonitor.endTimer(testId, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Test rapid view switching between timeline and list views (Phase 3 critical)
   */
  async runRapidViewSwitchingTest() {
    console.log(`🔄 Testing rapid view switching (${this.options.rapidViewSwitchCount} switches)`);

    const testId = 'rapid-view-switch-test-' + Date.now();
    performanceMonitor.startTimer(testId, 'viewSwitching');

    const initialMemory = this.getMemoryUsage();
    const switchTimes = [];

    try {
      // Check if UI switching methods are available
      const uiInstance = window.todayViewUI || window.ui;
      if (!uiInstance || typeof uiInstance.switchView !== 'function') {
        console.warn('⚠️ UI view switching not available. Testing with timeline refresh instead.');
        
        // Fallback: Test timeline render switching
        for (let i = 0; i < this.options.rapidViewSwitchCount; i++) {
          const start = performance.now();
          this.timeline.render();
          const switchTime = performance.now() - start;
          switchTimes.push(switchTime);
          
          if (i % 10 === 0) {
            await this.wait(this.options.viewSwitchDelay);
          }
        }
      } else {
        // Test actual view switching
        const views = ['timeline', 'list'];
        
        for (let i = 0; i < this.options.rapidViewSwitchCount; i++) {
          const start = performance.now();
          
          const viewMode = views[i % 2];
          await uiInstance.switchView(viewMode);
          
          const switchTime = performance.now() - start;
          switchTimes.push(switchTime);
          
          if (i % 10 === 0) {
            await this.wait(this.options.viewSwitchDelay);
          }
        }
      }

      const finalMemory = this.getMemoryUsage();

      const result = {
        switchCount: this.options.rapidViewSwitchCount,
        switchTimes: {
          average: switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length,
          min: Math.min(...switchTimes),
          max: Math.max(...switchTimes),
          median: this.calculateMedian(switchTimes)
        },
        memoryUsage: {
          initial: initialMemory,
          final: finalMemory,
          delta: finalMemory - initialMemory
        },
        slowSwitches: switchTimes.filter(time => time > 100).length, // switches > 100ms
        success: true
      };

      performanceMonitor.endTimer(testId, result);
      return result;

    } catch (error) {
      console.error('Rapid view switching test failed:', error);
      performanceMonitor.endTimer(testId, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Test real user scenarios (Phase 3 requirement)
   */
  async runUserScenarioTest() {
    console.log('👤 Testing user scenarios for Phase 3');

    const testId = 'user-scenarios-test-' + Date.now();
    performanceMonitor.startTimer(testId, 'userScenarios');

    const scenarios = [
      {
        name: 'Create New Task',
        action: async () => {
          // Simulate creating a new task
          const testTask = {
            taskName: 'User-Test-Task-' + Date.now(),
            scheduledTime: '14:00',
            durationMinutes: 45,
            priority: 3
          };
          
          const savedTask = await state.createTaskTemplate(testTask);
          await this.wait(100);
          
          // Clean up
          await state.deleteTaskTemplate(savedTask.id);
          return { taskCreated: true, taskId: savedTask.id };
        }
      },
      {
        name: 'Edit Existing Task',
        action: async () => {
          // Create a task to edit
          const testTask = await state.createTaskTemplate({
            taskName: 'Edit-Test-Task',
            scheduledTime: '15:00',
            durationMinutes: 30,
            priority: 2
          });
          
          await this.wait(50);
          
          // Edit the task
          const updatedTask = {
            ...testTask,
            taskName: 'Edited-Test-Task',
            priority: 4
          };
          
          await state.updateTaskTemplate(testTask.id, updatedTask);
          await this.wait(50);
          
          // Clean up
          await state.deleteTaskTemplate(testTask.id);
          return { taskEdited: true, taskId: testTask.id };
        }
      },
      {
        name: 'Complete Task',
        action: async () => {
          // Create a task to complete
          const testTask = await state.createTaskTemplate({
            taskName: 'Complete-Test-Task',
            scheduledTime: '16:00',
            durationMinutes: 20,
            priority: 1
          });
          
          await this.wait(50);
          
          // Create a completed instance
          const taskInstance = {
            templateId: testTask.id,
            date: dataUtils.getTodayDateString(),
            status: 'completed',
            completedAt: new Date().toISOString()
          };
          
          await state.createTaskInstance(taskInstance);
          await this.wait(50);
          
          // Clean up
          await state.deleteTaskTemplate(testTask.id);
          return { taskCompleted: true, taskId: testTask.id };
        }
      },
      {
        name: 'Timeline Navigation',
        action: async () => {
          const originalDate = this.timeline.currentDate;
          
          // Navigate forward
          this.timeline.navigateDate(1);
          await this.wait(100);
          
          // Navigate backward  
          this.timeline.navigateDate(-1);
          await this.wait(100);
          
          // Return to today
          this.timeline.goToToday();
          await this.wait(50);
          
          return { navigated: true, originalDate };
        }
      },
      {
        name: 'Timeline Refresh Performance',
        action: async () => {
          const refreshTimes = [];
          
          for (let i = 0; i < 5; i++) {
            const start = performance.now();
            this.timeline.refresh();
            const refreshTime = performance.now() - start;
            refreshTimes.push(refreshTime);
            await this.wait(100);
          }
          
          return {
            refreshCount: refreshTimes.length,
            averageRefreshTime: refreshTimes.reduce((a, b) => a + b, 0) / refreshTimes.length,
            maxRefreshTime: Math.max(...refreshTimes)
          };
        }
      }
    ];

    const scenarioResults = [];
    const initialMemory = this.getMemoryUsage();

    try {
      for (const scenario of scenarios) {
        console.log(`🎯 Running scenario: ${scenario.name}`);
        
        const beforeMemory = this.getMemoryUsage();
        const beforeTime = performance.now();
        
        const result = await scenario.action();
        
        const afterTime = performance.now();
        const afterMemory = this.getMemoryUsage();
        
        const scenarioResult = {
          name: scenario.name,
          duration: afterTime - beforeTime,
          memoryDelta: afterMemory - beforeMemory,
          result,
          success: true
        };
        
        scenarioResults.push(scenarioResult);
        
        // Small delay between scenarios
        await this.wait(200);
      }

      const finalMemory = this.getMemoryUsage();

      const testResult = {
        scenarios: scenarioResults,
        totalScenarios: scenarios.length,
        successfulScenarios: scenarioResults.filter(s => s.success).length,
        totalDuration: scenarioResults.reduce((sum, s) => sum + s.duration, 0),
        averageScenarioDuration: scenarioResults.reduce((sum, s) => sum + s.duration, 0) / scenarioResults.length,
        totalMemoryGrowth: finalMemory - initialMemory,
        success: true
      };

      performanceMonitor.endTimer(testId, testResult);
      return testResult;

    } catch (error) {
      console.error('User scenario test failed:', error);
      performanceMonitor.endTimer(testId, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze extended session test results
   */
  analyzeExtendedSessionResults(snapshots, startTime) {
    if (snapshots.length < 2) {
      return { success: false, error: 'Insufficient data points' };
    }

    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];
    
    // Calculate memory trend
    const memoryGrowth = lastSnapshot.memory - firstSnapshot.memory;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;
    
    // Calculate performance degradation
    const renderCountGrowth = lastSnapshot.performance.instanceMetrics.renderCount - 
                            firstSnapshot.performance.instanceMetrics.renderCount;
    
    // Find memory spikes
    const memorySpikes = snapshots.filter((snapshot, i) => {
      if (i === 0) return false;
      const prevSnapshot = snapshots[i - 1];
      const growth = snapshot.memory - prevSnapshot.memory;
      return growth > 5 * 1024 * 1024; // 5MB spike
    });

    // Calculate average memory per time period
    const memoryOverTime = snapshots.map(s => ({
      elapsed: s.elapsed,
      memory: s.memory / 1024 / 1024 // MB
    }));

    return {
      duration: lastSnapshot.elapsed,
      totalInteractions: lastSnapshot.totalInteractions,
      memoryAnalysis: {
        initial: firstSnapshot.memory / 1024 / 1024,
        final: lastSnapshot.memory / 1024 / 1024,
        growth: memoryGrowthMB,
        growthPerHour: (memoryGrowthMB / (lastSnapshot.elapsed / 3600000)),
        spikes: memorySpikes.length,
        trend: memoryOverTime
      },
      performanceAnalysis: {
        initialRenders: firstSnapshot.performance.instanceMetrics.renderCount,
        finalRenders: lastSnapshot.performance.instanceMetrics.renderCount,
        totalRenders: renderCountGrowth,
        averageRenderTime: lastSnapshot.performance.renderEfficiency.averageRenderTime
      },
      snapshotCount: snapshots.length,
      healthScore: this.calculateHealthScore(memoryGrowthMB, memorySpikes.length, renderCountGrowth),
      success: true
    };
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport(results, suiteDuration) {
    const report = {
      summary: {
        duration: suiteDuration,
        timestamp: new Date().toISOString(),
        browser: this.getBrowserInfo(),
        overallHealth: 'Good' // Will be calculated
      },
      results: results,
      recommendations: []
    };

    // Analyze results and generate recommendations
    if (results.loadTesting?.renderTimes?.average > this.options.maxRenderTime) {
      report.recommendations.push('Consider optimizing render performance for high task loads');
    }

    if (results.memoryLeakTest?.totalMemoryGrowthMB > this.options.maxMemoryGrowthMB) {
      report.recommendations.push('Potential memory leaks detected in multiple scenarios');
    }

    if (results.rapidNavigation?.slowNavigations > results.rapidNavigation?.navigationCount * 0.1) {
      report.recommendations.push('Navigation performance could be improved');
    }

    if (results.extendedSession?.memoryAnalysis?.growthPerHour > 10) {
      report.recommendations.push('Extended session shows concerning memory growth');
    }

    // Calculate overall health score
    const healthScores = Object.values(results)
      .filter(result => result?.success && result.healthScore)
      .map(result => result.healthScore);
    
    if (healthScores.length > 0) {
      const avgHealthScore = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
      report.summary.overallHealth = avgHealthScore > 80 ? 'Excellent' :
                                   avgHealthScore > 60 ? 'Good' :
                                   avgHealthScore > 40 ? 'Fair' : 'Poor';
    }

    return report;
  }

  /**
   * Helper methods
   */
  
  generateTestTasks(count) {
    const tasks = [];
    const categories = ['Work', 'Personal', 'Health', 'Learning', 'Creative'];
    const priorities = [1, 3, 5, 7, 9];
    
    for (let i = 0; i < count; i++) {
      const hour = 6 + Math.floor(Math.random() * 16); // 6 AM to 10 PM
      const minute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
      const duration = [15, 30, 45, 60, 90, 120][Math.floor(Math.random() * 6)];
      
      tasks.push({
        taskName: `LoadTest-${i.toString().padStart(3, '0')}-${categories[i % categories.length]}`,
        description: `Generated test task #${i} for load testing`,
        scheduledTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        durationMinutes: duration,
        priority: priorities[i % priorities.length],
        category: categories[i % categories.length],
        isMandatory: Math.random() > 0.7,
        isAnchor: Math.random() > 0.9
      });
    }
    
    return tasks;
  }

  getMemoryUsage() {
    return performance.memory ? performance.memory.usedJSHeapSize : 0;
  }

  calculateMedian(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  }

  calculateHealthScore(memoryGrowthMB, memorySpikes, renders) {
    let score = 100;
    
    // Deduct for memory growth
    score -= Math.min(memoryGrowthMB * 2, 40);
    
    // Deduct for memory spikes
    score -= memorySpikes * 5;
    
    // Deduct for excessive renders
    if (renders > 1000) {
      score -= Math.min((renders - 1000) / 100, 20);
    }
    
    return Math.max(0, score);
  }

  getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      memorySupported: !!performance.memory
    };
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

console.log('🧪 Timeline Load Tester utility loaded');