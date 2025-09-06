// TaskTemplatesRepo — Phase 4 helpers + skeleton
// Adds read-side helpers (mapping and query building). Methods still throw until later phases.

const notImplemented = (method) => {
  throw new Error(`NotImplementedError: TaskTemplatesRepo.${method}`);
};

import { db, auth } from '../../firebase.js';
import { paths } from '../shared/PathBuilder.js';
import { FirestoreQueryBuilder } from '../shared/FirestoreQueryBuilder.js';
import { templateFromDoc, templateToDTO, stampCreate, stampUpdate } from '../shared/Mapping.js';

export class TaskTemplatesRepo {
  // Helper: build Firestore query with current filters and ordering
  /**
   * Build a Firestore query for user templates with filters and ordering
   * @param {import('firebase').firestore.Firestore} db - Firestore instance
   * @param {string} uid - User id
   * @param {object} options - includeInactive, filters, orderBy, orderDirection, limit, startAfter
   * @returns {import('firebase').firestore.Query}
   */
  buildTemplateQuery(db, uid, options = {}) {
    const {
      includeInactive = false,
      filters = {},
      orderBy = 'priority',
      orderDirection = 'desc',
      limit = null,
      startAfter = null,
    } = options || {};

    const colRef = db.collection(paths.userTasks(uid));
    const qb = new FirestoreQueryBuilder(colRef);

    if (!includeInactive) {
      qb.where('isActive', '==', true);
    }
    if (filters.timeWindow) qb.where('timeWindow', '==', filters.timeWindow);
    if (typeof filters.isMandatory === 'boolean') qb.where('isMandatory', '==', filters.isMandatory);
    if (filters.schedulingType) qb.where('schedulingType', '==', filters.schedulingType);
    if (filters.priority) qb.where('priority', '==', filters.priority);

    qb.orderBy(orderBy, orderDirection);
    if (orderBy !== 'taskName') qb.orderBy('taskName', 'asc');
    if (startAfter) qb.startAfter(startAfter);
    if (limit) qb.limit(limit);

    return qb.build();
  }

  // Reads
  /**
   * List templates for a user with optional filters
   * @param {string} uid
   * @param {object} options
   * @returns {Promise<Array<object>>}
   */
  async getAll(uid, options = {}) {
    const query = this.buildTemplateQuery(db, uid, options);
    const snapshot = await query.get();
    const results = [];
    snapshot.forEach((doc) => results.push(templateFromDoc(doc)));
    return results;
  }

  /**
   * Get a single template by id (current user)
   * @param {string} id
   * @returns {Promise<object>}
   */
  async get(id) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const docRef = db.collection(paths.userTasks(user.uid)).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error(`Task template not found: ${id}`);
    return templateFromDoc(doc);
  }

  /**
   * Client-side search of templates by name/description
   * @param {string} uid
   * @param {string} query
   * @param {object} options
   * @returns {Promise<Array<object>>}
   */
  async search(uid, query, options = {}) {
    // Firestore lacks text search; fetch then filter client-side
    const all = await this.getAll(uid, options);
    const q = (query || '').toLowerCase().trim();
    return all.filter((t) =>
      (t.taskName && t.taskName.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  }

  /**
   * Filtered list with pagination metadata
   * @param {string} uid
   * @param {object} filters
   * @param {object} pagination { limit, startAfter }
   * @returns {Promise<{templates: object[], hasMore: boolean, lastDoc: any, total: number}>}
   */
  async getByFilters(uid, filters = {}, pagination = {}) {
    const { limit = 50, startAfter = null } = pagination || {};
    const query = this.buildTemplateQuery(db, uid, {
      includeInactive: false,
      filters,
      orderBy: 'createdAt',
      orderDirection: 'desc',
      limit,
      startAfter,
    });
    const snapshot = await query.get();
    const templates = [];
    let lastDoc = null;
    snapshot.forEach((doc) => {
      templates.push(templateFromDoc(doc));
      lastDoc = doc;
    });
    return {
      templates,
      hasMore: snapshot.size === limit,
      lastDoc,
      total: snapshot.size,
    };
  }

  // Writes
  /**
   * Create a new template
   * @param {string} uid
   * @param {object} data
   * @returns {Promise<object>} Created template with id
   */
  async create(uid, data) {
    const colRef = db.collection(paths.userTasks(uid));
    const dto = stampCreate(templateToDTO(data));
    const docRef = await colRef.add(dto);
    return { id: docRef.id, ...dto };
  }

  /**
   * Update an existing template
   * @param {string} id
   * @param {object} updates
   * @returns {Promise<object>} Updated template
   */
  async update(id, updates) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const docRef = db.collection(paths.userTasks(user.uid)).doc(id);
    const updateData = stampUpdate(templateToDTO(updates));
    await docRef.update(updateData);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error(`Task template not found after update: ${id}`);
    return templateFromDoc(doc);
  }

  /**
   * Soft delete a template (isActive=false)
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const docRef = db.collection(paths.userTasks(user.uid)).doc(id);
    const now = new Date().toISOString();
    await docRef.update({ isActive: false, deletedAt: now, updatedAt: now });
  }

  /**
   * Permanently delete a template
   * @param {string} id
   * @returns {Promise<void>}
   */
  async permanentDelete(id) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const docRef = db.collection(paths.userTasks(user.uid)).doc(id);
    await docRef.delete();
  }

  // Batch
  /**
   * Batch update many templates
   * @param {string[]} ids
   * @param {object} updates
   * @returns {Promise<{updatedCount:number, updates:object}>}
   */
  async batchUpdate(ids = [], updates = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const batch = db.batch();
    const data = stampUpdate(templateToDTO(updates));
    ids.forEach((id) => {
      const ref = db.collection(paths.userTasks(user.uid)).doc(id);
      batch.update(ref, data);
    });
    await batch.commit();
    return { updatedCount: ids.length, updates: data };
  }

  /**
   * Batch activate templates
   * @param {string[]} ids
   */
  async batchActivate(ids = []) {
    return await this.batchUpdate(ids, { isActive: true, deletedAt: null });
  }

  /**
   * Batch deactivate templates
   * @param {string[]} ids
   */
  async batchDeactivate(ids = []) {
    return await this.batchUpdate(ids, { isActive: false, deactivatedAt: new Date().toISOString() });
  }

  /**
   * Batch create templates
   * @param {string} uid
   * @param {object[]} templatesData
   * @returns {Promise<object[]>}
   */
  async batchCreate(uid, templatesData = []) {
    const batch = db.batch();
    const created = [];
    const colRef = db.collection(paths.userTasks(uid));
    templatesData.forEach((t) => {
      const ref = colRef.doc();
      const dto = stampCreate(templateToDTO(t));
      batch.set(ref, dto);
      created.push({ id: ref.id, ...dto });
    });
    await batch.commit();
    return created;
  }

  // Utilities
  /**
   * Compute statistics for user's templates
   * @param {string} uid
   * @returns {Promise<object>}
   */
  async getStats(uid) { notImplemented('getStats'); }

  /**
   * Export templates within repo abstraction
   * @param {string} uid
   * @param {boolean} includeInactive
   * @returns {Promise<{exportedAt:string,userId:string,templateCount:number,includeInactive:boolean,templates:object[]}>}
   */
  async exportTemplates(uid, includeInactive = false) {
    const templates = await this.getAll(uid, { includeInactive });
    return {
      exportedAt: new Date().toISOString(),
      userId: uid,
      templateCount: templates.length,
      includeInactive,
      templates,
    };
  }

  /**
   * Import templates with duplicate handling
   * @param {string} uid
   * @param {object} importData
   * @param {object} options
   * @returns {Promise<{importedCount:number,skippedCount:number,total:number}>}
   */
  async importTemplates(uid, importData, options = {}) {
    const { overwriteExisting = false, skipDuplicates = true } = options || {};
    if (!importData?.templates || !Array.isArray(importData.templates)) {
      throw new Error('Invalid import data: templates array is required');
    }
    let importedCount = 0;
    let skippedCount = 0;

    const existing = skipDuplicates ? await this.getAll(uid, { includeInactive: true }) : [];
    const existingNames = new Set(existing.map((t) => (t.taskName || '').trim()));

    const toImport = [];
    for (const t of importData.templates) {
      const name = (t.taskName || '').trim();
      if (skipDuplicates && existingNames.has(name)) { skippedCount++; continue; }
      const dto = templateToDTO(t);
      delete dto.createdAt; delete dto.updatedAt; // ensure fresh timestamps
      toImport.push(dto);
      importedCount++;
    }
    if (toImport.length > 0) {
      await this.batchCreate(uid, toImport);
    }
    return { importedCount, skippedCount, total: importData.templates.length };
  }
}

export default TaskTemplatesRepo;
