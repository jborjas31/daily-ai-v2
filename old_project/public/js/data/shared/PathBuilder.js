// PathBuilder — shared path helpers (Phase 1 stub)
// Returns Firestore path strings. No Firestore imports here.

const assertUid = (uid) => {
  if (!uid || typeof uid !== 'string') throw new Error('PathBuilder: uid is required');
  return uid;
};

export const paths = {
  // Root user collection and doc
  users: (uid) => `users/${assertUid(uid)}`,
  userDoc: (uid) => `users/${assertUid(uid)}`,

  // Task templates
  userTasks: (uid) => `users/${assertUid(uid)}/tasks`,
  taskDoc: (uid, taskId) => `${paths.userTasks(assertUid(uid))}/${taskId}`,

  // Task instances
  taskInstances: (uid) => `users/${assertUid(uid)}/task_instances`,
  instanceDoc: (uid, instanceId) => `${paths.taskInstances(assertUid(uid))}/${instanceId}`,

  // Daily schedules
  dailySchedules: (uid) => `users/${assertUid(uid)}/daily_schedules`,
  scheduleDoc: (uid, date) => `${paths.dailySchedules(assertUid(uid))}/${date}`,
};

export default paths;

