import { getFirestoreDb } from "@/lib/firebase/client";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import type { TaskInstance } from "@/lib/types";

const col = (uid: string) => collection(getFirestoreDb(), "users", uid, "task_instances");
const ref = (uid: string, id: string) => doc(getFirestoreDb(), "users", uid, "task_instances", id);

export function instanceIdFor(date: string, templateId: string): string {
  return `inst-${date}-${templateId}`;
}

export async function listInstancesByDate(uid: string, date: string): Promise<TaskInstance[]> {
  const q = query(col(uid), where("date", "==", date));
  const snap = await getDocs(q);
  const out: TaskInstance[] = [];
  snap.forEach((d) => {
    const data = d.data() as Omit<TaskInstance, "id">;
    out.push({ id: d.id, ...data });
  });
  return out;
}

export async function upsertInstance(
  uid: string,
  inst: TaskInstance | Omit<TaskInstance, "id">
): Promise<string> {
  // Use deterministic id if not provided so toggles are idempotent per date/template
  const id = (inst as TaskInstance).id ?? instanceIdFor(inst.date, inst.templateId);
  const { id: _ignored, ...payload } = inst as TaskInstance;
  await setDoc(ref(uid, id), payload, { merge: true });
  return id;
}

export async function deleteInstance(uid: string, id: string): Promise<void> {
  await deleteDoc(ref(uid, id));
}
