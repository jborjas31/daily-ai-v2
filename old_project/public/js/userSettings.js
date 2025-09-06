/**
 * User Settings Management
 * 
 * Manages user preferences and settings including sleep schedule,
 * notifications, and application preferences.
 */

import { state } from './state.js';
import { db, auth } from './firebase.js';
import { SimpleErrorHandler } from './utils/SimpleErrorHandler.js';

/**
 * Default user settings as specified in blueprint
 */
export const DEFAULT_SETTINGS = {
  // Sleep schedule (7.5h sleep, 6:30 wake, 23:00 sleep)
  desiredSleepDuration: 7.5,
  defaultWakeTime: "06:30",
  defaultSleepTime: "23:00",
  
  // Time windows for flexible task scheduling
  timeWindows: {
    morning: { start: "06:00", end: "12:00" },
    afternoon: { start: "12:00", end: "18:00" }, 
    evening: { start: "18:00", end: "23:00" },
    anytime: { start: "06:00", end: "23:00" }
  },
  
  // Application preferences
  preferences: {
    // Real-time updates
    enableRealTimeUpdates: true,
    updateIntervalSeconds: 30,
    
    // Notifications
    enableNotifications: true,
    notifyOverdueTasks: true,
    notifyUpcomingTasks: true,
    upcomingTaskMinutes: 15,
    
    // UI preferences
    showSeconds: false,
    enableSounds: false,
    enableAnimations: true,
    
    // Task display
    showCompletedTasks: true,
    showSkippedTasks: true,
    defaultTaskDuration: 30,
    defaultMinTaskDuration: 15,
    
    // Scheduling behavior
    enableCrunchTime: true,
    allowTaskRescheduling: true,
    strictMandatoryTasks: true,
    
    // Timezone and DST
    enableDSTAdjustment: false,
    timezoneOffset: 0
  },
  
  // Metadata
  version: "1.0",
  createdAt: null,
  updatedAt: null
};

/**
 * User Settings Manager
 */
export class UserSettingsManager {
  constructor() {
    this.currentUserId = null;
    this.settingsCache = new Map();
  }

  /**
   * Initialize settings for a new user or load existing settings
   */
  async initializeUserSettings(userId) {
    try {
      this.currentUserId = userId;
      console.log('🔧 Initializing user settings for:', userId);
      
      // Try to load existing settings
      const existingSettings = await this.loadUserSettings(userId);
      
      if (existingSettings) {
        console.log('✅ Loaded existing user settings');
        this.updateAppState(existingSettings);
        return existingSettings;
      } else {
        console.log('🆕 Creating default settings for new user');
        const defaultSettings = await this.createDefaultSettings(userId);
        this.updateAppState(defaultSettings);
        return defaultSettings;
      }
      
    } catch (error) {
      console.error('❌ Error initializing user settings:', error);
      SimpleErrorHandler.showError('Failed to load user settings. Using defaults.', error);
      
      // Fall back to in-memory defaults
      this.updateAppState(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Load user settings from Firestore
   */
  async loadUserSettings(userId) {
    try {
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log('📄 User settings loaded from Firestore');
        
        // Merge with defaults to ensure all settings are present
        const settings = this.mergeWithDefaults(userData);
        this.settingsCache.set(userId, settings);
        
        return settings;
      } else {
        console.log('📄 No existing user settings found');
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error loading user settings:', error);
      throw error;
    }
  }

  /**
   * Create and save default settings for a new user
   */
  async createDefaultSettings(userId) {
    try {
      const settings = {
        ...DEFAULT_SETTINGS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const userDocRef = db.collection('users').doc(userId);
      await userDocRef.set({
        ...settings,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Default settings created and saved to Firestore');
      this.settingsCache.set(userId, settings);
      
      return settings;
      
    } catch (error) {
      console.error('❌ Error creating default settings:', error);
      throw error;
    }
  }

  /**
   * Update specific settings
   */
  async updateSettings(userId, settingsUpdate, saveToFirestore = true) {
    try {
      // Get current settings from cache or load from state
      let currentSettings = this.settingsCache.get(userId) || state.getSettings();
      
      // Deep merge the updates
      const updatedSettings = this.deepMerge(currentSettings, settingsUpdate);
      updatedSettings.updatedAt = new Date().toISOString();
      
      // Update app state immediately
      this.updateAppState(updatedSettings);
      
      // Save to Firestore if requested
      if (saveToFirestore) {
        const userDocRef = db.collection('users').doc(userId);
        await userDocRef.update({
          ...updatedSettings,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Settings updated in Firestore');
      }
      
      // Update cache
      this.settingsCache.set(userId, updatedSettings);
      
      return updatedSettings;
      
    } catch (error) {
      console.error('❌ Error updating settings:', error);
      SimpleErrorHandler.showError('Failed to save settings. Changes may not be persistent.', error);
      throw error;
    }
  }

  /**
   * Update sleep schedule settings
   */
  async updateSleepSchedule(userId, sleepSchedule) {
    const update = {
      desiredSleepDuration: sleepSchedule.duration || DEFAULT_SETTINGS.desiredSleepDuration,
      defaultWakeTime: sleepSchedule.wakeTime || DEFAULT_SETTINGS.defaultWakeTime,
      defaultSleepTime: sleepSchedule.sleepTime || DEFAULT_SETTINGS.defaultSleepTime
    };
    
    return await this.updateSettings(userId, update);
  }

  /**
   * Update time window preferences
   */
  async updateTimeWindows(userId, timeWindows) {
    const update = {
      timeWindows: {
        ...DEFAULT_SETTINGS.timeWindows,
        ...timeWindows
      }
    };
    
    return await this.updateSettings(userId, update);
  }

  /**
   * Update application preferences
   */
  async updatePreferences(userId, preferences) {
    const currentSettings = this.settingsCache.get(userId) || state.getSettings();
    const update = {
      preferences: {
        ...currentSettings.preferences,
        ...preferences
      }
    };
    
    return await this.updateSettings(userId, update);
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(userId) {
    try {
      console.log('🔄 Resetting user settings to defaults');
      
      const defaultSettings = {
        ...DEFAULT_SETTINGS,
        createdAt: (this.settingsCache.get(userId) || {}).createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Update Firestore
      const userDocRef = db.collection('users').doc(userId);
      await userDocRef.set({
        ...defaultSettings,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Update app state and cache
      this.updateAppState(defaultSettings);
      this.settingsCache.set(userId, defaultSettings);
      
      console.log('✅ Settings reset to defaults');
      SimpleErrorHandler.showSuccess('Settings have been reset to defaults');
      
      return defaultSettings;
      
    } catch (error) {
      console.error('❌ Error resetting settings:', error);
      SimpleErrorHandler.showError('Failed to reset settings', error);
      throw error;
    }
  }

  /**
   * Get current user settings
   */
  getCurrentSettings(userId = this.currentUserId) {
    if (userId && this.settingsCache.has(userId)) {
      return this.settingsCache.get(userId);
    }
    return state.getSettings();
  }

  /**
   * Validate settings structure
   */
  validateSettings(settings) {
    const errors = [];
    
    // Validate sleep schedule
    if (settings.desiredSleepDuration < 4 || settings.desiredSleepDuration > 12) {
      errors.push('Sleep duration must be between 4 and 12 hours');
    }
    
    // Validate time formats
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(settings.defaultWakeTime)) {
      errors.push('Wake time must be in HH:MM format');
    }
    if (!timeRegex.test(settings.defaultSleepTime)) {
      errors.push('Sleep time must be in HH:MM format');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Merge settings with defaults to ensure all properties exist
   */
  mergeWithDefaults(userSettings) {
    return this.deepMerge(DEFAULT_SETTINGS, userSettings);
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Update application state with new settings
   */
  updateAppState(settings) {
    state.setSettings(settings);
  }

  /**
   * Clear cache for user
   */
  clearCache(userId) {
    this.settingsCache.delete(userId);
  }

  /**
   * Clear all cached settings
   */
  clearAllCache() {
    this.settingsCache.clear();
    this.currentUserId = null;
  }
}

// Create global instance
export const userSettingsManager = new UserSettingsManager();

/**
 * Utility functions for working with settings
 */
export const settingsUtils = {
  /**
   * Calculate sleep window based on settings
   */
  calculateSleepWindow(settings) {
    const sleepTime = settings.defaultSleepTime;
    const wakeTime = settings.defaultWakeTime;
    const duration = settings.desiredSleepDuration;
    
    return {
      sleepTime,
      wakeTime,
      duration,
      actualDuration: this.calculateActualSleepDuration(sleepTime, wakeTime)
    };
  },

  /**
   * Calculate actual sleep duration between sleep and wake times
   */
  calculateActualSleepDuration(sleepTime, wakeTime) {
    const [sleepHour, sleepMin] = sleepTime.split(':').map(Number);
    const [wakeHour, wakeMin] = wakeTime.split(':').map(Number);
    
    const sleepMinutes = sleepHour * 60 + sleepMin;
    const wakeMinutes = wakeHour * 60 + wakeMin;
    
    let duration;
    if (wakeMinutes > sleepMinutes) {
      // Same day
      duration = wakeMinutes - sleepMinutes;
    } else {
      // Next day
      duration = (24 * 60) - sleepMinutes + wakeMinutes;
    }
    
    return duration / 60; // Convert to hours
  },

  /**
   * Check if current time is within sleep window
   */
  isCurrentlyInSleepWindow(settings) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return this.isTimeInSleepWindow(currentTime, settings);
  },

  /**
   * Check if a specific time is within sleep window
   */
  isTimeInSleepWindow(timeString, settings) {
    const sleepTime = settings.defaultSleepTime;
    const wakeTime = settings.defaultWakeTime;
    
    const [checkHour, checkMin] = timeString.split(':').map(Number);
    const [sleepHour, sleepMin] = sleepTime.split(':').map(Number);
    const [wakeHour, wakeMin] = wakeTime.split(':').map(Number);
    
    const checkMinutes = checkHour * 60 + checkMin;
    const sleepMinutes = sleepHour * 60 + sleepMin;
    const wakeMinutes = wakeHour * 60 + wakeMin;
    
    if (sleepMinutes < wakeMinutes) {
      // Sleep window doesn't cross midnight
      return checkMinutes >= sleepMinutes && checkMinutes < wakeMinutes;
    } else {
      // Sleep window crosses midnight
      return checkMinutes >= sleepMinutes || checkMinutes < wakeMinutes;
    }
  },

  /**
   * Get time window for a specific hour
   */
  getTimeWindowForHour(hour, settings) {
    const timeWindows = settings.timeWindows || DEFAULT_SETTINGS.timeWindows;
    
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 23) return 'evening';
    
    return 'anytime';
  }
};

console.log('✅ User Settings management module loaded');