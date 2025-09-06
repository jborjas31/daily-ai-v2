/**
 * DirtyStateGuard
 * Tracks whether a form model has diverged from its baseline.
 * Emits change via callback and optional CustomEvent when state toggles.
 */
export class DirtyStateGuard {
  constructor({ baseline = {}, onChange = null, eventTarget = window } = {}) {
    this._baseline = this._clone(baseline);
    this._current = this._clone(baseline);
    this._isDirty = false;
    this._onChange = typeof onChange === 'function' ? onChange : null;
    this._eventTarget = eventTarget || window;
  }

  setBaseline(model) {
    this._baseline = this._clone(model || {});
    this._recompute();
  }

  setCurrent(model) {
    this._current = this._clone(model || {});
    this._recompute();
  }

  isDirty() {
    return this._isDirty;
  }

  _recompute() {
    const dirty = !this._deepEqual(this._baseline, this._current);
    if (dirty !== this._isDirty) {
      this._isDirty = dirty;
      try {
        const evt = new CustomEvent('dirty-change', { detail: { isDirty: dirty } });
        this._eventTarget.dispatchEvent(evt);
      } catch (_) {}
      if (this._onChange) {
        try { this._onChange(dirty); } catch (_) {}
      }
    }
  }

  _clone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (_) { return obj; }
  }

  _deepEqual(a, b) {
    if (a === b) return true;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (!this._deepEqual(a[i], b[i])) return false;
        }
        return true;
      }
      const aKeys = Object.keys(a).sort();
      const bKeys = Object.keys(b).sort();
      if (aKeys.length !== bKeys.length) return false;
      for (let i = 0; i < aKeys.length; i++) {
        const k = aKeys[i];
        if (k !== bKeys[i]) return false;
        if (!this._deepEqual(a[k], b[k])) return false;
      }
      return true;
    }
    // Handle null vs undefined differences explicitly
    if ((a == null && b == null)) return true;
    return false;
  }
}

