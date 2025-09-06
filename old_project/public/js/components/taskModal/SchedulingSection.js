import { TIME_WINDOWS } from '../../constants/timeWindows.js';
import { state } from '../../state.js';

/**
 * SchedulingSection
 * Fields: schedulingType (flexible|fixed), defaultTime (for fixed), timeWindow (for flexible)
 * Supports 24/12h hint based on settings (preferences.use12HourTime)
 */
export class SchedulingSection {
  constructor(container) {
    this.container = container;
    this.use12Hour = !!(state.getSettings?.().preferences?.use12HourTime);
  }

  render(targetEl, model = {}) {
    if (!targetEl) return;
    const m = model || {};
    const isFixed = (m.schedulingType === 'fixed');

    targetEl.innerHTML = `
      <div class="form-section">
        <h3>📅 Scheduling</h3>

        <div class="form-group">
          <label class="label">Scheduling Type</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="tmv2-scheduling-type" value="flexible" ${!isFixed ? 'checked' : ''} />
              <span class="radio-text">Flexible (Smart scheduling)</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="tmv2-scheduling-type" value="fixed" ${isFixed ? 'checked' : ''} />
              <span class="radio-text">Fixed time</span>
            </label>
          </div>
        </div>

        <div class="form-group" id="tmv2-fixed-time-group" style="display: ${isFixed ? 'block' : 'none'};">
          <label for="tmv2-default-time" class="label">Fixed Time</label>
          <input type="time" id="tmv2-default-time" class="input" value="${m.defaultTime || ''}" />
          ${this.use12Hour ? `<small class="form-help" id="tmv2-time-hint">${this._format12h(m.defaultTime || '')}</small>` : ''}
          <div class="validation-error" id="tmv2-default-time-error"></div>
        </div>

        <div class="form-group" id="tmv2-time-window-group" style="display: ${!isFixed ? 'block' : 'none'};">
          <label for="tmv2-time-window" class="label">Preferred Time Window</label>
          <select id="tmv2-time-window" class="input">
            ${Object.entries(TIME_WINDOWS).map(([key, window]) => `
              <option value="${key}" ${m.timeWindow === key ? 'selected' : ''}>${window.label}</option>
            `).join('')}
          </select>
          <div class="validation-error" id="tmv2-time-window-error"></div>
        </div>
      </div>
    `;

    // Wire events
    const radios = targetEl.querySelectorAll('input[name="tmv2-scheduling-type"]');
    radios.forEach(r => r.addEventListener('change', () => {
      const value = targetEl.querySelector('input[name="tmv2-scheduling-type"]:checked')?.value || 'flexible';
      const fixedGroup = targetEl.querySelector('#tmv2-fixed-time-group');
      const windowGroup = targetEl.querySelector('#tmv2-time-window-group');
      fixedGroup.style.display = value === 'fixed' ? 'block' : 'none';
      windowGroup.style.display = value !== 'fixed' ? 'block' : 'none';
      this._emit({ schedulingType: value });
    }));

    const timeEl = targetEl.querySelector('#tmv2-default-time');
    if (timeEl) {
      timeEl.addEventListener('input', () => {
        const val = timeEl.value;
        if (this.use12Hour) {
          const hint = targetEl.querySelector('#tmv2-time-hint');
          if (hint) hint.textContent = this._format12h(val);
        }
        this._emit({ defaultTime: val });
      });
    }

    const windowEl = targetEl.querySelector('#tmv2-time-window');
    if (windowEl) {
      windowEl.addEventListener('change', () => {
        this._emit({ timeWindow: windowEl.value });
      });
    }
  }

  _format12h(hhmm) {
    if (!hhmm) return '';
    const [hStr, mStr] = hhmm.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${suffix}`;
  }

  _emit(patch) {
    if (this.container && typeof this.container.emitSectionChange === 'function') {
      this.container.emitSectionChange(patch);
    } else {
      window.dispatchEvent(new CustomEvent('section-change', { detail: { patch } }));
    }
  }
}

