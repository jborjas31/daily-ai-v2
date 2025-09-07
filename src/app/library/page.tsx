"use client";
import { useEffect, useMemo, useState } from "react";
import useRequireAuth from "@/components/guards/useRequireAuth";
import { useAppStore } from "@/store/useAppStore";
import type { AppState } from "@/store/useAppStore";
import type { TaskTemplate } from "@/lib/types";
import { listTemplates, updateTemplate, duplicateTemplate, softDeleteTemplate, createTemplate } from "@/lib/data/templates";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import TaskModal from "@/components/library/TaskModal";
import { toast } from "sonner";

export default function LibraryPage() {
  const { user, ready } = useRequireAuth();
  const templates = useAppStore((s: AppState) => s.templates);
  const setTaskTemplates = useAppStore((s: AppState) => s.setTaskTemplates);
  const upsert = useAppStore((s: AppState) => s.upsertTaskTemplate);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<TaskTemplate | null>(null);

  useEffect(() => {
    (async () => {
      if (!ready || !user) return;
      setLoading(true);
      try {
        const list = await listTemplates(user.uid);
        setTaskTemplates(list);
      } catch {
        toast.error("Failed to load templates");
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, user, setTaskTemplates]);

  const active = useMemo(() => templates.filter(t => t.isActive !== false), [templates]);
  const inactive = useMemo(() => templates.filter(t => t.isActive === false), [templates]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold">Library</h1>
        </div>
        <p className="text-sm text-black/70 dark:text-white/70">Loading…</p>
      </div>
    );
  }

  async function toggleActive(t: TaskTemplate) {
    if (!user) return;
    const newVal = !(t.isActive !== false);
    upsert({ ...t, isActive: newVal });
    try {
      await updateTemplate(user.uid, t.id, { isActive: newVal });
      toast.success(newVal ? "Enabled" : "Disabled");
    } catch {
      upsert({ ...t });
      toast.error("Failed to update");
    }
  }

  async function onDuplicate(t: TaskTemplate) {
    if (!user) return;
    try {
      const created = await duplicateTemplate(user.uid, t);
      upsert(created);
      toast.success("Duplicated");
    } catch {
      toast.error("Failed to duplicate");
    }
  }

  async function onDelete(id: string) {
    if (!user) return;
    const t = templates.find(x=>x.id===id);
    if (!t) return;
    upsert({ ...t, isActive: false });
    try {
      await softDeleteTemplate(user.uid, id);
      toast.success("Deleted (soft)");
    } catch {
      upsert({ ...t });
      toast.error("Failed to delete");
    }
  }

  async function onSaveModal(payload: Omit<TaskTemplate, 'id'> | TaskTemplate) {
    if (!user) return;
    if ('id' in payload) {
      // edit
      upsert(payload);
      try {
        await updateTemplate(user.uid, payload.id, payload);
        toast.success("Saved");
      } catch {
        toast.error("Failed to save");
      }
    } else {
      // create
      try {
        const created = await createTemplate(user.uid, payload);
        upsert(created);
        toast.success("Created");
      } catch {
        toast.error("Failed to create");
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Library</h1>
        <button
          type="button"
          onClick={() => { setEditItem(null); setModalOpen(true); }}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          New Task
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-black/70 dark:text-white/70">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="border rounded-md p-3">
            <h2 className="font-semibold mb-2">Active ({active.length})</h2>
            {active.length === 0 ? (
              <p className="text-sm text-black/60 dark:text-white/60">No active templates.</p>
            ) : (
              <ul className="divide-y divide-black/10 dark:divide-white/10">
                {active.map((t) => (
                  <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{t.taskName}</div>
                      <div className="text-sm text-black/60 dark:text-white/60">{t.schedulingType === 'fixed' ? `Fixed @ ${t.defaultTime}` : `Flexible (${t.timeWindow})`} • {t.durationMinutes}m</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-700" onClick={()=>{ setEditItem(t); setModalOpen(true); }}>Edit</button>
                      <button className="px-2 py-1 rounded-md bg-emerald-600 text-white" onClick={()=>toggleActive(t)}>Disable</button>
                      <button className="px-2 py-1 rounded-md bg-blue-600 text-white" onClick={()=>onDuplicate(t)}>Duplicate</button>
                      <button className="px-2 py-1 rounded-md bg-rose-600 text-white" onClick={()=>setConfirm({ id: t.id, name: t.taskName })}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border rounded-md p-3">
            <h2 className="font-semibold mb-2">Deleted / Inactive ({inactive.length})</h2>
            {inactive.length === 0 ? (
              <p className="text-sm text-black/60 dark:text-white/60">None.</p>
            ) : (
              <ul className="divide-y divide-black/10 dark:divide-white/10">
                {inactive.map((t) => (
                  <li key={t.id} className="py-2 flex items-center justify-between gap-3 opacity-70">
                    <div>
                      <div className="font-medium">{t.taskName}</div>
                      <div className="text-sm text-black/60 dark:text-white/60">{t.schedulingType === 'fixed' ? `Fixed @ ${t.defaultTime}` : `Flexible (${t.timeWindow})`} • {t.durationMinutes}m</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-2 py-1 rounded-md bg-emerald-600 text-white" onClick={()=>toggleActive(t)}>Restore</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Delete Task"
        description={confirm ? `Delete “${confirm.name}”? This is a soft delete (can restore).` : ''}
        confirmText="Delete"
        onConfirm={() => { if (confirm) onDelete(confirm.id); }}
        onOpenChange={(o)=>{ if (!o) setConfirm(null); }}
      />
      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initial={editItem}
        onSave={onSaveModal}
      />
    </div>
  );
}
