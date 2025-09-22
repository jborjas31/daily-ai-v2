// Firebase client initialization (modular SDK)
// Uses NEXT_PUBLIC_* env vars. Client-only usage.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  type Auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

type FirestoreInitSettings = Parameters<typeof initializeFirestore>[1];

function buildPersistentCacheSettings(): FirestoreInitSettings {
  return {
    cache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  } as unknown as FirestoreInitSettings;
}

function buildMemoryCacheSettings(): FirestoreInitSettings {
  return {
    cache: memoryLocalCache(),
  } as unknown as FirestoreInitSettings;
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let persistenceInitialized = false;

export function getFirebaseApp(): FirebaseApp {
  if (appInstance) return appInstance;
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  } as const;

  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    console.warn("Firebase config is missing one or more NEXT_PUBLIC_* env vars");
  }

  appInstance = getApps().length ? getApp() : initializeApp(config);
  return appInstance;
}

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  authInstance = getAuth(getFirebaseApp());
  return authInstance;
}

export function getFirestoreDb(): Firestore {
  if (dbInstance) return dbInstance;
  const app = getFirebaseApp();

  if (typeof window === "undefined") {
    dbInstance = getFirestore(app);
    return dbInstance;
  }

  try {
    dbInstance = initializeFirestore(app, buildPersistentCacheSettings());
  } catch (err) {
    const message = (err as Error | undefined)?.message ?? "";
    if (message.includes("already exists")) {
      dbInstance = getFirestore(app);
      return dbInstance;
    }

    console.warn("Persistent Firestore cache unavailable, using in-memory cache instead.", err);
    try {
      dbInstance = initializeFirestore(app, buildMemoryCacheSettings());
    } catch (fallbackErr) {
      const fallbackMessage = (fallbackErr as Error | undefined)?.message ?? "";
      if (!fallbackMessage.includes("already exists")) {
        console.warn(
          "Failed to initialize Firestore memory cache; falling back to default instance.",
          fallbackErr,
        );
      }
      dbInstance = getFirestore(app);
    }
  }

  return dbInstance;
}

export async function ensureFirestorePersistence(): Promise<void> {
  if (persistenceInitialized) return;
  try {
    getFirestoreDb();
  } catch (e) {
    console.warn("Firestore persistence configuration failed:", e);
  } finally {
    persistenceInitialized = true;
  }
}

export type AuthUser = User | null;

export const authApi = {
  onAuthStateChanged: (cb: (user: AuthUser) => void) => onAuthStateChanged(getFirebaseAuth(), cb),
  signInWithEmailAndPassword: (email: string, password: string) =>
    signInWithEmailAndPassword(getFirebaseAuth(), email, password),
  createUserWithEmailAndPassword: (email: string, password: string) =>
    createUserWithEmailAndPassword(getFirebaseAuth(), email, password),
  signOut: () => signOut(getFirebaseAuth()),
};
