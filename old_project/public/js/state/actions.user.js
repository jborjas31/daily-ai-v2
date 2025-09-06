/**
 * actions.user.js
 * User and settings actions extracted from state.js (ST-08).
 */

import { appState, notifyStateChange } from './Store.js';
import { userSettingsManager } from '../userSettings.js';

// --- Mutators ---
export function setUser(user) {
  appState.user = user;
  appState.isAuthenticated = !!user;
  notifyStateChange('user', user);
}

export function setSettings(settings) {
  appState.settings = { ...settings };
  appState.lastUpdated = new Date().toISOString();
  notifyStateChange('settings', settings);
}

function setLoading(type, isLoading) {
  appState.loading[type] = isLoading;
  notifyStateChange('loading', { type, isLoading });
}

function getUser() {
  return appState.user;
}

// --- Actions ---
export async function initializeUser() {
  try {
    setLoading('settings', true);
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const settings = await userSettingsManager.initializeUserSettings(user.uid);
    setSettings(settings);
    console.log('✅ User data initialized with comprehensive settings');
  } catch (error) {
    console.error('❌ Error initializing user:', error);
    throw error;
  } finally {
    setLoading('settings', false);
  }
}

export async function loadSettings() {
  try {
    setLoading('settings', true);
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const settings = await userSettingsManager.loadUserSettings(user.uid);
    if (settings) {
      setSettings(settings);
      console.log('✅ Settings loaded with comprehensive settings manager');
    } else {
      console.log('⚠️ No settings found, will use defaults');
    }
  } catch (error) {
    console.error('❌ Error loading settings:', error);
    throw error;
  } finally {
    setLoading('settings', false);
  }
}

export async function saveSettings(newSettings) {
  try {
    setLoading('saving', true);
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const savedSettings = await userSettingsManager.updateSettings(user.uid, newSettings);
    console.log('✅ Settings saved with comprehensive settings manager');
    return savedSettings;
  } catch (error) {
    console.error('❌ Error saving settings:', error);
    throw error;
  } finally {
    setLoading('saving', false);
  }
}

export async function updateSleepSchedule(sleepSchedule) {
  try {
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const updatedSettings = await userSettingsManager.updateSleepSchedule(user.uid, sleepSchedule);
    console.log('✅ Sleep schedule updated');
    return updatedSettings;
  } catch (error) {
    console.error('❌ Error updating sleep schedule:', error);
    throw error;
  }
}

export async function updateTimeWindows(timeWindows) {
  try {
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const updatedSettings = await userSettingsManager.updateTimeWindows(user.uid, timeWindows);
    console.log('✅ Time windows updated');
    return updatedSettings;
  } catch (error) {
    console.error('❌ Error updating time windows:', error);
    throw error;
  }
}

export async function updatePreferences(preferences) {
  try {
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const updatedSettings = await userSettingsManager.updatePreferences(user.uid, preferences);
    console.log('✅ Preferences updated');
    return updatedSettings;
  } catch (error) {
    console.error('❌ Error updating preferences:', error);
    throw error;
  }
}

export async function resetSettingsToDefaults() {
  try {
    const user = getUser();
    if (!user) throw new Error('No authenticated user');
    const defaultSettings = await userSettingsManager.resetToDefaults(user.uid);
    console.log('✅ Settings reset to defaults');
    return defaultSettings;
  } catch (error) {
    console.error('❌ Error resetting settings:', error);
    throw error;
  }
}

