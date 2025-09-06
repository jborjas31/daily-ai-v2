/**
 * ConfirmDialog
 * Lightweight, accessible confirmation dialog with focus trap.
 * Usage:
 *   import { ConfirmDialog } from './ConfirmDialog.js';
 *   const ok = await ConfirmDialog.show({
 *     title: 'Delete this task?',
 *     message: 'This action cannot be undone.',
 *     confirmText: 'Delete',
 *     cancelText: 'Cancel',
 *     dangerous: true,
 *     defaultFocus: 'cancel'
 *   });
 */
import { FocusTrap } from '../features/FocusTrap.js';

export class ConfirmDialog {
  static show(options = {}) {
    return new Promise((resolve) => {
      const {
        title = 'Are you sure?',
        message = '',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        dangerous = false,
        defaultFocus = 'cancel', // 'cancel' | 'confirm'
      } = options;

      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      // Overlay
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.setAttribute('role', 'presentation');

      // Dialog
      const dialog = document.createElement('div');
      dialog.className = 'modal confirm-modal';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');

      const titleId = `confirm-title-${Date.now()}`;
      const msgId = `confirm-msg-${Date.now()}`;
      dialog.setAttribute('aria-labelledby', titleId);
      dialog.setAttribute('aria-describedby', msgId);

      // Header
      const header = document.createElement('div');
      header.className = 'modal-header confirm-header';
      const h = document.createElement('h3');
      h.id = titleId;
      h.textContent = title;
      header.appendChild(h);

      // Body
      const body = document.createElement('div');
      body.className = 'modal-body confirm-body';
      const p = document.createElement('p');
      p.className = 'confirm-message';
      p.id = msgId;
      p.textContent = message;
      body.appendChild(p);

      // Footer/actions
      const footer = document.createElement('div');
      footer.className = 'modal-footer confirm-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = cancelText;
      cancelBtn.addEventListener('click', () => close(false));

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = `btn ${dangerous ? 'btn-danger' : 'btn-primary'}`;
      confirmBtn.textContent = confirmText;
      confirmBtn.addEventListener('click', () => close(true));

      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);

      // Assemble
      dialog.appendChild(header);
      dialog.appendChild(body);
      dialog.appendChild(footer);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // Focus trap
      let trap = null;
      try {
        trap = new FocusTrap(dialog, { overlayEl: overlay });
        trap.activate();
      } catch (_) {}

      // Keyboard
      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close(false);
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          close(true);
        }
      };
      document.addEventListener('keydown', keyHandler, true);

      // Click outside to cancel
      const outsideHandler = (e) => {
        if (e.target === overlay) close(false);
      };
      overlay.addEventListener('click', outsideHandler);

      // Initial focus (safe by default)
      setTimeout(() => {
        try {
          (defaultFocus === 'confirm' ? confirmBtn : cancelBtn).focus();
        } catch (_) {}
      }, 0);

      function cleanup() {
        document.removeEventListener('keydown', keyHandler, true);
        overlay.removeEventListener('click', outsideHandler);
        try { trap && trap.deactivate(); } catch (_) {}
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        // Restore focus
        if (opener && typeof opener.focus === 'function') {
          const raf = window.requestAnimationFrame || window.setTimeout;
          raf(() => { try { opener.focus(); } catch (_) {} }, 0);
        }
      }

      function close(value) {
        cleanup();
        resolve(!!value);
      }
    });
  }
}

export default ConfirmDialog;

