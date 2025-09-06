/**
 * RecurrenceSection
 * Fields: frequency, interval, daysOfWeek (for weekly), end conditions (endDate, endAfterOccurrences)
 * Minimal validation: interval >= 1; endAfterOccurrences >= 1 when set
 */
export class RecurrenceSection {
  constructor(container) {
    this.container = container;
  }

  render(targetEl, model = {}) {
    if (!targetEl) return;
    const rule = (model && model.recurrenceRule) || {};
    const freq = rule.frequency || 'none';
    const interval = rule.interval || 1;
    const days = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek : [];
    const endDate = rule.endDate || '';
    const endAfter = rule.endAfterOccurrences || '';

    targetEl.innerHTML = `
      <div class="form-section">
        <h3>🔄 Recurrence</h3>

        <div class="form-group">
          <label for="tmv2-recur-frequency" class="label">Repeat</label>
          <select id="tmv2-recur-frequency" class="input">
            <option value="none" ${freq==='none'?'selected':''}>One-time</option>
            <option value="daily" ${freq==='daily'?'selected':''}>Daily</option>
            <option value="weekly" ${freq==='weekly'?'selected':''}>Weekly</option>
            <option value="monthly" ${freq==='monthly'?'selected':''}>Monthly</option>
            <option value="yearly" ${freq==='yearly'?'selected':''}>Yearly</option>
          </select>
          <div class="validation-error" id="tmv2-recur-frequency-error"></div>
        </div>

        <div class="form-group" id="tmv2-recur-interval-group" style="display: ${freq==='none'?'none':'block'};">
          <label for="tmv2-recur-interval" class="label">Every</label>
          <div class="form-row">
            <input type="number" id="tmv2-recur-interval" class="input" style="width: 90px;" min="1" value="${interval}" />
            <span id="tmv2-recur-interval-label" class="form-text" style="margin-left: 8px;">${this._intervalLabel(freq)}</span>
          </div>
          <div class="validation-error" id="tmv2-recur-interval-error"></div>
        </div>

        <div class="form-group" id="tmv2-recur-weekly" style="display: ${freq==='weekly'?'block':'none'};">
          <label class="label">Days of Week</label>
          <div class="weekday-selector">
            ${this._weekdayCheckboxes(days)}
          </div>
          <div class="validation-error" id="tmv2-recur-days-error"></div>
        </div>

        <div class="form-group" id="tmv2-recur-end" style="display: ${freq==='none'?'none':'block'};">
          <label class="label">End Conditions (optional)</label>
          <div class="form-row">
            <div class="form-group" style="margin-right: 12px;">
              <label for="tmv2-recur-end-date" class="label">End Date</label>
              <input type="date" id="tmv2-recur-end-date" class="input" value="${endDate}" />
              <div class="validation-error" id="tmv2-recur-end-date-error"></div>
            </div>
            <div class="form-group">
              <label for="tmv2-recur-end-after" class="label">End After (occurrences)</label>
              <input type="number" id="tmv2-recur-end-after" class="input" min="1" value="${endAfter}" />
              <div class="validation-error" id="tmv2-recur-end-after-error"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire events
    const freqEl = targetEl.querySelector('#tmv2-recur-frequency');
    const intervalEl = targetEl.querySelector('#tmv2-recur-interval');
    const weeklyEl = targetEl.querySelector('#tmv2-recur-weekly');
    const intervalLabelEl = targetEl.querySelector('#tmv2-recur-interval-label');
    const endDateEl = targetEl.querySelector('#tmv2-recur-end-date');
    const endAfterEl = targetEl.querySelector('#tmv2-recur-end-after');

    if (freqEl) {
      freqEl.addEventListener('change', () => {
        const newFreq = freqEl.value;
        const intervalGroup = targetEl.querySelector('#tmv2-recur-interval-group');
        const endGroup = targetEl.querySelector('#tmv2-recur-end');
        intervalGroup.style.display = newFreq === 'none' ? 'none' : 'block';
        weeklyEl.style.display = newFreq === 'weekly' ? 'block' : 'none';
        endGroup.style.display = newFreq === 'none' ? 'none' : 'block';
        if (intervalLabelEl) intervalLabelEl.textContent = this._intervalLabel(newFreq);
        this._emitRule({ frequency: newFreq });
      });
    }

    if (intervalEl) {
      intervalEl.addEventListener('input', () => {
        const val = Math.max(1, parseInt(intervalEl.value || '1', 10));
        if (val != intervalEl.value) intervalEl.value = String(val);
        this._emitRule({ interval: val });
      });
    }

    // Weekly checkboxes
    targetEl.querySelectorAll('.tmv2-weekday').forEach(cb => {
      cb.addEventListener('change', () => {
        const selected = Array.from(targetEl.querySelectorAll('.tmv2-weekday:checked')).map(el => parseInt(el.value, 10));
        this._emitRule({ daysOfWeek: selected });
      });
    });

    if (endDateEl) {
      endDateEl.addEventListener('change', () => {
        const v = endDateEl.value || null;
        this._emitRule({ endDate: v });
      });
    }

    if (endAfterEl) {
      endAfterEl.addEventListener('input', () => {
        const raw = endAfterEl.value;
        const val = raw === '' ? null : Math.max(1, parseInt(raw, 10) || 1);
        if (val !== null && String(val) !== raw) endAfterEl.value = String(val);
        this._emitRule({ endAfterOccurrences: val });
      });
    }
  }

  _weekdayCheckboxes(selected = []) {
    const days = [
      { value: 0, label: 'Sun' },
      { value: 1, label: 'Mon' },
      { value: 2, label: 'Tue' },
      { value: 3, label: 'Wed' },
      { value: 4, label: 'Thu' },
      { value: 5, label: 'Fri' },
      { value: 6, label: 'Sat' }
    ];
    return days.map(d => `
      <label class="weekday-option">
        <input type="checkbox" class="tmv2-weekday" value="${d.value}" ${selected.includes(d.value)?'checked':''} />
        <span class="weekday-label">${d.label}</span>
      </label>
    `).join('');
  }

  _intervalLabel(freq) {
    switch (freq) {
      case 'daily': return 'day(s)';
      case 'weekly': return 'week(s)';
      case 'monthly': return 'month(s)';
      case 'yearly': return 'year(s)';
      default: return '';
    }
  }

  _emitRule(rulePatch) {
    const base = (this.container && this.container._formModel && this.container._formModel.recurrenceRule) || {};
    const merged = { ...base, ...rulePatch };
    this._emit({ recurrenceRule: merged });
  }

  _emit(patch) {
    if (this.container && typeof this.container.emitSectionChange === 'function') {
      this.container.emitSectionChange(patch);
    } else {
      window.dispatchEvent(new CustomEvent('section-change', { detail: { patch } }));
    }
  }
}
