"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { type AuthUser, authApi, ensureFirestorePersistence } from "@/lib/firebase/client";
import { useAppStore } from "@/store/useAppStore";
import { getUserSettings } from "@/lib/data/settings";

type AuthContextValue = {
  user: AuthUser;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export default function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        await ensureFirestorePersistence();
      } catch (e) {
        console.warn("Failed to enable Firestore persistence", e);
      }
      unsub = authApi.onAuthStateChanged((u) => {
        setUser(u);
        setLoading(false);
        // Reflect auth state in the app store
        const st = useAppStore.getState();
        st.setUser(u);
        if (!u) {
          st.resetAfterSignOut();
        } else {
          // Load persisted settings for this user (if present)
          (async () => {
            try {
              const s = await getUserSettings(u.uid);
              if (s) st.setSettings(s);
            } catch (e) {
              console.warn("Failed to load user settings", e);
            }
          })();
        }
      });
    })();
    return () => {
      try { unsub(); } catch {}
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async signIn(email: string, password: string) {
      await authApi.signInWithEmailAndPassword(email, password);
    },
    async signUp(email: string, password: string) {
      await authApi.createUserWithEmailAndPassword(email, password);
    },
    async signOut() {
      await authApi.signOut();
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within FirebaseClientProvider");
  return ctx;
}
