/**
 * TimelineDragDrop Feature
 *
 * Decouples drag-and-drop interactions from TimelineGrid using event delegation.
 * Attaches listeners to the root container and emits custom events instead of
 * manipulating state directly.
 */

import { SafeEventListener } from '../utils/MemoryLeakPrevention.js';

export class TimelineDragDrop {
  constructor(rootEl, options = {}) {
    this.rootEl = rootEl;
    this.options = {
      emit: (type, detail) => this._defaultEmit(type, detail),
      ...options
    };

    this.tokens = [];
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

    // Delegated dragstart on task blocks
    const dragStartTok = SafeEventListener.add(
      this.rootEl,
      'dragstart',
      (e) => this._onDragStart(e),
      { description: 'TimelineDragDrop delegated dragstart' }
    );
    this.tokens.push(dragStartTok);

    // Delegated dragover for hour-content drop zones
    const dragOverTok = SafeEventListener.add(
      this.rootEl,
      'dragover',
      (e) => this._onDragOver(e),
      { description: 'TimelineDragDrop delegated dragover' }
    );
    this.tokens.push(dragOverTok);

    // Delegated drop handler
    const dropTok = SafeEventListener.add(
      this.rootEl,
      'drop',
      (e) => this._onDrop(e),
      { description: 'TimelineDragDrop delegated drop' }
    );
    this.tokens.push(dropTok);

    this.active = true;
  }

  _onDragStart(event) {
    const taskBlock = event.target.closest('.task-block');
    if (!taskBlock) return;

    const taskId = taskBlock.dataset.taskId;
    if (!taskId) return;

    event.dataTransfer?.setData?.('text/plain', taskId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';

    taskBlock.style.cursor = 'grabbing';
    taskBlock.classList.add('is-dragging');

    this.options.emit('task-drag-start', { taskId, element: taskBlock });
  }

  _onDragOver(event) {
    const hourContent = event.target.closest('.hour-content');
    if (!hourContent) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    hourContent.classList.add('is-drop-target');
  }

  _onDrop(event) {
    const hourContent = event.target.closest('.hour-content');
    if (!hourContent) return;
    event.preventDefault();

    const hour = hourContent.dataset.hour;
    const taskId = event.dataTransfer?.getData?.('text/plain');

    // Cleanup visual indicators
    hourContent.classList.remove('is-drop-target');
    const draggingTask = this.rootEl.querySelector('.is-dragging');
    if (draggingTask) {
      draggingTask.classList.remove('is-dragging');
      draggingTask.style.cursor = 'grab';
    }

    if (!hour || !taskId) return;
    const newHour = parseInt(hour, 10);
    const newTime = `${hour.toString().padStart(2, '0')}:00`;

    this.options.emit('task-drop', { taskId, newHour, newTime });
  }

  destroy() {
    this.tokens.forEach(tok => {
      try { tok.remove && tok.remove(); } catch (_) {}
    });
    this.tokens = [];
    this.active = false;

    if (!this.rootEl) return;
    // Clear transient classes
    this.rootEl.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
    const draggingTask = this.rootEl.querySelector('.is-dragging');
    if (draggingTask) {
      draggingTask.classList.remove('is-dragging');
      draggingTask.style.cursor = '';
    }
  }
}
