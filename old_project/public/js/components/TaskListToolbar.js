/**
 * TaskListToolbar — dumb presentational component
 *
 * Renders the toolbar for TaskList and emits semantic events instead of
 * directly mutating parent state. Parent subscribes to these events.
 */

/**
 * Create a toolbar element matching existing selectors and structure.
 *
 * @param {Object} options
 * @param {string} options.currentView - 'library' | 'active' | 'inactive'
 * @param {string} options.currentCategory - 'all' | 'priority' | 'timeWindow' | 'scheduling'
 * @param {string} options.currentSort - 'name' | 'priority' | 'created' | 'modified'
 * @param {string} options.sortDirection - 'asc' | 'desc'
 * @param {string} [options.searchQuery]
 * @returns {HTMLElement}
 */
export function createTaskListToolbar({
  currentView = 'library',
  currentCategory = 'all',
  currentSort = 'name',
  sortDirection = 'asc',
  searchQuery = ''
} = {}) {
  const el = document.createElement('div');
  el.className = 'task-list-toolbar';

  el.innerHTML = `
    <div class="toolbar-left">
      <div class="view-switcher">
        <button type="button" class="view-btn ${currentView === 'library' ? 'active' : ''}" data-view="library">📚 All Templates</button>
        <button type="button" class="view-btn ${currentView === 'active' ? 'active' : ''}" data-view="active">✅ Active Only</button>
        <button type="button" class="view-btn ${currentView === 'inactive' ? 'active' : ''}" data-view="inactive">⏸️ Inactive Only</button>
      </div>

      <div class="category-switcher">
        <select id="category-select" class="select">
          <option value="all" ${currentCategory === 'all' ? 'selected' : ''}>All Categories</option>
          <option value="priority" ${currentCategory === 'priority' ? 'selected' : ''}>By Priority</option>
          <option value="timeWindow" ${currentCategory === 'timeWindow' ? 'selected' : ''}>By Time Window</option>
          <option value="scheduling" ${currentCategory === 'scheduling' ? 'selected' : ''}>By Scheduling Type</option>
        </select>
      </div>
    </div>

    <div class="toolbar-center">
      <div class="search-box">
        <input type="text" id="search-input" class="search-input" placeholder="🔍 Search templates..." value="${escapeHtml(searchQuery)}" />
        <button type="button" id="clear-search-btn" class="clear-search-btn" ${!searchQuery ? 'style="display: none;"' : ''}>×</button>
      </div>
    </div>

    <div class="toolbar-right">
      <div class="sort-controls">
        <select id="sort-select" class="select">
          <option value="name" ${currentSort === 'name' ? 'selected' : ''}>Sort by Name</option>
          <option value="priority" ${currentSort === 'priority' ? 'selected' : ''}>Sort by Priority</option>
          <option value="created" ${currentSort === 'created' ? 'selected' : ''}>Sort by Created</option>
          <option value="modified" ${currentSort === 'modified' ? 'selected' : ''}>Sort by Modified</option>
        </select>
        <button type="button" id="sort-direction-btn" class="sort-direction-btn" title="Toggle sort direction">${sortDirection === 'asc' ? '⬆️' : '⬇️'}</button>
      </div>

      <button type="button" id="toggle-filters-btn" class="btn btn-secondary">🔧 Filters</button>
    </div>
  `;

  // Event emit helper
  const emit = (type, detail = {}) => {
    el.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  };

  // Wire events
  el.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.getAttribute('data-view');
      emit('toolbar:view', { view });
    });
  });

  el.querySelector('#category-select')?.addEventListener('change', (e) => {
    emit('toolbar:category', { category: e.target.value });
  });

  el.querySelector('#search-input')?.addEventListener('input', (e) => {
    const value = (e.target.value || '').trim();
    // Toggle clear button visibility
    const clearBtn = el.querySelector('#clear-search-btn');
    if (clearBtn) clearBtn.style.display = value ? '' : 'none';
    emit('toolbar:search', { query: value });
  });

  el.querySelector('#clear-search-btn')?.addEventListener('click', () => {
    const input = el.querySelector('#search-input');
    if (input) input.value = '';
    const clearBtn = el.querySelector('#clear-search-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    emit('toolbar:search', { query: '' });
  });

  el.querySelector('#sort-select')?.addEventListener('change', (e) => {
    emit('toolbar:sort-field', { field: e.target.value });
  });

  el.querySelector('#sort-direction-btn')?.addEventListener('click', () => {
    const next = sortDirection === 'asc' ? 'desc' : 'asc';
    emit('toolbar:sort-direction', { direction: next });
  });

  el.querySelector('#toggle-filters-btn')?.addEventListener('click', () => {
    emit('toolbar:toggle-filters', {});
  });

  return el;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export const TaskListToolbar = { create: createTaskListToolbar };

