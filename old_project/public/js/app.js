/**
 * Daily AI - Main Application Entry Point
 * 
 * This is the main application file that initializes all modules
 * and starts the Daily AI task management application.
 */

// Task Modal V2 is now the default (legacy modal removed)

// Import Firebase module with error handling
import { 
  initFirebase, 
  onAuthStateChanged, 
  safeSignIn, 
  safeCreateUser,
  SimpleErrorHandler 
} from './firebase.js';

// Import data and state management
import { state, stateListeners, stateActions } from './state.js';
import { dataUtils } from './dataOffline.js';
import { userSettingsManager } from './userSettings.js';

// Import task logic and scheduling
import { schedulingEngine, taskTemplateManager, taskInstanceManager } from './taskLogic.js';

// Import UI management system
import { uiController, authUI, mainAppUI } from './ui.js';

// Import components
import { TaskModalContainer } from './components/TaskModalContainer.js';
import { taskList } from './components/TaskList.js';
import { TimelineContainer } from './components/TimelineContainer.js';

// Import utility modules
import { SimpleValidation } from './utils/SimpleValidation.js';
import { SimpleNetworkChecker } from './utils/SimpleNetworkChecker.js';
import { SimpleTabSync } from './utils/SimpleTabSync.js';
import { ResponsiveNavigation } from './utils/ResponsiveNavigation.js';
import { SafeEventListener, initMemoryLeakPrevention } from './utils/MemoryLeakPrevention.js';

// Import offline functionality
import { offlineDataLayer } from './utils/OfflineDataLayer.js';
import { offlineDetection } from './utils/OfflineDetection.js';

// Import task actions
import { editTask, duplicateTask, toggleTaskCompletion, skipTask, postponeTask, softDeleteTask } from './logic/TaskActions.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';

// Create task modal instance
export const taskModal = new TaskModalContainer();

/**
 * Application initialization
 * Called by AppInitializer after browser compatibility check
 */
export async function initApp() {
  try {
    console.log('🚀 Initializing Daily AI...');
    
    // Initialize memory leak prevention system first
    initMemoryLeakPrevention();
    
    // Initialize offline system early
    await offlineDataLayer.init();
    console.log('✅ Offline system initialized');
    
    // Initialize UI system first
    uiController.init();
    
    // Setup network monitoring
    SimpleNetworkChecker.setupNetworkMonitoring();
    console.log('✅ Network monitoring initialized');
    
    // Initialize tab synchronization
    window.tabSync = new SimpleTabSync();
    console.log('✅ Tab synchronization initialized');
    
    // Initialize Firebase first
    await initFirebase();
    console.log('✅ Firebase initialized');
    
    // Set up authentication state observer
    onAuthStateChanged(async (user) => {
      // Safely hide loading screen if it exists
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
      
      if (user) {
        console.log('✅ User authenticated:', user.email);
        
        // Set user in application state
        state.setUser(user);
        
        try {
          // Initialize user data and load settings with error handling
          SimpleErrorHandler.showLoading('Loading your data...');
          
          console.log('🔧 Step 1: Initializing user settings...');
          await stateActions.initializeUser();
          console.log('✅ Step 1 complete: User settings initialized');
          
          console.log('🔧 Step 2: Loading task templates...');
          await stateActions.loadTaskTemplates();
          console.log('✅ Step 2 complete: Task templates loaded');
          
          // Load data for current date
          const today = dataUtils.getTodayDateString();
          console.log('🔧 Step 3: Loading task instances for today:', today);
          await stateActions.loadTaskInstancesForDate(today);
          console.log('✅ Step 3 complete: Task instances loaded');
          
          console.log('🔧 Step 4: Loading daily schedule for today:', today);
          await stateActions.loadDailyScheduleForDate(today);
          console.log('✅ Step 4 complete: Daily schedule loaded');
          
          SimpleErrorHandler.hideLoading();
          
          // Show main app using UI module
          mainAppUI.show();

          // Global Add Task event listener (header/FAB/other sources)
          try {
            document.addEventListener('addTask', handleAddTaskAction);
          } catch (e) {
            console.warn('Failed to attach addTask listener:', e);
          }
        } catch (error) {
          SimpleErrorHandler.hideLoading();
          console.error('❌ Error initializing user data:', error);
          SimpleErrorHandler.showError('Failed to load user data. Please try refreshing the page.', error);
        }
      } else {
        console.log('🔒 User not authenticated, showing login');
        
        // Clear user from application state
        state.setUser(null);
        
        // Show auth UI using UI module
        authUI.show();
        setupAuthEventListeners();
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize Daily AI:', error);
    document.getElementById('loading-screen').style.display = 'none';
    SimpleErrorHandler.showError('Failed to initialize the application. Please refresh the page and try again.', error);
  }
}

/**
 * Setup event delegation for task actions
 */
function setupTaskActionDelegation() {
  // Event delegation for task actions
  document.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    const taskId = e.target.dataset.taskId;
    
    if (!action || !taskId) return;
    
    switch (action) {
      case 'edit-task':
        editTask(taskId);
        break;
      case 'duplicate-task':
        (async () => {
          const ok = await ConfirmDialog.show({
            title: 'Duplicate this task?',
            message: 'Creates a copy in your library.',
            confirmText: 'Duplicate',
            cancelText: 'Cancel',
            dangerous: false,
            defaultFocus: 'cancel'
          });
          if (ok) duplicateTask(taskId);
        })();
        break;
      case 'toggle-task-completion':
        toggleTaskCompletion(taskId);
        break;
      case 'skip-task':
        skipTask(taskId);
        break;
      case 'postpone-task':
        postponeTask(taskId, 30);
        break;
      case 'soft-delete-task':
        (async () => {
          const ok = await ConfirmDialog.show({
            title: 'Delete this task?',
            message: 'This removes it from active views. You can restore later.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            dangerous: true,
            defaultFocus: 'cancel'
          });
          if (ok) softDeleteTask(taskId);
        })();
        break;
    }
  });
}

// Initialize event delegation when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupTaskActionDelegation);
} else {
  setupTaskActionDelegation();
}

/**
 * Setup authentication event listeners
 */
function setupAuthEventListeners() {
  const form = document.getElementById('auth-form');
  const loginBtn = document.getElementById('login-btn');
  const signupBtn = document.getElementById('signup-btn');
  const errorDiv = document.getElementById('auth-error');
  
  // Handle form submission (login)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const email = emailInput.value;
    const password = passwordInput.value;
    
    // Clear previous validation errors
    SimpleValidation.clearValidationError(emailInput);
    SimpleValidation.clearValidationError(passwordInput);
    errorDiv.style.display = 'none';
    
    // Validate email
    const emailValidation = SimpleValidation.validateEmail(email);
    if (!emailValidation.valid) {
      SimpleValidation.showValidationError(emailInput, emailValidation.message);
      return;
    }
    
    // Validate password
    const passwordValidation = SimpleValidation.validatePassword(password);
    if (!passwordValidation.valid) {
      SimpleValidation.showValidationError(passwordInput, passwordValidation.message);
      return;
    }
    
    // Check network connection
    if (!SimpleNetworkChecker.checkConnectionBeforeAction()) {
      return;
    }
    
    try {
      loginBtn.textContent = 'Signing in...';
      loginBtn.disabled = true;
      
      const result = await safeSignIn(email, password);
      
      if (!result.success) {
        // Error already handled by safeSignIn
        console.log('Login failed');
      }
      
    } finally {
      loginBtn.textContent = 'Sign In';
      loginBtn.disabled = false;
    }
  });
  
  // Handle signup button
  signupBtn.addEventListener('click', async () => {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const email = emailInput.value;
    const password = passwordInput.value;
    
    // Clear previous validation errors
    SimpleValidation.clearValidationError(emailInput);
    SimpleValidation.clearValidationError(passwordInput);
    errorDiv.style.display = 'none';
    
    // Validate email
    const emailValidation = SimpleValidation.validateEmail(email);
    if (!emailValidation.valid) {
      SimpleValidation.showValidationError(emailInput, emailValidation.message);
      return;
    }
    
    // Validate password
    const passwordValidation = SimpleValidation.validatePassword(password);
    if (!passwordValidation.valid) {
      SimpleValidation.showValidationError(passwordInput, passwordValidation.message);
      return;
    }
    
    // Check network connection
    if (!SimpleNetworkChecker.checkConnectionBeforeAction()) {
      return;
    }
    
    try {
      signupBtn.textContent = 'Creating account...';
      signupBtn.disabled = true;
      
      const result = await safeCreateUser(email, password);
      
      if (!result.success) {
        // Error already handled by safeCreateUser
        console.log('Signup failed');
      }
      
    } finally {
      signupBtn.textContent = 'Create Account';
      signupBtn.disabled = false;
    }
  });
}

// Note: Authentication error messages are now handled by SimpleErrorHandler.getFriendlyMessage()

/**
 * Show critical error message (used for app initialization failures)
 */
/**
 * Handle add task action from navigation
 */
function handleAddTaskAction(event) {
  const initialData = (event && event.detail && typeof event.detail === 'object') ? event.detail : {};
  console.log('🚀 Opening task creation modal...', initialData);
  
  taskModal.showCreate(initialData, (savedTask) => {
    console.log('Task created:', savedTask);
    // The UI will automatically update via state listeners
  });
}

function showErrorMessage(message) {
  // For critical errors, show using SimpleErrorHandler and offer reload
  SimpleErrorHandler.showError(message);
  
  // Also show in UI if possible
  try {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    
    const mainContent = document.getElementById('app-main');
    mainContent.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <h2 style="color: #EF4444; margin-bottom: 1rem;">Application Error</h2>
        <p style="color: #57534E;">${message}</p>
        <button onclick="location.reload()" style="
          margin-top: 1rem;
          padding: 0.75rem 1.5rem;
          background: #3B82F6;
          color: white;
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
        ">
          Reload Application
        </button>
      </div>
    `;
  } catch (error) {
    console.error('Failed to show error UI:', error);
  }
}


// Note: App initialization now handled by AppInitializer.js
// document.addEventListener('DOMContentLoaded', initApp);

// Expose objects globally for testing purposes
// This allows the comprehensive test script to access required modules

// Create a single global object for debugging (localhost only)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.debug = {
    taskList,
    taskTemplateManager,
    schedulingEngine,
    taskInstanceManager,
    state,
    stateActions,
  };
  console.log('Debug object available at window.debug');
}


console.log('✅ Daily AI application module loaded');
console.log('🧪 Testing objects exposed globally for console access');
