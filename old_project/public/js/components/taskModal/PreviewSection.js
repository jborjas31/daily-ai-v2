import { state } from '../../state.js';
import { taskValidation } from '../../utils/TaskValidation.js';

/**
 * PreviewSection
 * Read-only summary of the current form model + conflicts snippet.
 * Re-renders on `section-change` events from the container.
 */
export class PreviewSection {
  constructor(container) {
    this.container = container;
    this.root = null;
    this._bound = null;
  }

  render(targetEl) {
    if (!targetEl) return;
    this.root = targetEl;
    this.root.innerHTML = this._contentHtml(this._model());
    this._wire();
    this._listen();
  }

  dispose() {
    if (this._bound) {
      window.removeEventListener('section-change', this._bound);
      this._bound = null;
    }
  }

  _listen() {
    this._bound = () => {
      if (!this.root) return;
      this.root.innerHTML = this._contentHtml(this._model());
      this._wire();
    };
    window.addEventListener('section-change', this._bound);
  }

  _wire() {
    const refreshBtn = this.root.querySelector('#tmv2-preview-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => {
      if (!this.root) return;
      this.root.innerHTML = this._contentHtml(this._model());
      this._wire();
    });
  }

  _model() {
    return this.container?._formModel || {};
  }

  _contentHtml(model) {
    const sanity = this._validate(model);
    const conflicts = (sanity?.warnings || []).filter(w => /conflict/i.test(w.message));
    const warnings = (sanity?.warnings || []).filter(w => !/conflict/i.test(w.message));

    return `
      <div class="form-section">
        <h3>👁️ Preview</h3>
        <div class="template-preview">
          <div class="preview-section">
            <h4>Basics</h4>
            <div class="preview-item"><strong>Name:</strong> ${this._esc(model.taskName || '(Untitled)')}</div>
            <div class="preview-item"><strong>Priority:</strong> ${model.priority ?? '-'}</div>
            ${model.description ? `<div class="preview-item"><strong>Description:</strong> ${this._esc(model.description)}</div>` : ''}
          </div>

          <div class="preview-section">
            <h4>Scheduling</h4>
            <div class="preview-item"><strong>Type:</strong> ${this._esc(model.schedulingType || 'flexible')}</div>
            ${model.schedulingType === 'fixed' ? `
              <div class="preview-item"><strong>Time:</strong> ${this._esc(model.defaultTime || '-')}</div>
            ` : `
              <div class="preview-item"><strong>Window:</strong> ${this._esc(model.timeWindow || 'anytime')}</div>
            `}
          </div>

          <div class="preview-section">
            <h4>Recurrence</h4>
            <div class="preview-item">${this._recurrenceSummary(model.recurrenceRule)}</div>
          </div>

          ${conflicts.length ? `
            <div class="preview-section" style="border-top:1px solid #eee; padding-top:8px;">
              <h4>Conflicts</h4>
              <ul>
                ${conflicts.map(c => `<li>${this._esc(c.message)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${warnings.length ? `
            <div class="preview-section" style="border-top:1px solid #eee; padding-top:8px;">
              <h4>Warnings</h4>
              <ul>
                ${warnings.map(w => `<li>${this._esc(w.message)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="preview-actions" style="margin-top:8px;">
            <button type="button" id="tmv2-preview-refresh" class="btn btn-secondary">Refresh Preview</button>
          </div>
        </div>
      </div>
    `;
  }

  _validate(model) {
    try {
      const existing = (state.getTaskTemplates && state.getTaskTemplates()) || [];
      return taskValidation.validateTemplate(model, existing);
    } catch (e) {
      return { isValid: true, errors: [], warnings: [] };
    }
  }

  _recurrenceSummary(rule) {
    if (!rule || rule.frequency === 'none') return 'One-time task';
    const freq = rule.frequency;
    const intv = rule.interval || 1;
    if (freq === 'daily') return intv === 1 ? 'Daily' : `Every ${intv} days`;
    if (freq === 'weekly') {
      const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const days = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek.map(d => names[d]).join(', ') : '';
      return `${intv === 1 ? 'Weekly' : `Every ${intv} weeks`}${days ? ` on ${days}`: ''}`;
    }
    if (freq === 'monthly') return intv === 1 ? 'Monthly' : `Every ${intv} months`;
    if (freq === 'yearly') return intv === 1 ? 'Yearly' : `Every ${intv} years`;
    return 'Custom';
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

