"use client";
import { useMemo } from "react";
import { useAuth } from "@/components/providers/FirebaseClientProvider";

function formatToday() {
  const now = new Date();
  // Local device time only
  return now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AppHeader() {
  const { user, loading, signOut } = useAuth();
  const today = useMemo(() => formatToday(), []);

  return (
    <header className="w-full border-b border-black/10 dark:border-white/15 bg-white/70 dark:bg-black/30 backdrop-blur supports-[backdrop-filter]:bg-white/50 sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold">Daily AI</span>
          <span className="text-sm text-black/60 dark:text-white/60" aria-label="Current date">
            {today}
          </span>
        </div>
        <div className="text-sm text-black/70 dark:text-white/70 flex items-center gap-3">
          {loading ? (
            <span>Loading…</span>
          ) : user ? (
            <>
              <span>Signed in as {user.email ?? "user"}</span>
              <button
                type="button"
                onClick={() => void (async () => { try { await signOut(); } catch {} })()}
                className="px-2 py-1 rounded-md bg-black/80 text-white hover:bg-black"
              >
                Sign out
              </button>
            </>
          ) : (
            <span>Not signed in</span>
          )}
        </div>
      </div>
    </header>
  );
}
