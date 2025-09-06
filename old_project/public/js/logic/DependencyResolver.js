/**
 * Dependency Resolution Module
 * 
 * Comprehensive dependency management system with graph algorithms.
 * Extracted from TaskInstanceManager as part of Phase 3 refactoring.
 * 
 * Features:
 * - Topological sorting for dependency ordering
 * - Circular dependency detection using DFS
 * - Dependency constraint validation
 * - Scheduling optimization based on dependencies
 */

export class DependencyResolver {
  constructor() {
    // Optional logger for debugging dependency resolution
    this.logger = console;
  }

  /**
   * Main entry point: Resolve dependencies for all instances on a specific date
   * @param {string} userId - User ID 
   * @param {string} date - Date string (YYYY-MM-DD)
   * @param {Array} instances - Task instances for the date
   * @returns {Object} Resolution results with conflicts, warnings, and dependency order
   */
  async resolveDependencies(userId, date, instances = []) {
    try {
      this.logger.log(`🔄 Resolving dependencies for date: ${date}`);
      
      if (instances.length === 0) {
        this.logger.log(`ℹ️ No instances found for ${date}, skipping dependency resolution`);
        return { resolved: 0, conflicts: 0, warnings: [] };
      }
      
      // Build dependency graph
      const dependencyGraph = this.buildDependencyGraph(instances);
      
      // Check for circular dependencies
      const circularDependencies = this.detectCircularDependencies(dependencyGraph);
      if (circularDependencies.length > 0) {
        this.logger.warn(`⚠️ Circular dependencies detected for ${date}:`, circularDependencies);
      }
      
      // Resolve dependency order using topological sort
      const sortedInstances = this.topologicalSort(instances, dependencyGraph);
      
      // Apply dependency constraints and update scheduling
      const resolutionResults = await this.applyDependencyConstraints(sortedInstances, dependencyGraph);
      
      const result = {
        date,
        totalInstances: instances.length,
        resolved: resolutionResults.resolved,
        conflicts: resolutionResults.conflicts,
        warnings: resolutionResults.warnings,
        circularDependencies,
        dependencyOrder: sortedInstances.map(i => ({ id: i.id, name: i.taskName }))
      };
      
      this.logger.log(`✅ Dependency resolution completed for ${date}: ${result.resolved} resolved, ${result.conflicts} conflicts`);
      return result;
      
    } catch (error) {
      this.logger.error('❌ Error resolving dependencies:', error);
      throw error;
    }
  }

  /**
   * Build dependency graph from task instances
   * @param {Array} instances - Task instances with dependency information
   * @returns {Map} Dependency graph with nodes containing instance data and relationships
   */
  buildDependencyGraph(instances) {
    const graph = new Map();
    const instanceMap = new Map();
    
    // Initialize graph nodes and create instance lookup map
    instances.forEach(instance => {
      instanceMap.set(instance.id, instance);
      graph.set(instance.id, {
        instance,
        dependencies: [], // Instances this depends on
        dependents: []    // Instances that depend on this
      });
    });
    
    // Build dependency relationships
    instances.forEach(instance => {
      if (instance.dependsOn && instance.dependsOn.length > 0) {
        const node = graph.get(instance.id);
        
        instance.dependsOn.forEach(dependencyId => {
          if (instanceMap.has(dependencyId)) {
            // Add dependency relationship
            node.dependencies.push(dependencyId);
            
            // Add reverse relationship
            const dependencyNode = graph.get(dependencyId);
            if (dependencyNode) {
              dependencyNode.dependents.push(instance.id);
            }
          } else {
            this.logger.warn(`⚠️ Dependency ${dependencyId} not found for instance ${instance.id}`);
          }
        });
      }
    });
    
    return graph;
  }

  /**
   * Detect circular dependencies using Depth-First Search (DFS)
   * @param {Map} dependencyGraph - The dependency graph
   * @returns {Array} Array of circular dependency chains
   */
  detectCircularDependencies(dependencyGraph) {
    const visited = new Set();
    const recursionStack = new Set();
    const circularDependencies = [];
    
    const dfsVisit = (nodeId, path = []) => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart).concat(nodeId);
        circularDependencies.push(cycle);
        return;
      }
      
      if (visited.has(nodeId)) {
        return; // Already processed
      }
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const node = dependencyGraph.get(nodeId);
      if (node) {
        node.dependencies.forEach(depId => {
          dfsVisit(depId, path.concat(nodeId));
        });
      }
      
      recursionStack.delete(nodeId);
    };
    
    // Visit all nodes to find all cycles
    for (const nodeId of dependencyGraph.keys()) {
      if (!visited.has(nodeId)) {
        dfsVisit(nodeId);
      }
    }
    
    return circularDependencies;
  }

  /**
   * Perform topological sort to determine dependency execution order
   * Uses DFS-based approach (Kahn's algorithm variation)
   * @param {Array} instances - Task instances to sort
   * @param {Map} dependencyGraph - The dependency graph
   * @returns {Array} Topologically sorted instances (dependencies first)
   */
  topologicalSort(instances, dependencyGraph) {
    const sorted = [];
    const visited = new Set();
    const temp = new Set(); // Temporary mark for cycle detection
    
    const visit = (nodeId) => {
      if (temp.has(nodeId)) {
        // Circular dependency detected - return early to avoid infinite recursion
        this.logger.warn(`⚠️ Circular dependency detected during topological sort involving node: ${nodeId}`);
        return;
      }
      
      if (visited.has(nodeId)) {
        return; // Already processed
      }
      
      temp.add(nodeId);
      
      const node = dependencyGraph.get(nodeId);
      if (node) {
        // Visit all dependencies first (recursive DFS)
        node.dependencies.forEach(depId => {
          visit(depId);
        });
      }
      
      temp.delete(nodeId);
      visited.add(nodeId);
      
      // Add to sorted list (dependencies come first due to DFS post-order)
      const instance = instances.find(i => i.id === nodeId);
      if (instance) {
        sorted.unshift(instance);
      }
    };
    
    // Visit all nodes
    instances.forEach(instance => {
      if (!visited.has(instance.id)) {
        visit(instance.id);
      }
    });
    
    return sorted;
  }

  /**
   * Validate the entire dependency chain for correctness
   * @param {Array} instances - Task instances to validate
   * @returns {Object} Validation result with errors and warnings
   */
  validateDependencyChain(instances) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      statistics: {
        totalTasks: instances.length,
        tasksWithDependencies: 0,
        averageDependencyCount: 0,
        maxDependencyDepth: 0
      }
    };

    const dependencyGraph = this.buildDependencyGraph(instances);
    
    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(dependencyGraph);
    if (circularDeps.length > 0) {
      result.isValid = false;
      result.errors.push({
        type: 'circular_dependencies',
        message: 'Circular dependencies detected',
        details: circularDeps
      });
    }

    // Validate individual dependencies
    let totalDependencies = 0;
    instances.forEach(instance => {
      if (instance.dependsOn && instance.dependsOn.length > 0) {
        result.statistics.tasksWithDependencies++;
        totalDependencies += instance.dependsOn.length;

        // Check for missing dependencies
        instance.dependsOn.forEach(depId => {
          const depExists = instances.find(i => i.id === depId);
          if (!depExists) {
            result.isValid = false;
            result.errors.push({
              type: 'missing_dependency',
              message: `Task "${instance.taskName}" depends on non-existent task: ${depId}`,
              taskId: instance.id,
              missingDependencyId: depId
            });
          }
        });
      }
    });

    // Calculate statistics
    if (result.statistics.tasksWithDependencies > 0) {
      result.statistics.averageDependencyCount = Math.round(
        (totalDependencies / result.statistics.tasksWithDependencies) * 10
      ) / 10;
    }

    // Calculate maximum dependency depth
    result.statistics.maxDependencyDepth = this.calculateMaxDependencyDepth(dependencyGraph);

    return result;
  }

  /**
   * Apply dependency constraints to sorted instances
   * @private
   */
  async applyDependencyConstraints(sortedInstances, dependencyGraph) {
    let resolved = 0;
    let conflicts = 0;
    const warnings = [];
    
    for (const instance of sortedInstances) {
      try {
        const node = dependencyGraph.get(instance.id);
        
        if (node && node.dependencies.length > 0) {
          // Check if all dependencies are satisfied
          const dependencyResults = this.checkDependencyConstraints(instance, node, dependencyGraph);
          
          if (dependencyResults.canSchedule) {
            // Apply dependency-based scheduling adjustments
            const schedulingUpdate = this.calculateDependencyScheduling(instance, dependencyResults);
            
            if (schedulingUpdate.needsUpdate) {
              // Note: In the extracted version, we don't directly update instances
              // This should be handled by the calling code
              resolved++;
            } else {
              resolved++;
            }
          } else {
            conflicts++;
            warnings.push({
              instanceId: instance.id,
              instanceName: instance.taskName,
              issue: 'dependency_conflict',
              details: dependencyResults.conflictReason
            });
          }
        } else {
          // No dependencies, mark as resolved
          resolved++;
        }
        
      } catch (error) {
        this.logger.error(`❌ Error processing dependency constraints for ${instance.id}:`, error);
        conflicts++;
      }
    }
    
    return { resolved, conflicts, warnings };
  }

  /**
   * Check dependency constraints for a specific instance
   * @private
   */
  checkDependencyConstraints(instance, node, dependencyGraph) {
    const result = {
      canSchedule: true,
      conflictReason: null,
      dependencyInfo: []
    };
    
    for (const depId of node.dependencies) {
      const depNode = dependencyGraph.get(depId);
      if (!depNode) {
        result.canSchedule = false;
        result.conflictReason = `Dependency ${depId} not found`;
        break;
      }
      
      const depInstance = depNode.instance;
      
      // Check dependency status
      if (depInstance.status === 'skipped') {
        result.canSchedule = false;
        result.conflictReason = `Dependency "${depInstance.taskName}" was skipped`;
        break;
      }
      
      // Check dependency completion requirement
      if (instance.isMandatory && depInstance.status !== 'completed') {
        // For mandatory tasks, dependencies must be completed
        result.canSchedule = false;
        result.conflictReason = `Mandatory task requires completed dependency "${depInstance.taskName}"`;
        break;
      }
      
      result.dependencyInfo.push({
        id: depId,
        name: depInstance.taskName,
        status: depInstance.status,
        scheduledTime: depInstance.scheduledTime,
        durationMinutes: depInstance.durationMinutes
      });
    }
    
    return result;
  }

  /**
   * Calculate dependency-based scheduling adjustments
   * @private
   */
  calculateDependencyScheduling(instance, dependencyResults) {
    const updates = {};
    let needsUpdate = false;
    
    // Find the latest dependency end time
    let latestEndTime = null;
    
    for (const dep of dependencyResults.dependencyInfo) {
      if (dep.scheduledTime) {
        const depStartTime = new Date(`${instance.date}T${dep.scheduledTime}`);
        const depEndTime = new Date(depStartTime.getTime() + (dep.durationMinutes || 30) * 60000);
        
        if (!latestEndTime || depEndTime > latestEndTime) {
          latestEndTime = depEndTime;
        }
      }
    }
    
    if (latestEndTime) {
      // Add buffer time after dependency completion
      const bufferMinutes = 15; // 15-minute buffer
      const suggestedStartTime = new Date(latestEndTime.getTime() + bufferMinutes * 60000);
      const suggestedTimeString = `${suggestedStartTime.getHours().toString().padStart(2, '0')}:${suggestedStartTime.getMinutes().toString().padStart(2, '0')}`;
      
      // Only update if current scheduled time is earlier than suggested time
      if (!instance.scheduledTime || instance.scheduledTime < suggestedTimeString) {
        updates.scheduledTime = suggestedTimeString;
        updates.modificationReason = 'Adjusted for dependency constraints';
        needsUpdate = true;
      }
    }
    
    return { updates, needsUpdate };
  }

  /**
   * Calculate maximum dependency depth in the graph
   * @private
   */
  calculateMaxDependencyDepth(dependencyGraph) {
    let maxDepth = 0;
    const visited = new Set();

    const calculateDepth = (nodeId, currentDepth = 0) => {
      if (visited.has(nodeId)) {
        return currentDepth; // Avoid infinite recursion in cycles
      }
      
      visited.add(nodeId);
      const node = dependencyGraph.get(nodeId);
      
      if (!node || node.dependencies.length === 0) {
        visited.delete(nodeId);
        return currentDepth;
      }

      let maxChildDepth = currentDepth;
      for (const depId of node.dependencies) {
        const childDepth = calculateDepth(depId, currentDepth + 1);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
      
      visited.delete(nodeId);
      return maxChildDepth;
    };

    for (const nodeId of dependencyGraph.keys()) {
      const depth = calculateDepth(nodeId);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  /**
   * Optimize dependency sequencing for better scheduling
   * @param {Array} instances - Task instances to optimize
   * @param {string} date - Date string for context
   * @returns {Array} Array of optimization suggestions
   */
  async optimizeDependencySequencing(instances, date) {
    const optimizations = [];
    
    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(instances);
    
    // Check if dependencies can be better sequenced
    for (const instance of instances) {
      if (!instance.dependsOn || instance.dependsOn.length === 0) continue;
      
      const node = dependencyGraph.get(instance.id);
      if (!node) continue;
      
      // Find the optimal start time based on dependencies
      let latestDependencyEnd = 0;
      
      for (const depId of node.dependencies) {
        const depNode = dependencyGraph.get(depId);
        if (depNode && depNode.instance.scheduledTime) {
          const depStart = this.parseTimeToMinutes(depNode.instance.scheduledTime);
          const depEnd = depStart + (depNode.instance.durationMinutes || 30);
          latestDependencyEnd = Math.max(latestDependencyEnd, depEnd);
        }
      }
      
      if (latestDependencyEnd > 0) {
        const optimalStart = this.minutesToTimeString(latestDependencyEnd + 10); // 10-minute buffer
        const currentStart = this.parseTimeToMinutes(instance.scheduledTime || '09:00');
        
        // Only suggest optimization if current timing doesn't respect dependencies
        if (currentStart < latestDependencyEnd) {
          optimizations.push({
            instanceId: instance.id,
            instanceName: instance.taskName,
            strategy: 'dependency_sequencing',
            updates: { scheduledTime: optimalStart },
            reason: 'Optimized start time to respect dependency completion',
            improvement: {
              from: { dependencyRespected: false },
              to: { dependencyRespected: true }
            }
          });
        }
      }
    }
    
    return optimizations;
  }

  /**
   * Utility: Parse time string (HH:MM) to minutes since midnight
   * @private
   */
  parseTimeToMinutes(timeString) {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Utility: Convert minutes since midnight to time string (HH:MM)
   * @private
   */
  minutesToTimeString(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Get dependency statistics for a set of instances
   * @param {Array} instances - Task instances to analyze
   * @returns {Object} Statistics about dependencies
   */
  getDependencyStatistics(instances) {
    const dependencyGraph = this.buildDependencyGraph(instances);
    const circularDeps = this.detectCircularDependencies(dependencyGraph);
    
    const stats = {
      totalTasks: instances.length,
      tasksWithDependencies: 0,
      totalDependencies: 0,
      averageDependencyCount: 0,
      maxDependencyDepth: this.calculateMaxDependencyDepth(dependencyGraph),
      circularDependencies: circularDeps.length,
      independentTasks: 0,
      mostDependentTask: null,
      dependencyDensity: 0
    };

    let maxDependencies = 0;
    instances.forEach(instance => {
      const depCount = instance.dependsOn ? instance.dependsOn.length : 0;
      
      if (depCount > 0) {
        stats.tasksWithDependencies++;
        stats.totalDependencies += depCount;
        
        if (depCount > maxDependencies) {
          maxDependencies = depCount;
          stats.mostDependentTask = {
            id: instance.id,
            name: instance.taskName,
            dependencyCount: depCount
          };
        }
      } else {
        stats.independentTasks++;
      }
    });

    if (stats.tasksWithDependencies > 0) {
      stats.averageDependencyCount = Math.round(
        (stats.totalDependencies / stats.tasksWithDependencies) * 10
      ) / 10;
    }

    // Calculate dependency density (percentage of tasks with dependencies)
    stats.dependencyDensity = Math.round(
      (stats.tasksWithDependencies / stats.totalTasks) * 100
    );

    return stats;
  }
}