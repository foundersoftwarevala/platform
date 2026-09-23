import { KeyRound, CheckCircle2, XCircle, Clock, ShieldCheck, Activity } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "revoked", "expired", "suspended"] as const;

/**
 * Licences, read and written on the licenses table.
 *
 * The wall used to show four invented keys - SV-PRO-8F3K-9421 and friends -
 * that existed in one browser tab. A licence is issued by the purchase that
 * pays for it, so none is created here; what this screen carries is the
 * decision to revoke or reinstate one, and the reason for it.
 */
export const config: WallConfig = {
  resource: "licences",
  creatable: false,
  scope: "licenses", entity: "licence", route: "/licenses",
  eyebrow: "Catalog", title: "Licences Wall",
  subtitle: "Every licence the platform has issued — who holds it, and whether it still works.",
  icon: KeyRound, primaryLabel: "New Licence",
  seed: [],
  columns: [
    { key: "license_key", header: "Licence key", render: (r) => <span className="font-mono text-[12px] font-semibold">{r.license_key ?? "—"}</span> },
    {
      key: "product_id", header: "Product",
      render: (r) => <span className="font-mono text-[11px]">{String(r.product_id ?? "—").slice(0, 8)}</span>,
    },
    {
      key: "user_id", header: "Holder",
      render: (r) => <span className="font-mono text-[11px]">{String(r.user_id ?? "—").slice(0, 8)}</span>,
    },
    { key: "activation_count", header: "Activations", align: "right", render: (r) => <span>{r.activation_count ?? 0}</span> },
    { key: "issued_at", header: "Issued" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [{ key: "status", label: "Status", options: STATUSES }],
  kpis: [
    { label: "Licences", icon: KeyRound, compute: (r) => (r.length ? r.length : "—") },
    { label: "Active", icon: CheckCircle2, compute: (r) => (r.length ? r.filter((x) => x.status === "active").length : "—") },
    { label: "Revoked", icon: XCircle, compute: (r) => (r.length ? r.filter((x) => x.status === "revoked").length : "—") },
    {
      label: "Activations", hint: "Across every licence", icon: Activity,
      compute: (r) => (r.length ? r.reduce((s, x) => s + Number(x.activation_count ?? 0), 0) : "—"),
    },
  ],
  bulkActions: [
    { key: "activate", label: "Reinstate", icon: CheckCircle2, patch: { status: "active" } },
    {
      key: "revoke", label: "Revoke", icon: XCircle, patch: { status: "revoked" }, variant: "destructive",
      confirmTitle: "Revoke these licences?",
      confirmDescription: "The software stops working for whoever holds them, straight away.",
    },
  ],
  rowActions: [
    { key: "activate", label: "Reinstate", icon: CheckCircle2, patch: { status: "active" } },
    { key: "suspend", label: "Suspend", icon: Clock, patch: { status: "suspended" } },
    { key: "revoke", label: "Revoke", icon: ShieldCheck, patch: { status: "revoked" }, destructive: true },
  ],
  formFields: [
    { key: "status", label: "Status", type: "select", options: STATUSES },
    { key: "revoked_reason", label: "Reason", type: "textarea", placeholder: "Why this licence was revoked" },
  ],
  searchFields: ["license_key", "status"],
  primaryField: "license_key", subField: "status",
  statusField: "status",
};
