import { CheckCircle2, Clock, XCircle, Users, Building2, ShieldCheck, Trash2 } from "lucide-react";
import { StatusPill, type WallConfig, type WallRow } from "@/components/manager-suite/wall";
import { setResellerStatus } from "@/lib/marketplace-manager/resellers.functions";

const STATUSES = ["pending", "active", "paused", "suspended", "rejected", "terminated"] as const;

/**
 * A reseller's status changes only through mm_reseller_status, which grants or
 * withdraws the reseller role, switches referral links on or off, refuses a
 * decision on one's own account, requires a reason to suspend or reject and
 * tells the reseller. The endpoint behind this wall no longer accepts a
 * status patch.
 */
const decide = (to: "active" | "suspended" | "rejected") => async (row: WallRow, reason?: string) =>
  setResellerStatus({ data: { id: row.id, status: to, ...(reason ? { reason } : {}) } });
const not = (...statuses: string[]) => (row: WallRow) => !statuses.includes(String(row.status));
const KYC = ["unverified", "submitted", "verified", "rejected"] as const;
const TIERS = ["bronze", "silver", "gold", "platinum"] as const;

/**
 * The reseller directory, read and written on the resellers table.
 *
 * This wall said in a comment that it read a reseller_applications table. No
 * such table exists, and the wall named no resource, so it rendered whatever
 * the operator typed into their own browser and lost it on reload. An
 * applicant is a row in resellers whose status is still pending, and
 * approving one here is a real change to that row.
 */
export const config: WallConfig = {
  resource: "resellers",
  scope: "reseller_applications",
  entity: "reseller",
  route: "/reseller-applications",
  eyebrow: "Reseller Manager",
  title: "Reseller Directory",
  subtitle: "Every partner in the channel — applicants awaiting approval, and the resellers already trading.",
  icon: Users,
  primaryLabel: "New Reseller",
  // A reseller arrives by applying (submit_reseller_application), not by an
  // operator typing one in.
  creatable: false,
  seed: [],
  columns: [
    { key: "name", header: "Reseller", render: (r) => <div className="font-semibold text-[13px]">{r.name || "—"}</div> },
    { key: "company_name", header: "Company", render: (r) => <span className="text-[13px]">{r.company_name || "—"}</span> },
    { key: "email", header: "Email", render: (r) => <span className="text-[12px]">{r.email || "—"}</span> },
    { key: "region", header: "Region", render: (r) => <span>{r.region || "—"}</span> },
    { key: "tier", header: "Tier", render: (r) => <StatusPill value={r.tier} /> },
    { key: "kyc_status", header: "KYC", render: (r) => <StatusPill value={r.kyc_status} /> },
    { key: "created_at", header: "Applied" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
    { key: "kyc_status", label: "KYC", options: KYC },
    { key: "tier", label: "Tier", options: TIERS },
  ],
  kpis: [
    { label: "Awaiting Approval", icon: Clock, compute: (r) => (r.length ? r.filter((x) => x.status === "pending").length : "—") },
    { label: "Trading", hint: "Approved and active", icon: CheckCircle2, compute: (r) => (r.length ? r.filter((x) => x.status === "active").length : "—") },
    { label: "KYC Verified", icon: ShieldCheck, compute: (r) => (r.length ? r.filter((x) => x.kyc_status === "verified").length : "—") },
    { label: "Companies", hint: "Distinct company names", icon: Building2, compute: (r) => (r.length ? new Set(r.map((x) => x.company_name).filter(Boolean)).size : "—") },
  ],
  bulkActions: [
    { key: "approve", label: "Approve", icon: CheckCircle2, when: not("active", "terminated"), run: decide("active") },
    {
      key: "suspend", label: "Suspend", icon: Clock, when: not("suspended", "terminated"), run: decide("suspended"),
      ask: "Why are these resellers being suspended? Their referral links stop attributing and this is recorded.",
    },
    {
      key: "reject", label: "Reject", icon: XCircle, variant: "destructive",
      when: not("rejected", "terminated"), run: decide("rejected"),
      ask: "Why are these applicants being rejected? This is recorded and sent to them.",
      confirmTitle: "Reject these applicants?",
      confirmDescription: "They keep their record, but they cannot trade on the channel.",
    },
    { key: "delete", label: "Retire", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "approve", label: "Approve", icon: CheckCircle2, when: not("active", "terminated"), run: decide("active") },
    { key: "verify_kyc", label: "Mark KYC Verified", icon: ShieldCheck, patch: { kyc_status: "verified" } },
    {
      key: "suspend", label: "Suspend", icon: Clock, when: not("suspended", "terminated"), run: decide("suspended"),
      ask: "Why is this reseller being suspended? Their referral links stop attributing and this is recorded.",
    },
    {
      key: "reject", label: "Reject", icon: XCircle, destructive: true,
      when: not("rejected", "terminated"), run: decide("rejected"),
      ask: "Why is this applicant being rejected? This is recorded and sent to them.",
    },
  ],
  formFields: [
    { key: "name", label: "Reseller name", type: "text", required: true },
    { key: "company_name", label: "Company", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "region", label: "Region", type: "text" },
    { key: "tier", label: "Tier", type: "select", options: TIERS, defaultValue: "bronze" },
    // Status is not a field: it is decided by the actions above.
    { key: "kyc_status", label: "KYC", type: "select", options: KYC, defaultValue: "unverified" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  searchFields: ["name", "code", "email", "status"],
  primaryField: "name",
  subField: "company_name",
  statusField: "status",
};
