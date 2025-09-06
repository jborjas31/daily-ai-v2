/**
 * FocusTrap
 * Keeps keyboard focus within a container (e.g., modal dialog) and
 * hides background content from screen readers while active.
 */
export class FocusTrap {
  constructor(containerEl, { overlayEl = null } = {}) {
    this.containerEl = containerEl;
    this.overlayEl = overlayEl;
    this._keydownHandler = this._onKeyDown.bind(this);
    this._hiddenSiblings = [];
    this._active = false;
  }

  activate() {
    if (!this.containerEl || this._active) return;
    this._active = true;

    // Hide background from screen readers by setting aria-hidden on body children except overlay
    try {
      const children = Array.from(document.body.children);
      children.forEach(el => {
        if (el === this.overlayEl) return;
        const prev = el.getAttribute('aria-hidden');
        this._hiddenSiblings.push({ el, prev });
        el.setAttribute('aria-hidden', 'true');
      });
    } catch (_) {}

    // Add keydown handler to cycle focus within container
    document.addEventListener('keydown', this._keydownHandler, true);

    // Ensure something inside is focused
    this._focusInitial();
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;

    // Restore aria-hidden on siblings
    try {
      this._hiddenSiblings.forEach(({ el, prev }) => {
        if (prev === null) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', prev);
      });
    } catch (_) {}
    this._hiddenSiblings = [];

    document.removeEventListener('keydown', this._keydownHandler, true);
  }

  _focusables() {
    if (!this.containerEl) return [];
    const selectors = [
      'a[href]',
      'area[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'button:not([disabled])',
      'iframe',
      'audio[controls]',
      'video[controls]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ];
    const nodes = Array.from(this.containerEl.querySelectorAll(selectors.join(',')));
    return nodes.filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  _onKeyDown(e) {
    if (e.key !== 'Tab') return;
    const focusables = this._focusables();
    if (focusables.length === 0) {
      // keep focus on dialog container
      e.preventDefault();
      this.containerEl.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      if (active === first || !this.containerEl.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  _focusInitial() {
    const focusables = this._focusables();
    if (focusables.length > 0) {
      // Focus the first meaningful control
      focusables[0].focus();
    } else {
      // Focus the container as last resort
      this.containerEl.tabIndex = -1;
      this.containerEl.focus();
    }
  }
}

