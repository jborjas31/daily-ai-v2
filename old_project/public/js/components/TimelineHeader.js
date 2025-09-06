/**
 * TimelineHeader Component
 * 
 * Handles the timeline header section including:
 * - Date display and navigation (previous/next day, today button)
 * - Current time display
 * - Time block filters (All Day, Morning, Afternoon, Evening)
 * - Filter statistics display
 * 
 * This component is presentational - it emits events instead of directly manipulating state
 */

import { SafeEventListener } from '../utils/MemoryLeakPrevention.js';

export class TimelineHeader {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      showSeconds: false,
      ...options
    };
    
    // Event listeners array for cleanup
    this.eventListeners = [];
    
    // Component state (receives from parent)
    this.currentDate = null;
    this.timeFilter = 'all';
    this.scheduleData = null;
  }

  /**
   * Update component with new data
   */
  update(data = {}) {
    this.currentDate = data.currentDate || this.currentDate;
    this.timeFilter = data.timeFilter || this.timeFilter;
    this.scheduleData = data.scheduleData || this.scheduleData;
    
    this.render();
  }

  /**
   * Render the complete header
   */
  render() {
    if (!this.container) return;
    
    // Clean up existing event listeners
    this.cleanup();
    
    this.container.innerHTML = this.renderHeaderHTML();
    this.setupEventListeners();
  }

  /**
   * Generate the header HTML
   */
  renderHeaderHTML() {
    const currentTime = new Date().toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      ...(this.options.showSeconds && { second: '2-digit' })
    });
    
    const dateDisplay = this.currentDate 
      ? new Date(this.currentDate + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'Select Date';
    
    return `
      <div class="timeline-header-content">
        <div class="timeline-date">
          <button id="timeline-prev-day" class="timeline-nav-btn" aria-label="Previous day">‹</button>
          <h2 class="timeline-date-text">${dateDisplay}</h2>
          <button id="timeline-next-day" class="timeline-nav-btn" aria-label="Next day">›</button>
        </div>
        <div class="timeline-time">
          <div class="current-time" id="timeline-current-time">${currentTime}</div>
          <button id="timeline-today-btn" class="btn btn-primary btn-sm">Today</button>
        </div>
        <div class="timeline-filters">
          <div class="time-block-filters">
            <button id="filter-all" class="filter-btn ${this.timeFilter === 'all' ? 'active' : ''}" data-filter="all">All Day</button>
            <button id="filter-morning" class="filter-btn ${this.timeFilter === 'morning' ? 'active' : ''}" data-filter="morning">Morning</button>
            <button id="filter-afternoon" class="filter-btn ${this.timeFilter === 'afternoon' ? 'active' : ''}" data-filter="afternoon">Afternoon</button>
            <button id="filter-evening" class="filter-btn ${this.timeFilter === 'evening' ? 'active' : ''}" data-filter="evening">Evening</button>
          </div>
          ${this.renderFilterStats()}
        </div>
      </div>
    `;
  }

  /**
   * Render filter statistics
   */
  renderFilterStats() {
    if (!this.scheduleData || !this.scheduleData.schedule) {
      return '<div class="filter-stats">No tasks to analyze</div>';
    }

    const stats = this.getTimeBlockStats();
    
    if (this.timeFilter === 'all') {
      return `
        <div class="filter-stats">
          <span class="stat-item">Morning: ${stats.morning.count} tasks (${stats.morning.duration}h)</span>
          <span class="stat-item">Afternoon: ${stats.afternoon.count} tasks (${stats.afternoon.duration}h)</span>
          <span class="stat-item">Evening: ${stats.evening.count} tasks (${stats.evening.duration}h)</span>
        </div>
      `;
    }
    
    const currentStats = stats[this.timeFilter];
    return `
      <div class="filter-stats">
        <span class="stat-item">${currentStats.count} tasks</span>
        <span class="stat-item">${currentStats.duration}h total</span>
        <span class="stat-item">${currentStats.range}</span>
      </div>
    `;
  }

  /**
   * Get statistics for time blocks
   */
  getTimeBlockStats() {
    const schedule = this.scheduleData.schedule || [];
    
    const stats = {
      morning: { count: 0, duration: 0, range: '6:00 - 12:00' },
      afternoon: { count: 0, duration: 0, range: '12:00 - 18:00' },
      evening: { count: 0, duration: 0, range: '18:00 - 24:00' }
    };

    schedule.forEach(task => {
      const hour = parseInt(task.scheduledTime.split(':')[0]);
      const duration = (task.durationMinutes || 0) / 60;
      
      if (hour >= 6 && hour < 12) {
        stats.morning.count++;
        stats.morning.duration += duration;
      } else if (hour >= 12 && hour < 18) {
        stats.afternoon.count++;
        stats.afternoon.duration += duration;
      } else if (hour >= 18) {
        stats.evening.count++;
        stats.evening.duration += duration;
      }
    });

    // Round durations to 1 decimal place
    Object.keys(stats).forEach(period => {
      stats[period].duration = Math.round(stats[period].duration * 10) / 10;
    });

    return stats;
  }

  /**
   * Setup event listeners for header interactions
   */
  setupEventListeners() {
    // Date navigation buttons
    const prevBtn = this.container.querySelector('#timeline-prev-day');
    const nextBtn = this.container.querySelector('#timeline-next-day');
    const todayBtn = this.container.querySelector('#timeline-today-btn');
    
    if (prevBtn) {
      const listener = SafeEventListener.add(
        prevBtn,
        'click',
        () => this.emitEvent('navigate-day', { direction: 'previous', days: -1 }),
        { description: 'TimelineHeader previous day button' }
      );
      this.eventListeners.push(listener);
    }
    
    if (nextBtn) {
      const listener = SafeEventListener.add(
        nextBtn,
        'click',
        () => this.emitEvent('navigate-day', { direction: 'next', days: 1 }),
        { description: 'TimelineHeader next day button' }
      );
      this.eventListeners.push(listener);
    }
    
    if (todayBtn) {
      const listener = SafeEventListener.add(
        todayBtn,
        'click',
        () => this.emitEvent('go-to-today'),
        { description: 'TimelineHeader today button' }
      );
      this.eventListeners.push(listener);
    }
    
    // Filter buttons
    const filterButtons = this.container.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
      const listener = SafeEventListener.add(
        button,
        'click',
        () => this.emitEvent('time-filter-change', { 
          filter: button.dataset.filter,
          previousFilter: this.timeFilter 
        }),
        { description: 'TimelineHeader filter button' }
      );
      this.eventListeners.push(listener);
    });
  }

  /**
   * Emit custom events to parent components
   */
  emitEvent(eventType, data = {}) {
    const customEvent = new CustomEvent(eventType, {
      detail: data,
      bubbles: true
    });
    this.container.dispatchEvent(customEvent);
  }

  /**
   * Update the current time display (called from parent for real-time updates)
   */
  updateCurrentTime() {
    const timeElement = this.container?.querySelector('#timeline-current-time');
    if (timeElement) {
      const currentTime = new Date().toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        ...(this.options.showSeconds && { second: '2-digit' })
      });
      timeElement.textContent = currentTime;
    }
  }

  /**
   * Clean up event listeners
   */
  cleanup() {
    this.eventListeners.forEach(listener => {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    });
    this.eventListeners = [];
  }

  /**
   * Destroy the component
   */
  destroy() {
    this.cleanup();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.scheduleData = null;
  }
}