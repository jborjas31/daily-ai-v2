You are an expert web developer. Your task is to create a complete Progressive Web App (PWA) that functions as a time-based daily task manager. The app must work seamlessly across phone (320px+), tablet (768px+), laptop (1024px+), and desktop (1440px+) screens with responsive design and adaptive interactions. This app will only be used by one user and will incorporate simple login.

**Guiding Principles**

* **Modular Code:** Structure the JavaScript into modules/files with clear responsibilities (e.g., firebase.js, ui.js, taskLogic.js).  
* **Separation of Concerns:** Keep the code that fetches data (Firestore logic) separate from the code that draws the UI (DOM manipulation).  
* **Single Source of Truth:** The application's state should be held in a single JavaScript object. When data is fetched from Firestore, update this object. All UI rendering functions should read from this object.  
* **Graceful Error Handling & User Feedback:** All interactions with Firebase must be wrapped in try/catch blocks. If an operation fails, the app must not crash. It must provide clear, non-technical feedback to the user (e.g., a small, temporary message at the bottom of the screen).
* **Data Validation & Error Messages:** Validate all user input with specific feedback:
  - Task name cannot be empty: "Task name is required."
  - Duration must be 1-480 minutes: "Duration must be between 1 and 480 minutes."
  - Priority must be 1-5: "Priority must be between 1 and 5."
  - Start time validation: "Start time cannot be after end time."
  - Network errors: "Unable to save task. Please check your connection and try again."
  - General save errors: "Unable to save task. Please try again."
* **Loading States:** All save operations show loading spinners, disabled button states, and "Saving..." text feedback. Network status indicators show online/offline/syncing states.
* **Simple Error Logging:** Console logging for development debugging and troubleshooting.
* **Real-Time Updates:** The app must track time in real-time and update the UI accordingly without requiring page refreshes.
* **Offline-First:** Enable offline functionality for viewing loaded tasks and marking them complete/skipped, with automatic sync when online.

**Technology Stack**

* **Frontend:** HTML, CSS, and modern JavaScript (ES6+). No frontend frameworks.  
* **Backend & Hosting:** Use Google Firebase.  
  * **Database:** Cloud Firestore for all data storage. Enable offline persistence.  
  * **Hosting:** Firebase Hosting.  
  * **Authentication:** Firebase Authentication. Implement simple email and password authentication.
* **No Time Zones:** Do not implement timezone handling. Use local system time only.
* **Personal Use:** This app is for single-user personal use only, not for publishing.

**🎊 PROJECT STATUS: PHASE 3 FULLY COMPLETED ✅ | PHASE 4 READY | PWA BASICS LIVE**
**Complete timeline interface with advanced features - responsive timeline, performance monitoring, drag-and-drop interactions, and comprehensive testing framework operational. Basic PWA (service worker + offline page + manifest) implemented; app icons pending.**

---

## Codebase Snapshot (Current Implementation)

- App bootstrap: `public/index.html` registers `/sw.js` and loads `js/utils/AppInitializer.js` (browser check via `ModernBrowserChecker`) which then imports `js/app.js`.
- Firebase: `js/firebase.js` uses v9 compat SDKs and enables Firestore offline persistence.
- State: Centralized store/event bus in `js/state/Store.js` with `BroadcastChannel` sync; high‑level facade/actions in `js/state.js`.
- UI: `js/ui.js` renders Today/Library/Settings, with `utils/ResponsiveNavigation.js` handling mobile/desktop nav, live clock, and view switches.
- Logic: `js/taskLogic.js` wires `SchedulingEngine`, `RecurrenceEngine`, `DependencyResolver`, `TaskTemplateManager`, `TaskInstanceManager`.
- Offline‑first: `js/dataOffline.js` bridges to `utils/OfflineDataLayer.js` (IndexedDB cache, offline queue, auto sync). Online calls defer to `js/data.js` when online.
- PWA: `public/manifest.json` present; `public/sw.js` caches core assets and falls back to `offline.html` for navigations. Icons are not yet included; `public/icons/` is currently empty.

**Project Structure**

```
daily_ai/
├── README.md                          # Main project documentation
├── firebase.json                      # Firebase hosting & Firestore config  
├── docs/                             # Project documentation
│   ├── PHASE_1_COMPLETION_REPORT.md # ✅ NEW: Complete Phase 1 report
│   ├── PHASE_2_TECHNICAL_HANDOFF.md # ✅ NEW: Phase 2 technical guidance
│   ├── REQUIREMENTS_QA.md            # Q&A and project readiness (100%)
│   ├── USER_FLOW.md                  # Complete user experience flows
│   ├── DESIGN_SYSTEM.md              # UI/UX design specifications
│   ├── SAMPLE_DATA.md                # Sample data and examples
│   ├── CRITICAL_GAPS.md              # Original critical issues (RESOLVED)
│   ├── FINAL_CRITICAL_GAPS_AUDIT.md  # Final audit with user feedback
│   ├── CRITICAL_FIXES_ACTION_PLAN.md # Implementation roadmap
│   ├── FUTURE_PAST_NAVIGATION.md     # Additional feature specs
│   ├── MONDAY_WALKTHROUGH.md         # Usage walkthrough
│   └── specs/                        # Detailed implementation specs
│       ├── FIREBASE_SETUP_GUIDE.md          # ✅ NEW: Simple Firebase setup
│       ├── ERROR_HANDLING_SYSTEM_SPEC.md    # ✅ NEW: Simple error handling  
│       ├── MULTI_TAB_HANDLING_SPEC.md       # ✅ NEW: Simple multi-tab sync
│       ├── MODERN_BROWSER_COMPATIBILITY_SPEC.md # ✅ NEW: Modern browser support
│       ├── SIMPLE_DEV_ENVIRONMENT_SPEC.md   # ✅ NEW: Non-programmer setup
│       ├── MEMORY_LEAK_PREVENTION_SPEC.md   # Original specs (all resolved)
│       ├── CROSS_MIDNIGHT_TASKS_SPEC.md
│       ├── CIRCULAR_DEPENDENCY_DETECTION_SPEC.md
│       ├── STORAGE_LIMITS_SPEC.md
│       ├── PERFORMANCE_LIMITS_SPEC.md
│       ├── PWA_CACHING_STRATEGY_SPEC.md
│       └── DST_MANUAL_ADJUSTMENT_SPEC.md
├── firebase/                         # Firebase configuration
│   ├── firestore.rules              # Security rules (CRITICAL)
│   └── firestore.indexes.json       # Database indexes (CRITICAL)
├── public/                           # Web application files
│   ├── index.html                   # Main app HTML
│   ├── manifest.json                # PWA manifest
│   ├── offline.html                 # Offline fallback page
│   ├── css/                         # Stylesheets
│   │   ├── main.css                 # Main styles & design system
│   │   ├── timeline.css             # Timeline-specific styles
│   │   ├── components.css           # Component styles
│   │   ├── modern-features.css      # Modern CSS features
│   │   └── responsive-navigation.css # Navigation styles
│   ├── js/                          # JavaScript modules (ES modules)
│   │   ├── app.js                   # Main application entry point
│   │   ├── firebase.js              # Firebase integration
│   │   ├── ui.js                    # UI management
│   │   ├── state.js                 # Application state management
│   │   ├── taskLogic.js             # Task logic & scheduling
│   │   ├── data.js                  # Original data operations
│   │   ├── dataOffline.js           # ✅ NEW: Offline-enabled data layer
│   │   ├── userSettings.js          # User settings management
│   │   ├── components/              # UI components
│   │   │   ├── TaskModalContainer.js # Task Template modal (refactored, V2)
│   │   │   ├── TaskList.js          # ✅ NEW: Professional task management interface
│   │   │   ├── TimelineContainer.js  # Timeline container
│   │   │   ├── TimelineHeader.js     # Timeline header
│   │   │   ├── TimelineGrid.js       # Timeline grid and indicator
│   │   │   ├── TaskBlock.js          # Individual task block component
│   │   │   ├── TaskCard.js           # Card/list presentation
│   │   │   ├── TaskListToolbar.js    # Library toolbar and filters
│   │   │   └── TaskGrid.js           # Grid layouts
│   │   ├── utils/                   # Utility functions
│   │   │   ├── OfflineStorage.js    # ✅ NEW: IndexedDB offline storage
│   │   │   ├── OfflineQueue.js      # ✅ NEW: Operation queue with retry logic
│   │   │   ├── OfflineDataLayer.js  # ✅ NEW: Unified online/offline interface
│   │   │   ├── ConflictResolution.js # ✅ NEW: Intelligent sync conflict resolution
│   │   │   ├── OfflineDetection.js  # ✅ NEW: UI feedback for connectivity
│   │   │   ├── DataMaintenance.js   # ✅ NEW: Schema migration & cleanup
│   │   │   ├── TaskValidation.js    # Comprehensive task validation
│   │   │   ├── MemoryLeakPrevention.js # Memory management utilities
│   │   │   ├── SimpleErrorHandler.js # Error handling system
│   │   │   ├── SimpleNetworkChecker.js # Network monitoring
│   │   │   ├── SimpleTabSync.js     # Multi-tab synchronization
│   │   │   ├── ResponsiveNavigation.js # Adaptive navigation
│   │   │   ├── ModernBrowserChecker.js # Browser compatibility
│   │   │   ├── AppInitializer.js    # Application initialization
│   │   │   └── SimpleValidation.js  # Input validation utilities
│   │   ├── performance/             # Performance monitoring
│   │   ├── storage/                 # Storage management
│   │   ├── scheduling/              # Scheduling engine
│   │   └── validation/              # Input validation
│   ├── sw.js                        # Service Worker (basic cache + offline)
│   └── icons/                       # PWA icons and graphics (pending)
└── tests/                           # Test files
```

**Responsive Design Requirements**

* **Mobile-First Approach:** Design for mobile screens first, then enhance for larger displays.
* **Breakpoint Strategy:**
  - Mobile: 320px - 767px (single column, touch-optimized)
  - Tablet: 768px - 1023px (enhanced spacing, larger touch targets)
  - Laptop: 1024px - 1439px (mouse interactions, hover states)
  - Desktop: 1440px+ (full feature set, maximum screen real estate)
* **Touch-Friendly Design:**
  - Minimum 44px touch targets for mobile
  - Sufficient spacing between interactive elements
  - Swipe gestures for day navigation on mobile
  - Long-press alternatives for hover states
* **Adaptive Interface Elements:**
  - Mobile: Collapsible menu, full-screen modals, stack UI vertically
  - Tablet: Larger timeline grid, improved modal sizing
  - Desktop: Hover states, keyboard shortcuts, side-by-side layouts
* **Performance Optimization:**
  - Optimize for slower mobile networks
  - Lazy load non-critical resources
  - Efficient touch event handling

**Modern Design System**

* **Visual Aesthetic: "Calm Productivity"**
  - Clean, minimalist interface with generous whitespace
  - Subtle depth through soft shadows and layered elements
  - Rounded corners (8px-16px) for friendly, approachable feel
  - Smooth micro-animations that enhance rather than distract
  - Consistent geometric patterns throughout interface
* **Color Palette:**
  - Light Mode: Modern blue primary (#3B82F6), neutral grays (#FAFAF9-#1C1917), semantic colors
  - Success: #10B981, Warning: #F59E0B, Error: #EF4444, Info: #6366F1
  > **Note**: Dark mode planned for **future development** - MVP launches with light mode only
* **Typography System:**
  - Primary: 'Inter' font family for excellent readability
  - Monospace: 'JetBrains Mono' for time displays and technical elements
  - Scale: 12px-30px with consistent hierarchy (xs, sm, base, lg, xl, 2xl, 3xl)
* **Component Design:**
  - Task blocks: Subtle gradients, soft shadows, 12px border radius
  - Buttons: Gradient backgrounds, smooth hover transitions
  - Modals: Glassmorphism with backdrop blur and transparency
  - Form elements: Clean borders, focus states with blue accent
* **Timeline-Specific Styling:**
  - Hour markers: Minimal lines in subtle gray with clean typography
  - Time indicator: Modern red-orange gradient with subtle shadow and smooth animation
  - Sleep blocks: Gradient backgrounds with optional subtle pattern overlay
  - Task states: Color-coded with visual hierarchy (normal, completed, overdue, in-progress)
* **Micro-Interactions:**
  - Hover effects: Subtle lift with enhanced shadows
  - Task completion: Scale animation with opacity change
  - Loading states: Skeleton shimmer and smooth progress indicators
  - Transitions: Cubic-bezier easing for natural feel
* **Iconography:**
  - Modern icon library (Phosphor Icons or Heroicons)
  - Consistent sizing (16px/20px/24px) and stroke width (1.5px-2px)
  - Rounded style to match overall aesthetic

**📋 Design Implementation:** See [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) for complete CSS specifications, component styles, and implementation guidelines.

### Firestore Data Architecture

Use the following collection and document structure:

1. **A users collection:** Each document key is the userId.  
   * **Settings stored directly in user document:**  
     * **Path:** /users/{userId}  
     * **Fields:** desiredSleepDuration (number, in hours), defaultWakeTime (string, e.g., "08:00"), defaultSleepTime (string, e.g., "00:00").
     * **Default Values:** desiredSleepDuration: 7.5, defaultWakeTime: "06:30", defaultSleepTime: "23:00".  
2. **A tasks sub-collection for each user:**  
   * **Path:** /users/{userId}/tasks/{taskId}  
   * **Purpose:** Stores all task *templates*.  
   * **Fields:**  
     * taskName: string  
     * description: string (optional, plain text notes)  
     * isMandatory: boolean (for anchors)  
     * priority: number (1-5)  
     * isActive: boolean  
     * recurrenceRule: object  
       * Structure: { frequency: string ('none'|'daily'|'weekly'|'monthly'|'yearly'), interval: number (e.g., 2 for every 2 weeks), endDate: string (optional), endAfterOccurrences: number (optional), daysOfWeek: array (for weekly tasks, e.g., ['monday', 'friday']) }
     * **Scheduling Fields:**  
       * schedulingType: string ('fixed' or 'flexible')  
       * defaultTime: string (only for 'fixed' tasks)  
       * timeWindow: string ('morning'|'afternoon'|'evening'|'anytime' - for 'flexible' tasks)
       * Time Window Definitions: morning (6:00-12:00), afternoon (12:00-18:00), evening (18:00-23:00), anytime (6:00-23:00)
       * Boundary Handling: Tasks spanning multiple time windows are classified by their start time (e.g., 11:30 AM - 12:30 PM = morning task)  
       * dependsOn: string (stores taskId of a prerequisite task)  
     * **Duration Fields:**  
       * durationMinutes: number (normal duration)  
       * minDurationMinutes: number (crunch-time duration)  
3. **A task\_instances sub-collection for each user:**  
   * **Path:** /users/{userId}/task\_instances/{instanceId}  
   * **Purpose:** Stores the status of a task for a *specific day* when modified from default state.  
   * **Fields:** templateId, date, status ("completed", "skipped", "postponed"), modifiedStartTime, completedAt (timestamp), skippedReason (string).
   * **Creation Rule:** Only create instances when tasks are actually modified (completed/skipped/postponed), not for every daily occurrence.
   * **Retention:** Rolling 30-day window to prevent indefinite data growth.  
4. **A daily\_schedules sub-collection for each user:**  
   * **Path:** /users/{userId}/daily\_schedules/{date}  
   * **Purpose:** Stores overrides for the default wake/sleep times for a specific day.  
   * **Fields:** wakeTime (string), sleepTime (string).

### App Structure & UI

The app has three views: **"Today View,"** **"Task Library,"** and **"Settings."** Access between views should be through a responsive menu navigation system that adapts to screen size:
* **Mobile:** Bottom tab bar or collapsible hamburger menu
* **Tablet/Desktop:** Top navigation bar or side menu panel

#### 1\. Today View (Main Screen)

**Header Section (Responsive):**
* **Current Date Display:** Show the current date prominently at the top.
* **Live Clock:** Display current time that updates in real-time based on system time.
* **Day Navigation:** 
  - Mobile: Swipe gestures + small arrow buttons, Today button prominent
  - Desktop: Full-size arrow buttons, Today button, keyboard shortcuts (←/→)
* **Calendar Selector:** 
  - Mobile: Full-screen calendar modal overlay
  - Desktop: Dropdown calendar picker
* **Fixed Header:** Header remains fixed at the top when scrolling, with responsive sizing:
  - Mobile: Compact header to maximize timeline space
  - Tablet/Desktop: Larger header with additional controls and spacing

**Floating UI Elements:**
* **Scroll to Top Button:** Floating button positioned in the bottom-right corner that appears when user scrolls down and allows quick return to top of page.

**Timeline Grid (Responsive):**
* **Hourly Grid:** A vertical hourly grid (24-hour format) with adaptive sizing:
  - Mobile: Condensed hour markers, minimum 60px row height for touch targets
  - Tablet: Medium sizing with 80px row height
  - Desktop: Full-size markers with 100px row height for precision
* **Sleep Blocks:** Shaded, non-schedulable areas representing the sleep period based on user settings.
* **Real-Time Indicator:** A prominent red line that marks the current time and moves in real-time.
* **Task Blocks:** Visual blocks representing scheduled tasks with responsive sizing:
  - Mobile: Full-width blocks with stacked text, larger fonts
  - Desktop: Precise sizing with detailed text, smaller fonts
* **Click-to-Create:** 
  - Mobile: Tap empty timeline spaces, with touch-friendly 44px minimum targets
  - Desktop: Click empty spaces with hover states showing "+" icon
* **Interactive Feedback:** 
  - Mobile: Touch feedback with subtle vibration (if supported), long-press alternatives for hover states
  - Desktop: Hover states, cursor changes, immediate visual feedback

**Overlapping Task Handling (Responsive):**
* **Horizontal Layout:** When tasks overlap, display with device-appropriate strategies:
  - **Mobile:** Maximum 2 tasks side-by-side (50% each), 3+ tasks show "+X more" indicator with carousel swipe
  - **Tablet:** Up to 3 tasks horizontally (33.3% each), 4+ tasks show "+X more" indicator
  - **Desktop:** Up to 3 tasks horizontally sharing space proportionally, 4+ tasks show "+X more" indicator
  - This maintains readability while showing schedule density across all screen sizes.

**Task Visual States:**
* **Normal Tasks:** Standard appearance with clear boundaries.
* **Overdue Mandatory Tasks:** Subtly red background and automatically move to current time in real-time.
* **Overdue Skippable Tasks:** Greyed out but remain in original time slot.
* **Completed Tasks:** Toggle state (checkmark or strikethrough).

**Smart Countdown UI:**
* **Anchor Blocks:** For each block of tasks between mandatory "anchor" tasks, display:
  - "Time Until Next Anchor: XX:XX"
  - "Time Required for Tasks: XX:XX"
  - Real-time countdown that turns red when time crunch is detected.

**Schedule Conflict Alert:**
* **Prominent Alert Banner:** Display when impossible schedule is detected.
* **Suggested Solutions:** Offer specific recommendations (adjust sleep, reschedule tasks, etc.).

#### 2\. Task Library (Separate Page/Tab)

**Search Functionality:**
* **Search Bar:** At the top of the page to filter all task lists by name and description.
* **Client-Side Search:** Instant filtering as user types, case-insensitive.

**Task Categories:**
* **Overdue Tasks:** Tasks past their scheduled time, with distinction between overdue mandatory (needs immediate attention) and overdue skippable (can be rescheduled/skipped). Shows count in section header.
* **Active Tasks:** Currently scheduled and recurring tasks, sorted by priority (high to low).
* **Completed Tasks:** Tasks marked as completed with timestamps, with recently completed tasks shown first.
* **Skipped Tasks:** Tasks deliberately skipped, with distinction between "Skipped by User" and "Missed," with recently skipped tasks shown first.
* **Deleted Tasks:** Soft-deleted tasks (isActive=false) in separate section for recovery.

**Enhanced Features:**
* **Priority-Based Sorting:** Within each section, high-priority tasks appear first for better focus.
* **Dependencies Indicator:** Visual indicators showing which tasks are blocked by incomplete prerequisites (e.g., "🔗 Waiting for: Do Laundry").
* **Simple Filters:** Toggle options for "Mandatory vs Skippable" tasks and filter by time window (Morning/Afternoon/Evening/Anytime).
* **Recently Modified:** Recent changes appear at the top of their respective sections for context and easier review.

**Task Status Indicators:**
* Clear visual indicators for task status (overdue, active, completed, skipped, deleted).
* Searchable and filterable by all categories and enhanced filter options.

#### 3\. Settings Page

* **Sleep Configuration:** Fields for desired sleep duration, default wake time, and default sleep time.
* **User Preferences:** Any additional customization options.
* **Data Management:** Basic preferences and settings configuration.
  > **Note:** Data export/backup functionality is planned for future development.

### Task Logic & Real-Time Behavior

**Real-Time Updates:**
* **Clock Updates:** Update the current time display every 30 seconds.
* **Timeline Indicator:** Update the red timeline indicator every 30 seconds for smooth movement.
* **Task State Updates:** Check for overdue tasks and update their visual state every 30 seconds.
* **Smart Countdown Refresh:** Update countdown timers every 30 seconds between anchor tasks.
* **Batched DOM Updates:** All time-related UI updates are batched into a single function to prevent layout thrashing.

**Intelligent Scheduling Engine (Secret Sauce V3):** The app's core logic for arranging the day. It should operate in the following order:  
  1. **Place Anchors:** First, place all mandatory, 'fixed' time tasks on the timeline.  
  2. **Resolve Dependencies:** Next, place tasks that have dependencies, ensuring they are scheduled after their prerequisite task is complete. Includes circular dependency validation to prevent infinite loops.  
  3. **Slot Flexible Tasks:** Finally, intelligently fit the 'flexible' tasks into the remaining open time slots within their specified timeWindow, starting with the highest priority tasks first.  
  4. **Crunch-Time Adjustments:** When the "Smart Countdown" detects a time crunch, it should recalculate the Time Required using the minDurationMinutes for skippable tasks to see if the schedule can be salvaged.
  5. **Performance Optimization:** Cache scheduling calculation results and only recalculate when tasks actually change, not on every render.  

**Sleep-Aware Scheduling (Secret Sauce V2):** Before scheduling, the app must perform an "Impossibility Check." If the total time for mandatory tasks exceeds the available waking hours, trigger the "Schedule Conflict Alert" with suggestions to adjust sleep/wake times. Includes DST validation to prevent wake time becoming later than sleep time during transitions.  

**Overdue Logic:** 
* **Mandatory Tasks:** Move to current time in real-time, maintain original order, turn subtly red.
* **Skippable Tasks:** Remain in original time slot but grey out, can still be marked complete.

**Task Completion Logic:**
* **Toggle Functionality:** Users can mark tasks as complete/incomplete with visual feedback.
* **State Persistence:** Completion states saved immediately to Firestore and cached for offline use.

**Search Logic:** 
* **Client-Side Implementation:** Filter loaded task lists based on taskName and description containing search query.
* **Case-Insensitive:** Search should work regardless of letter case.
* **Real-Time Filtering:** Results update as user types in search field.
* **Multi-Field Search:** Search includes both task names and description text.

**Offline Functionality:**
* **Cached Data:** Display previously loaded tasks when offline.
* **Offline Actions:** Allow marking tasks as complete/skipped while offline.
* **Sync Queue:** Store offline actions in local queue for sync when connection restored.
* **Auto-Sync:** Automatically sync pending changes when connection detected.

**Cross-Midnight Tasks:**
* **Multi-Day Support:** Tasks can span past midnight into the next day.
* **Visual Continuity:** Show task blocks continuing across day boundaries.
* **Navigation Consistency:** Maintain task visibility when navigating between days.

### User Interactions

**Task Creation/Editing (Responsive):**
* **Add Task Button:** Device-appropriate placement and sizing:
  - Mobile: Floating action button (FAB) in bottom-right corner
  - Desktop: Prominent button in header or sidebar
* **Timeline Task Creation:** 
  - Mobile: Tap empty timeline spaces (44px minimum touch targets) for instant task creation
  - Desktop: Click empty spaces with hover states and "+" icon indicators
  - Smart pre-population works across all devices with appropriate conflict detection
* **Task Editing:** 
  - Mobile: Tap any task block, with touch-friendly target sizing
  - Desktop: Click any task block with hover states and cursor feedback
* **Unified Time Block Editor Modal:** Responsive modal design:
  - Mobile: Full-screen modal with vertical stacking, large form fields, touch-optimized inputs
  - Tablet: Centered modal with appropriate sizing and spacing
  - Desktop: Compact modal with side-by-side layouts, keyboard navigation support
  Contains all task properties with device-appropriate input methods:
  - Task name
  - Description (optional plain text notes)
  - Duration (normal and minimum for crunch time)
  - Scheduling type (fixed time vs. flexible window)
  - Time window (morning/afternoon/evening/anytime for flexible tasks)
  - Priority level (1-5)
  - Mandatory vs. skippable
  - Dependencies (task must complete before this one)
  - Recurrence rules (daily/weekly/monthly/yearly/custom)

**Task Creation Default Values:**
* **Priority**: Defaults to 3 (middle priority)
* **Duration**: Defaults to 30 minutes if not specified
* **Scheduling Type**: Defaults to "flexible" unless user selects specific time
* **Time Window**: Auto-detected from creation context:
  - Morning (6:00-12:00) if created before noon
  - Afternoon (12:00-18:00) if created 12:00-6:00 PM
  - Evening (18:00-23:00) if created after 6:00 PM
  - Anytime if created during sleep hours
* **Mandatory**: Defaults to "No" (skippable)
* **Recurrence**: Defaults to "none" (one-time task)

**Modal Action Buttons:**
* **Save:** Saves changes to task template with loading state feedback.
* **Copy Task:** Duplicates current task with all properties, opens new task modal for user to modify name/time before saving.
* **Delete:** Prompts confirmation dialog, then sets isActive flag to false (soft delete), task moves to deleted section.
* **Skip for Today:** Creates a task_instance with status: 'skipped', removes from today's grid.
* **Postpone:** Creates a task_instance for the next day, effectively moving the task.
* **Mark Complete:** Toggle completion state for the current task instance.

**Confirmation Dialogs:**
* **Delete Task:** "Are you sure you want to delete this task?" with Cancel/Delete buttons.
* **Delete Recurring Task:** "Delete all future instances?" or "Delete this instance only?" options.
* **Permanent Delete:** "Permanently delete this task template?" for soft-deleted tasks.

**Recurring Task Edit Logic:**
When editing a recurring task, present user with three options:
* **"This instance only":** Edit affects only the current occurrence.
* **"This and future instances":** End the recurrence of the original task template on the day before the edit, then create a brand new task template with updated information starting from the edit day.
* **"All instances":** Update the original task template affecting all past and future occurrences.

**Sleep Block Interaction:** 
* **Click Sleep Block:** Opens unified time block editor modal to override wake/sleep times for that specific day.
* **Daily Overrides:** Changes apply only to selected date, don't affect default settings.

**Real-Time Interactions (Device-Optimized):**
* **Task Completion Toggle:** 
  - Mobile: Tap any task to mark complete/incomplete, with haptic feedback if supported
  - Desktop: Click any task with immediate visual feedback and hover states
* **Navigation:** 
  - Mobile: Swipe gestures for day navigation, supplemented by touch-friendly arrow buttons
  - Desktop: Keyboard shortcuts (←/→), mouse click on arrows, Today button
* **Today Button:** 
  - Mobile: Large, thumb-friendly button for easy access
  - Desktop: Standard button with keyboard shortcut (Home key)
* **Live Updates:** All changes reflect immediately across all devices without page refresh.

### Authentication & First-Time Experience

**Login Implementation:**
* **Simple Credentials:** Use email and password authentication with Firebase Auth.
* **No Complexity:** Implement the simplest possible login mechanism.
* **Direct Access:** After successful login, immediately redirect to Today View.
* **No Onboarding:** No welcome messages, guided tours, or setup wizards.
* **Session Persistence:** Maintain login state for return visits.

**Data Recovery:**
* **Soft Deletes:** Deleted tasks remain in database with isActive=false.
* **Recovery Section:** Provide access to deleted tasks in Task Library for potential restoration.
* **Audit Trail:** Track task status changes with timestamps for debugging.

### Implementation Patterns & Best Practices

**Split-and-Create Pattern for Recurring Task Edits:**
For "This and future instances" edits:
1. End the recurrence of the original task template on the day before the edit
2. Create a brand new task template with updated information starting from the edit day
3. This industry-standard pattern prevents data corruption and maintains historical accuracy

**Real-Time Update Architecture:**
* Use `setInterval()` for clock updates every 30 seconds and timeline indicator every 30 seconds
* Implement efficient DOM updates to avoid performance issues
* Cache task states to minimize unnecessary re-renders

**Offline-First Considerations:**
* **Storage Strategy:** Use IndexedDB for robust offline data storage and caching
* **Offline Queue:** Store user actions in IndexedDB when offline for later synchronization (replaces Firestore offline_queue)
* **Sync Mechanism:** Implement last-write-wins conflict resolution when syncing offline changes
* **Graceful Degradation:** When IndexedDB fails, fall back to localStorage with data size limit warning to ensure functionality in restricted environments

**Performance Requirements:**
* **Responsiveness:** App should not lag or feel sluggish during any user interactions
* **Smooth Animations:** Ensure timeline indicator moves smoothly every 30 seconds
* **Efficient Rendering:** Optimize timeline and overlapping task calculations for performance
* **Memory Management:** Prevent memory leaks in real-time update loops

### Simulations & Test Cases

Use the following scenarios to test the implementation of the scheduling engine.

1. **The "Dependency Chain" Test:**  
   * **Setup:** Create three tasks: Do Laundry (Flexible, Morning), Iron Clothes (Flexible, Afternoon, Depends on: Do Laundry), and Pack for Trip (Flexible, Evening, Depends on: Iron Clothes).  
   * **Action:** Mark Do Laundry as complete at 10 AM.  
   * **Expected Result:** The app should now schedule Iron Clothes in an open slot in the afternoon. Pack for Trip should only become available to be scheduled in the evening, after Iron Clothes could logically be completed.  
2. **The "Crunch Time" Test:**  
   * **Setup:** Create a Shower task (Normal: 15min, Min: 5min) and a mandatory Client Meeting anchor at 10 AM.  
   * **Action:** Open the app at 9:50 AM. There are 10 minutes available.  
   * **Expected Result:** The "Smart Countdown" UI should detect the time crunch (15min required \> 10min available). It should then recalculate using the minDurationMinutes (5min). Since 5min \< 10min, it should display a message like "Time Crunch\! A 5-minute shower is possible."  
3. **The "Impossible Day" Test:**  
   * **Setup:** Set desiredSleepDuration to 8 hours. Create 9 hours of mandatory, fixed-time tasks throughout the day.  
   * **Action:** Open the app to view that day's schedule.  
   * **Expected Result:** The "Impossibility Check" should run first. It will detect that the mandatory tasks cannot fit within the 16 available waking hours. It must trigger the "Schedule Conflict Alert" and suggest adjusting the wake-up or sleep time.  
4. **The "Flexible Reschedule" Test:**  
   * **Setup:** The app has scheduled a flexible Groceries task at 2 PM.  
   * **Action:** At 1:30 PM, add a new mandatory Doctor's Appointment anchor from 2:30 PM to 3:30 PM.  
   * **Expected Result:** The app must detect the conflict with the Groceries task. It should automatically re-run its scheduling logic and move the Groceries block to a new, open slot later in the day without user intervention.

### Development Plan & Step-by-Step Guide

Build the application in the following logical order.

**Phase 1: Foundation & Authentication** ✅ COMPLETED (12/14 STEPS)
1. **✅ Setup Firebase Project** - Follow complete guide: `docs/specs/FIREBASE_SETUP_GUIDE.md` (COMPLETED)
2. **✅ CRITICAL: Deploy Firebase Security Rules** - Deploy `firestore.rules` with user-scoped permissions before enabling authentication (COMPLETED)
3. **✅ CRITICAL: Deploy Firestore Indexes** - Deploy `firestore.indexes.json` for production query support (COMPLETED)
4. **✅ Setup Development Environment** - Follow simple setup: `docs/specs/SIMPLE_DEV_ENVIRONMENT_SPEC.md` (COMPLETED)
5. **✅ Initialize Error Handling System** - Implement simple error handling: `docs/specs/ERROR_HANDLING_SYSTEM_SPEC.md` (COMPLETED)
6. **✅ Setup Multi-Tab Synchronization** - Implement tab sync: `docs/specs/MULTI_TAB_HANDLING_SPEC.md` (COMPLETED)
7. **✅ Configure Modern Browser 1Support** - Setup browser checking: `docs/specs/MODERN_BROWSER_COMPATIBILITY_SPEC.md` (COMPLETED)
8. **✅ Create responsive HTML structure** - Adaptive menu navigation (mobile bottom tabs, desktop top nav) (COMPLETED)
9. **✅ Implement simple email/password authentication** - Firebase Auth integration (COMPLETED)
10. **✅ Setup comprehensive responsive CSS framework** - Mobile-first approach with breakpoints (COMPLETED)
   - Define breakpoints: mobile (320-767px), tablet (768-1023px), laptop (1024-1439px), desktop (1440px+)
   - Establish touch-friendly sizing (44px minimum) and spacing standards
   - Create adaptive typography and layout systems
11. **✅ Implement modern design system** - CSS custom properties, light mode palette, component styles (COMPLETED)
   - Setup CSS custom properties for light mode color palette
   - Define typography scale and spacing system variables
   - Create component base styles (buttons, forms, modals, cards)
   - Setup modern icon library (Phosphor Icons or Heroicons)
   > **Note**: Dark mode toggle functionality planned for **future development**

12. **✅ Create JavaScript module structure** - 15+ modules with modular architecture implemented (COMPLETED)
13. **✅ CRITICAL: Implement Memory Leak Prevention** - Comprehensive memory management system with cleanup and Page Visibility API (COMPLETED)
14. **✅ Initialize default user settings** - Comprehensive settings management with Firestore persistence (COMPLETED)

**📋 Phase 1 Status:** Foundation solidly established with comprehensive documentation  
**📁 Phase 1 Report:** See `docs/PHASE_1_COMPLETION_REPORT.md` for detailed completion analysis  
**🚀 Phase 2 Ready:** See `docs/PHASE_2_TECHNICAL_HANDOFF.md` for implementation guidance

**Phase 2: Core Data Architecture** ✅ COMPLETED (12/12 Steps)

**Phase 2A: Task Template System Foundation (COMPLETED ✅ - 5/5 Steps)**
1. **✅ Complete TaskTemplateManager Implementation**
   - Finished taskLogic.js TaskTemplateManager class with full CRUD operations
   - Added template validation, smart defaults, and dependency handling
   - Implemented template duplication and soft deletion logic
2. **✅ Implement Task Template Data Operations**  
   - Extended data.js with taskTemplates collection CRUD operations
   - Added Firestore queries for template management with offline support
   - Implemented template search and filtering capabilities
3. **✅ Add Task Template State Management**
   - Extended state.js with task template state and listeners
   - Added state actions for template operations (create, update, delete)
   - Implemented real-time state updates for template changes
4. **✅ Create Comprehensive Task Validation System**
   - Built validation utilities for all task properties
   - Added specific error messages matching requirements (name, duration, priority, etc.)
   - Implemented dependency validation and circular dependency detection
5. **✅ Basic Template Testing and Validation**
   - Tested template CRUD operations with validation
   - Verified state management integration  
   - Validated error handling and user feedback

**Phase 2B: Task Instance System (COMPLETED ✅ - 4/4 Steps)**  
6. **✅ Implement TaskInstanceManager**
   - Created comprehensive TaskInstanceManager class for daily task modifications
   - Added instance status management (pending, completed, skipped, postponed)
   - Implemented instance lifecycle and cleanup operations with date-based caching
7. **✅ Add Task Instance Data Operations**
   - Extended data.js with taskInstances collection CRUD operations
   - Added date-based queries and batch operations for performance optimization
   - Implemented comprehensive instance management with cleanup utilities
8. **✅ Extend State Management for Instances**
   - Added task instance state management and date-based caching system
   - Implemented state actions for instance operations with offline support
   - Added multi-date support with intelligent preloading and navigation
9. **✅ Implement Instance Generation Logic**
   - Built comprehensive logic to generate daily instances from templates
   - Added recurrence rule processing (daily, weekly, monthly, yearly, custom)
   - Implemented sophisticated dependency resolution and scheduling optimization

**Phase 2C: UI Integration & Enhancement (COMPLETED ✅ - 3/3 Steps)**
10. **✅ Enhance TaskModal for Template Management**
    - Extended TaskModal component with comprehensive template creation and editing
    - Added multi-tab interface with Form/Preview tabs and all task properties
    - Implemented recurring task editing options and advanced recurrence configuration
11. **✅ Build Task Management Interfaces**
    - Created professional TaskList component with advanced categorization system
    - Implemented comprehensive search and filtering with real-time updates
    - Added bulk operations and intuitive task status management
      > **Note:** Import/export functionality implemented but temporarily hidden - planned for future release
12. **✅ Complete Offline Integration**
    - Implemented comprehensive offline persistence with IndexedDB storage system
    - Added intelligent sync queue with conflict resolution and automatic retry
    - Created seamless online/offline switching with transparent data layer integration

**🎊 Phase 2 FULLY COMPLETE:** Complete core data architecture with comprehensive offline functionality  
**🚀 Ready for Phase 4:** Responsive Task Management and Advanced User Interactions implementation

**Phase 3: Today View - Responsive Timeline** ✅ COMPLETED
1. Create responsive hourly grid layout with device-adaptive sizing:
   - Mobile: 60px row height, condensed markers, touch-optimized
   - Tablet: 80px row height, medium spacing
   - Desktop: 100px row height, full-size markers
2. Implement real-time clock display and red timeline indicator with responsive sizing
3. Add adaptive day navigation:
   - Mobile: Swipe gestures + compact arrow buttons, prominent Today button
   - Desktop: Full-size arrows, keyboard shortcuts (←/→), Today button
4. Create sleep block visualization with responsive design
5. Implement responsive task block rendering:
   - Mobile: Full-width blocks, stacked text, larger fonts
   - Desktop: Precise sizing, detailed text, smaller fonts
6. Add responsive fixed header that adapts to screen size
7. Implement floating scroll-to-top button with device-appropriate sizing
8. Add adaptive Today button functionality (navigate + scroll) with touch/click optimization

**Phase 4: Responsive Task Management** 🚀 CURRENT PHASE

- Outcomes (what “done” looks like):
  1) Task Modal UX: One adaptive modal (mobile full‑screen, desktop centered) with full keyboard support (Tab/Shift+Tab/Enter/Esc), proper ARIA/labels, and clean focus management.
  2) Smart Defaults: New tasks pre‑fill from context (timeline click → time/window) and TemplateDefaultsService (priority, duration, window).
  3) Clear Validation: Inline messages match specs (name empty, duration 1–480, priority 1–5, start<=end). Buttons disable during submit; no double‑submit.
  4) Core Actions: Create, Edit, Duplicate, Soft Delete, Complete, Skip, Postpone — visible in list and timeline, with immediate UI updates and toasts.
  5) Recurrence Edits: “Only this / This and future / All” flows implemented; apply Split‑and‑Create for “this and future” to preserve history.
  6) Confirmations & Feedback: Short, device‑appropriate confirm dialogs for destructive actions; consistent toasts for results.
  7) A11y & Keyboard: Modal is fully operable with keyboard; controls have accessible names; no focus traps or scroll issues on mobile.

- Bite‑Sized Steps (build on existing code, no re‑writes):
  1) Responsive Modal Polish
     - Wire TaskModalContainer to adjust layout at breakpoints; ensure focus trap and Esc to close; verify ARIA roles and labels.
     - Acceptance: Can create/edit a task with keyboard only; modal is readable on mobile; focus returns to invoker.
  2) Intelligent Pre‑Fill
     - Pass timeline click/tap context (time/window) into TaskTemplateFormService; ensure TemplateDefaultsService sets sensible defaults.
     - Acceptance: New task modal reflects clicked slot/window and has no empty required fields.
  3) Validation & Error UX
     - Ensure SimpleValidation + TaskTemplateValidation show exact messages; disable buttons during save; use SimpleErrorHandler only for network/unknown errors.
     - Acceptance: All listed error cases display precise messages; no double submit.
  4) Core Actions Wiring
     - Hook list/timeline buttons to TaskActions for complete/skip/postpone/duplicate/delete; keep copy explicit; ensure state listeners update UI immediately.
     - Acceptance: Actions reflect instantly; toasts confirm results; works offline with queue.
  5) Recurrence Edit Options
     - Implement “Only this / This and future / All” in the edit flow; apply Split‑and‑Create for “this and future.”
     - Acceptance: After edit, lists/schedule reflect chosen scope; no duplicated/orphaned templates.
  6) Confirmations & Feedback
     - Use a small, consistent confirm UI for destructive actions; avoid heavy animations on mobile.
     - Acceptance: All destructive actions confirm; messages short and clear.

- De‑scoped from Phase 4 (to avoid scope creep):
  - Haptics/long‑press; advanced drag‑and‑drop polish; import/export UI (already implemented but hidden) — address later as optional polish.

**Phase 5: Task Library & Search**
1. Create Task Library page with enhanced categorized task lists
2. Implement client-side search functionality with multi-field search (name and description)
3. Add sections for overdue, active, completed, skipped, and deleted tasks
4. Implement priority-based sorting within each category
5. Add dependencies indicator for blocked tasks
6. Create simple filter toggles (mandatory vs skippable, time window filtering)
7. Implement recently modified task sorting within sections
8. Add enhanced task status indicators and comprehensive filtering

**Phase 6: Real-Time Features**
1. Implement overdue task logic (mandatory vs skippable behavior)
2. Add responsive overlapping task visualization:
   - Mobile: Maximum 2 tasks side-by-side, 3+ tasks show "+X more" with carousel swipe
   - Tablet: Up to 3 tasks horizontally
   - Desktop: Up to 3 tasks with proportional width sharing
3. Create real-time updates optimized for all devices: clock (30s), timeline indicator (30s), task states (30s)
4. Implement task completion state persistence with device-appropriate loading feedback
5. Add responsive network status indicators and loading states for all Firebase operations

**Phase 7: Offline Functionality**
1. Setup IndexedDB for offline task caching and data storage
2. Implement offline action queuing system using IndexedDB
3. Create sync mechanism with last-write-wins conflict resolution
4. **⚡ MEDIUM: Implement Storage Limits & Fallbacks** - Add 80% capacity warnings, graceful degradation (USER EXPERIENCE)
5. Add visual indicators for offline state and sync status

**Phase 8: Smart Countdown (Option 3)**
1. Implement anchor task detection and grouping
2. Create countdown UI showing time until next anchor and time required
3. Add real-time countdown updates and time crunch detection
4. Implement visual warnings when schedule is tight

**Phase 9: Advanced Scheduling Engine**
1. Enhance scheduling logic to handle flexible task placement
2. **🔥 CRITICAL: Implement Cross-Midnight Task Handling** - Add algorithm for tasks spanning midnight (FUNCTIONALITY CRITICAL)
3. **🔥 CRITICAL: Implement Circular Dependency Detection** - Add validation to prevent infinite loops (STABILITY CRITICAL)
4. Implement dependency resolution and task ordering
5. Add crunch-time adjustments using minimum durations
6. Create schedule conflict detection and suggestion system
7. **⚡ MEDIUM: Implement Performance Limits** - Add 100 task limit, warnings, and optimization (PERFORMANCE)

**Phase 10: Triage Advisor (Option 1)**
1. Add priority-based task flagging during time crunches
2. Implement visual indicators for at-risk tasks
3. Create intelligent suggestions for task management

**Phase 11: Dynamic Scheduler (Option 2)**
1. Implement automatic task rescheduling capabilities
2. Add sophisticated time block analysis and optimization
3. Create automated solutions for schedule conflicts

**Phase 12: PWA Features & Polish**
1. **⚡ MEDIUM: Implement PWA Caching Strategy** - Cache static assets, recent data, update strategy (PERFORMANCE)
2. Add service worker for proper PWA functionality
3. Create app manifest for mobile installation
4. Add simple PWA install prompt (no complex update management)
5. Implement proper error handling and user feedback
6. **🟢 LOW: Add DST Manual Time Adjustment** - User setting to shift time forward/backward (REGIONAL COMPATIBILITY)
7. Add final testing against all simulation scenarios
8. Deploy to Firebase Hosting

**Testing Throughout (Comprehensive Device Testing):**
- Test against all four simulation scenarios after each major phase on all device types
- **Responsive Design Testing:**
  - Test on mobile (320px-767px), tablet (768px-1023px), laptop (1024px-1439px), desktop (1440px+)
  - Verify touch targets meet 44px minimum on mobile devices
  - Test swipe gestures for day navigation on mobile/tablet
  - Validate hover states work properly on desktop (not on touch devices)
  - Ensure modals display correctly: full-screen on mobile, centered on tablet/desktop
  - Test keyboard navigation and shortcuts on desktop
- **Modern Design System Testing:**
  - Verify light mode color palette consistency
  - Test typography scaling and readability on all screen sizes
  - Validate component styling (buttons, forms, modals) appears correctly
  - Ensure micro-animations and transitions perform smoothly
  - Test glassmorphism effects and backdrop blur functionality
  - Verify icon consistency and proper sizing across all contexts
  - Test task block styling (gradients, shadows, border radius)
  - Validate timeline visual hierarchy (hour markers, time indicator, sleep blocks)
  - Ensure loading states and skeleton animations display properly
  - Test hover effects and interactive states on desktop
- **Visual Quality Assurance:**
  - Cross-browser testing for CSS consistency (Chrome, Firefox, Safari, Edge)
  - Test color contrast ratios meet WCAG AA standards for light mode
  - Validate visual feedback for all task states (normal, completed, overdue, in-progress)
  - Ensure smooth transitions between different UI states
  - Test visual consistency of overlapping task displays
- **Device-Specific Interactions:**
  - Mobile: Test tap interactions, swipe gestures, haptic feedback (if supported)
  - Desktop: Test click interactions, hover states, keyboard shortcuts
  - Verify timeline click-to-create works with both touch and mouse
- **Performance Across Devices:**
  - Ensure no lag during interactions on slower mobile devices
  - Test smooth animations and transitions on all screen sizes
  - Verify real-time updates (30s timeline indicator, 30s clock) perform well on mobile networks
  - Test animation performance and frame rates across devices
- **Core Functionality Testing:**
  - Ensure offline functionality operates smoothly with IndexedDB across all devices
  - Validate recurring task editing works as expected (this/future/all options)
  - Confirm all visual states display properly (overdue, completed, overlapping) on all screen sizes
  - Test overlapping task handling: 2 tasks on mobile, 3 tasks on tablet/desktop
  - Test time window scheduling and boundary handling across all devices
  - Test confirmation dialogs for all destructive actions with appropriate sizing
  - Test loading states for all Firebase operations with device-appropriate feedback
  - Test task description field functionality and search capability across devices
  - **Test New Task Management Features:**
    - Verify default values populate correctly in task creation modal
    - Test task duplication/copying functionality with "Copy Task" button
    - Validate data validation with proper error messages for invalid inputs
    - Test all specific error message scenarios (empty name, invalid duration, etc.)
    - Confirm intelligent time window detection based on creation context
  - **Test Enhanced Task Library features:**
    - Verify overdue tasks section displays correctly with count indicators
    - Test priority-based sorting within each task category
    - Validate dependencies indicator shows blocked tasks properly
    - Test simple filter toggles (mandatory vs skippable, time window filters)
    - Confirm recently modified tasks appear at top of their sections
    - Test multi-field search functionality (name and description)
    - Verify all task status indicators display correctly across categories
  - Test PWA install prompt functionality on mobile and desktop
  - Verify fixed header stays visible and adapts to screen size
  - Test scroll-to-top button functionality with device-appropriate sizing
  - Test Today button navigation and auto-scroll on all devices
  - Validate smart duration suggestions work across all screen sizes

---

## 🚀 Getting Started

**Quick Setup:**
1. **Firebase Setup**: See `docs/specs/FIREBASE_SETUP_GUIDE.md`
2. **Development**: See `docs/specs/SIMPLE_DEV_ENVIRONMENT_SPEC.md`

**Deploy to Firebase:**
```bash
firebase deploy
```

**Local Development:**
- Open `public/index.html` in a browser for a quick UI check.
- For service worker/offline testing, use a local server (e.g., `firebase serve`) or HTTPS; service workers do not register on `file://`.

**Repository:** Auto-deployed via GitHub Actions on push to main branch.

---

## Known Issues and Follow-ups

- Manifest icons are not yet included. Add icons under `public/icons/` and reference them in `manifest.json` and `index.html`.
- `public/sw.js` maintains a static cache list; keep it in sync or migrate to a generated precache in a future pass.
- `js/dataOffline.js` uses `require('./firebase.js')` inside an ES module (`dataUtils.getCurrentUserId`). Replace with `import { auth } from './firebase.js'` to avoid `require` being undefined in strict ESM contexts.
- Advanced PWA features (install prompt, update flow, background sync) are planned but not yet implemented.
# Daily AI — Personal Daily Task Manager (PWA)

Daily AI is a personal, time‑based daily task manager with an intelligent scheduling engine. It runs as a lightweight Progressive Web App, works offline, and syncs when you’re back online. Built with plain HTML/CSS/JS and Firebase.

## Features

- Today view: timeline with real‑time indicator and list toggle
- Task Library: search, filters, priority, dependencies, soft delete
- Simple Settings: sleep duration, wake/sleep times
- Authentication: single‑user email/password (Firebase Auth)
- Offline‑first: IndexedDB cache, queued changes, auto‑sync, multi‑tab sync
- Responsive UI: phone, tablet, laptop, desktop
- PWA basics: service worker, offline page, manifest (icons pending)

## Architecture

- Frontend: HTML/CSS/JS (no framework). Modules under `public/js/`
- Firebase: Auth + Firestore (offline persistence enabled)
- State: single store in `js/state/Store.js` with `BroadcastChannel` sync
- Scheduling: `js/taskLogic.js` + `js/logic/*` (recurrence, dependencies)
- Offline layer: `js/utils/OfflineDataLayer.js` via `js/dataOffline.js`
- Error handling: `js/utils/SimpleErrorHandler.js` (toasts + friendly messages)

## Getting Started

Prerequisites
- Modern browser: Chrome 100+, Firefox 100+, Safari 15.4+, Edge 100+
- Firebase project (Auth + Firestore). See `docs/specs/FIREBASE_SETUP_GUIDE.md`.
- Optional: `firebase-tools` for local serve/deploy.

Setup
1) Configure Firebase Security Rules and Indexes.
2) Enable Email/Password Auth in Firebase Console.
3) Update `public/js/firebase-config.js` if using your own project.

Run Locally
- Quick UI check: open `public/index.html` directly.
- To test service worker/offline, use a local server (e.g. `firebase serve`).

Deploy
```bash
firebase deploy
```

## PWA Notes

- Service Worker: `public/sw.js` caches core assets and serves `offline.html` for navigations when offline (cache‑first for static assets).
- Manifest: `public/manifest.json` is included. App icons are not yet defined.
- Icons: add PNG/SVG icons under `public/icons/` and reference them in `manifest.json` and (optionally) `index.html`.

## Project Structure (key files)

```
public/
  index.html                 # App shell, SW registration, module bootstrap
  manifest.json              # PWA manifest (icons pending)
  offline.html               # Offline fallback page
  sw.js                      # Basic service worker (cache + offline)
  css/                       # Styles (design system, components, timeline)
  js/
    app.js                   # App init (UI, offline, Firebase, auth state)
    ui.js                    # Views (Today/Library/Settings) + rendering
    state.js                 # State facade + actions
    state/Store.js           # Single source of truth + event bus
    taskLogic.js             # Scheduling engine and managers
    logic/                   # Recurrence, dependency, scheduling logic
    firebase.js              # Firebase init + safe wrappers
    utils/                   # Offline layer, navigation, errors, etc.
    components/              # Timeline, TaskList, TaskModal, etc.
```

## Known Limitations / TODO

- Icons missing: add and wire to `manifest.json` and `index.html`.
- Static cache list in `sw.js`: keep updated or migrate to a generated precache.
- ESM cleanup: `js/dataOffline.js` uses `require('./firebase.js')` in one utility; replace with an ESM import (`import { auth } from './firebase.js'`).
- Advanced PWA features (install prompt, update flow, background sync) are not yet implemented.

## Troubleshooting

- “Browser not supported” splash: update your browser to the versions above.
- Service worker not registering: SW requires localhost/HTTPS (not `file://`).
- Firestore permission errors: ensure rules and indexes are deployed; confirm user is authenticated.

## Documentation

Detailed specs and walkthroughs live in `docs/` (design system, error handling, multi‑tab sync, browser compatibility, and more).
