import { ShieldCheck, ShieldAlert, BadgeCheck, FileSearch, CheckCircle2, XCircle, Eye } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const KYC = ["unverified", "submitted", "verified", "rejected"] as const;
const STATUSES = ["pending", "active", "suspended", "rejected"] as const;

/**
 * KYC, read and written on the resellers table.
 *
 * There is no separate submissions table: a reseller's identity documents and
 * their verification state are columns on the reseller itself. This wall used
 * to show three invented submissions with made-up GST and PAN numbers; it now
 * shows the real partners and the documents they actually gave.
 */
export const config: WallConfig = {
  resource: "resellers",
  creatable: false,
  scope: "kyc", entity: "reseller", route: "/kyc",
  eyebrow: "Compliance", title: "KYC Wall",
  subtitle: "Identity and tax documents for every partner, and where each stands.",
  icon: ShieldCheck, primaryLabel: "New Submission",
  seed: [],
  columns: [
    { key: "name", header: "Reseller", render: (r) => <div className="font-semibold">{r.name || "—"}</div> },
    { key: "legal_name", header: "Legal name", render: (r) => <span>{r.legal_name || r.company_name || "—"}</span> },
    { key: "gst_number", header: "GST", render: (r) => <span className="font-mono text-[12px]">{r.gst_number || "—"}</span> },
    { key: "pan_number", header: "PAN", render: (r) => <span className="font-mono text-[12px]">{r.pan_number || "—"}</span> },
    { key: "created_at", header: "Registered" },
    { key: "kyc_status", header: "KYC", render: (r) => <StatusPill value={r.kyc_status} /> },
    { key: "status", header: "Account", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "kyc_status", label: "KYC", options: KYC },
    { key: "status", label: "Account", options: STATUSES },
  ],
  kpis: [
    { label: "Awaiting Review", icon: FileSearch, compute: (r) => (r.length ? r.filter((x) => x.kyc_status === "submitted").length : "—") },
    { label: "Verified", icon: BadgeCheck, compute: (r) => (r.length ? r.filter((x) => x.kyc_status === "verified").length : "—") },
    { label: "Rejected", icon: ShieldAlert, compute: (r) => (r.length ? r.filter((x) => x.kyc_status === "rejected").length : "—") },
    {
      label: "Documents Missing", hint: "Neither GST nor PAN on file", icon: ShieldCheck,
      compute: (r) => (r.length ? r.filter((x) => !x.gst_number && !x.pan_number).length : "—"),
    },
  ],
  bulkActions: [
    { key: "verify", label: "Verify", icon: CheckCircle2, patch: { kyc_status: "verified" } },
    {
      key: "reject", label: "Reject", icon: XCircle, patch: { kyc_status: "rejected" }, variant: "destructive",
      confirmTitle: "Reject these documents?",
      confirmDescription: "The partner is asked to submit again. Their account status is not changed.",
    },
  ],
  rowActions: [
    { key: "verify", label: "Verify", icon: CheckCircle2, patch: { kyc_status: "verified" } },
    { key: "review", label: "Send back for review", icon: Eye, patch: { kyc_status: "submitted" } },
    { key: "reject", label: "Reject", icon: XCircle, patch: { kyc_status: "rejected" }, destructive: true },
  ],
  formFields: [
    { key: "legal_name", label: "Legal name", type: "text" },
    { key: "gst_number", label: "GST number", type: "text" },
    { key: "pan_number", label: "PAN number", type: "text" },
    { key: "kyc_status", label: "KYC", type: "select", options: KYC },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  searchFields: ["name", "code", "email", "status"],
  primaryField: "name", subField: "legal_name",
  statusField: "kyc_status",
};
