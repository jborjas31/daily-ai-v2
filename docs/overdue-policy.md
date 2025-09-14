# Overdue Policy (Visual Only)

The Today view uses a calm, visual‑only policy for overdue items:

- Definition: A block is considered overdue when its scheduled start time is before the current local time and it has not been Completed or Skipped on the current date.
- Mandatory vs. skippable:
  - Mandatory tasks: are visually re‑seated to “now” (using a CSS transform) to draw attention, and shown in higher‑contrast red.
  - Skippable tasks: are not re‑seated; they remain at their scheduled position but are de‑emphasized (reduced opacity).
- Scope: This policy applies only on Today; other dates do not show the now‑line or overdue visuals.
- Non‑destructive: No underlying schedule or instance data is changed by the overdue visuals.

Rationale: This provides a gentle nudge to address important tasks first while keeping the timeline stable and predictable.
