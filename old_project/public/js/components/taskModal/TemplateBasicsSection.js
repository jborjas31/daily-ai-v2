/**
 * TemplateBasicsSection
 * Renders basic template fields: name, description, category, priority.
 * Emits section-change patches on input.
 */

export class TemplateBasicsSection {
  constructor(container) {
    this.container = container; // TaskModalContainer instance (for event emission)
  }

  /**
   * Render the Basics section into a target element
   * @param {HTMLElement} targetEl
   * @param {object} model
   */
  render(targetEl, model = {}) {
    if (!targetEl) return;
    const m = model || {};
    targetEl.innerHTML = `
      <div class="form-section">
        <h3>📝 Template Basics</h3>

        <div class="form-group">
          <label for="tmv2-task-name" class="label required">Task Name</label>
          <input type="text" id="tmv2-task-name" class="input" placeholder="e.g., Morning Workout" value="${this._esc(m.taskName || '')}" />
          <div class="validation-error" id="tmv2-task-name-error"></div>
        </div>

        <div class="form-group">
          <label for="tmv2-task-desc" class="label">Description</label>
          <textarea id="tmv2-task-desc" class="input textarea" rows="3" placeholder="Optional notes or instructions">${this._esc(m.description || '')}</textarea>
          <div class="validation-error" id="tmv2-task-desc-error"></div>
        </div>

        <div class="form-group">
          <label for="tmv2-task-category" class="label">Category</label>
          <input type="text" id="tmv2-task-category" class="input" placeholder="Optional grouping, e.g., Health" value="${this._esc(m.category || '')}" />
          <div class="validation-error" id="tmv2-task-category-error"></div>
        </div>

        <div class="form-group">
          <label for="tmv2-priority" class="label">Priority</label>
          <select id="tmv2-priority" class="input">
            ${[1,2,3,4,5].map(p => `<option value="${p}" ${(+m.priority||3)===p?'selected':''}>${p}</option>`).join('')}
          </select>
          <div class="validation-error" id="tmv2-priority-error"></div>
        </div>

        <div class="form-group">
          <label class="label">Requirement</label>
          <label class="checkbox-label" style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="tmv2-mandatory" ${m.isMandatory ? 'checked' : ''} />
            <span>${m.isMandatory ? '🔒 Mandatory (must complete)' : '📝 Optional (can skip)'}</span>
          </label>
          <small class="form-help">Mandatory tasks are prioritized and treated as required.</small>
          <div class="validation-error" id="tmv2-mandatory-error"></div>
        </div>
      </div>
    `;

    // Wire inputs to emit section-change patches
    const nameEl = targetEl.querySelector('#tmv2-task-name');
    const descEl = targetEl.querySelector('#tmv2-task-desc');
    const catEl = targetEl.querySelector('#tmv2-task-category');
    const priEl = targetEl.querySelector('#tmv2-priority');
    const mandEl = targetEl.querySelector('#tmv2-mandatory');

    if (nameEl) nameEl.addEventListener('input', () => this._emit({ taskName: nameEl.value }));
    if (descEl) descEl.addEventListener('input', () => this._emit({ description: descEl.value }));
    if (catEl) catEl.addEventListener('input', () => this._emit({ category: catEl.value }));
    if (priEl) priEl.addEventListener('change', () => this._emit({ priority: parseInt(priEl.value) || 3 }));
    if (mandEl) mandEl.addEventListener('change', () => this._emit({ isMandatory: !!mandEl.checked }));
  }

  _emit(patch) {
    if (this.container && typeof this.container.emitSectionChange === 'function') {
      this.container.emitSectionChange(patch);
    } else {
      // Fallback to global event if container missing
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
