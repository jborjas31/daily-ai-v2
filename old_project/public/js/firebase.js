// Simple Firebase Integration
import { firebaseConfig } from './firebase-config.js';
import { SimpleErrorHandler } from './utils/SimpleErrorHandler.js';
import { SimpleTabSync } from './utils/SimpleTabSync.js';

// Import Firebase (using CDN for simplicity)
let app, auth, db;

async function initFirebase() {
  try {
    // Initialize Firebase
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    
    // Enable offline persistence
    await db.enablePersistence();
    
    console.log('✅ Firebase initialized');
    return { app, auth, db };
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
}

// Simple auth state observer
function onAuthStateChanged(callback) {
  return auth.onAuthStateChanged(callback);
}

// Simple login function
async function signInWithEmail(email, password) {
  return await auth.signInWithEmailAndPassword(email, password);
}

// Simple signup function
async function createUserWithEmail(email, password) {
  return await auth.createUserWithEmailAndPassword(email, password);
}

// Simple wrapper for Firebase operations
async function safeFirebaseOperation(operation, loadingMessage = null) {
  return await SimpleErrorHandler.withErrorHandling(operation, loadingMessage);
}

// Safe login function
async function safeSignIn(email, password) {
  const result = await safeFirebaseOperation(
    () => signInWithEmail(email, password),
    'Signing in...'
  );
  // On successful sign-in, proceed silently without showing a popup
  return result;
}

// Safe signup function
async function safeCreateUser(email, password) {
  const result = await safeFirebaseOperation(
    () => createUserWithEmail(email, password),
    'Creating account...'
  );
  
  if (result.success) {
    SimpleErrorHandler.showSuccess('Account created successfully!');
  }
  
  return result;
}

// Safe data save function (generic)
async function safeSaveData(collectionPath, data, loadingMessage = 'Saving...') {
  return await safeFirebaseOperation(
    () => db.collection(collectionPath).add(data),
    loadingMessage
  );
}

// Safe data update function (generic)
async function safeUpdateData(docPath, data, loadingMessage = 'Updating...') {
  return await safeFirebaseOperation(
    () => db.doc(docPath).update(data),
    loadingMessage
  );
}

// Safe data load function (generic)
async function safeLoadData(collectionPath, loadingMessage = 'Loading...') {
  return await safeFirebaseOperation(
    () => db.collection(collectionPath).get(),
    loadingMessage
  );
}

// Safe document get function
async function safeGetDocument(docPath, loadingMessage = 'Loading...') {
  return await safeFirebaseOperation(
    () => db.doc(docPath).get(),
    loadingMessage
  );
}

// Safe document set function
async function safeSetDocument(docPath, data, loadingMessage = 'Saving...') {
  return await safeFirebaseOperation(
    () => db.doc(docPath).set(data),
    loadingMessage
  );
}

// Enhanced functions with tab synchronization
async function createTaskWithSync(taskData) {
  try {
    // Save to Firebase
    const result = await safeSaveData(`users/${taskData.userId}/tasks`, taskData, 'Saving task...');
    
    if (result.success) {
      // Notify other tabs
      if (window.tabSync) {
        window.tabSync.notifyTaskChanged();
        window.tabSync.notifyUserAction('task-created', { 
          taskName: taskData.taskName 
        });
      }
      
      SimpleErrorHandler.showSuccess('Task created!');
      return result;
    }
    
    return result;
  } catch (error) {
    console.error('Error creating task with sync:', error);
    SimpleErrorHandler.handleFirebaseError(error);
    return { success: false, error };
  }
}

// Enhanced task completion with tab sync
async function completeTaskWithSync(userId, taskId) {
  try {
    const result = await safeUpdateData(
      `users/${userId}/task_instances/${taskId}`, 
      { 
        status: 'completed', 
        completedAt: Date.now(),
        lastModified: Date.now()
      }, 
      'Completing task...'
    );
    
    if (result.success) {
      if (window.tabSync) {
        window.tabSync.notifyTaskChanged();
        window.tabSync.notifyUserAction('task-completed', { taskId });
      }
      return result;
    }
    
    return result;
  } catch (error) {
    console.error('Error completing task with sync:', error);
    SimpleErrorHandler.handleFirebaseError(error);
    return { success: false, error };
  }
}

// Enhanced settings update with tab sync
async function updateSettingsWithSync(userId, newSettings) {
  try {
    const settingsData = {
      ...newSettings,
      lastModified: Date.now()
    };
    
    const result = await safeSetDocument(`users/${userId}`, settingsData, 'Saving settings...');
    
    if (result.success) {
      if (window.tabSync) {
        window.tabSync.notifySettingsChanged();
      }
      
      SimpleErrorHandler.showSuccess('Settings updated!');
      return result;
    }
    
    return result;
  } catch (error) {
    console.error('Error updating settings with sync:', error);
    SimpleErrorHandler.handleFirebaseError(error);
    return { success: false, error };
  }
}

// Enhanced task loading with user scope
async function loadUserTasks(userId) {
  return await safeFirebaseOperation(
    () => db.collection(`users/${userId}/tasks`).where('isActive', '==', true).get(),
    'Loading tasks...'
  );
}

// Enhanced settings loading
async function loadUserSettings(userId) {
  return await safeGetDocument(`users/${userId}`, 'Loading settings...');
}

export { 
  initFirebase, 
  onAuthStateChanged, 
  signInWithEmail, 
  createUserWithEmail,
  safeSignIn,
  safeCreateUser,
  safeSaveData,
  safeUpdateData,
  safeLoadData,
  safeGetDocument,
  safeSetDocument,
  createTaskWithSync,
  completeTaskWithSync,
  updateSettingsWithSync,
  loadUserTasks,
  loadUserSettings,
  SimpleErrorHandler,
  auth,
  db 
};
