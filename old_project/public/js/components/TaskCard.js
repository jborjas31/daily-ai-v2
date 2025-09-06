/**
 * TaskCard — dumb presentational component
 *
 * Produces a single task template card element matching existing markup.
 * No internal state; delegates interactions via passed handlers.
 */

import { TIME_WINDOWS } from '../constants/timeWindows.js';

/**
 * Create a TaskCard element.
 *
 * @param {Object} options
 * @param {Object} options.template - Task template object
 * @param {boolean} [options.isSelected=false] - Whether this card is selected
 * @param {Object} [options.handlers] - Optional event handlers
 * @param {Function} [options.handlers.onSelectChange] - (templateId, isSelected) => void
 * @param {Function} [options.handlers.onEdit] - (templateId) => void
 * @param {Function} [options.handlers.onDuplicate] - (templateId) => void
 * @param {Function} [options.handlers.onToggleStatus] - (templateId) => void
 * @returns {HTMLElement}
 */
export function createTaskCard({ template, isSelected = false, handlers = {} }) {
  const statusClass = template.isActive !== false ? 'active' : 'inactive';
  const statusIcon = template.isActive !== false ? '✅' : '⏸️';
  const mandatoryIcon = template.isMandatory ? '🔒' : '📋';
  const schedulingIcon = template.schedulingType === 'fixed' ? '🕒' : '🤖';
  const priorityIcon = getPriorityIcon(template.priority);

  const root = document.createElement('div');
  root.className = `task-card ${statusClass} ${isSelected ? 'selected' : ''}`.trim();
  root.setAttribute('data-template-id', template.id);

  root.innerHTML = `
    <div class="task-card-header">
      <div class="task-selection">
        <input 
          type="checkbox" 
          class="task-checkbox" 
          data-template-id="${template.id}"
          ${isSelected ? 'checked' : ''}
        />
      </div>
      <div class="task-status">
        <span class="status-indicator" title="${template.isActive !== false ? 'Active' : 'Inactive'}">
          ${statusIcon}
        </span>
      </div>
      <div class="task-actions">
        <button type="button" class="action-btn edit-btn" data-action="edit-task" data-task-id="${template.id}" data-template-id="${template.id}" title="Edit">✏️</button>
        <button type="button" class="action-btn duplicate-btn" data-action="duplicate-task" data-task-id="${template.id}" data-template-id="${template.id}" title="Duplicate">📄</button>
        <button type="button" class="action-btn toggle-status-btn" data-template-id="${template.id}" title="Toggle Status">${template.isActive !== false ? '⏸️' : '✅'}</button>
        <button type="button" class="action-btn delete-btn" data-action="soft-delete-task" data-task-id="${template.id}" data-template-id="${template.id}" title="Delete">🗑️</button>
      </div>
    </div>
    <div class="task-card-body">
      <h4 class="task-name">${escapeHtml(template.taskName)}</h4>
      ${template.description ? `<p class="task-description">${escapeHtml(template.description)}</p>` : ''}
      <div class="task-meta">
        <div class="meta-row">
          <span class="meta-item">${priorityIcon} Priority ${template.priority}</span>
          <span class="meta-item">⏱️ ${template.durationMinutes}min</span>
        </div>
        <div class="meta-row">
          <span class="meta-item">${mandatoryIcon} ${template.isMandatory ? 'Mandatory' : 'Optional'}</span>
          <span class="meta-item">${schedulingIcon} ${template.schedulingType === 'fixed' ? 'Fixed' : 'Flexible'}</span>
        </div>
        ${template.schedulingType === 'flexible' && template.timeWindow ? `
          <div class="meta-row">
            <span class="meta-item">🕐 ${TIME_WINDOWS[template.timeWindow]?.label || template.timeWindow}</span>
          </div>
        ` : ''}
        ${template.schedulingType === 'fixed' && template.defaultTime ? `
          <div class="meta-row">
            <span class="meta-item">🕒 ${template.defaultTime}</span>
          </div>
        ` : ''}
      </div>
      ${template.dependsOn && template.dependsOn.length > 0 ? `
        <div class="task-dependencies"><small>🔗 ${template.dependsOn.length} dependenc${template.dependsOn.length !== 1 ? 'ies' : 'y'}</small></div>
      ` : ''}
      <div class="task-recurrence"><small>🔄 ${getRecurrenceDisplay(template.recurrenceRule)}</small></div>
    </div>
  `;

  // Wire events to handlers (if provided)
  const checkbox = root.querySelector('.task-checkbox');
  if (checkbox && typeof handlers.onSelectChange === 'function') {
    checkbox.addEventListener('change', (e) => {
      handlers.onSelectChange(template.id, !!e.target.checked);
    });
  }

  const editBtn = root.querySelector('.edit-btn');
  if (editBtn && typeof handlers.onEdit === 'function') {
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handlers.onEdit(template.id);
    });
  }

  const dupBtn = root.querySelector('.duplicate-btn');
  if (dupBtn && typeof handlers.onDuplicate === 'function') {
    dupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handlers.onDuplicate(template.id);
    });
  }

  const toggleBtn = root.querySelector('.toggle-status-btn');
  if (toggleBtn && typeof handlers.onToggleStatus === 'function') {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handlers.onToggleStatus(template.id);
    });
  }

  return root;
}

function getPriorityIcon(priority) {
  const icons = { 1: '⚪', 2: '🔵', 3: '🟡', 4: '🔴', 5: '🔥' };
  return icons[priority] || icons[3];
}

function getRecurrenceDisplay(recurrenceRule) {
  if (!recurrenceRule || recurrenceRule.frequency === 'none') {
    return 'One-time task';
  }
  const { frequency, interval } = recurrenceRule;
  switch (frequency) {
    case 'daily':
      return interval === 1 ? 'Daily' : `Every ${interval} days`;
    case 'weekly':
      return interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
    case 'monthly':
      return interval === 1 ? 'Monthly' : `Every ${interval} months`;
    case 'yearly':
      return interval === 1 ? 'Yearly' : `Every ${interval} years`;
    case 'custom':
      return 'Custom pattern';
    default:
      return 'Unknown pattern';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export const TaskCard = { create: createTaskCard };
