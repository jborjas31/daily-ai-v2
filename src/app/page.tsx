"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    // Redirect to Today on first load
    router.replace("/today");
  }, [router]);
  return (
    <div className="p-6">
      <p className="text-sm text-black/70 dark:text-white/70">Redirecting to Today…</p>
      <p className="mt-2">
        <a href="/today" className="underline">Go to Today</a>
      </p>
    </div>
  );
}
