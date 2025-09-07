"use client";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/FirebaseClientProvider";
import type { AuthUser } from "@/lib/firebase/client";

type UseRequireAuthResult = {
  user: AuthUser;
  ready: boolean; // true when authenticated and safe to render protected content
};

export default function useRequireAuth(): UseRequireAuthResult {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [user, loading, router]);

  const ready = useMemo(() => !loading && !!user, [loading, user]);
  return { user, ready };
}

