/**
 * Task List Component
 * 
 * Comprehensive task template management interface with categorization,
 * search, filtering, status management, and bulk operations
 */

import { state } from '../state.js';
import { taskTemplateManager } from '../taskLogic.js';
import { TIME_WINDOWS } from '../constants/timeWindows.js';
import { taskModal } from '../app.js';
import { TaskQuery } from '../logic/TaskQuery.js';
import { SimpleErrorHandler } from '../utils/SimpleErrorHandler.js';
import { SafeTimeout, SafeEventListener, ComponentManager } from '../utils/MemoryLeakPrevention.js';
import { TaskCard } from './TaskCard.js';
import { TaskGrid } from './TaskGrid.js';
import { TaskListToolbar } from './TaskListToolbar.js';

/**
 * Task List Controller
 */
export class TaskList {
  constructor() {
    this.containerElement = null;
    this.currentView = 'library'; // 'library', 'active', 'inactive'
    this.currentCategory = 'all'; // 'all', 'priority', 'timeWindow', 'scheduling'
    this.currentSort = 'name'; // 'name', 'priority', 'created', 'modified'
    this.sortDirection = 'asc'; // 'asc', 'desc'
    this.searchQuery = '';
    this.selectedTasks = new Set();
    this.cardById = new Map(); // Phase 4: keyed map of templateId -> HTMLElement
    this.prevSignatures = new Map(); // Phase 4: templateId -> signature
    this.currentFilters = {
      priority: 'all',
      timeWindow: 'all',
      schedulingType: 'all',
      isMandatory: 'all',
      isActive: 'all'
    };
    
    // Memory leak prevention tracking
    this.eventListeners = [];
    this.timeouts = [];
    
    // Register with memory manager
    ComponentManager.register(this);
    
    // Bind methods
    this.render = this.render.bind(this);
    this.handleTemplateChange = this.handleTemplateChange.bind(this);
    
    // Subscribe to state changes
    this.subscribeToStateChanges();
  }

  /**
   * Build a stable, serializable query criteria object from current UI state.
   * Note: This method does not change behavior; routing happens in Phase 1 Step 3.
   */
  buildCriteriaFromUI() {
    const criteria = {
      search: (this.searchQuery || '').trim(),
      view: this.currentView, // 'library' | 'active' | 'inactive'
      filters: { ...this.currentFilters },
      sort: { field: this.currentSort, direction: this.sortDirection },
      // paging is optional; left undefined for now to avoid behavior change
    };

    if (window && window.DEBUG_TASKLIST) {
      try { console.log('[TaskList] buildCriteriaFromUI', criteria); } catch (_) {}
    }

    return criteria;
  }

  /**
   * Subscribe to template state changes
   */
  subscribeToStateChanges() {
    // Listen for template changes
    document.addEventListener('stateChanged', this.handleTemplateChange);
  }

  /**
   * Handle template state changes
   */
  handleTemplateChange(event) {
    if (event.detail?.type?.includes('taskTemplate') || event.detail?.type?.includes('TEMPLATE')) {
      // Refresh the view
      this.refreshView();
    }
  }

  /**
   * Initialize the task list in a container element
   */
  init(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) {
      console.error('TaskList: Container not found:', containerSelector);
      return;
    }
    
    this.containerElement = container;
    this.render();
    this.setupEventListeners();
  }

  /**
   * Render the complete task list interface
   */
  render() {
    if (!this.containerElement) return;
    
    // Clear existing content
    this.containerElement.innerHTML = '';
    
    // Get template data
    const templates = this.getFilteredAndSortedTemplates();
    const templateStats = this.getTemplateStats(templates);
    
    // Create main HTML structure
    const html = `
      <div class="task-list-container">
        ${this.renderHeader(templateStats)}
        ${this.renderToolbar()}
        ${this.renderFiltersPanel()}
        ${this.renderBulkActionsBar()}
        ${this.renderTaskGrid(templates)}
        ${this.renderPagination(templates)}
      </div>
    `;
    
    this.containerElement.innerHTML = html;
    this.mountToolbar();
    // Mount per-item cards using TaskCard to match markup and enable future reconciliation
    this.mountTaskCards(templates);
  }

  /**
   * Render the header section with stats and view controls
   */
  renderHeader(stats) {
    return `
      <div class="task-list-header">
        <div class="header-main">
          <h2 class="header-title">
            📚 Task Library
            <span class="template-count">${stats.total} templates</span>
          </h2>
          
          <div class="header-actions">
            <button type="button" class="btn btn-primary" id="create-template-btn">
              ➕ Create Template
            </button>
            <!-- Import/Export features temporarily disabled -->
            <!--
            <button type="button" class="btn btn-secondary" id="import-templates-btn">
              📥 Import
            </button>
            <button type="button" class="btn btn-secondary" id="export-templates-btn">
              📤 Export
            </button>
            -->
          </div>
        </div>
        
        <div class="header-stats">
          <div class="stat-item">
            <span class="stat-label">Active:</span>
            <span class="stat-value active">${stats.active}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Inactive:</span>
            <span class="stat-value inactive">${stats.inactive}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">High Priority:</span>
            <span class="stat-value priority">${stats.highPriority}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Mandatory:</span>
            <span class="stat-value mandatory">${stats.mandatory}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render the toolbar with view controls and search
   */
  renderToolbar() {
    return `
      <div class="task-list-toolbar">
        <div class="toolbar-left">
          <div class="view-switcher">
            <button type="button" class="view-btn ${this.currentView === 'library' ? 'active' : ''}" data-view="library">
              📚 All Templates
            </button>
            <button type="button" class="view-btn ${this.currentView === 'active' ? 'active' : ''}" data-view="active">
              ✅ Active Only
            </button>
            <button type="button" class="view-btn ${this.currentView === 'inactive' ? 'active' : ''}" data-view="inactive">
              ⏸️ Inactive Only
            </button>
          </div>
          
          <div class="category-switcher">
            <select id="category-select" class="select">
              <option value="all" ${this.currentCategory === 'all' ? 'selected' : ''}>All Categories</option>
              <option value="priority" ${this.currentCategory === 'priority' ? 'selected' : ''}>By Priority</option>
              <option value="timeWindow" ${this.currentCategory === 'timeWindow' ? 'selected' : ''}>By Time Window</option>
              <option value="scheduling" ${this.currentCategory === 'scheduling' ? 'selected' : ''}>By Scheduling Type</option>
            </select>
          </div>
        </div>
        
        <div class="toolbar-center">
          <div class="search-box">
            <input 
              type="text" 
              id="search-input" 
              class="search-input" 
              placeholder="🔍 Search templates..."
              value="${this.searchQuery}"
            />
            <button type="button" id="clear-search-btn" class="clear-search-btn" ${!this.searchQuery ? 'style="display: none;"' : ''}>
              ×
            </button>
          </div>
        </div>
        
        <div class="toolbar-right">
          <div class="sort-controls">
            <select id="sort-select" class="select">
              <option value="name" ${this.currentSort === 'name' ? 'selected' : ''}>Sort by Name</option>
              <option value="priority" ${this.currentSort === 'priority' ? 'selected' : ''}>Sort by Priority</option>
              <option value="created" ${this.currentSort === 'created' ? 'selected' : ''}>Sort by Created</option>
              <option value="modified" ${this.currentSort === 'modified' ? 'selected' : ''}>Sort by Modified</option>
            </select>
            <button type="button" id="sort-direction-btn" class="sort-direction-btn" title="Toggle sort direction">
              ${this.sortDirection === 'asc' ? '⬆️' : '⬇️'}
            </button>
          </div>
          
          <button type="button" id="toggle-filters-btn" class="btn btn-secondary">
            🔧 Filters
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Mount the toolbar component by replacing the static markup.
   * Keeps existing selectors/ids so legacy listeners continue to work.
   */
  mountToolbar() {
    const host = this.containerElement.querySelector('.task-list-toolbar');
    if (!host) return;
    const toolbar = TaskListToolbar.create({
      currentView: this.currentView,
      currentCategory: this.currentCategory,
      currentSort: this.currentSort,
      sortDirection: this.sortDirection,
      searchQuery: this.searchQuery
    });
    // Subscribe to semantic events from toolbar
    toolbar.addEventListener('toolbar:view', (e) => this.handleViewSwitch(e.detail.view));
    toolbar.addEventListener('toolbar:category', (e) => this.handleCategoryChange(e.detail.category));
    toolbar.addEventListener('toolbar:search', (e) => this.handleSearchInput(e.detail.query));
    toolbar.addEventListener('toolbar:sort-field', (e) => this.handleSortChange(e.detail.field));
    toolbar.addEventListener('toolbar:sort-direction', (e) => { this.sortDirection = e.detail.direction; this.refreshView(); });
    toolbar.addEventListener('toolbar:toggle-filters', () => this.handleToggleFilters());
    host.replaceWith(toolbar);
  }

  /**
   * Render the filters panel
   */
  renderFiltersPanel() {
    return `
      <div class="task-list-filters" id="filters-panel" style="display: none;">
        <div class="filters-content">
          <div class="filter-section">
            <h4>🎯 Priority</h4>
            <select id="priority-filter" class="filter-select">
              <option value="all" ${this.currentFilters.priority === 'all' ? 'selected' : ''}>All Priorities</option>
              <option value="5" ${this.currentFilters.priority === '5' ? 'selected' : ''}>🔥 Highest (5)</option>
              <option value="4" ${this.currentFilters.priority === '4' ? 'selected' : ''}>🔴 High (4)</option>
              <option value="3" ${this.currentFilters.priority === '3' ? 'selected' : ''}>🟡 Medium (3)</option>
              <option value="2" ${this.currentFilters.priority === '2' ? 'selected' : ''}>🔵 Low (2)</option>
              <option value="1" ${this.currentFilters.priority === '1' ? 'selected' : ''}>⚪ Lowest (1)</option>
            </select>
          </div>
          
          <div class="filter-section">
            <h4>⏰ Time Window</h4>
            <select id="time-window-filter" class="filter-select">
              <option value="all" ${this.currentFilters.timeWindow === 'all' ? 'selected' : ''}>All Windows</option>
              ${Object.entries(TIME_WINDOWS).map(([key, window]) => `
                <option value="${key}" ${this.currentFilters.timeWindow === key ? 'selected' : ''}>
                  ${window.label}
                </option>
              `).join('')}
            </select>
          </div>
          
          <div class="filter-section">
            <h4>📅 Scheduling</h4>
            <select id="scheduling-filter" class="filter-select">
              <option value="all" ${this.currentFilters.schedulingType === 'all' ? 'selected' : ''}>All Types</option>
              <option value="flexible" ${this.currentFilters.schedulingType === 'flexible' ? 'selected' : ''}>🤖 Flexible</option>
              <option value="fixed" ${this.currentFilters.schedulingType === 'fixed' ? 'selected' : ''}>🕒 Fixed Time</option>
            </select>
          </div>
          
          <div class="filter-section">
            <h4>🔒 Requirements</h4>
            <select id="mandatory-filter" class="filter-select">
              <option value="all" ${this.currentFilters.isMandatory === 'all' ? 'selected' : ''}>All Tasks</option>
              <option value="true" ${this.currentFilters.isMandatory === 'true' ? 'selected' : ''}>🔒 Mandatory Only</option>
              <option value="false" ${this.currentFilters.isMandatory === 'false' ? 'selected' : ''}>📋 Optional Only</option>
            </select>
          </div>
          
          <div class="filter-section">
            <h4>⚡ Status</h4>
            <select id="status-filter" class="filter-select">
              <option value="all" ${this.currentFilters.isActive === 'all' ? 'selected' : ''}>All Statuses</option>
              <option value="true" ${this.currentFilters.isActive === 'true' ? 'selected' : ''}>✅ Active Only</option>
              <option value="false" ${this.currentFilters.isActive === 'false' ? 'selected' : ''}>⏸️ Inactive Only</option>
            </select>
          </div>
          
          <div class="filter-actions">
            <button type="button" id="clear-filters-btn" class="btn btn-secondary">
              🗑️ Clear Filters
            </button>
            <button type="button" id="apply-filters-btn" class="btn btn-primary">
              ✅ Apply Filters
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render bulk actions bar
   */
  renderBulkActionsBar() {
    const selectedCount = this.selectedTasks.size;
    
    return `
      <div class="bulk-actions-bar" id="bulk-actions-bar" style="display: ${selectedCount > 0 ? 'flex' : 'none'};">
        <div class="bulk-selection">
          <span class="selection-count">${selectedCount} template${selectedCount !== 1 ? 's' : ''} selected</span>
          <button type="button" id="select-all-btn" class="btn btn-link">Select All</button>
          <button type="button" id="deselect-all-btn" class="btn btn-link">Deselect All</button>
        </div>
        
        <div class="bulk-actions">
          <button type="button" id="bulk-activate-btn" class="btn btn-success">
            ✅ Activate Selected
          </button>
          <button type="button" id="bulk-deactivate-btn" class="btn btn-warning">
            ⏸️ Deactivate Selected
          </button>
          <button type="button" id="bulk-duplicate-btn" class="btn btn-secondary">
            📄 Duplicate Selected
          </button>
          <!-- Bulk export temporarily disabled -->
          <!--
          <button type="button" id="bulk-export-btn" class="btn btn-secondary">
            📤 Export Selected
          </button>
          -->
          <button type="button" id="bulk-delete-btn" class="btn btn-danger">
            🗑️ Delete Selected
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render the task grid with templates
   */
  renderTaskGrid(templates) {
    if (templates.length === 0) {
      return this.renderEmptyState();
    }
    
    if (this.currentCategory !== 'all') {
      return this.renderCategorizedGrid(templates);
    }
    
    return `
      <div class="task-grid"></div>
    `;
  }

  /**
   * Render categorized task grid
   */
  renderCategorizedGrid(templates) {
    const categorized = this.categorizeTemplates(templates);
    
    return `
      <div class="categorized-grid">
        ${Object.entries(categorized).map(([category, templates]) => `
          <div class="category-section" data-category="${this.getCategoryDisplayName(category)}">
            <h3 class="category-header">
              ${this.getCategoryDisplayName(category)}
              <span class="category-count">${templates.length}</span>
            </h3>
            <div class="task-grid"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  

  /**
   * Mount TaskCard elements into the grid(s)
   */
  mountTaskCards(templates) {
    if (!this.containerElement) return;
    if (templates.length === 0) return;
    // Optional simple windowing (experimental, disabled by default)
    let renderItems = templates;
    try {
      const enabled = !!window.TASKLIST_WINDOWING_ENABLED;
      const limit = Number(window.TASKLIST_WINDOW_SIZE || 400);
      if (enabled && Number.isFinite(limit) && limit > 0 && templates.length > limit) {
        renderItems = templates.slice(0, limit);
        if (window.DEBUG_TASKLIST) {
          console.log(`[TaskList] windowing enabled: showing ${limit}/${templates.length}`);
        }
      }
    } catch (_) {}

    // Phase 4 Step 2: compute additions/removals/changes via signatures
    const prevCards = new Map(this.cardById);
    const prevSigs = new Map(this.prevSignatures);
    const nextSigs = new Map();
    const prevIds = new Set(prevCards.keys());
    const nextIds = new Set(renderItems.map(t => t.id));
    const removed = [...prevIds].filter(id => !nextIds.has(id));
    const added = renderItems.filter(t => !prevIds.has(t.id)).map(t => t.id);
    const changed = [];
    renderItems.forEach(t => {
      const sig = this.computeTemplateSignature(t);
      nextSigs.set(t.id, sig);
      const prevSig = prevSigs.get(t.id);
      if (prevSig && prevSig !== sig) changed.push(t.id);
    });

    if (window && window.DEBUG_TASKLIST) {
      try {
        console.log('[TaskList] reconcile plan', {
          total: renderItems.length,
          added: added.length,
          removed: removed.length,
          changed: changed.length
        });
      } catch (_) {}
    }

    const changedSet = new Set(changed);
    const applyUpdates = () => {
      const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const newCardById = new Map();
      if (this.currentCategory === 'all') {
        const grid = this.containerElement.querySelector('.task-grid');
        if (grid) {
          this.reconcileGrid(grid, renderItems, prevCards, changedSet, newCardById);
        }
      } else {
        const categorized = this.categorizeTemplates(renderItems);
        Object.entries(categorized).forEach(([category, items]) => {
          const display = this.getCategoryDisplayName(category);
          const section = this.containerElement.querySelector(`.category-section[data-category="${CSS.escape(display)}"]`);
          const gridEl = section?.querySelector('.task-grid');
          if (!gridEl) return;
          this.reconcileGrid(gridEl, items, prevCards, changedSet, newCardById);
        });
      }
      this.cardById = newCardById;
      this.prevSignatures = nextSigs;
      if (window && window.DEBUG_TASKLIST) {
        try {
          const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          console.log(`[TaskList] reconcile done in ${(t1 - t0).toFixed(1)}ms, nodes: ${renderItems.length}`);
        } catch (_) {}
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(applyUpdates);
    } else {
      applyUpdates();
    }
  }

  /**
   * Reconcile a grid container to match the desired templates order/content.
   */
  reconcileGrid(grid, items, prevCards, changedSet, outMap) {
    const desiredElements = [];
    const desiredSet = new Set();

    // Preserve scroll position and focus
    const prevScrollTop = grid.scrollTop;
    let restoreFocus = null;
    const active = document.activeElement;
    if (active && grid.contains(active)) {
      const cardEl = active.closest('.task-card');
      const templateId = cardEl?.getAttribute('data-template-id');
      if (templateId) {
        let control = null;
        if (active.classList.contains('task-checkbox')) control = '.task-checkbox';
        else if (active.classList.contains('edit-btn')) control = '.edit-btn';
        else if (active.classList.contains('duplicate-btn')) control = '.duplicate-btn';
        else if (active.classList.contains('toggle-status-btn')) control = '.toggle-status-btn';
        restoreFocus = { templateId, control };
      }
    }

    // Build desired elements, reusing unchanged nodes when possible
    items.forEach(t => {
      let el = prevCards.get(t.id);
      const needsReplace = !el || changedSet.has(t.id) || !grid.contains(el);
      if (needsReplace) {
        el = TaskCard.create({ template: t, isSelected: this.selectedTasks.has(t.id) });
      }
      desiredElements.push(el);
      desiredSet.add(el);
      outMap.set(t.id, el);
    });

    // Remove nodes that are no longer desired
    Array.from(grid.children).forEach(child => {
      if (!desiredSet.has(child)) {
        grid.removeChild(child);
      }
    });

    // Reorder/insert nodes to match desired order
    let cursor = grid.firstChild;
    desiredElements.forEach(el => {
      if (cursor === el) {
        cursor = cursor.nextSibling;
      } else {
        grid.insertBefore(el, cursor);
      }
    });

    // Attempt to restore focus target if still present
    if (restoreFocus) {
      try {
        const card = grid.querySelector(`.task-card[data-template-id="${CSS.escape(restoreFocus.templateId)}"]`);
        let target = null;
        if (card) {
          target = restoreFocus.control ? card.querySelector(restoreFocus.control) : card;
        }
        if (target && typeof target.focus === 'function') {
          try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
        }
      } catch (_) {}
    }

    // Restore scroll position
    grid.scrollTop = prevScrollTop;
  }

  /**
   * Build a lightweight signature string to detect meaningful card changes.
   * Include fields that affect card rendering and ordering.
   */
  computeTemplateSignature(t) {
    return [
      t.taskName || '',
      t.description || '',
      t.priority ?? '',
      t.durationMinutes ?? '',
      t.isMandatory ? '1' : '0',
      t.isActive !== false ? '1' : '0',
      t.schedulingType || '',
      t.timeWindow || '',
      t.defaultTime || '',
      (t.dependsOn && t.dependsOn.length) || 0,
      (t.recurrenceRule && t.recurrenceRule.frequency) || 'none',
      this.currentSort,
      this.sortDirection
    ].join('|');
  }

  /**
   * Render empty state
   */
  renderEmptyState() {
    const hasFilters = this.hasActiveFilters();
    
    return `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h3 class="empty-title">
          ${hasFilters ? 'No templates match your filters' : 'No task templates yet'}
        </h3>
        <p class="empty-description">
          ${hasFilters ? 
            'Try adjusting your search or filter criteria to find templates.' :
            'Create your first task template to get started with automated daily scheduling.'
          }
        </p>
        <div class="empty-actions">
          ${hasFilters ? `
            <button type="button" id="clear-all-filters-btn" class="btn btn-secondary">
              🗑️ Clear All Filters
            </button>
          ` : ''}
          <button type="button" id="create-first-template-btn" class="btn btn-primary">
            ➕ Create Your First Template
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render pagination (placeholder for future implementation)
   */
  renderPagination(templates) {
    // For now, just return empty string
    // In the future, implement pagination for large template sets
    templates; // Mark parameter as used for now
    return '';
  }

  /**
   * Get filtered and sorted templates
   */
  getFilteredAndSortedTemplates() {
    const criteria = this.buildCriteriaFromUI();
    const templates = state.getTaskTemplates() || [];
    return TaskQuery.queryTemplates(criteria, templates);
  }

  /**
   * (Removed) applyDetailedFilters and sortTemplates moved to TaskQuery.
   * Source of truth: TaskQuery.queryTemplates(criteria).
   */

  /**
   * Categorize templates based on current category setting
   */
  categorizeTemplates(templates) {
    const categories = {};
    
    templates.forEach(template => {
      let categoryKey = '';
      
      switch (this.currentCategory) {
        case 'priority':
          categoryKey = `Priority ${template.priority || 3}`;
          break;
        case 'timeWindow':
          if (template.schedulingType === 'fixed') {
            categoryKey = 'Fixed Time Tasks';
          } else {
            const window = TIME_WINDOWS[template.timeWindow] || { label: template.timeWindow || 'Anytime' };
            categoryKey = window.label;
          }
          break;
        case 'scheduling':
          categoryKey = template.schedulingType === 'fixed' ? 'Fixed Time Tasks' : 'Flexible Tasks';
          break;
        default:
          categoryKey = 'All Templates';
      }
      
      if (!categories[categoryKey]) {
        categories[categoryKey] = [];
      }
      categories[categoryKey].push(template);
    });
    
    return categories;
  }

  /**
   * Get template statistics
   */
  getTemplateStats(templates) {
    return {
      total: templates.length,
      active: templates.filter(t => t.isActive !== false).length,
      inactive: templates.filter(t => t.isActive === false).length,
      highPriority: templates.filter(t => (t.priority || 3) >= 4).length,
      mandatory: templates.filter(t => t.isMandatory).length
    };
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    if (!this.containerElement) return;
    
    // Clear existing listeners
    this.clearEventListeners();
    
    // === Header Actions ===
    this.addEventListeners([
      // Create template button
      ['#create-template-btn', 'click', () => this.handleCreateTemplate()],
      ['#create-first-template-btn', 'click', () => this.handleCreateTemplate()],
      
      // Import/Export buttons - temporarily disabled
      // ['#import-templates-btn', 'click', () => this.handleImportTemplates()],
      // ['#export-templates-btn', 'click', () => this.handleExportTemplates()],
      
      // Toolbar decoupled: events handled via TaskListToolbar semantic events
      
      // === Filters Panel ===
      
      // Filter controls
      ['#priority-filter', 'change', (e) => this.handleFilterChange('priority', e.target.value)],
      ['#time-window-filter', 'change', (e) => this.handleFilterChange('timeWindow', e.target.value)],
      ['#scheduling-filter', 'change', (e) => this.handleFilterChange('schedulingType', e.target.value)],
      ['#mandatory-filter', 'change', (e) => this.handleFilterChange('isMandatory', e.target.value)],
      ['#status-filter', 'change', (e) => this.handleFilterChange('isActive', e.target.value)],
      
      // Filter actions
      ['#clear-filters-btn', 'click', () => this.handleClearFilters()],
      ['#clear-all-filters-btn', 'click', () => this.handleClearAllFilters()],
      ['#apply-filters-btn', 'click', () => this.handleApplyFilters()],
      
      // === Selection and Bulk Actions ===
      
      // Selection controls
      ['#select-all-btn', 'click', () => this.handleSelectAll()],
      ['#deselect-all-btn', 'click', () => this.handleDeselectAll()],
      
      // Individual task checkboxes (delegated)
      ['.task-checkbox', 'change', (e) => this.handleTaskSelection(e.target.dataset.templateId, e.target.checked)],
      
      // Bulk actions
      ['#bulk-activate-btn', 'click', () => this.handleBulkAction('activate')],
      ['#bulk-deactivate-btn', 'click', () => this.handleBulkAction('deactivate')],
      ['#bulk-duplicate-btn', 'click', () => this.handleBulkAction('duplicate')],
      // ['#bulk-export-btn', 'click', () => this.handleBulkAction('export')], // temporarily disabled
      ['#bulk-delete-btn', 'click', () => this.handleBulkAction('delete')],
      
      // === Task Card Actions ===
      
      // Individual task actions (delegated)
      ['.edit-btn', 'click', (e) => this.handleEditTemplate(e.target.dataset.templateId)],
      ['.duplicate-btn', 'click', (e) => this.handleDuplicateTemplate(e.target.dataset.templateId)],
      ['.toggle-status-btn', 'click', (e) => this.handleToggleTemplateStatus(e.target.dataset.templateId)]
    ]);
  }

  /**
   * Add multiple event listeners with proper cleanup tracking
   */
  addEventListeners(listenerConfigs) {
    listenerConfigs.forEach(([selector, event, handler]) => {
      const elements = this.containerElement.querySelectorAll(selector);
      elements.forEach(element => {
        const listenerId = SafeEventListener.add(
          element,
          event,
          handler,
          { description: `TaskList ${selector} ${event}` }
        );
        this.eventListeners.push(listenerId);
      });
    });
  }

  /**
   * Clear all event listeners
   */
  clearEventListeners() {
    this.eventListeners.forEach(listenerId => {
      SafeEventListener.remove(listenerId);
    });
    this.eventListeners = [];
  }

  // === Event Handlers ===

  /**
   * Handle create template button
   */
  handleCreateTemplate() {
    taskModal.showCreate({}, (newTemplate) => {
      if (newTemplate) {
        SimpleErrorHandler.showSuccess('Template created successfully!');
        this.refreshView();
      }
    });
  }

  /**
   * Handle view switch
   */
  handleViewSwitch(view) {
    this.currentView = view;
    this.selectedTasks.clear(); // Clear selection when switching views
    this.refreshView();
  }

  /**
   * Handle category change
   */
  handleCategoryChange(category) {
    this.currentCategory = category;
    this.refreshView();
  }

  /**
   * Handle sort change
   */
  handleSortChange(sortBy) {
    this.currentSort = sortBy;
    this.refreshView();
  }

  /**
   * Handle sort direction toggle
   */
  handleSortDirectionToggle() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.refreshView();
  }

  /**
   * Handle search input
   */
  handleSearchInput(query) {
    this.searchQuery = query.trim();
    
    // Debounce search to avoid excessive re-renders
    if (this.searchTimeout) {
      SafeTimeout.clear(this.searchTimeout);
    }
    
    this.searchTimeout = SafeTimeout.set(() => {
      this.refreshView();
    }, 150, 'TaskList search debounce');
    
    this.timeouts.push(this.searchTimeout);
  }

  /**
   * Handle clear search
   */
  handleClearSearch() {
    this.searchQuery = '';
    this.refreshView();
  }

  /**
   * Handle toggle filters panel
   */
  handleToggleFilters() {
    const filtersPanel = this.containerElement.querySelector('#filters-panel');
    if (filtersPanel) {
      const isVisible = filtersPanel.style.display !== 'none';
      filtersPanel.style.display = isVisible ? 'none' : 'block';
      
      // Update button text
      const toggleBtn = this.containerElement.querySelector('#toggle-filters-btn');
      if (toggleBtn) {
        toggleBtn.textContent = isVisible ? '🔧 Filters' : '🔧 Hide Filters';
      }
    }
  }

  /**
   * Handle filter change
   */
  handleFilterChange(filterType, value) {
    this.currentFilters[filterType] = value;
    // Auto-apply filters on change
    this.refreshView();
  }

  /**
   * Handle clear filters
   */
  handleClearFilters() {
    this.currentFilters = {
      priority: 'all',
      timeWindow: 'all',
      schedulingType: 'all',
      isMandatory: 'all',
      isActive: 'all'
    };
    this.refreshView();
  }

  /**
   * Handle clear all filters and search
   */
  handleClearAllFilters() {
    this.searchQuery = '';
    this.handleClearFilters();
  }

  /**
   * Handle apply filters (currently auto-applied)
   */
  handleApplyFilters() {
    this.refreshView();
  }

  /**
   * Handle select all templates
   */
  handleSelectAll() {
    const templates = this.getFilteredAndSortedTemplates();
    templates.forEach(template => {
      this.selectedTasks.add(template.id);
    });
    this.updateBulkActionsBar();
    this.updateTaskCardSelections();
  }

  /**
   * Handle deselect all templates
   */
  handleDeselectAll() {
    this.selectedTasks.clear();
    this.updateBulkActionsBar();
    this.updateTaskCardSelections();
  }

  /**
   * Handle individual task selection
   */
  handleTaskSelection(templateId, isSelected) {
    if (isSelected) {
      this.selectedTasks.add(templateId);
    } else {
      this.selectedTasks.delete(templateId);
    }
    
    this.updateBulkActionsBar();
    this.updateTaskCardAppearance(templateId);
  }

  /**
   * Handle bulk actions
   */
  async handleBulkAction(action) {
    const selectedIds = Array.from(this.selectedTasks);
    if (selectedIds.length === 0) {
      SimpleErrorHandler.showWarning('Please select templates to perform bulk actions.');
      return;
    }
    
    try {
      let confirmMessage = '';
      let successMessage = '';
      
      switch (action) {
        case 'activate':
          confirmMessage = `Activate ${selectedIds.length} selected template${selectedIds.length !== 1 ? 's' : ''}?`;
          successMessage = 'Templates activated successfully!';
          break;
        case 'deactivate':
          confirmMessage = `Deactivate ${selectedIds.length} selected template${selectedIds.length !== 1 ? 's' : ''}?`;
          successMessage = 'Templates deactivated successfully!';
          break;
        case 'duplicate':
          confirmMessage = `Duplicate ${selectedIds.length} selected template${selectedIds.length !== 1 ? 's' : ''}?`;
          successMessage = 'Tasks duplicated successfully!';
          break;
        // case 'export': // temporarily disabled
          // await this.handleBulkExport(selectedIds);
          // return;
        case 'delete':
          confirmMessage = `Delete ${selectedIds.length} selected template${selectedIds.length !== 1 ? 's' : ''}? This action cannot be undone.`;
          successMessage = 'Templates deleted successfully!';
          break;
      }
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // Show loading state
      this.showBulkActionLoading(true);
      
      // Perform bulk action
      switch (action) {
        case 'activate':
          await taskTemplateManager.getBulkOperations().bulkActivate(selectedIds);
          break;
        case 'deactivate':
          await taskTemplateManager.getBulkOperations().bulkDeactivate(selectedIds);
          break;
        case 'duplicate':
          {
            const uid = state.getUser()?.uid;
            if (!uid) {
              SimpleErrorHandler.showError('Please sign in to duplicate templates.');
              break;
            }
            for (const id of selectedIds) {
              await taskTemplateManager.duplicate(uid, id);
            }
          }
          break;
        case 'delete':
          for (const id of selectedIds) {
            await taskTemplateManager.delete(id);
          }
          break;
      }
      
      SimpleErrorHandler.showSuccess(successMessage);
      this.selectedTasks.clear();
      this.refreshView();
      
    } catch (error) {
      console.error(`Bulk ${action} error:`, error);
      SimpleErrorHandler.showError(`Failed to ${action} templates. Please try again.`, error);
    } finally {
      this.showBulkActionLoading(false);
    }
  }

  /**
   * Handle individual template edit
   */
  handleEditTemplate(templateId) {
    const template = state.getTaskTemplateById(templateId);
    if (!template) {
      SimpleErrorHandler.showError('Template not found.');
      return;
    }
    
    taskModal.showEdit(template, (updatedTemplate) => {
      if (updatedTemplate) {
        SimpleErrorHandler.showSuccess('Template updated successfully!');
        this.refreshView();
      }
    });
  }

  /**
   * Handle individual template duplicate
   */
  async handleDuplicateTemplate(templateId) {
    try {
      const uid = state.getUser()?.uid;
      if (!uid) {
        SimpleErrorHandler.showError('Please sign in to duplicate templates.');
        return;
      }
      await taskTemplateManager.duplicate(uid, templateId);
      SimpleErrorHandler.showSuccess('Task duplicated successfully!');
      this.refreshView();
    } catch (error) {
      console.error('Duplicate template error:', error);
      SimpleErrorHandler.showError('Failed to duplicate template. Please try again.', error);
    }
  }

  /**
   * Handle individual template status toggle
   */
  async handleToggleTemplateStatus(templateId) {
    try {
      const template = state.getTaskTemplateById(templateId);
      if (!template) {
        SimpleErrorHandler.showError('Template not found.');
        return;
      }
      
      const newStatus = !template.isActive;
      await taskTemplateManager.update(templateId, { isActive: newStatus });
      
      const statusText = newStatus ? 'activated' : 'deactivated';
      SimpleErrorHandler.showSuccess(`Template ${statusText} successfully!`);
      this.refreshView();
      
    } catch (error) {
      console.error('Toggle template status error:', error);
      SimpleErrorHandler.showError('Failed to update template status. Please try again.', error);
    }
  }

  /**
   * Handle import templates
   */
  handleImportTemplates() {
    // Create file input for import
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const templates = JSON.parse(text);
        
        if (!Array.isArray(templates)) {
          throw new Error('Invalid file format. Expected array of templates.');
        }
        
        // Import templates
        let imported = 0;
        const uid = state.getUser()?.uid;
        if (!uid) {
          SimpleErrorHandler.showError('Please sign in to import templates.');
          return;
        }
        for (const template of templates) {
          try {
            await taskTemplateManager.create(uid, template);
            imported++;
          } catch (error) {
            console.warn('Failed to import template:', template.taskName, error);
          }
        }
        
        SimpleErrorHandler.showSuccess(`Successfully imported ${imported} of ${templates.length} templates.`);
        this.refreshView();
        
      } catch (error) {
        console.error('Import error:', error);
        SimpleErrorHandler.showError('Failed to import templates. Please check the file format.', error);
      } finally {
        document.body.removeChild(fileInput);
      }
    });
    
    document.body.appendChild(fileInput);
    fileInput.click();
  }

  /**
   * Handle export templates
   */
  async handleExportTemplates() {
    try {
      const templates = state.getTaskTemplates();
      await this.downloadTemplatesAsJson(templates, 'task-templates-all.json');
      SimpleErrorHandler.showSuccess('Templates exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      SimpleErrorHandler.showError('Failed to export templates. Please try again.', error);
    }
  }

  /**
   * Handle bulk export
   */
  async handleBulkExport(templateIds) {
    try {
      const templates = templateIds.map(id => state.getTaskTemplateById(id)).filter(Boolean);
      await this.downloadTemplatesAsJson(templates, 'task-templates-selected.json');
      SimpleErrorHandler.showSuccess('Selected templates exported successfully!');
    } catch (error) {
      console.error('Bulk export error:', error);
      SimpleErrorHandler.showError('Failed to export selected templates. Please try again.', error);
    }
  }

  // === Utility Methods ===

  /**
   * Refresh the entire view
   */
  refreshView() {
    this.render();
    this.setupEventListeners();
  }

  /**
   * Update bulk actions bar visibility and content
   */
  updateBulkActionsBar() {
    const bulkActionsBar = this.containerElement?.querySelector('#bulk-actions-bar');
    if (bulkActionsBar) {
      const selectedCount = this.selectedTasks.size;
      bulkActionsBar.style.display = selectedCount > 0 ? 'flex' : 'none';
      
      const selectionCount = bulkActionsBar.querySelector('.selection-count');
      if (selectionCount) {
        selectionCount.textContent = `${selectedCount} template${selectedCount !== 1 ? 's' : ''} selected`;
      }
    }
  }

  /**
   * Update task card selection checkboxes
   */
  updateTaskCardSelections() {
    const checkboxes = this.containerElement?.querySelectorAll('.task-checkbox');
    checkboxes?.forEach(checkbox => {
      const templateId = checkbox.dataset.templateId;
      checkbox.checked = this.selectedTasks.has(templateId);
      this.updateTaskCardAppearance(templateId);
    });
  }

  /**
   * Update individual task card appearance based on selection
   */
  updateTaskCardAppearance(templateId) {
    const taskCard = this.containerElement?.querySelector(`.task-card[data-template-id="${templateId}"]`);
    if (taskCard) {
      if (this.selectedTasks.has(templateId)) {
        taskCard.classList.add('selected');
      } else {
        taskCard.classList.remove('selected');
      }
    }
  }

  /**
   * Show bulk action loading state
   */
  showBulkActionLoading(isLoading) {
    const bulkButtons = this.containerElement?.querySelectorAll('.bulk-actions button');
    bulkButtons?.forEach(button => {
      button.disabled = isLoading;
      if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.textContent = '⏳ Processing...';
      } else {
        button.textContent = button.dataset.originalText || button.textContent;
      }
    });
  }

  /**
   * Download templates as JSON file
   */
  async downloadTemplatesAsJson(templates, filename) {
    const jsonData = JSON.stringify(templates, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Check if any filters are currently active
   */
  hasActiveFilters() {
    return this.searchQuery || 
           this.currentFilters.priority !== 'all' ||
           this.currentFilters.timeWindow !== 'all' ||
           this.currentFilters.schedulingType !== 'all' ||
           this.currentFilters.isMandatory !== 'all' ||
           this.currentFilters.isActive !== 'all';
  }


  /**
   * Get category display name
   */
  getCategoryDisplayName(category) {
    // If category is already a display name, return as-is
    if (category.includes('Priority') || category.includes('Tasks') || category.includes('Fixed') || 
        category === 'Morning' || category === 'Afternoon' || category === 'Evening' || 
        category === 'Anytime' || category === 'All Templates') {
      return category;
    }
    
    // Otherwise, format it nicely
    return category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1');
  }


  

  /**
   * Destroy the component and clean up resources
   */
  destroy() {
    // Prevent double cleanup
    if (this._isDestroying || this._isDestroyed) return;
    
    // Clear event listeners
    this.clearEventListeners();
    
    // Clear timeouts
    this.timeouts.forEach(timeoutId => {
      SafeTimeout.clear(timeoutId);
    });
    this.timeouts = [];
    
    // Remove state change listener
    document.removeEventListener('stateChanged', this.handleTemplateChange);
    
    // Clear container
    if (this.containerElement) {
      this.containerElement.innerHTML = '';
      this.containerElement = null;
    }
    
    // Clear data
    this.selectedTasks.clear();
    this.cardById.clear();
    this.prevSignatures.clear();
    
    // DO NOT call ComponentManager.unregister(this) here to prevent recursion
    // Memory manager handles unregistration externally via MemoryLeakPrevention.unregisterComponent()
  }
}

// Create and export global instance
export const taskList = new TaskList();

console.log('✅ Task list component initialized');
