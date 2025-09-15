import { useEffect, useState } from 'react';
import { todayISO, nowTimeString } from '@/lib/time';

type NowTick = {
  nowISO: string; // YYYY-MM-DD (local)
  nowTime: string; // HH:MM (local)
};

/**
 * useNowTick — lightweight ticker for current date/time strings.
 * - Updates every `periodMs` (default 30s).
 * - Skips updates when the document is hidden (tab not visible).
 * - On becoming visible again, forces an immediate refresh.
 */
export default function useNowTick(periodMs = 30_000): NowTick {
  const [now, setNow] = useState<NowTick>(() => ({ nowISO: todayISO(), nowTime: nowTimeString() }));

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      // If running in a non-DOM environment, just update best‑effort
      // Otherwise, avoid updating state while hidden to prevent needless renders
      const isHidden = typeof document !== 'undefined' && typeof document.hidden === 'boolean' ? document.hidden : false;
      if (!isHidden && !cancelled) {
        setNow({ nowISO: todayISO(), nowTime: nowTimeString() });
      }
    };

    // Schedule periodic updates with a self-adjusting timeout to avoid multi-fire catch-up under fake timers
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const period = Math.max(1_000, periodMs);
    const loop = () => {
      timeoutId = setTimeout(() => {
        tick();
        if (!cancelled) loop();
      }, period);
    };
    loop();

    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        tick();
      }
    };
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    // Do not call tick() immediately to avoid double-advancing under fake timers/tests

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [periodMs]);

  return now;
}
