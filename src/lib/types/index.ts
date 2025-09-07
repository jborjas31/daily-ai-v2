export type TimeString = string; // 'HH:MM' 24-hour

export interface Settings {
  desiredSleepDuration: number; // hours
  defaultWakeTime: TimeString;
  defaultSleepTime: TimeString;
}

export type SchedulingType = 'fixed' | 'flexible';
export type TimeWindow = 'morning' | 'afternoon' | 'evening' | 'anytime';

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
  recurrenceRule?: unknown;
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
