import { getFirestoreDb } from "@/lib/firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { Settings } from "@/lib/types";

const ref = (uid: string) => doc(getFirestoreDb(), "users", uid);

export async function getUserSettings(uid: string): Promise<Settings | null> {
  const snap = await getDoc(ref(uid));
  if (!snap.exists()) return null;
  const d = snap.data() as Partial<Settings>;
  const settings: Settings = {
    desiredSleepDuration: typeof d.desiredSleepDuration === 'number' ? d.desiredSleepDuration : 7.5,
    defaultWakeTime: (d.defaultWakeTime as string) ?? "06:30",
    defaultSleepTime: (d.defaultSleepTime as string) ?? "23:00",
  };
  return settings;
}

export async function saveUserSettings(uid: string, settings: Settings): Promise<void> {
  await setDoc(ref(uid), settings, { merge: true });
}

