/**
 * TimelineInlineEdit Feature
 *
 * Enables inline editing of a task's name via double-click on a task block.
 * Emits `task-rename` with `{ taskId, newName }` and avoids direct state changes.
 */

import { SafeEventListener } from '../utils/MemoryLeakPrevention.js';

export class TimelineInlineEdit {
  constructor(rootEl, options = {}) {
    this.rootEl = rootEl;
    this.options = {
      emit: (type, detail) => this._defaultEmit(type, detail),
      ...options
    };

    this.tokens = [];
    this.activeEditor = null; // { input, taskId, nameEl, originalText }
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

    // Double-click to edit task name
    const dblTok = SafeEventListener.add(
      this.rootEl,
      'dblclick',
      (e) => this._onDblClick(e),
      { description: 'TimelineInlineEdit dblclick' }
    );
    this.tokens.push(dblTok);

    // Click elsewhere to close editor (without saving)
    const docClickTok = SafeEventListener.add(
      document,
      'click',
      (e) => this._handleDocumentClick(e),
      { description: 'TimelineInlineEdit document click' }
    );
    this.tokens.push(docClickTok);

    this.active = true;
  }

  _onDblClick(event) {
    const block = event.target.closest('.task-block');
    if (!block || !this.rootEl.contains(block)) return;

    // Prevent triggering other click handlers (like open modal)
    event.preventDefault();
    event.stopPropagation();

    const taskId = block.dataset.taskId;
    const nameEl = block.querySelector('.task-name');
    if (!taskId || !nameEl) return;

    // If already editing this one, ignore
    if (this.activeEditor && this.activeEditor.nameEl === nameEl) return;

    this._startEditing(taskId, nameEl);
  }

  _startEditing(taskId, nameEl) {
    this._cancelActiveEditor();
    const originalText = nameEl.textContent || '';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
    input.className = 'inline-edit-input';
    input.style.width = Math.max(120, nameEl.offsetWidth || 160) + 'px';

    // Replace text with input
    nameEl.textContent = '';
    nameEl.appendChild(input);

    // Handle keys
    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._commitEditing(taskId, nameEl, input.value.trim(), originalText);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this._restoreName(nameEl, originalText);
      }
    };
    input.addEventListener('keydown', onKeyDown);

    // On blur, cancel (do not save) to avoid accidental commits
    const onBlur = () => {
      this._restoreName(nameEl, originalText);
    };
    input.addEventListener('blur', onBlur);

    this.activeEditor = { input, taskId, nameEl, originalText, onKeyDown, onBlur };
    input.focus();
    input.select();
  }

  _commitEditing(taskId, nameEl, newText, originalText) {
    // If unchanged, just restore
    if (!newText || newText === originalText) {
      this._restoreName(nameEl, originalText);
      return;
    }

    // Emit event for container to persist
    this.options.emit('task-rename', { taskId, newName: newText });

    // Optimistic UI update
    this._restoreName(nameEl, newText);
  }

  _restoreName(nameEl, text) {
    if (this.activeEditor) {
      const { input, onKeyDown, onBlur } = this.activeEditor;
      if (input) {
        input.removeEventListener('keydown', onKeyDown);
        input.removeEventListener('blur', onBlur);
      }
    }
    nameEl.textContent = text;
    this.activeEditor = null;
  }

  _cancelActiveEditor() {
    if (!this.activeEditor) return;
    const { nameEl, originalText } = this.activeEditor;
    this._restoreName(nameEl, originalText);
  }

  _handleDocumentClick(event) {
    if (!this.activeEditor) return;
    const { input } = this.activeEditor;
    if (input && event.target !== input && !input.contains(event.target)) {
      // Cancel edit on outside click
      const { nameEl, originalText } = this.activeEditor;
      this._restoreName(nameEl, originalText);
    }
  }

  destroy() {
    this._cancelActiveEditor();
    this.tokens.forEach(tok => {
      try { tok.remove && tok.remove(); } catch (_) {}
    });
    this.tokens = [];
    this.active = false;
  }
}

