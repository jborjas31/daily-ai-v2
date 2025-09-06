/**
 * Components Index
 * 
 * Central export file for all UI components
 * Provides easy importing of components throughout the application
 */

// Import all components
import { TaskModalContainer } from './TaskModalContainer.js';
import { TimelineContainer } from './TimelineContainer.js';
import { TaskBlock, taskBlockUtils } from './TaskBlock.js';

// Export all components
export {
  // Task Modal Container (V2)
  TaskModalContainer,
  
  // Timeline Components
  TimelineContainer,
  
  // Task Block Component
  TaskBlock,
  taskBlockUtils
};

// Default export for convenience
export default {
  TaskModalContainer,
  TimelineContainer,
  TaskBlock,
  taskBlockUtils
};

console.log('✅ Components index loaded');
