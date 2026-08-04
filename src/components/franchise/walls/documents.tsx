import { FileText, Activity, Coins, Gauge, ShieldCheck, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  scope: "franchise-documents",
  entity: "document",
  eyebrow: "Documents",
  title: "Document Vault",
  subtitle: "Every KYC and compliance file uploaded through License creation and renewal, linked to its exact record.",
  icon: FileText,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "Total Documents", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "KYC", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Compliance", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Pending Review", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
    { label: "Verified", icon: Users, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "document", header: "Document" },
    { key: "category", header: "Category" },
    { key: "kind", header: "Kind" },
    { key: "franchise", header: "Franchise" },
    { key: "linked_to", header: "Linked to" },
    { key: "size", header: "Size" },
    { key: "uploaded", header: "Uploaded" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [{ key: "status", label: "Status", options: STATUSES }],
  bulkActions: [],
  rowActions: [],
  formFields: [
    { key: "document", label: "Document", type: "text", required: true },
    { key: "category", label: "Category", type: "text" },
    { key: "kind", label: "Kind", type: "text" },
    { key: "franchise", label: "Franchise", type: "text" },
    { key: "linked_to", label: "Linked to", type: "text" },
    { key: "size", label: "Size", type: "text" },
    { key: "uploaded", label: "Uploaded", type: "text" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "active" },
  ],
  searchFields: ["document", "category", "kind"],
  primaryField: "document",
  panels: [{ title: "All Documents", items: ["Live source pending", "Owner", "Last sync"] }],
};
