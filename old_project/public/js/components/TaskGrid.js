/**
 * TaskGrid — dumb presentational component
 *
 * Renders a container with items appended using a provided renderItem callback.
 * No internal state; purely structural/layout concerns.
 */

/**
 * Create a TaskGrid container element and populate it.
 *
 * @param {Object} options
 * @param {Array<any>} options.items - Items to render
 * @param {Function} options.renderItem - (item) => HTMLElement | null
 * @param {string} [options.className='task-grid'] - Container class name
 * @returns {HTMLElement}
 */
export function createTaskGrid({ items = [], renderItem, className = 'task-grid' } = {}) {
  const container = document.createElement('div');
  container.className = className || 'task-grid';

  if (typeof renderItem !== 'function') {
    return container;
  }

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const el = renderItem(item);
    if (el instanceof HTMLElement) {
      fragment.appendChild(el);
    }
  }
  container.appendChild(fragment);
  return container;
}

export const TaskGrid = { create: createTaskGrid };

