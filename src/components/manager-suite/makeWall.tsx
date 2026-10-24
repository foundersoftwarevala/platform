import type { WallConfig } from "./wall";
import { StatusPill } from "./wall";
import { ArrowLeft, CheckCircle2, Clock, Layers, Pause, Trash2 } from "lucide-react";
import type { ComponentType } from "react";

const STATUSES = ["active", "pending", "review", "paused", "closed"] as const;

export type WallStatus = "connected" | "coming_soon" | "removed";

type MakeWallOptions = {
  scope: string;
  entity: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  primaryLabel?: string;
  status?: WallStatus;
};

type SectionComponent = ComponentType<{ onNavigate?: (id: string) => void }>;

export function makeWall(opts: MakeWallOptions & { status: "coming_soon" }): SectionComponent;
export function makeWall(opts: MakeWallOptions & { status: "removed" }): null;
export function makeWall(opts: MakeWallOptions & { status?: "connected" }): WallConfig;
/**
 * Standard wall for every manager surface that mirrors the upstream feature
 * without a bespoke schema: named records, owner, scope, value, status.
 */
export function makeWall(opts: MakeWallOptions): WallConfig | SectionComponent | null {
  if (opts.status === "removed") return null;
  if (opts.status === "coming_soon") {
    return function ComingSoon({ onNavigate }) {
      return (
        <section
          aria-labelledby="coming-soon-title"
          className="flex min-h-[18rem] flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center"
        >
          <opts.icon className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h1 id="coming-soon-title" className="text-lg font-semibold">
            {opts.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Coming soon</p>
          <button
            type="button"
            onClick={() => onNavigate?.("Dashboard")}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to dashboard
          </button>
        </section>
      );
    };
  }

  return {
    scope: opts.scope,
    entity: opts.entity,
    eyebrow: opts.eyebrow,
    title: opts.title,
    subtitle: opts.subtitle,
    icon: opts.icon,
    primaryLabel: opts.primaryLabel ?? `New ${opts.entity}`,
    seed: [],
    kpis: [],
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
