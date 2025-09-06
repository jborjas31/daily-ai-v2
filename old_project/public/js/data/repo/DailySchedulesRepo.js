// DailySchedulesRepo — Phase 9 implementation (read/write)
// Provides Firestore-backed operations for per-day schedule overrides.

import { db } from '../../firebase.js';
import { paths } from '../shared/PathBuilder.js';

export class DailySchedulesRepo {
  /**
   * Get a daily schedule override or null
   * @param {string} uid
   * @param {string} date - YYYY-MM-DD
   * @returns {Promise<object|null>}
   */
  async getForDate(uid, date) {
    const docRef = db.doc(paths.scheduleDoc(uid, date));
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return { date, ...snap.data() };
  }

  /**
   * Save a daily schedule override
   * @param {string} uid
   * @param {string} date - YYYY-MM-DD
   * @param {object} data - { wakeTime, sleepTime }
   * @returns {Promise<object>} Saved schedule with date and lastUpdated
   */
  async save(uid, date, data) {
    const docRef = db.doc(paths.scheduleDoc(uid, date));
    const schedule = {
      wakeTime: data.wakeTime,
      sleepTime: data.sleepTime,
      lastUpdated: new Date().toISOString(),
    };
    await docRef.set(schedule);
    return { date, ...schedule };
  }

  /**
   * Delete a daily schedule override
   * @param {string} uid
   * @param {string} date - YYYY-MM-DD
   * @returns {Promise<void>}
   */
  async delete(uid, date) {
    const docRef = db.doc(paths.scheduleDoc(uid, date));
    await docRef.delete();
  }
}

export default DailySchedulesRepo;
