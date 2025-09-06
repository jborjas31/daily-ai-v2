/**
 * KeyboardShortcuts
 * Handles modal-specific keyboard shortcuts:
 * - Cmd/Ctrl+S → submit
 * Optionally could include Esc, but container already handles Esc.
 */
export class KeyboardShortcuts {
  constructor(container, { scopeEl = document } = {}) {
    this.container = container;
    this.scopeEl = scopeEl;
    this._handler = this._onKeyDown.bind(this);
    this._active = false;
  }

  activate() {
    if (this._active) return;
    document.addEventListener('keydown', this._handler, true);
    this._active = true;
  }

  deactivate() {
    if (!this._active) return;
    document.removeEventListener('keydown', this._handler, true);
    this._active = false;
  }

  _onKeyDown(e) {
    // Ignore if outside scope element
    if (this.scopeEl && !this.scopeEl.isConnected) return;

    const isCtrlS = (e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey);
    if (isCtrlS) {
      e.preventDefault();
      e.stopPropagation();
      try { this.container?.requestSubmit(); } catch (_) {}
      return;
    }
  }
}

