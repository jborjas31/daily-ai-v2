import { state } from '../../state.js';

/**
 * DependenciesSection
 * UI: select to add dependency, list with remove and simple order controls.
 * Prevents self-dependency in UI.
 */
export class DependenciesSection {
  constructor(container) {
    this.container = container;
    this.selected = [];
  }

  render(targetEl, model = {}) {
    if (!targetEl) return;
    const currentId = model?.id || null;
    this.selected = Array.isArray(model?.dependsOn) ? [...model.dependsOn] : [];

    targetEl.innerHTML = `
      <div class="form-section">
        <h3>🔗 Dependencies</h3>
        <label for="tmv2-dep-select" class="label">Add Dependency</label>
        <div class="dependency-selector" style="display:flex;align-items:center;gap:8px;">
          <select id="tmv2-dep-select" class="input" style="flex:1;">
            <option value="">Select a task to add as dependency...</option>
            ${this._optionsHtml(currentId, this.selected)}
          </select>
          <button type="button" id="tmv2-dep-add" class="btn btn-secondary">Add</button>
        </div>
        <div id="tmv2-dep-list" class="selected-dependencies" style="margin-top:10px;">
          ${this._listHtml()}
        </div>
        <div class="validation-error" id="tmv2-dep-error"></div>
      </div>
    `;

    const addBtn = targetEl.querySelector('#tmv2-dep-add');
    const selectEl = targetEl.querySelector('#tmv2-dep-select');
    const listEl = targetEl.querySelector('#tmv2-dep-list');

    addBtn?.addEventListener('click', () => {
      const val = selectEl.value;
      if (!val) return;
      if (this.selected.includes(val)) return;
      this.selected.push(val);
      this._emit();
      // Refresh UI selections and list
      selectEl.innerHTML = `<option value="">Select a task to add as dependency...</option>${this._optionsHtml(currentId, this.selected)}`;
      listEl.innerHTML = this._listHtml();
      this._wireListEvents(targetEl);
      selectEl.value = '';
    });

    this._wireListEvents(targetEl);
  }

  _wireListEvents(root) {
    const listEl = root.querySelector('#tmv2-dep-list');
    if (!listEl) return;
    listEl.querySelectorAll('.tmv2-dep-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.selected = this.selected.filter(x => x !== id);
        listEl.innerHTML = this._listHtml();
        this._emit();
        this._wireListEvents(root);
      });
    });
    listEl.querySelectorAll('.tmv2-dep-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const idx = this.selected.indexOf(id);
        if (idx > 0) {
          [this.selected[idx - 1], this.selected[idx]] = [this.selected[idx], this.selected[idx - 1]];
          listEl.innerHTML = this._listHtml();
          this._emit();
          this._wireListEvents(root);
        }
      });
    });
    listEl.querySelectorAll('.tmv2-dep-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const idx = this.selected.indexOf(id);
        if (idx >= 0 && idx < this.selected.length - 1) {
          [this.selected[idx], this.selected[idx + 1]] = [this.selected[idx + 1], this.selected[idx]];
          listEl.innerHTML = this._listHtml();
          this._emit();
          this._wireListEvents(root);
        }
      });
    });
  }

  _optionsHtml(currentId, selected) {
    const tasks = (state.getTaskTemplates && state.getTaskTemplates()) || [];
    return tasks
      .filter(t => t && t.id && t.id !== currentId && !selected.includes(t.id))
      .map(t => `<option value="${t.id}">${this._esc(t.taskName || '(Untitled)')}</option>`) 
      .join('');
  }

  _listHtml() {
    const tasksById = new Map(((state.getTaskTemplates && state.getTaskTemplates()) || []).map(t => [t.id, t]));
    if (!this.selected.length) {
      return '<div class="form-help">No dependencies added.</div>';
    }
    return this.selected.map((id, idx) => {
      const name = this._esc(tasksById.get(id)?.taskName || id);
      return `
        <div class="dependency-item" data-id="${id}" style="display:flex;align-items:center;gap:8px;margin:4px 0;">
          <span class="dependency-name" style="flex:1;">${name}</span>
          <div class="btn-group" style="display:flex;gap:4px;">
            <button type="button" class="btn btn-secondary tmv2-dep-up" data-id="${id}" ${idx===0?'disabled':''}>↑</button>
            <button type="button" class="btn btn-secondary tmv2-dep-down" data-id="${id}" ${idx===this.selected.length-1?'disabled':''}>↓</button>
            <button type="button" class="btn btn-danger tmv2-dep-remove" data-id="${id}">Remove</button>
          </div>
        </div>
      `;
    }).join('');
  }

  _emit() {
    const patch = { dependsOn: [...this.selected] };
    if (this.container && typeof this.container.emitSectionChange === 'function') {
      this.container.emitSectionChange(patch);
    } else {
      window.dispatchEvent(new CustomEvent('section-change', { detail: { patch } }));
    }
  }

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
