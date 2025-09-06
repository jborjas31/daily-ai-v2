/**
 * Logic Module Index
 * 
 * Centralized export point for all business logic modules.
 * Part of Phase 1 refactoring to create modular architecture.
 */

// Phase 1: Task querying and filtering
export { TaskQuery } from './TaskQuery.js';

// Phase 2: Recurrence engine
export { RecurrenceEngine } from './Recurrence.js';

// Phase 3: Dependency resolution
export { DependencyResolver } from './DependencyResolver.js';

// Phase 4: Scheduling engine
// export { SchedulingEngine } from './SchedulingEngine.js';

// Phase 5: Manager classes (refactored)
// export { TaskTemplateManager } from './TaskTemplateManager.js';
// export { TaskInstanceManager } from './TaskInstanceManager.js';