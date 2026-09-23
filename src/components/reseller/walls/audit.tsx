import { ScrollText, Shield, AlertTriangle, User, Eye } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";


const SEVERITIES = ["info", "warning", "critical"] as const;
const ENTITIES = ["reseller", "order", "customer", "product", "license", "kyc", "commission", "approval"] as const;

export const config: WallConfig = {
  // The real audit log. Read only apart from the severity flag, because a
  // record of what happened must not be rewritable from a screen.
  resource: "audit_logs",
  scope: "audit", entity: "event", route: "/audit",
  eyebrow: "Governance", title: "Audit Wall",
  subtitle: "Immutable record of every privileged action — actor, target and outcome.",
  icon: ScrollText, primaryLabel: "Manual Entry",
  creatable: false,
  seed: [],
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
  bulkActions: [],
  rowActions: [
    { key: "flag", label: "Flag as Critical", icon: AlertTriangle, patch: { severity: "critical" } },
    { key: "review", label: "Mark Reviewed", icon: Eye, patch: { severity: "info" } },
  ],
  formFields: [
    { key: "severity", label: "Severity", type: "select", options: SEVERITIES },
  ],
  searchFields: ["actor", "action", "target", "ip", "entity"],
  primaryField: "action", subField: "target",
};
