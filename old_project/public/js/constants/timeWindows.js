/**
 * Time Windows - Single Source of Truth
 * Canonical, settings-ready definitions for time windows used across the app.
 */

// Helpers
export function toMinutes(timeString) {
  const [h, m] = (timeString || '00:00').split(':').map(Number);
  return (h * 60) + (m || 0);
}

export function toTimeString(minutes) {
  const clamped = Math.max(0, Math.min(minutes, (23 * 60) + 59));
  const h = Math.floor(clamped / 60).toString().padStart(2, '0');
  const m = (clamped % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function formatWindowLabel(start, end) {
  return `${start.replace(':00','')}-${end.replace(':00','')}`.replace('--', '-');
}

// Default windows (string start/end retained for compatibility)
export const TIME_WINDOWS_DEFAULT = {
  morning: { start: '06:00', end: '12:00', label: 'Morning (6:00-12:00)', startMin: 360, endMin: 720 },
  afternoon: { start: '12:00', end: '18:00', label: 'Afternoon (12:00-18:00)', startMin: 720, endMin: 1080 },
  evening: { start: '18:00', end: '23:00', label: 'Evening (18:00-23:00)', startMin: 1080, endMin: 1380 },
  anytime: { start: '06:00', end: '23:00', label: 'Anytime (6:00-23:00)', startMin: 360, endMin: 1380 }
};

// Alias for convenience (current callers expect TIME_WINDOWS)
export const TIME_WINDOWS = TIME_WINDOWS_DEFAULT;

// Future: derive windows from user settings (wake/sleep or regional prefs)
export function getTimeWindows(settings = null) {
  // For now, return defaults. Settings integration can adjust ranges later.
  return TIME_WINDOWS_DEFAULT;
}

