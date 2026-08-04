import { ScrollText, Shield, AlertTriangle, User, Trash2, Eye } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";


const SEVERITIES = ["info", "warning", "critical"] as const;
const ENTITIES = ["reseller", "order", "customer", "product", "license", "kyc", "commission", "approval"] as const;

export const config: WallConfig = {
  scope: "audit", entity: "event", route: "/audit",
  eyebrow: "Governance", title: "Audit Wall",
  subtitle: "Immutable record of every privileged action — actor, target and outcome.",
  icon: ScrollText, primaryLabel: "Manual Entry",
  seed: [
    { id: "E-1", actor: "boss@softwarevala.com", action: "reseller.approve", entity: "reseller", target: "Acme Digital", severity: "info", ip: "103.21.44.12", created_at: "2026-07-10T09:12:00" },
    { id: "E-2", actor: "ops@softwarevala.com", action: "kyc.reject", entity: "kyc", target: "Nova Retail", severity: "warning", ip: "103.21.44.14", created_at: "2026-07-10T08:45:00" },
    { id: "E-3", actor: "system", action: "commission.compute", entity: "commission", target: "Q2-cycle", severity: "info", ip: "-", created_at: "2026-07-09T23:00:00" },
    { id: "E-4", actor: "unknown", action: "auth.failed_login", entity: "reseller", target: "acme@x.com", severity: "critical", ip: "45.9.14.220", created_at: "2026-07-09T19:22:00" },
  ],
  columns: [
    { key: "created_at", header: "When", render: (r) => new Date(r.created_at).toLocaleString() },
    { key: "actor", header: "Actor" },
    { key: "action", header: "Action", render: (r) => <span className="font-mono text-[12px]">{r.action}</span> },
    { key: "entity", header: "Entity", render: (r) => <StatusPill value={r.entity} /> },
    { key: "target", header: "Target" },
    { key: "ip", header: "IP", render: (r) => <span className="font-mono text-[11px] text-muted-foreground">{r.ip}</span> },
    { key: "severity", header: "Severity", render: (r) => <StatusPill value={r.severity} /> },
  ],
  filters: [
    { key: "severity", label: "Severity", options: SEVERITIES },
    { key: "entity", label: "Entity", options: ENTITIES },
  ],
  kpis: [
    { label: "Events", icon: ScrollText, compute: (r) => r.length },
    { label: "Actors", icon: User, compute: (r) => new Set(r.map((x) => x.actor)).size },
    { label: "Security", icon: Shield, compute: (r) => r.filter((x) => x.action.startsWith("auth.")).length },
    { label: "Anomalies", icon: AlertTriangle, compute: (r) => r.filter((x) => x.severity === "critical").length },
  ],
  bulkActions: [
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive", confirmTitle: "Delete audit events?", confirmDescription: "Deleting audit events is itself a logged action. Proceed only for cleanup / testing." },
  ],
  rowActions: [
    { key: "flag", label: "Flag as Critical", icon: AlertTriangle, patch: { severity: "critical" } },
    { key: "review", label: "Mark Reviewed", icon: Eye, patch: { severity: "info" } },
  ],
  formFields: [
    { key: "actor", label: "Actor", type: "text", required: true, placeholder: "email@domain / system" },
    { key: "action", label: "Action", type: "text", required: true, placeholder: "entity.action" },
    { key: "entity", label: "Entity", type: "select", options: ENTITIES, defaultValue: "reseller" },
    { key: "target", label: "Target", type: "text" },
    { key: "ip", label: "IP", type: "text" },
    { key: "severity", label: "Severity", type: "select", options: SEVERITIES, defaultValue: "info" },
  ],
  searchFields: ["actor", "action", "target", "ip", "entity"],
  primaryField: "action", subField: "target",
};
