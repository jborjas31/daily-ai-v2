/**
 * AutosaveDraft
 * Debounced localStorage autosave for Task Modal V2 drafts.
 */
export class AutosaveDraft {
  constructor({ key = null, delayMs = 600 } = {}) {
    this.key = key;
    this.delayMs = delayMs;
    this._timer = null;
    this._lastSavedJson = null;
  }

  setKey(key) {
    this.key = key;
  }

  load() {
    if (!this.key) return null;
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  update(model) {
    if (!this.key) return;
    const json = this._safeStringify(model);
    if (json === this._lastSavedJson) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this._save(json), this.delayMs);
  }

  clear() {
    if (!this.key) return;
    try { localStorage.removeItem(this.key); } catch (_) {}
    this._lastSavedJson = null;
  }

  _save(json) {
    try {
      localStorage.setItem(this.key, json);
      this._lastSavedJson = json;
    } catch (_) {
      // Ignore storage errors (quota, etc.)
    }
  }

  _safeStringify(obj) {
    try { return JSON.stringify(obj); } catch (_) { return null; }
  }
}

