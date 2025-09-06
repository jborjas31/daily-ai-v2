// Lightweight toast notifications
class Toast {
  static ensureContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.container);
    }
  }

  static show(message, { type = 'info', duration = 3000 } = {}) {
    this.ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;

    this.container.appendChild(toast);

    // Auto-dismiss
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fadeOutMs = reduceMotion ? 0 : 200;
    const total = Math.max(1500, duration);

    const timer = setTimeout(() => {
      toast.classList.add('toast--hide');
      setTimeout(() => {
        toast.remove();
      }, fadeOutMs);
    }, total);

    // Click to dismiss early
    toast.addEventListener('click', () => {
      clearTimeout(timer);
      toast.classList.add('toast--hide');
      setTimeout(() => toast.remove(), fadeOutMs);
    });

    return toast;
  }

  static info(msg, opts) { return this.show(msg, { type: 'info', ...(opts || {}) }); }
  static success(msg, opts) { return this.show(msg, { type: 'success', ...(opts || {}) }); }
  static error(msg, opts) { return this.show(msg, { type: 'error', ...(opts || {}) }); }
}

export { Toast };

