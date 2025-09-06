// Mapping helpers (Phase 1 stub)

export function timestampToISO(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate().toISOString() : ts;
}

export function stampCreate(domain) {
  const now = new Date().toISOString();
  return { ...domain, createdAt: now, updatedAt: now };
}

export function stampUpdate(updates) {
  const now = new Date().toISOString();
  const { id, createdAt, ...rest } = updates || {};
  return { ...rest, updatedAt: now };
}

// Templates: mapping helpers
export function templateToDTO(domain) {
  if (!domain || typeof domain !== 'object') return {};
  const { id, ...rest } = domain;
  // Do not carry timestamp fields here; callers can stamp via stampCreate/stampUpdate
  return { ...rest };
}

export function templateFromDoc(doc) {
  const data = doc?.data ? doc.data() : doc;
  if (!data) return null;
  const id = doc?.id || data.id || null;
  return {
    id,
    ...data,
    createdAt: data.createdAt ? timestampToISO(data.createdAt) : data.createdAt ?? null,
    updatedAt: data.updatedAt ? timestampToISO(data.updatedAt) : data.updatedAt ?? null,
    deletedAt: data.deletedAt ? timestampToISO(data.deletedAt) : data.deletedAt ?? null,
    deactivatedAt: data.deactivatedAt ? timestampToISO(data.deactivatedAt) : data.deactivatedAt ?? null,
  };
}

// Instances: mapping helpers
export function instanceToDTO(domain) {
  if (!domain || typeof domain !== 'object') return {};
  const { id, ...rest } = domain;
  return { ...rest };
}

export function instanceFromDoc(doc) {
  const data = doc?.data ? doc.data() : doc;
  if (!data) return null;
  const id = doc?.id || data.id || null;
  return {
    id,
    ...data,
    createdAt: data.createdAt ? timestampToISO(data.createdAt) : data.createdAt ?? null,
    updatedAt: data.updatedAt ? timestampToISO(data.updatedAt) : data.updatedAt ?? null,
    modifiedAt: data.modifiedAt ? timestampToISO(data.modifiedAt) : data.modifiedAt ?? null,
    completedAt: data.completedAt ? timestampToISO(data.completedAt) : data.completedAt ?? null,
    deletedAt: data.deletedAt ? timestampToISO(data.deletedAt) : data.deletedAt ?? null,
  };
}

export default { timestampToISO, stampCreate, stampUpdate };
