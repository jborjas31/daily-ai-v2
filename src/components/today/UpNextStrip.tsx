"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore, type UpNextSuggestion } from "@/store/useAppStore";
import useNowTick from "@/lib/utils/useNowTick";

export default function UpNextStrip() {
  const currentDate = useAppStore((s) => s.ui.currentDate);
  const computeUpNext = useAppStore((s) => s.computeUpNext);
  const setInstanceStartTime = useAppStore((s) => s.setInstanceStartTime);
  const skipInstance = useAppStore((s) => s.skipInstance);
  const postponeInstance = useAppStore((s) => s.postponeInstance);
  const { nowTime } = useNowTick(30_000);

  const suggestion: UpNextSuggestion = useMemo(() => computeUpNext(currentDate, nowTime), [computeUpNext, currentDate, nowTime]);

  const [justStartedId, setJustStartedId] = useState<string | null>(null);
  useEffect(() => {
    if (!justStartedId) return;
    const id = setTimeout(() => setJustStartedId(null), 1400);
    return () => clearTimeout(id);
  }, [justStartedId]);

  // Disclosure menu state (declare before any conditional returns to keep hook order stable)
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = 'upnext-cantdo-menu';
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const lastItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!menuOpen) return;
      const el = containerRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function onDocKey(e: KeyboardEvent) {
      if (!menuOpen) return;
      if (e.key === 'Escape') {
        setMenuOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) {
      // Focus first item on open
      firstItemRef.current?.focus();
    }
  }, [menuOpen]);

  if (suggestion.kind === 'none') return null;

  const label = (() => {
    if (suggestion.kind === 'anchor') {
      return `${suggestion.template.taskName}`;
    }
    if (suggestion.kind === 'flexible') {
      return `${suggestion.template.taskName}`;
    }
    return '';
  })();

  const hint = (() => {
    if (suggestion.kind === 'anchor') {
      return `${suggestion.block.startTime}–${suggestion.block.endTime}`;
    }
    if (suggestion.kind === 'flexible') {
      const d = suggestion.template.durationMinutes ?? 0;
      const win = suggestion.window;
      return d > 0 ? `~${d}m in ${win}` : `${win}`;
    }
    return '';
  })();

  const onStart = async () => {
    const t = suggestion.template;
    const ok = await setInstanceStartTime(currentDate, t.id, nowTime);
    if (ok) setJustStartedId(t.id);
  };

  const onSkip = async () => {
    const t = suggestion.template;
    await skipInstance(currentDate, t.id);
  };

  const onPostpone = async () => {
    const t = suggestion.template;
    await postponeInstance(currentDate, t.id);
  };

  const isAnchor = suggestion.kind === 'anchor';

  return (
    <div className="mt-2 mb-3" aria-live="polite">
      <div className="flex items-center justify-between gap-3 rounded-md border bg-slate-50 dark:bg-slate-800 px-3 py-2">
        <div className="min-w-0">
          <div className="text-sm text-black/70 dark:text-white/70">Up next</div>
          <div className="font-medium truncate" title={`${label} — ${hint}`}>{label}</div>
          <div className="text-xs text-black/60 dark:text-white/60">{hint}</div>
        </div>
        <div className="flex items-center gap-2" ref={containerRef}>
          {justStartedId === suggestion.template.id ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 text-sm" aria-label="Started">
              ✓ Started
            </span>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
              aria-label="Start now"
            >
              Start
            </button>
          )}
          <div className={`relative ${isAnchor ? 'opacity-90' : ''}`}>
            <button
              ref={btnRef}
              type="button"
              aria-haspopup="menu"
              aria-controls={menuId}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setMenuOpen(true);
                }
              }}
              className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-600"
            >
              Can&apos;t do
            </button>
            {menuOpen ? (
              <div
                id={menuId}
                role="menu"
                aria-label="Can&apos;t do menu"
                className="absolute right-0 mt-1 w-36 rounded-md border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-lg focus:outline-none z-10"
                onKeyDown={(e) => {
                  const first = firstItemRef.current;
                  const last = lastItemRef.current;
                  if (!first || !last) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    (document.activeElement === first ? last : first).focus();
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    (document.activeElement === last ? first : last).focus();
                  } else if (e.key === 'Tab') {
                    e.preventDefault();
                    (document.activeElement === first ? last : first).focus();
                  }
                }}
              >
                <button
                  ref={firstItemRef}
                  role="menuitem"
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={async () => {
                    await onSkip();
                    setMenuOpen(false);
                    btnRef.current?.focus();
                  }}
                >
                  Skip
                </button>
                <button
                  ref={lastItemRef}
                  role="menuitem"
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={async () => {
                    await onPostpone();
                    setMenuOpen(false);
                    btnRef.current?.focus();
                  }}
                >
                  Postpone
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
