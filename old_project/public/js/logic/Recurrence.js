/**
 * Recurrence Engine Module
 * 
 * Comprehensive recurrence rule processing system for task templates.
 * Extracted from TaskInstanceManager as part of Phase 2 refactoring.
 */

export class RecurrenceEngine {
  /**
   * Main entry point for checking if a template should generate an instance for a given date
   * @param {Object} template - The task template with recurrence rules
   * @param {string|Date} date - The target date to check
   * @returns {boolean} - True if an instance should be generated
   */
  shouldGenerateForDate(template, date) {
    // Treat templates with no recurrence (or 'none') as eligible for today's schedule.
    // This ensures new tasks appear on the timeline by default unless a rule restricts them.
    if (!template.recurrenceRule || template.recurrenceRule.frequency === 'none') {
      return true;
    }

    const targetDate = new Date(date);
    const recurrenceRule = template.recurrenceRule;
    
    // Check if template has start/end date restrictions
    if (!this.isWithinRecurrenceDateRange(recurrenceRule, targetDate)) {
      return false;
    }
    
    // Check occurrence limits
    if (!this.isWithinOccurrenceLimits(recurrenceRule, template.id, targetDate)) {
      return false;
    }

    switch (recurrenceRule.frequency) {
      case 'daily':
        return this.shouldGenerateDaily(recurrenceRule, targetDate);
        
      case 'weekly':
        return this.shouldGenerateWeekly(recurrenceRule, targetDate);
        
      case 'monthly':
        return this.shouldGenerateMonthly(recurrenceRule, targetDate);
        
      case 'yearly':
        return this.shouldGenerateYearly(recurrenceRule, targetDate);
        
      case 'custom':
        return this.shouldGenerateCustom(recurrenceRule, targetDate);
        
      default:
        console.warn(`Unknown recurrence frequency: ${recurrenceRule.frequency}`);
        return false;
    }
  }

  /**
   * Get the next occurrence of a template after a given date
   * @param {Object} template - The task template with recurrence rules
   * @param {string|Date} fromDate - The date to search from
   * @returns {Date|null} - The next occurrence date or null if none
   */
  getNextOccurrence(template, fromDate) {
    if (!template.recurrenceRule || template.recurrenceRule.frequency === 'none') {
      return null;
    }

    const startDate = new Date(fromDate);
    startDate.setDate(startDate.getDate() + 1); // Start checking from the next day
    
    // Search for the next occurrence within a reasonable range (1 year)
    const maxSearchDate = new Date(startDate);
    maxSearchDate.setFullYear(maxSearchDate.getFullYear() + 1);
    
    const currentDate = new Date(startDate);
    while (currentDate <= maxSearchDate) {
      if (this.shouldGenerateForDate(template, currentDate)) {
        return new Date(currentDate);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return null; // No occurrence found within search range
  }

  /**
   * Get all occurrences of a template within a date range
   * @param {Object} template - The task template with recurrence rules
   * @param {string|Date} startDate - The start date of the range
   * @param {string|Date} endDate - The end date of the range
   * @returns {Date[]} - Array of occurrence dates
   */
  getOccurrencesInRange(template, startDate, endDate) {
    if (!template.recurrenceRule || template.recurrenceRule.frequency === 'none') {
      return [];
    }

    const occurrences = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      if (this.shouldGenerateForDate(template, currentDate)) {
        occurrences.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return occurrences;
  }

  /**
   * Validate a recurrence rule for correctness
   * @param {Object} recurrenceRule - The recurrence rule to validate
   * @returns {Object} - Validation result with isValid and errors
   */
  validateRecurrenceRule(recurrenceRule) {
    const result = { isValid: true, errors: [] };
    
    if (!recurrenceRule || typeof recurrenceRule !== 'object') {
      result.isValid = false;
      result.errors.push('Recurrence rule must be an object');
      return result;
    }

    // Check frequency
    const validFrequencies = ['none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'];
    if (!validFrequencies.includes(recurrenceRule.frequency)) {
      result.isValid = false;
      result.errors.push(`Invalid frequency: ${recurrenceRule.frequency}`);
    }

    // Validate interval
    if (recurrenceRule.interval && (!Number.isInteger(recurrenceRule.interval) || recurrenceRule.interval < 1)) {
      result.isValid = false;
      result.errors.push('Interval must be a positive integer');
    }

    // Validate date ranges
    if (recurrenceRule.startDate && recurrenceRule.endDate) {
      const start = new Date(recurrenceRule.startDate);
      const end = new Date(recurrenceRule.endDate);
      if (start >= end) {
        result.isValid = false;
        result.errors.push('End date must be after start date');
      }
    }

    // Validate weekly rules
    if (recurrenceRule.frequency === 'weekly' && recurrenceRule.daysOfWeek) {
      if (!Array.isArray(recurrenceRule.daysOfWeek) || 
          !recurrenceRule.daysOfWeek.every(day => Number.isInteger(day) && day >= 0 && day <= 6)) {
        result.isValid = false;
        result.errors.push('daysOfWeek must be an array of integers 0-6');
      }
    }

    // Validate monthly rules
    if (recurrenceRule.frequency === 'monthly' && recurrenceRule.dayOfMonth) {
      const dayOfMonth = recurrenceRule.dayOfMonth;
      if (!Number.isInteger(dayOfMonth) || (dayOfMonth < 1 || dayOfMonth > 31) && dayOfMonth !== -1) {
        result.isValid = false;
        result.errors.push('dayOfMonth must be an integer 1-31 or -1 for last day');
      }
    }

    return result;
  }

  /**
   * Expand a recurrence pattern to generate a list of dates
   * @param {Object} template - The task template with recurrence rules
   * @param {Object} dateRange - Object with start and end dates
   * @returns {string[]} - Array of date strings in YYYY-MM-DD format
   */
  expandRecurrencePattern(template, dateRange) {
    const occurrences = this.getOccurrencesInRange(template, dateRange.start, dateRange.end);
    return occurrences.map(date => this.formatDate(date));
  }

  /**
   * Daily recurrence pattern processing
   * @private
   */
  shouldGenerateDaily(recurrenceRule, targetDate) {
    const interval = recurrenceRule.interval || 1;
    
    if (interval === 1) {
      return true; // Every day
    }
    
    // Calculate days since start date for interval checking
    const startDate = recurrenceRule.startDate ? new Date(recurrenceRule.startDate) : new Date();
    const daysDiff = Math.floor((targetDate - startDate) / (1000 * 60 * 60 * 24));
    
    return daysDiff >= 0 && (daysDiff % interval) === 0;
  }

  /**
   * Weekly recurrence pattern processing
   * @private
   */
  shouldGenerateWeekly(recurrenceRule, targetDate) {
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysOfWeek = recurrenceRule.daysOfWeek || [];
    
    if (daysOfWeek.length === 0) {
      return false; // No days specified
    }
    
    if (!daysOfWeek.includes(dayOfWeek)) {
      return false; // Not on specified day of week
    }
    
    const interval = recurrenceRule.interval || 1;
    if (interval === 1) {
      return true; // Every week
    }
    
    // Calculate weeks since start date for interval checking
    const startDate = recurrenceRule.startDate ? new Date(recurrenceRule.startDate) : new Date();
    const weeksDiff = Math.floor((targetDate - startDate) / (1000 * 60 * 60 * 24 * 7));
    
    return weeksDiff >= 0 && (weeksDiff % interval) === 0;
  }

  /**
   * Monthly recurrence pattern processing
   * @private
   */
  shouldGenerateMonthly(recurrenceRule, targetDate) {
    const interval = recurrenceRule.interval || 1;
    
    // Check day of month
    if (recurrenceRule.dayOfMonth) {
      const targetDayOfMonth = targetDate.getDate();
      
      if (recurrenceRule.dayOfMonth === -1) {
        // Last day of month
        const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
        if (targetDayOfMonth !== lastDayOfMonth) {
          return false;
        }
      } else if (recurrenceRule.dayOfMonth !== targetDayOfMonth) {
        return false;
      }
    }
    
    // Check interval
    if (interval === 1) {
      return true;
    }
    
    const startDate = recurrenceRule.startDate ? new Date(recurrenceRule.startDate) : new Date();
    const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 + 
                      (targetDate.getMonth() - startDate.getMonth());
    
    return monthsDiff >= 0 && (monthsDiff % interval) === 0;
  }

  /**
   * Yearly recurrence pattern processing
   * @private
   */
  shouldGenerateYearly(recurrenceRule, targetDate) {
    const targetMonth = targetDate.getMonth() + 1; // JavaScript months are 0-indexed
    const targetDay = targetDate.getDate();
    
    // Check month and day
    if (recurrenceRule.month && recurrenceRule.month !== targetMonth) {
      return false;
    }
    
    if (recurrenceRule.dayOfMonth && recurrenceRule.dayOfMonth !== targetDay) {
      return false;
    }
    
    const interval = recurrenceRule.interval || 1;
    if (interval === 1) {
      return true;
    }
    
    const startDate = recurrenceRule.startDate ? new Date(recurrenceRule.startDate) : new Date();
    const yearsDiff = targetDate.getFullYear() - startDate.getFullYear();
    
    return yearsDiff >= 0 && (yearsDiff % interval) === 0;
  }

  /**
   * Custom recurrence pattern processing
   * @private
   */
  shouldGenerateCustom(recurrenceRule, targetDate) {
    // Custom recurrence allows for complex patterns
    // This supports various custom patterns and can be extended
    
    if (recurrenceRule.customPattern) {
      const pattern = recurrenceRule.customPattern;
      
      // Simple custom patterns
      if (pattern.type === 'weekdays') {
        const dayOfWeek = targetDate.getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
      }
      
      if (pattern.type === 'weekends') {
        const dayOfWeek = targetDate.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // Saturday and Sunday
      }
      
      if (pattern.type === 'nth_weekday') {
        // e.g., "2nd Tuesday of every month"
        const dayOfWeek = targetDate.getDay();
        const nthWeek = Math.ceil(targetDate.getDate() / 7);
        
        return pattern.dayOfWeek === dayOfWeek && pattern.nthWeek === nthWeek;
      }

      if (pattern.type === 'last_weekday') {
        // e.g., "Last Friday of every month"
        const dayOfWeek = targetDate.getDay();
        if (pattern.dayOfWeek !== dayOfWeek) {
          return false;
        }
        
        // Check if this is the last occurrence of this weekday in the month
        const nextWeek = new Date(targetDate);
        nextWeek.setDate(targetDate.getDate() + 7);
        return nextWeek.getMonth() !== targetDate.getMonth();
      }

      if (pattern.type === 'business_days') {
        // Business days excluding holidays (basic implementation)
        const dayOfWeek = targetDate.getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
      }
    }
    
    return false;
  }

  /**
   * Check if date is within recurrence date range
   * @private
   */
  isWithinRecurrenceDateRange(recurrenceRule, targetDate) {
    if (recurrenceRule.startDate) {
      const startDate = new Date(recurrenceRule.startDate);
      if (targetDate < startDate) {
        return false;
      }
    }
    
    if (recurrenceRule.endDate) {
      const endDate = new Date(recurrenceRule.endDate);
      if (targetDate > endDate) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if within occurrence limits
   * @private
   */
  isWithinOccurrenceLimits(recurrenceRule, templateId, targetDate) {
    if (!recurrenceRule.endAfterOccurrences) {
      return true; // No occurrence limit
    }
    
    // TODO: This would require counting existing instances for the template
    // For now, we'll return true and implement counting logic when needed
    // In a production system, you'd query the database for instance count
    
    return true;
  }

  /**
   * Get date range as array of Date objects
   * @param {string|Date} startDate - Start date
   * @param {string|Date} endDate - End date
   * @returns {Date[]} - Array of Date objects
   */
  getDateRange(startDate, endDate) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  /**
   * Get date range as array of date strings
   * @param {string|Date} startDate - Start date
   * @param {string|Date} endDate - End date
   * @returns {string[]} - Array of date strings in YYYY-MM-DD format
   */
  getDateRangeArray(startDate, endDate) {
    const dates = this.getDateRange(startDate, endDate);
    return dates.map(date => this.formatDate(date));
  }

  /**
   * Format date as YYYY-MM-DD string
   * @private
   */
  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Calculate the next valid business day (Monday-Friday)
   * @param {Date} date - Starting date
   * @returns {Date} - Next business day
   */
  getNextBusinessDay(date) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Skip weekends
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    return nextDay;
  }

  /**
   * Check if a date falls on a weekend
   * @param {Date} date - Date to check
   * @returns {boolean} - True if weekend
   */
  isWeekend(date) {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Saturday or Sunday
  }

  /**
   * Check if a date is a leap year
   * @param {number} year - Year to check
   * @returns {boolean} - True if leap year
   */
  isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  /**
   * Get the last day of a month, handling leap years
   * @param {number} year - Year
   * @param {number} month - Month (0-indexed)
   * @returns {number} - Last day of the month
   */
  getLastDayOfMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }
}
