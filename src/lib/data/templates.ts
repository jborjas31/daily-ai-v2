import { getFirestoreDb } from "@/lib/firebase/client";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import type { TaskTemplate } from "@/lib/types";

const col = (uid: string) => collection(getFirestoreDb(), "users", uid, "tasks");
const ref = (uid: string, id: string) => doc(getFirestoreDb(), "users", uid, "tasks", id);

export async function listTemplates(uid: string): Promise<TaskTemplate[]> {
  const snap = await getDocs(col(uid));
  const out: TaskTemplate[] = [];
  snap.forEach((d) => {
    const data = d.data() as Omit<TaskTemplate, 'id'>;
    out.push({ id: d.id, ...data });
  });
  return out;
}

export async function createTemplate(uid: string, tpl: Omit<TaskTemplate, 'id'>): Promise<TaskTemplate> {
  const res = await addDoc(col(uid), tpl);
  return { ...tpl, id: res.id };
}

export async function updateTemplate(uid: string, id: string, updates: Partial<TaskTemplate>): Promise<void> {
  await updateDoc(ref(uid, id), updates);
}

export async function softDeleteTemplate(uid: string, id: string): Promise<void> {
  await updateDoc(ref(uid, id), { isActive: false });
}

export async function duplicateTemplate(uid: string, tpl: TaskTemplate): Promise<TaskTemplate> {
  const copy: Omit<TaskTemplate, 'id'> = {
    taskName: tpl.taskName,
    description: tpl.description,
    isMandatory: tpl.isMandatory,
    priority: tpl.priority,
    isActive: true,
    schedulingType: tpl.schedulingType,
    defaultTime: tpl.defaultTime,
    timeWindow: tpl.timeWindow,
    durationMinutes: tpl.durationMinutes,
    minDurationMinutes: tpl.minDurationMinutes,
    dependsOn: tpl.dependsOn,
    recurrenceRule: tpl.recurrenceRule,
  };
  const res = await addDoc(col(uid), copy);
  return { ...copy, id: res.id };
}
