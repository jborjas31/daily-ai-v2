// Firebase client initialization (modular SDK)
// Uses NEXT_PUBLIC_* env vars. Client-only usage.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  type Auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  type Firestore,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
} from "firebase/firestore";

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
    // eslint-disable-next-line no-console
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
  dbInstance = getFirestore(getFirebaseApp());
  return dbInstance;
}

export async function ensureFirestorePersistence(): Promise<void> {
  if (persistenceInitialized) return;
  const db = getFirestoreDb();
  try {
    // Try multi-tab first; fall back to single-tab if not available
    await enableMultiTabIndexedDbPersistence(db);
  } catch (err) {
    try {
      await enableIndexedDbPersistence(db);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Firestore persistence not available:", e);
    }
  } finally {
    persistenceInitialized = true;
  }
}

export type AuthUser = User | null;

export const authApi = {
  onAuthStateChanged: (cb: (user: AuthUser) => void) => onAuthStateChanged(getFirebaseAuth(), cb),
  signInWithEmailAndPassword: (email: string, password: string) =>
    signInWithEmailAndPassword(getFirebaseAuth(), email, password),
  signOut: () => signOut(getFirebaseAuth()),
};

