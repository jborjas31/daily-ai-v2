// UserSettingsRepo — Phase 3 implementation
// Provides Firestore-backed operations for user settings.

import { db } from '../../firebase.js';
import { paths } from '../shared/PathBuilder.js';

const DEFAULT_SETTINGS = Object.freeze({
  desiredSleepDuration: 7.5,
  defaultWakeTime: '06:30',
  defaultSleepTime: '23:00',
});

export class UserSettingsRepo {
  /**
   * Get user settings or defaults if none exist
   * @param {string} uid - Authenticated user id
   * @returns {Promise<object>} Resolves to settings object
   */
  async get(uid) {
    const docRef = db.doc(paths.userDoc(uid));
    const snap = await docRef.get();
    if (snap.exists) {
      return snap.data();
    }
    // match legacy behavior: no timestamps in default get()
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Save (merge) user settings
   * @param {string} uid - Authenticated user id
   * @param {object} settings - Partial settings to merge
   * @returns {Promise<object>} Resolves to saved settings input
   */
  async save(uid, settings) {
    const docRef = db.doc(paths.userDoc(uid));
    await docRef.set(settings, { merge: true });
    return settings;
  }

  /**
   * Initialize default settings for new users
   * @param {string} uid - Authenticated user id
   * @returns {Promise<object>} Resolves to existing or newly created settings
   */
  async initialize(uid) {
    const docRef = db.doc(paths.userDoc(uid));
    const snap = await docRef.get();
    if (!snap.exists) {
      const now = new Date().toISOString();
      const initial = {
        ...DEFAULT_SETTINGS,
        createdAt: now,
        lastUpdated: now,
      };
      await docRef.set(initial);
      return initial;
    }
    return snap.data();
  }
}

export default UserSettingsRepo;
