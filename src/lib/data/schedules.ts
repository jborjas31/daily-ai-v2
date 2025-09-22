import { getFirestoreDb } from "@/lib/firebase/client";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { ScheduleResult } from "@/lib/types";

const ref = (uid: string, date: string) => doc(getFirestoreDb(), "users", uid, "daily_schedules", date);

export async function getCachedSchedule(uid: string, date: string): Promise<ScheduleResult | null> {
  const snap = await getDoc(ref(uid, date));
  if (!snap.exists()) return null;
  const data = snap.data() as ScheduleResult | (ScheduleResult & { updatedAt?: unknown; version?: string });
  // Strip metadata if present
  const { success, schedule, sleepSchedule, totalTasks, scheduledTasks, message, error, advisories } = data as ScheduleResult;
  return { success, schedule, sleepSchedule, totalTasks, scheduledTasks, message, error, advisories };
}

export async function putCachedSchedule(uid: string, date: string, result: ScheduleResult): Promise<void> {
  const { message, error, advisories, ...required } = result;
  const payload = {
    ...required,
    ...(message !== undefined && { message }),
    ...(error !== undefined && { error }),
    ...(advisories !== undefined && { advisories }),
    updatedAt: serverTimestamp(),
    version: "v1",
  };
  await setDoc(ref(uid, date), payload, { merge: true });
}
