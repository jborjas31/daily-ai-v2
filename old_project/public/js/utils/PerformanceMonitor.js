/**
 * Performance Monitor Utility
 * 
 * Comprehensive performance monitoring system for timeline rendering,
 * memory usage tracking, and performance budget enforcement
 */

export class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      enableMemoryMonitoring: true,
      enableRenderMetrics: true,
      enableEventMetrics: true,
      performanceBudgets: {
        renderTime: 50, // ms
        refreshTime: 30, // ms
        memoryDelta: 5, // MB
        eventHandlerTime: 10 // ms
      },
      alertThresholds: {
        renderTime: 100, // ms
        memoryLeak: 10, // MB increase
        consecutiveSlowRenders: 3
      },
      historySize: 100, // Keep last 100 measurements
      ...options
    };

    this.metrics = {
      renders: [],
      refreshes: [],
      memorySnapshots: [],
      events: [],
      alerts: []
    };

    this.counters = {
      totalRenders: 0,
      slowRenders: 0,
      consecutiveSlowRenders: 0,
      memoryLeaks: 0,
      alertsTriggered: 0
    };

    this.timers = new Map();
    this.observers = [];
    
    // Initialize performance observer if available
    this.initializePerformanceObserver();
    
    // Start memory monitoring if enabled
    if (this.options.enableMemoryMonitoring) {
      this.startMemoryMonitoring();
    }

    console.log('✅ Performance Monitor initialized');
  }

  /**
   * Initialize Performance Observer for detailed metrics
   */
  initializePerformanceObserver() {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        // Observe paint and layout metrics
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordPaintMetric(entry);
          }
        });
        paintObserver.observe({ entryTypes: ['paint', 'measure'] });
        this.observers.push(paintObserver);

        // Observe long tasks (> 50ms)
        if ('longtask' in PerformanceObserver.supportedEntryTypes) {
          const longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              this.recordLongTask(entry);
            }
          });
          longTaskObserver.observe({ entryTypes: ['longtask'] });
          this.observers.push(longTaskObserver);
        }
      } catch (error) {
        console.warn('Performance Observer not fully supported:', error);
      }
    }
  }

  /**
   * Start a performance timer
   */
  startTimer(name, category = 'general') {
    const timer = {
      name,
      category,
      startTime: performance.now(),
      startMemory: this.getCurrentMemoryUsage()
    };
    
    this.timers.set(name, timer);
    
    // Use Performance API mark if available
    if (typeof performance.mark === 'function') {
      performance.mark(`${name}-start`);
    }
    
    return name;
  }

  /**
   * End a performance timer and record metrics
   */
  endTimer(name, metadata = {}) {
    const timer = this.timers.get(name);
    if (!timer) {
      console.warn(`Timer '${name}' not found`);
      return null;
    }

    const endTime = performance.now();
    const endMemory = this.getCurrentMemoryUsage();
    
    const metric = {
      name: timer.name,
      category: timer.category,
      duration: endTime - timer.startTime,
      startTime: timer.startTime,
      endTime,
      memoryDelta: endMemory - timer.startMemory,
      timestamp: Date.now(),
      metadata
    };

    // Store metric in appropriate category
    this.recordMetric(timer.category, metric);

    // Use Performance API measure if available
    if (typeof performance.measure === 'function') {
      try {
        performance.measure(`${name}-duration`, `${name}-start`);
      } catch (error) {
        // Ignore if mark doesn't exist
      }
    }

    // Check performance budgets
    this.checkPerformanceBudgets(metric);

    this.timers.delete(name);
    return metric;
  }

  /**
   * Record a metric in the appropriate category
   */
  recordMetric(category, metric) {
    if (!this.metrics[category]) {
      this.metrics[category] = [];
    }

    // Add to metrics array
    this.metrics[category].push(metric);

    // Keep only recent metrics to prevent memory bloat
    if (this.metrics[category].length > this.options.historySize) {
      this.metrics[category].shift();
    }

    // Update counters
    this.updateCounters(category, metric);
  }

  /**
   * Update performance counters
   */
  updateCounters(category, metric) {
    if (category === 'renders') {
      this.counters.totalRenders++;
      
      if (metric.duration > this.options.performanceBudgets.renderTime) {
        this.counters.slowRenders++;
        this.counters.consecutiveSlowRenders++;
      } else {
        this.counters.consecutiveSlowRenders = 0;
      }
    }

    if (metric.memoryDelta > this.options.performanceBudgets.memoryDelta * 1024 * 1024) {
      this.counters.memoryLeaks++;
    }
  }

  /**
   * Check performance budgets and trigger alerts
   */
  checkPerformanceBudgets(metric) {
    const budgets = this.options.performanceBudgets;
    const thresholds = this.options.alertThresholds;

    // Check render time budget
    if (metric.category === 'renders' && metric.duration > budgets.renderTime) {
      this.triggerAlert('render_budget_exceeded', {
        duration: metric.duration,
        budget: budgets.renderTime,
        overage: metric.duration - budgets.renderTime
      });
    }

    // Check for performance cliff (very slow render)
    if (metric.duration > thresholds.renderTime) {
      this.triggerAlert('performance_cliff', {
        duration: metric.duration,
        threshold: thresholds.renderTime,
        metric: metric.name
      });
    }

    // Check consecutive slow renders
    if (this.counters.consecutiveSlowRenders >= thresholds.consecutiveSlowRenders) {
      this.triggerAlert('consecutive_slow_renders', {
        count: this.counters.consecutiveSlowRenders,
        threshold: thresholds.consecutiveSlowRenders
      });
    }

    // Check memory delta
    if (metric.memoryDelta > thresholds.memoryLeak * 1024 * 1024) {
      this.triggerAlert('potential_memory_leak', {
        memoryDelta: metric.memoryDelta / 1024 / 1024, // MB
        threshold: thresholds.memoryLeak
      });
    }
  }

  /**
   * Trigger performance alert
   */
  triggerAlert(type, data) {
    const alert = {
      type,
      timestamp: Date.now(),
      data,
      severity: this.getAlertSeverity(type, data)
    };

    this.metrics.alerts.push(alert);
    this.counters.alertsTriggered++;

    // Keep only recent alerts
    if (this.metrics.alerts.length > 50) {
      this.metrics.alerts.shift();
    }

    // Log alert based on severity
    const message = this.formatAlertMessage(alert);
    if (alert.severity === 'critical') {
      console.error('🚨 Performance Alert (Critical):', message);
    } else if (alert.severity === 'warning') {
      console.warn('⚠️ Performance Alert (Warning):', message);
    } else {
      console.info('ℹ️ Performance Alert (Info):', message);
    }

    // Trigger custom alert handlers if provided
    if (this.options.onAlert) {
      this.options.onAlert(alert);
    }
  }

  /**
   * Get alert severity level
   */
  getAlertSeverity(type, data) {
    switch (type) {
      case 'performance_cliff':
        return data.duration > 200 ? 'critical' : 'warning';
      case 'potential_memory_leak':
        return data.memoryDelta > 20 ? 'critical' : 'warning';
      case 'consecutive_slow_renders':
        return data.count > 5 ? 'critical' : 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Format alert message for logging
   */
  formatAlertMessage(alert) {
    switch (alert.type) {
      case 'render_budget_exceeded':
        return `Render took ${alert.data.duration.toFixed(1)}ms (budget: ${alert.data.budget}ms, overage: ${alert.data.overage.toFixed(1)}ms)`;
      case 'performance_cliff':
        return `Very slow operation: ${alert.data.metric} took ${alert.data.duration.toFixed(1)}ms`;
      case 'consecutive_slow_renders':
        return `${alert.data.count} consecutive slow renders detected`;
      case 'potential_memory_leak':
        return `Memory increased by ${alert.data.memoryDelta.toFixed(1)}MB`;
      default:
        return `${alert.type}: ${JSON.stringify(alert.data)}`;
    }
  }

  /**
   * Record paint metrics from Performance Observer
   */
  recordPaintMetric(entry) {
    if (this.options.enableRenderMetrics) {
      this.recordMetric('paints', {
        name: entry.name,
        category: 'paints',
        duration: entry.startTime,
        timestamp: Date.now(),
        entryType: entry.entryType
      });
    }
  }

  /**
   * Record long task from Performance Observer
   */
  recordLongTask(entry) {
    this.triggerAlert('long_task_detected', {
      duration: entry.duration,
      startTime: entry.startTime
    });
  }

  /**
   * Get current memory usage (if available)
   */
  getCurrentMemoryUsage() {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Start memory monitoring interval
   */
  startMemoryMonitoring() {
    if (!performance.memory) {
      console.warn('Memory monitoring not available in this browser');
      return;
    }

    this.memoryInterval = setInterval(() => {
      const snapshot = {
        timestamp: Date.now(),
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };

      this.metrics.memorySnapshots.push(snapshot);

      // Keep only recent snapshots
      if (this.metrics.memorySnapshots.length > 200) {
        this.metrics.memorySnapshots.shift();
      }

      // Check for memory leaks
      this.checkMemoryTrends();
    }, 10000); // Every 10 seconds
  }

  /**
   * Check memory usage trends for potential leaks
   */
  checkMemoryTrends() {
    const snapshots = this.metrics.memorySnapshots;
    if (snapshots.length < 10) return; // Need enough data points

    const recent = snapshots.slice(-10);
    const older = snapshots.slice(-20, -10);

    const recentAvg = recent.reduce((sum, s) => sum + s.used, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.used, 0) / older.length;

    const growth = recentAvg - olderAvg;
    const growthMB = growth / 1024 / 1024;

    if (growthMB > this.options.alertThresholds.memoryLeak) {
      this.triggerAlert('memory_trend_leak', {
        growthMB: growthMB.toFixed(2),
        recentAvgMB: (recentAvg / 1024 / 1024).toFixed(2),
        olderAvgMB: (olderAvg / 1024 / 1024).toFixed(2)
      });
    }
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const summary = {
      counters: { ...this.counters },
      averages: {},
      recent: {},
      alerts: this.metrics.alerts.slice(-10)
    };

    // Calculate averages
    for (const [category, metrics] of Object.entries(this.metrics)) {
      if (Array.isArray(metrics) && metrics.length > 0 && metrics[0].duration !== undefined) {
        const durations = metrics.map(m => m.duration);
        summary.averages[category] = {
          mean: durations.reduce((a, b) => a + b, 0) / durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations),
          count: durations.length
        };

        // Recent metrics (last 10)
        const recentMetrics = metrics.slice(-10);
        const recentDurations = recentMetrics.map(m => m.duration);
        summary.recent[category] = {
          mean: recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length,
          count: recentDurations.length
        };
      }
    }

    // Memory summary
    if (this.metrics.memorySnapshots.length > 0) {
      const latest = this.metrics.memorySnapshots[this.metrics.memorySnapshots.length - 1];
      summary.memory = {
        currentMB: (latest.used / 1024 / 1024).toFixed(2),
        totalMB: (latest.total / 1024 / 1024).toFixed(2),
        limitMB: (latest.limit / 1024 / 1024).toFixed(2),
        utilization: ((latest.used / latest.total) * 100).toFixed(1) + '%'
      };
    }

    return summary;
  }

  /**
   * Get detailed metrics for analysis
   */
  getDetailedMetrics() {
    return {
      ...this.metrics,
      counters: { ...this.counters },
      options: { ...this.options }
    };
  }

  /**
   * Clear all metrics and reset counters
   */
  clearMetrics() {
    for (const category of Object.keys(this.metrics)) {
      this.metrics[category] = [];
    }
    
    for (const counter of Object.keys(this.counters)) {
      this.counters[counter] = 0;
    }

    console.log('📊 Performance metrics cleared');
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics() {
    return JSON.stringify({
      timestamp: Date.now(),
      summary: this.getSummary(),
      detailed: this.getDetailedMetrics()
    }, null, 2);
  }

  /**
   * Destroy performance monitor
   */
  destroy() {
    // Clear memory monitoring interval
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }

    // Disconnect performance observers
    this.observers.forEach(observer => {
      observer.disconnect();
    });

    // Clear all data
    this.clearMetrics();
    this.timers.clear();

    console.log('✅ Performance Monitor destroyed');
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

console.log('✅ Performance Monitor utility loaded');