import type { WallConfig } from "./wall";
import { StatusPill } from "./wall";
import { Activity, CheckCircle2, Clock, Layers, Pause, Trash2 } from "lucide-react";

const STATUSES = ["active", "pending", "review", "paused", "closed"] as const;

/**
 * Standard wall for every manager surface that mirrors the upstream feature
 * without a bespoke schema: named records, owner, scope, value, status.
 */
export function makeWall(opts: {
  scope: string;
  entity: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  primaryLabel?: string;
}): WallConfig {
  return {
    scope: opts.scope,
    entity: opts.entity,
    eyebrow: opts.eyebrow,
    title: opts.title,
    subtitle: opts.subtitle,
    icon: opts.icon,
    primaryLabel: opts.primaryLabel ?? `New ${opts.entity}`,
    seed: [],
    kpis: [
      { label: "Records", icon: Layers, compute: (r) => (r.length ? r.length : "—") },
      { label: "Active", icon: CheckCircle2, compute: (r) => (r.length ? r.filter((x) => x.status === "active").length : "—") },
      { label: "Pending", icon: Clock, compute: (r) => (r.length ? r.filter((x) => x.status === "pending").length : "—") },
      { label: "Updated", icon: Activity, compute: (r) => (r.length ? r.length : "—") },
    ],
    columns: [
      { key: "name", header: "Name", render: (r) => <div className="font-semibold">{r.name}</div> },
      { key: "owner", header: "Owner" },
      { key: "scope", header: "Scope" },
      { key: "value", header: "Value", align: "right" },
      { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
      { key: "created_at", header: "Created" },
    ],
    filters: [{ key: "status", label: "Status", options: STATUSES }],
    bulkActions: [
      { key: "activate", label: "Activate", icon: CheckCircle2, patch: { status: "active" } },
      { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" } },
      { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
    ],
    rowActions: [
      { key: "activate", label: "Activate", icon: CheckCircle2, patch: { status: "active" } },
      { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" }, destructive: true },
    ],
    formFields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "owner", label: "Owner", type: "text" },
      { key: "scope", label: "Scope", type: "text" },
      { key: "value", label: "Value", type: "text" },
      { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "active" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    searchFields: ["name", "owner", "scope"],
    primaryField: "name",
    subField: "owner",
  };
}