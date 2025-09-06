// Simple conflict resolution - last write wins
class SimpleConflictResolver {
  
  // Compare timestamps to determine which data is newer
  static resolveByTimestamp(localData, remoteData) {
    const localTime = localData.lastModified || 0;
    const remoteTime = remoteData.lastModified || 0;
    
    if (remoteTime > localTime) {
      console.log('Using remote data (newer)');
      return remoteData;
    } else {
      console.log('Using local data (newer)');
      return localData;
    }
  }
  
  // Merge user settings with conflict resolution
  static mergeSettings(localSettings, remoteSettings) {
    // For settings, prefer remote changes for most fields
    // but keep local UI state
    const merged = {
      ...remoteSettings, // Use remote as base
      
      // Keep local UI state
      uiState: localSettings.uiState || {},
      
      // Use newer timestamp
      lastModified: Math.max(
        localSettings.lastModified || 0,
        remoteSettings.lastModified || 0
      )
    };
    
    console.log('Settings merged:', merged);
    return merged;
  }
  
  // Simple task conflict resolution
  static resolveTasks(localTasks, remoteTasks) {
    const resolved = new Map();
    
    // Add all remote tasks first
    remoteTasks.forEach(task => {
      resolved.set(task.id, task);
    });
    
    // Add local tasks, only if they're newer
    localTasks.forEach(localTask => {
      const remoteTask = resolved.get(localTask.id);
      
      if (!remoteTask) {
        // Local task doesn't exist remotely, keep it
        resolved.set(localTask.id, localTask);
      } else {
        // Both exist, use the newer one
        const newer = this.resolveByTimestamp(localTask, remoteTask);
        resolved.set(localTask.id, newer);
      }
    });
    
    const result = Array.from(resolved.values());
    console.log(`Resolved ${result.length} tasks from conflict`);
    return result;
  }
}

export { SimpleConflictResolver };