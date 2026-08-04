import { ShieldCheck, ShieldAlert, BadgeCheck, FileSearch, CheckCircle2, XCircle, Eye, Trash2 } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";


const STATUSES = ["pending", "verified", "rejected"] as const;
const DOCS = ["pan", "gst", "aadhaar", "passport"] as const;

export const config: WallConfig = {
  scope: "kyc", entity: "kyc", route: "/kyc",
  eyebrow: "Compliance", title: "KYC Wall",
  subtitle: "Verify identities and maintain compliance posture across every reseller.",
  icon: ShieldCheck, primaryLabel: "New Submission",
  seed: [
    { id: "K-1", reseller: "Acme Digital", legal_name: "Acme Digital Pvt Ltd", doc_type: "gst", doc_number: "27AABCA1234C1Z5", status: "pending", submitted_at: "2026-07-05", created_at: "2026-07-05" },
    { id: "K-2", reseller: "PixelForge", legal_name: "PixelForge Studio LLP", doc_type: "pan", doc_number: "AABCP4321X", status: "verified", submitted_at: "2026-06-18", created_at: "2026-06-18" },
    { id: "K-3", reseller: "Nova Retail", legal_name: "Nova Retail Co.", doc_type: "gst", doc_number: "29XYZAB5678L1Z1", status: "rejected", submitted_at: "2026-06-01", created_at: "2026-06-01" },
  ],
  columns: [
    { key: "reseller", header: "Reseller", render: (r) => <div className="font-semibold">{r.reseller}</div> },
    { key: "legal_name", header: "Legal Name" },
    { key: "doc_type", header: "Doc", render: (r) => <StatusPill value={r.doc_type} /> },
    { key: "doc_number", header: "Doc Number", render: (r) => <span className="font-mono text-[12px]">{r.doc_number}</span> },
    { key: "submitted_at", header: "Submitted" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
    { key: "doc_type", label: "Doc Type", options: DOCS },
  ],
  kpis: [
    { label: "Pending Review", icon: FileSearch, compute: (r) => r.filter((x) => x.status === "pending").length },
    { label: "Verified", icon: BadgeCheck, compute: (r) => r.filter((x) => x.status === "verified").length },
    { label: "Rejected", icon: ShieldAlert, compute: (r) => r.filter((x) => x.status === "rejected").length },
    { label: "Total", icon: ShieldCheck, compute: (r) => r.length },
  ],
  bulkActions: [
    { key: "verify", label: "Verify", icon: CheckCircle2, patch: { status: "verified" } },
    { key: "reject", label: "Reject", icon: XCircle, patch: { status: "rejected" }, variant: "destructive", confirmTitle: "Reject submissions?" },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "verify", label: "Verify", icon: CheckCircle2, patch: { status: "verified" } },
    { key: "reject", label: "Reject", icon: XCircle, patch: { status: "rejected" }, destructive: true },
    { key: "review", label: "Mark for Review", icon: Eye, patch: { status: "pending" } },
  ],
  formFields: [
    { key: "reseller", label: "Reseller", type: "text", required: true },
    { key: "legal_name", label: "Legal Name", type: "text", required: true },
    { key: "doc_type", label: "Document Type", type: "select", options: DOCS, required: true, defaultValue: "gst" },
    { key: "doc_number", label: "Document Number", type: "text", required: true },
    { key: "submitted_at", label: "Submitted On", type: "text", placeholder: "YYYY-MM-DD" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "pending" },
  ],
  searchFields: ["reseller", "legal_name", "doc_number"],
  primaryField: "reseller", subField: "legal_name",
};
