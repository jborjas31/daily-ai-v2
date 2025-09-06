/**
 * ActionsFooter
 * Renders Save/Cancel/Delete controls and a simple dirty indicator.
 * Save button disabled can be controlled via props.isValid.
 */
export class ActionsFooter {
  constructor(container) {
    this.container = container;
    this.root = null;
  }

  render(targetEl, { mode = 'create', isDirty = false, isValid = true, hasId = false } = {}) {
    if (!targetEl) return;
    this.root = targetEl;
    targetEl.innerHTML = '';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '8px';

    if (isDirty) {
      const dirty = document.createElement('span');
      dirty.textContent = 'Unsaved changes';
      dirty.style.color = '#9A3412';
      dirty.style.fontSize = '0.9em';
      left.appendChild(dirty);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.container?.close());
    left.appendChild(cancelBtn);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '8px';
    right.style.marginLeft = 'auto';

    if (mode === 'edit' && hasId) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        // Delegate to container for now
        this.container?._handleDelete?.(deleteBtn);
      });
      right.appendChild(deleteBtn);
    }

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary';
    saveBtn.dataset.role = 'save';
    saveBtn.textContent = mode === 'edit' ? 'Save Changes' : 'Create Template';
    // Keep enabled to trigger validation and focus first invalid on click
    saveBtn.addEventListener('click', () => this.container?.requestSubmit());
    right.appendChild(saveBtn);

    targetEl.appendChild(left);
    targetEl.appendChild(right);
  }
}
