export type TimeString = string; // 'HH:MM' 24-hour

export interface Settings {
  desiredSleepDuration: number; // hours
  defaultWakeTime: TimeString;
  defaultSleepTime: TimeString;
}

export type SchedulingType = 'fixed' | 'flexible';
export type TimeWindow = 'morning' | 'afternoon' | 'evening' | 'anytime';

// Recurrence types promoted to shared types for consistency across the app
export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export type CustomPattern =
  | { type: 'weekdays' }
  | { type: 'weekends' }
  | { type: 'nth_weekday'; dayOfWeek: number; nthWeek: number }
  | { type: 'last_weekday'; dayOfWeek: number }
  | { type: 'business_days' };

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number; // >=1
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  endAfterOccurrences?: number;
  // weekly
  daysOfWeek?: number[]; // 0-6 (Sun=0)
  // monthly/yearly
  dayOfMonth?: number; // 1-31 or -1 for last day of month
  month?: number; // 1-12 (for yearly)
  // custom
  customPattern?: CustomPattern;
}

export interface TaskTemplate {
  id: string;
  taskName: string;
  description?: string;
  isMandatory: boolean;
  priority: number; // 1-5
  isActive: boolean;
  schedulingType: SchedulingType;
  defaultTime?: TimeString; // for fixed
  timeWindow?: TimeWindow; // for flexible
  durationMinutes: number;
  minDurationMinutes?: number;
  dependsOn?: string; // templateId
  recurrenceRule?: RecurrenceRule;
  // Optional small visual buffer (minutes) around anchors on timeline
  bufferMinutes?: number;
  // Optional metadata: last updated time (server timestamp/epoch)
  updatedAt?: unknown;
}

export type InstanceStatus = 'pending' | 'completed' | 'skipped' | 'postponed';

export interface TaskInstance {
  id: string;
  templateId: string;
  date: string; // YYYY-MM-DD
  status: InstanceStatus;
  modifiedStartTime?: TimeString;
  completedAt?: number; // epoch ms
  skippedReason?: string;
  note?: string;
}

export interface ScheduleBlock {
  templateId: string;
  startTime: TimeString;
  endTime: TimeString;
}

export interface ScheduleResult {
  success: boolean;
  schedule: ScheduleBlock[];
  sleepSchedule: { wakeTime: TimeString; sleepTime: TimeString; duration: number };
  totalTasks: number;
  scheduledTasks: number;
  message?: string;
  error?: string;
  advisories?: string[];
}
