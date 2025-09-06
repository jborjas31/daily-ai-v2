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
    const data = d.data() as any;
    out.push({ id: d.id, ...data } as TaskTemplate);
  });
  return out;
}

export async function createTemplate(uid: string, tpl: Omit<TaskTemplate, 'id'>): Promise<TaskTemplate> {
  const { id, ...rest } = tpl as any;
  const res = await addDoc(col(uid), rest);
  return { ...(tpl as any), id: res.id } as TaskTemplate;
}

export async function updateTemplate(uid: string, id: string, updates: Partial<TaskTemplate>): Promise<void> {
  await updateDoc(ref(uid, id), updates as any);
}

export async function softDeleteTemplate(uid: string, id: string): Promise<void> {
  await updateDoc(ref(uid, id), { isActive: false } as any);
}

export async function duplicateTemplate(uid: string, tpl: TaskTemplate): Promise<TaskTemplate> {
  const copy: Omit<TaskTemplate, 'id'> = {
    ...tpl,
    isActive: true,
    taskName: `Copy of ${tpl.taskName}`,
  } as any;
  const { id, ...rest } = copy as any;
  const res = await addDoc(col(uid), rest);
  return { ...(copy as any), id: res.id } as TaskTemplate;
}

