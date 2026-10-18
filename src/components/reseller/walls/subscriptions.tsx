import { Repeat, CheckCircle2, Pause, Play, XCircle, Clock, Layers } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

// The table's own vocabulary (reseller_memberships_status_check).
const STATES = ["pending", "active", "renewal_due", "expired", "cancelled", "failed"] as const;

/**
 * Reseller memberships, read on reseller_memberships.
 *
 * The wall used to show three invented subscriptions. These are the real
 * memberships: which plan a reseller is on, when it started, and when it
 * next comes up for renewal.
 *
 * What a membership entitles a reseller to is decided by its status and
 * expiry (reseller_pricing_for), and a membership is opened, replaced and
 * expired by activate_reseller_membership after the payment is verified. The
 * buttons here used to change membership_state, a label nothing reads, so
 * "Activate" granted nothing. No operator function exists yet to pause or
 * cancel a membership, so the actions are shown and say so.
 */
const NO_BACKEND =
  "Memberships change only when a payment is verified (activate_reseller_membership). " +
  "There is no operator function yet to pause, cancel or re-date one, so nothing is changed here.";

export const config: WallConfig = {
  resource: "reseller_memberships",
  creatable: false,
  unavailable: NO_BACKEND,
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
    { key: "status", header: "State", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [{ key: "status", label: "State", options: STATES }],
  kpis: [
    { label: "Memberships", icon: Repeat, compute: (r) => (r.length ? r.length : "—") },
    { label: "Active", icon: CheckCircle2, compute: (r) => (r.length ? r.filter((x) => x.status === "active").length : "—") },
    { label: "Plans In Use", hint: "Distinct plan codes", icon: Layers, compute: (r) => (r.length ? new Set(r.map((x) => x.plan_code)).size : "—") },
    { label: "Renewal Due", icon: Pause, compute: (r) => (r.length ? r.filter((x) => x.status === "renewal_due").length : "—") },
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
    { key: "status", label: "State", type: "select", options: STATES },
    { key: "renewal_at", label: "Renews on", type: "text", placeholder: "YYYY-MM-DD" },
    { key: "expires_at", label: "Expires on", type: "text", placeholder: "YYYY-MM-DD" },
  ],
  searchFields: ["plan_code", "status"],
  primaryField: "plan_code", subField: "status",
  statusField: "status",
};
