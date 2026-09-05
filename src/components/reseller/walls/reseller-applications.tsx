import { CheckCircle2, Clock, XCircle, ArrowUpRight, Trash2, FileText, User, Mail, Building2, MapPin } from "lucide-react";
import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["pending", "approved", "rejected"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

/**
 * Real Applications wall that reads from reseller_applications table in Supabase.
 * Replaces the previous mock approvals wall for actual reseller applications.
 */
export const config: WallConfig = {
  scope: "reseller_applications",
  entity: "application",
  route: "/reseller-applications",
  eyebrow: "Reseller Manager",
  title: "Reseller Applications",
  subtitle: "Review reseller applicants, approve new partners and manage onboarding.",
  icon: FileText,
  primaryLabel: "New Application",
  
  // This will be populated by useResellerEntityList in wall.tsx
  seed: [],
  
  columns: [
    {
      key: "requester_name",
      header: "Applicant Name",
      render: (r) => (
        <div className="font-semibold text-[13px]">{r.requester_name || "—"}</div>
      ),
    },
    {
      key: "company_name",
      header: "Company",
      render: (r) => (
        <div className="text-[13px] text-white/70">{r.company_name || "—"}</div>
      ),
    },
    {
      key: "requester_email",
      header: "Email",
      render: (r) => (
        <div className="text-[12px] font-mono text-white/60">{r.requester_email || "—"}</div>
      ),
    },
    {
      key: "region",
      header: "Territory",
      render: (r) => (
        <div className="text-[13px] text-white/70">{r.region || "—"}</div>
      ),
    },
    {
      key: "created_at",
      header: "Applied",
      render: (r) => {
        if (!r.created_at) return "—";
        const date = new Date(r.created_at);
        return date.toLocaleDateString();
      },
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill value={r.status} />,
    },
  ],
  
  filters: [
    { key: "status", label: "Status", options: STATUSES },
    { key: "application_type", label: "Type", options: ["new", "renewal"] },
  ],
  
  kpis: [
    {
      label: "Pending",
      icon: Clock,
      compute: (r) => r.filter((x) => x.status === "pending").length,
    },
    {
      label: "Approved",
      icon: CheckCircle2,
      compute: (r) => r.filter((x) => x.status === "approved").length,
    },
    {
      label: "Rejected",
      icon: XCircle,
      compute: (r) => r.filter((x) => x.status === "rejected").length,
    },
    {
      label: "Total",
      icon: FileText,
      compute: (r) => r.length,
    },
  ],
  
  bulkActions: [
    {
      key: "approve",
      label: "Approve",
      icon: CheckCircle2,
      patch: { status: "approved" },
    },
    {
      key: "reject",
      label: "Reject",
      icon: XCircle,
      patch: { status: "rejected" },
      variant: "destructive",
      confirmTitle: "Reject applications?",
    },
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
    },
  ],
  
  rowActions: [
    {
      key: "approve",
      label: "Approve",
      icon: CheckCircle2,
      patch: { status: "approved" },
    },
    {
      key: "reject",
      label: "Reject",
      icon: XCircle,
      patch: { status: "rejected" },
      destructive: true,
    },
    {
      key: "escalate",
      label: "Escalate",
      icon: ArrowUpRight,
      patch: { priority: "critical" },
    },
  ],
  
  formFields: [
    {
      key: "requester_name",
      label: "Applicant Name",
      type: "text",
      required: true,
    },
    {
      key: "requester_email",
      label: "Email",
      type: "email",
      required: true,
    },
    {
      key: "company_name",
      label: "Company Name",
      type: "text",
      required: true,
    },
    {
      key: "region",
      label: "Territory / Region",
      type: "text",
      required: false,
    },
    {
      key: "motivation",
      label: "Motivation / Notes",
      type: "textarea",
      required: false,
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: STATUSES,
      defaultValue: "pending",
    },
    {
      key: "review_notes",
      label: "Review Notes",
      type: "textarea",
      required: false,
    },
  ],
  
  searchFields: ["requester_name", "requester_email", "company_name", "region"],
  primaryField: "requester_name",
  subField: "company_name",
};
