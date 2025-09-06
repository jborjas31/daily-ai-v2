// TaskInstancesRepo — Phase 7 (read paths implemented)
// Implements read operations for task instances; writes remain for later phases.

import { db, auth } from '../../firebase.js';
import { paths } from '../shared/PathBuilder.js';

export class TaskInstancesRepo {
  // Reads
  /**
   * Get instance by id (current user)
   * @param {string} id
   * @returns {Promise<object>}
   */
  async get(id) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const doc = await db.collection(paths.taskInstances(user.uid)).doc(id).get();
    if (!doc.exists) throw new Error(`Task instance not found: ${id}`);
    return { id: doc.id, ...doc.data() };
  }

  /**
   * List instances for a specific date
   * @param {string} date - YYYY-MM-DD
   * @param {object} options - { status, templateId, orderBy, orderDirection }
   * @returns {Promise<object[]>}
   */
  async getForDate(date, options = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const {
      status = null,
      templateId = null,
      orderBy = 'createdAt',
      orderDirection = 'asc',
    } = options || {};

    let query = db
      .collection(paths.taskInstances(user.uid))
      .where('date', '==', date);

    if (status) query = query.where('status', '==', status);
    if (templateId) query = query.where('templateId', '==', templateId);

    query = query.orderBy(orderBy, orderDirection);
    const snapshot = await query.get();
    const instances = [];
    snapshot.forEach((d) => instances.push({ id: d.id, ...d.data() }));
    return instances;
  }

  /**
   * List instances for a date range
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @param {object} options - { status, templateId, orderBy, orderDirection, limit }
   * @returns {Promise<object[]>}
   */
  async getForDateRange(startDate, endDate, options = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const {
      status = null,
      templateId = null,
      orderBy = 'date',
      orderDirection = 'asc',
      limit = null,
    } = options || {};

    let query = db
      .collection(paths.taskInstances(user.uid))
      .where('date', '>=', startDate)
      .where('date', '<=', endDate);

    if (status) query = query.where('status', '==', status);
    if (templateId) query = query.where('templateId', '==', templateId);

    query = query.orderBy(orderBy, orderDirection);
    if (orderBy !== 'createdAt') query = query.orderBy('createdAt');
    if (limit) query = query.limit(limit);

    const snapshot = await query.get();
    const instances = [];
    snapshot.forEach((d) => instances.push({ id: d.id, ...d.data() }));
    return instances;
  }

  /**
   * List instances by template across dates
   * @param {string} templateId
   * @param {object} options - { startDate, endDate, status, limit, orderBy, orderDirection }
   * @returns {Promise<object[]>}
   */
  async getByTemplateId(templateId, options = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const {
      startDate = null,
      endDate = null,
      status = null,
      limit = null,
      orderBy = 'date',
      orderDirection = 'desc',
    } = options || {};

    let query = db
      .collection(paths.taskInstances(user.uid))
      .where('templateId', '==', templateId);

    if (startDate) query = query.where('date', '>=', startDate);
    if (endDate) query = query.where('date', '<=', endDate);
    if (status) query = query.where('status', '==', status);

    query = query.orderBy(orderBy, orderDirection);
    if (limit) query = query.limit(limit);

    const snapshot = await query.get();
    const instances = [];
    snapshot.forEach((d) => instances.push({ id: d.id, ...d.data() }));
    return instances;
  }

  // Writes
  /**
   * Create a task instance
   * @param {object} data
   * @returns {Promise<object>} Created instance with id
   */
  async create(data) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const colRef = db.collection(paths.taskInstances(user.uid));
    const now = new Date().toISOString();
    const instance = {
      templateId: data.templateId,
      date: data.date,
      status: data.status || 'pending',
      modifiedStartTime: data.modifiedStartTime ?? null,
      modifiedDuration: data.modifiedDuration ?? null,
      modifiedPriority: data.modifiedPriority ?? null,
      completedAt: data.completedAt ?? null,
      actualDuration: data.actualDuration ?? null,
      skippedReason: data.skippedReason ?? null,
      postponedToDate: data.postponedToDate ?? null,
      modificationReason: data.modificationReason ?? null,
      modifiedAt: data.modifiedAt ?? null,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await colRef.add(instance);
    return { id: docRef.id, ...instance };
  }

  /**
   * Update an instance
   * @param {string} id
   * @param {object} updates
   * @returns {Promise<object>} Updated instance
   */
  async update(id, updates) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const ref = db.collection(paths.taskInstances(user.uid)).doc(id);
    const now = new Date().toISOString();
    const { id: _id, createdAt, ...rest } = updates || {};
    const updateData = { ...rest, modifiedAt: now, updatedAt: now };
    await ref.update(updateData);
    const doc = await ref.get();
    if (!doc.exists) throw new Error(`Task instance not found after update: ${id}`);
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Delete an instance (hard delete)
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    await db.collection(paths.taskInstances(user.uid)).doc(id).delete();
  }

  // Batch
  /**
   * Batch update instances
   * @param {string[]} ids
   * @param {object} updates
   * @returns {Promise<{updatedCount:number, updates:object}>}
   */
  async batchUpdate(ids = [], updates = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const batch = db.batch();
    const now = new Date().toISOString();
    const data = { ...updates, modifiedAt: now, updatedAt: now };
    ids.forEach((id) => {
      const ref = db.collection(paths.taskInstances(user.uid)).doc(id);
      batch.update(ref, data);
    });
    await batch.commit();
    return { updatedCount: ids.length, updates: data };
  }

  /**
   * Batch create instances
   * @param {object[]} instancesData
   * @returns {Promise<object[]>}
   */
  async batchCreate(instancesData = []) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const batch = db.batch();
    const created = [];
    const now = new Date().toISOString();
    const colRef = db.collection(paths.taskInstances(user.uid));
    instancesData.forEach((input) => {
      const ref = colRef.doc();
      const instance = {
        templateId: input.templateId,
        date: input.date,
        status: input.status || 'pending',
        modifiedStartTime: input.modifiedStartTime ?? null,
        modifiedDuration: input.modifiedDuration ?? null,
        completedAt: input.completedAt ?? null,
        skippedReason: input.skippedReason ?? null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(ref, instance);
      created.push({ id: ref.id, ...instance });
    });
    await batch.commit();
    return created;
  }

  /**
   * Batch delete instances
   * @param {string[]} ids
   * @returns {Promise<{deletedCount:number}>}
   */
  async batchDelete(ids = []) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const batch = db.batch();
    ids.forEach((id) => {
      const ref = db.collection(paths.taskInstances(user.uid)).doc(id);
      batch.delete(ref);
    });
    await batch.commit();
    return { deletedCount: ids.length };
  }

  // Maintenance / Import-Export
  /**
   * Cleanup instances older than retention window
   * @param {number} retentionDays
   * @returns {Promise<{deletedCount:number, cutoffDate:string}>}
   */
  async cleanupOldInstances(retentionDays = 365) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffDate = cutoff.toISOString().split('T')[0];
    const snap = await db
      .collection(paths.taskInstances(user.uid))
      .where('date', '<', cutoffDate)
      .get();
    if (snap.empty) return { deletedCount: 0 };
    const ids = [];
    snap.forEach((d) => ids.push(d.id));
    let totalDeleted = 0;
    const batchSize = 500;
    for (let i = 0; i < ids.length; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize);
      const res = await this.batchDelete(chunk);
      totalDeleted += res.deletedCount;
    }
    return { deletedCount: totalDeleted, cutoffDate };
  }

  /**
   * Export instances in a date range
   * @param {string} startDate
   * @param {string} endDate
   * @param {object} options - { includeCompleted, includeSkipped }
   * @returns {Promise<{exportedAt:string,dateRange:{startDate:string,endDate:string},instanceCount:number,filters:object,instances:object[]}>}
   */
  async exportInstances(startDate, endDate, options = {}) {
    const { includeCompleted = true, includeSkipped = false } = options || {};
    let instances = await this.getForDateRange(startDate, endDate);
    if (!includeCompleted) instances = instances.filter((i) => i.status !== 'completed');
    if (!includeSkipped) instances = instances.filter((i) => i.status !== 'skipped');
    return {
      exportedAt: new Date().toISOString(),
      dateRange: { startDate, endDate },
      instanceCount: instances.length,
      filters: { includeCompleted, includeSkipped },
      instances,
    };
  }

  /**
   * Import instances with duplicate handling
   * @param {object} importData - { dateRange, instances }
   * @param {object} options - { overwriteExisting }
   * @returns {Promise<{importedCount:number, skippedCount:number, total:number}>}
   */
  async importInstances(importData, options = {}) {
    const { overwriteExisting = false } = options || {};
    if (!importData?.instances || !Array.isArray(importData.instances)) {
      throw new Error('Invalid import data: instances array is required');
    }
    let importedCount = 0;
    let skippedCount = 0;
    const start = importData.dateRange?.startDate;
    const end = importData.dateRange?.endDate;
    const existing = overwriteExisting ? [] : await this.getForDateRange(start, end);
    const existingMap = new Map();
    existing.forEach((inst) => existingMap.set(`${inst.templateId}-${inst.date}`, true));
    const toCreate = [];
    for (const inst of importData.instances) {
      const key = `${inst.templateId}-${inst.date}`;
      if (!overwriteExisting && existingMap.has(key)) { skippedCount++; continue; }
      const copy = { ...inst };
      delete copy.id; delete copy.createdAt; delete copy.updatedAt;
      toCreate.push(copy);
      importedCount++;
    }
    if (toCreate.length > 0) {
      await this.batchCreate(toCreate);
    }
    return { importedCount, skippedCount, total: importData.instances.length };
  }
}

export default TaskInstancesRepo;
