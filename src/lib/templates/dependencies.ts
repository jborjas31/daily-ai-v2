import type { TaskTemplate } from "@/lib/types";

export type DependencyStatus = "ok" | "disabled" | "missing" | "cycle";

export type DependencyInfo = {
  status: DependencyStatus;
  dependsOnId: string;
  dependsOnName?: string;
};

/**
 * Build a fast lookup table for templates by id.
 */
export function buildById(templates: TaskTemplate[]): Map<string, TaskTemplate> {
  const map = new Map<string, TaskTemplate>();
  for (const t of templates) map.set(t.id, t);
  return map;
}

/**
 * Compute dependency status for a single template.
 * - If no dependsOn, returns null (no dependency).
 * - If dependsOn not found, status = "missing".
 * - If dependsOn found but inactive, status = "disabled".
 * - Else, status = "ok".
 */
export function getDependencyStatus(
  template: TaskTemplate,
  byId: Map<string, TaskTemplate>
): DependencyInfo | null {
  const depId = template.dependsOn;
  if (!depId) return null;
  // Self-cycle
  if (depId === template.id) {
    return { status: "cycle", dependsOnId: depId, dependsOnName: template.taskName };
  }
  const dep = byId.get(depId);
  if (!dep) return { status: "missing", dependsOnId: depId };
  // Two-node cycle (A <-> B)
  if (dep.dependsOn === template.id) {
    return { status: "cycle", dependsOnId: depId, dependsOnName: dep.taskName };
  }
  if (dep.isActive === false) {
    return { status: "disabled", dependsOnId: depId, dependsOnName: dep.taskName };
  }
  return { status: "ok", dependsOnId: depId, dependsOnName: dep.taskName };
}
