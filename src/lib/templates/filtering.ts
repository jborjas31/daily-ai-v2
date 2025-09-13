import type { TaskTemplate, TimeWindow } from "@/lib/types";

// Local copies to avoid coupling UI store types into pure utils
export type SortMode = "name" | "priority";
export type MandatoryFilter = "all" | "mandatory" | "skippable";

export type FilterOptions = {
  query?: string;
  mandatory?: MandatoryFilter;
  timeWindows?: Set<TimeWindow>;
};

export function normalize(s: string | undefined | null): string {
  return (s ?? "").toLowerCase().trim();
}

export function matchesQuery(t: TaskTemplate, q: string | undefined): boolean {
  const query = normalize(q);
  if (!query) return true;
  const hay = `${normalize(t.taskName)}\n${normalize(t.description)}`;
  return hay.includes(query);
}

export function filterByMandatory(t: TaskTemplate, f: MandatoryFilter | undefined): boolean {
  if (!f || f === "all") return true;
  if (f === "mandatory") return t.isMandatory === true;
  // skippable
  return t.isMandatory !== true;
}

export function filterByTimeWindows(t: TaskTemplate, wins?: Set<TimeWindow>): boolean {
  // Empty or undefined set allows all
  if (!wins || wins.size === 0) return true;
  if (t.schedulingType === "fixed") return true; // fixed time not filtered by window
  const w = t.timeWindow ?? "anytime";
  return wins.has(w);
}

export function filterTemplates(templates: TaskTemplate[], opts?: FilterOptions): TaskTemplate[] {
  const { query, mandatory, timeWindows } = opts || {};
  return templates.filter((t) =>
    matchesQuery(t, query) && filterByMandatory(t, mandatory) && filterByTimeWindows(t, timeWindows)
  );
}

export function sortTemplates(templates: TaskTemplate[], mode: SortMode): TaskTemplate[] {
  const withIndex = templates.map((t, i) => ({ t, i }));
  const byName = (a: string, b: string) => normalize(a).localeCompare(normalize(b));
  withIndex.sort((a, b) => {
    if (mode === "name") {
      const c = byName(a.t.taskName, b.t.taskName);
      return c !== 0 ? c : a.i - b.i; // stable
    }
    // priority: high -> low; tiebreaker name A->Z; then index for stability
    const pa = Number.isFinite(a.t.priority as number) ? (a.t.priority as number) : 0;
    const pb = Number.isFinite(b.t.priority as number) ? (b.t.priority as number) : 0;
    if (pb !== pa) return pb - pa;
    const c = byName(a.t.taskName, b.t.taskName);
    return c !== 0 ? c : a.i - b.i;
  });
  return withIndex.map((x) => x.t);
}

