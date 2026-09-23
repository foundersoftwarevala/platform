import { Repeat, CheckCircle2, Pause, Play, XCircle, Clock, Layers } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATES = ["active", "paused", "cancelled", "pending", "expired"] as const;

/**
 * Reseller memberships, read and written on reseller_memberships.
 *
 * The wall used to show three invented subscriptions. These are the real
 * memberships: which plan a reseller is on, when it started, and when it
 * next comes up for renewal.
 */
export const config: WallConfig = {
  resource: "reseller_memberships",
  creatable: false,
  scope: "subscriptions", entity: "membership", route: "/subscriptions",
  eyebrow: "Catalog", title: "Memberships Wall",
  subtitle: "Which plan each reseller is on, and when it renews.",
  icon: Repeat, primaryLabel: "New Membership",
  seed: [],
  columns: [
    { key: "plan_code", header: "Plan", render: (r) => <div className="font-semibold text-[13px]">{r.plan_code ?? "—"}</div> },
    {
      key: "reseller_id", header: "Reseller",
      render: (r) => <span className="font-mono text-[11px]">{String(r.reseller_id ?? "—").slice(0, 8)}</span>,
    },
    { key: "activated_at", header: "Activated" },
    { key: "renewal_at", header: "Renews" },
    { key: "expires_at", header: "Expires" },
    { key: "membership_state", header: "State", render: (r) => <StatusPill value={r.membership_state} /> },
  ],
  filters: [{ key: "membership_state", label: "State", options: STATES }],
  kpis: [
    { label: "Memberships", icon: Repeat, compute: (r) => (r.length ? r.length : "—") },
    { label: "Active", icon: CheckCircle2, compute: (r) => (r.length ? r.filter((x) => x.membership_state === "active").length : "—") },
    { label: "Plans In Use", hint: "Distinct plan codes", icon: Layers, compute: (r) => (r.length ? new Set(r.map((x) => x.plan_code)).size : "—") },
    { label: "Paused", icon: Pause, compute: (r) => (r.length ? r.filter((x) => x.membership_state === "paused").length : "—") },
  ],
  bulkActions: [
    { key: "activate", label: "Activate", icon: Play, patch: { membership_state: "active" } },
    { key: "pause", label: "Pause", icon: Pause, patch: { membership_state: "paused" } },
    { key: "cancel", label: "Cancel", icon: XCircle, patch: { membership_state: "cancelled" }, variant: "destructive", confirmTitle: "Cancel these memberships?" },
  ],
  rowActions: [
    { key: "activate", label: "Activate", icon: Play, patch: { membership_state: "active" } },
    { key: "pause", label: "Pause", icon: Pause, patch: { membership_state: "paused" } },
    { key: "cancel", label: "Cancel", icon: XCircle, patch: { membership_state: "cancelled" }, destructive: true },
  ],
  formFields: [
    { key: "membership_state", label: "State", type: "select", options: STATES },
    { key: "renewal_at", label: "Renews on", type: "text", placeholder: "YYYY-MM-DD" },
    { key: "expires_at", label: "Expires on", type: "text", placeholder: "YYYY-MM-DD" },
  ],
  searchFields: ["plan_code", "membership_state"],
  primaryField: "plan_code", subField: "membership_state",
  statusField: "membership_state",
};
