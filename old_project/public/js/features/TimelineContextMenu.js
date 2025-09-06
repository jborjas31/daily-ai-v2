/**
 * TimelineContextMenu Feature
 *
 * Provides a contextual menu for task blocks using delegated events.
 * Emits high-level events (task-complete, task-edit, task-skip, task-postpone, task-delete)
 * and does not manipulate application state directly.
 */

import { SafeEventListener } from '../utils/MemoryLeakPrevention.js';

export class TimelineContextMenu {
  constructor(rootEl, options = {}) {
    this.rootEl = rootEl;
    this.options = {
      longPressMs: 550,
      emit: (type, detail) => this._defaultEmit(type, detail),
      ...options
    };

    this.tokens = [];
    this.menuEl = null;
    this.longPressTimer = null;
    this.active = false;

    this._attach();
  }

  _defaultEmit(type, detail) {
    if (!this.rootEl) return;
    const event = new CustomEvent(type, { detail, bubbles: true });
    this.rootEl.dispatchEvent(event);
  }

  _attach() {
    if (!this.rootEl || this.active) return;

    // Context menu (right-click)
    const ctxTok = SafeEventListener.add(
      this.rootEl,
      'contextmenu',
      (e) => this._onContextMenu(e),
      { description: 'TimelineContextMenu contextmenu' }
    );
    this.tokens.push(ctxTok);

    // Long-press for touch devices
    const pdTok = SafeEventListener.add(
      this.rootEl,
      'pointerdown',
      (e) => this._onPointerDown(e),
      { description: 'TimelineContextMenu pointerdown' }
    );
    const puTok = SafeEventListener.add(
      this.rootEl,
      'pointerup',
      () => this._clearLongPress(),
      { description: 'TimelineContextMenu pointerup' }
    );
    const pcTok = SafeEventListener.add(
      this.rootEl,
      'pointercancel',
      () => this._clearLongPress(),
      { description: 'TimelineContextMenu pointercancel' }
    );
    const plTok = SafeEventListener.add(
      this.rootEl,
      'pointerleave',
      () => this._clearLongPress(),
      { description: 'TimelineContextMenu pointerleave' }
    );
    this.tokens.push(pdTok, puTok, pcTok, plTok);

    // Global close listeners
    const clickTok = SafeEventListener.add(
      document,
      'click',
      (e) => this._handleGlobalClick(e),
      { description: 'TimelineContextMenu global click' }
    );
    const escTok = SafeEventListener.add(
      document,
      'keydown',
      (e) => { if (e.key === 'Escape') this.closeMenu(); },
      { description: 'TimelineContextMenu escape key' }
    );
    this.tokens.push(clickTok, escTok);

    this.active = true;
  }

  _onContextMenu(event) {
    const block = event.target.closest('.task-block');
    if (!block || !this.rootEl.contains(block)) return;
    event.preventDefault();

    const taskId = block.dataset.taskId;
    this.openMenu(taskId, { x: event.clientX, y: event.clientY });
  }

  _onPointerDown(event) {
    const block = event.target.closest('.task-block');
    if (!block || !this.rootEl.contains(block)) return;
    this._clearLongPress();
    const { clientX: x, clientY: y } = event;
    const taskId = block.dataset.taskId;
    this.longPressTimer = setTimeout(() => {
      this.openMenu(taskId, { x, y });
    }, this.options.longPressMs);
  }

  _clearLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  _handleGlobalClick(event) {
    if (!this.menuEl) return;
    if (this.menuEl.contains(event.target)) return; // clicks inside menu handled separately
    this.closeMenu();
  }

  openMenu(taskId, pos) {
    this.closeMenu();
    if (!this.rootEl) return;

    const menu = document.createElement('div');
    menu.className = 'timeline-context-menu';
    menu.style.position = 'fixed';
    menu.style.zIndex = '1000';
    menu.style.minWidth = '180px';
    menu.style.background = '#fff';
    menu.style.border = '1px solid rgba(0,0,0,0.1)';
    menu.style.borderRadius = '8px';
    menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
    menu.style.padding = '6px 0';
    menu.style.fontSize = '14px';
    menu.style.userSelect = 'none';

    const items = [
      { key: 'complete', label: 'Mark Complete', event: 'task-complete' },
      { key: 'edit', label: 'Edit Task', event: 'task-edit' },
      { key: 'skip', label: 'Skip Today', event: 'task-skip' },
      { key: 'postpone-15', label: 'Postpone 15 min', event: 'task-postpone', detail: { deltaMinutes: 15 } },
      { key: 'delete', label: 'Delete Task', event: 'task-delete' },
    ];

    items.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = item.label;
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.style.padding = '8px 12px';
      btn.style.border = 'none';
      btn.style.background = 'transparent';
      btn.style.cursor = 'pointer';
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(0,0,0,0.05)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const base = { taskId };
        const extra = item.detail || {};
        this.options.emit(item.event, { ...base, ...extra });
        this.closeMenu();
      });
      menu.appendChild(btn);
    });

    // Position within viewport
    const { x, y } = this._fitToViewport(pos, { width: 200, height: items.length * 36 + 8 });
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    document.body.appendChild(menu);
    this.menuEl = menu;
  }

  _fitToViewport(pos, size) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = pos.x;
    let y = pos.y;
    if (x + size.width > vw) x = Math.max(0, vw - size.width - 8);
    if (y + size.height > vh) y = Math.max(0, vh - size.height - 8);
    return { x, y };
  }

  closeMenu() {
    if (this.menuEl && this.menuEl.parentNode) {
      this.menuEl.parentNode.removeChild(this.menuEl);
    }
    this.menuEl = null;
    this._clearLongPress();
  }

  destroy() {
    this.closeMenu();
    this.tokens.forEach(tok => {
      try { tok.remove && tok.remove(); } catch (_) {}
    });
    this.tokens = [];
    this.active = false;
  }
}

