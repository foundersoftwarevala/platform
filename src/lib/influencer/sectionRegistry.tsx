import { CheckCircle2, Megaphone, Pause, Target, Trash2, Users } from "lucide-react";

import { ModuleDashboard } from "@/components/creator/ModuleDashboard";
import { influencerConfig } from "@/components/creator/moduleConfigs";
import { InfluencerReferenceDashboard } from "@/components/influencer/InfluencerReferenceDashboard";
import type { SectionEntry } from "@/components/manager-suite/ManagerWorkspace";
import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";
import { influencerGroups } from "@/components/influencer/navigation";

const statuses = ["active", "pending", "paused", "completed", "draft"] as const;

const influencerWall: WallConfig = {
  scope: "influencer-influencers", entity: "influencer", eyebrow: "Influencer Manager",
  title: "Master Influencer Directory", subtitle: "Search, segment and operate on the connected influencer network.", icon: Users,
  primaryLabel: "Add Influencer",
  filters: [{ key: "status", label: "Status", options: statuses }, { key: "country", label: "Country", options: ["India", "United States", "United Kingdom", "United Arab Emirates", "Canada", "Australia"] }],
  kpis: [
    { label: "Influencers", icon: Users, compute: (rows) => rows.length },
    { label: "Active", icon: CheckCircle2, compute: (rows) => rows.filter((row) => row.status === "active").length },
    { label: "Pending", icon: Target, compute: (rows) => rows.filter((row) => row.status === "pending").length },
    { label: "Regions", icon: Target, compute: (rows) => new Set(rows.map((row) => row.region).filter(Boolean)).size },
  ],
  bulkActions: [
    { key: "activate", label: "Activate", icon: CheckCircle2, patch: { status: "active" } },
    { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" } },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [{ key: "activate", label: "Activate", icon: CheckCircle2, patch: { status: "active" } }, { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" }, destructive: true }],
  formFields: [
    { key: "full_name", label: "Full name", type: "text", required: true },
    { key: "email", label: "Email", type: "email", required: true },
    { key: "country", label: "Country", type: "text" },
    { key: "region", label: "Region", type: "text" },
    { key: "niche", label: "Niche", type: "text" },
    { key: "status", label: "Status", type: "select", options: statuses, defaultValue: "active" },
  ],
  searchFields: ["full_name", "email", "country", "region", "niche"], primaryField: "full_name", subField: "email", statusField: "status",
  columns: [
    { key: "full_name", header: "Profile", render: (row) => <div><div className="font-semibold">{row.full_name}</div><div className="text-[11px] text-muted-foreground">{row.email}</div></div> },
    { key: "country", header: "Country" }, { key: "region", header: "Region" }, { key: "niche", header: "Niche" },
    { key: "status", header: "Status", render: (row) => <StatusPill value={row.status} /> },
  ],
};

const campaignWall: WallConfig = {
  scope: "influencer-campaigns", entity: "campaign", eyebrow: "Campaigns", title: "Campaign Management",
  subtitle: "Plan and govern real campaigns with budgets, dates and performance fields.", icon: Megaphone, primaryLabel: "Create Campaign",
  filters: [{ key: "status", label: "Status", options: statuses }],
  kpis: [
    { label: "Campaigns", icon: Megaphone, compute: (rows) => rows.length },
    { label: "Active", icon: CheckCircle2, compute: (rows) => rows.filter((row) => row.status === "active").length },
    { label: "Budget", icon: Target, compute: (rows) => `$${rows.reduce((sum, row) => sum + Number(row.budget ?? 0), 0).toLocaleString()}` },
    { label: "Revenue", icon: Target, compute: (rows) => `$${rows.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0).toLocaleString()}` },
  ],
  bulkActions: [{ key: "activate", label: "Activate", icon: CheckCircle2, patch: { status: "active" } }, { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" } }],
  rowActions: [{ key: "activate", label: "Activate", icon: CheckCircle2, patch: { status: "active" } }, { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" }, destructive: true }],
  formFields: [
    { key: "code", label: "Campaign code", type: "text", required: true }, { key: "name", label: "Campaign name", type: "text", required: true },
    { key: "channel", label: "Channel", type: "text", required: true }, { key: "start_date", label: "Start date", type: "text", required: true },
    { key: "end_date", label: "End date", type: "text", required: true }, { key: "status", label: "Status", type: "select", options: statuses, defaultValue: "draft" },
    { key: "budget", label: "Budget", type: "number", defaultValue: 0 }, { key: "owner", label: "Owner", type: "text" },
  ],
  searchFields: ["code", "name", "channel", "owner"], primaryField: "name", subField: "code",
  columns: [
    { key: "name", header: "Campaign", render: (row) => <div><div className="font-semibold">{row.name}</div><div className="text-[11px] text-muted-foreground">{row.code}</div></div> },
    { key: "channel", header: "Channel" }, { key: "owner", header: "Owner" }, { key: "budget", header: "Budget", align: "right" },
    { key: "spend", header: "Spend", align: "right" }, { key: "revenue", header: "Revenue", align: "right" }, { key: "status", header: "Status", render: (row) => <StatusPill value={row.status} /> },
  ],
};

const leadWall: WallConfig = {
  scope: "influencer-leads", entity: "lead", eyebrow: "Growth", title: "Creator-Generated Leads",
  subtitle: "Track real leads attributed to creator campaigns.", icon: Target, primaryLabel: "New Lead",
  filters: [{ key: "status", label: "Status", options: ["open", "won", "lost"] }, { key: "stage", label: "Stage", options: ["new", "qualified", "contacted"] }],
  kpis: [
    { label: "Leads", icon: Target, compute: (rows) => rows.length }, { label: "Open", icon: Target, compute: (rows) => rows.filter((row) => row.status === "open").length },
    { label: "Qualified", icon: CheckCircle2, compute: (rows) => rows.filter((row) => row.stage === "qualified").length }, { label: "Won", icon: CheckCircle2, compute: (rows) => rows.filter((row) => row.status === "won").length },
  ],
  bulkActions: [],
  formFields: [
    { key: "full_name", label: "Full name", type: "text", required: true }, { key: "email", label: "Email", type: "email" }, { key: "company", label: "Company", type: "text" },
    { key: "stage", label: "Stage", type: "select", options: ["new", "qualified", "contacted"], defaultValue: "new" }, { key: "status", label: "Status", type: "select", options: ["open", "won", "lost"], defaultValue: "open" }, { key: "assigned_to", label: "Assigned to", type: "text" },
  ],
  searchFields: ["full_name", "email", "company", "assigned_to"], primaryField: "full_name",
  columns: [
    { key: "full_name", header: "Lead", render: (row) => <div><div className="font-semibold">{row.full_name}</div><div className="text-[11px] text-muted-foreground">{row.email}</div></div> },
    { key: "company", header: "Company" }, { key: "stage", header: "Stage" }, { key: "score", header: "Score", align: "right" }, { key: "assigned_to", header: "Assigned to" }, { key: "status", header: "Status", render: (row) => <StatusPill value={row.status} /> },
  ],
};

const applicationWall: WallConfig = {
  scope: "influencer-approvals", entity: "application", eyebrow: "Creator Lifecycle", title: "Influencer Applications",
  subtitle: "Review real applications, verify fit and approve onboarding into the creator network.", icon: Target, primaryLabel: "New Application",
  filters: [{ key: "status", label: "Status", options: ["pending", "in_review", "approved", "rejected"] }],
  kpis: [
    { label: "Applications", icon: Target, compute: (rows) => rows.length },
    { label: "Pending", icon: Target, compute: (rows) => rows.filter((row) => row.status === "pending").length },
    { label: "Approved", icon: CheckCircle2, compute: (rows) => rows.filter((row) => row.status === "approved").length },
    { label: "Rejected", icon: Trash2, compute: (rows) => rows.filter((row) => row.status === "rejected").length },
  ],
  bulkActions: [{ key: "approve", label: "Approve", icon: CheckCircle2, patch: { status: "approved" } }],
  rowActions: [{ key: "approve", label: "Approve", icon: CheckCircle2, patch: { status: "approved" } }],
  formFields: [
    { key: "full_name", label: "Full name", type: "text", required: true }, { key: "email", label: "Email", type: "email", required: true },
    { key: "phone", label: "Phone", type: "text" }, { key: "country", label: "Country", type: "text" }, { key: "region", label: "Region", type: "text" },
    { key: "niche", label: "Content niche", type: "text", required: true }, { key: "followers", label: "Followers", type: "number", defaultValue: 0 },
    { key: "engagement_rate", label: "Engagement rate", type: "number", defaultValue: 0 },
  ],
  searchFields: ["full_name", "email", "country", "region", "niche"], primaryField: "full_name", subField: "email",
  columns: [
    { key: "full_name", header: "Applicant", render: (row) => <div><div className="font-semibold">{row.full_name}</div><div className="text-[11px] text-muted-foreground">{row.email}</div></div> },
    { key: "country", header: "Country" }, { key: "niche", header: "Niche" }, { key: "followers", header: "Followers", align: "right" },
    { key: "engagement_rate", header: "Engagement", align: "right" }, { key: "status", header: "Status", render: (row) => <StatusPill value={row.status} /> }, { key: "created_at", header: "Submitted" },
  ],
};

function existingMarketingWall(scope: string, title: string, icon: typeof Target, table: string, searchFields: string[], columns: WallConfig["columns"]): WallConfig {
  return {
    scope, entity: title.toLowerCase(), eyebrow: "Influencer Manager", title,
    subtitle: `Live ${title.toLowerCase()} records from the connected marketing workspace.`, icon,
    primaryLabel: `New ${title.replace(/s$/, "")}`, canCreate: false, seed: [],
    columns, filters: [], kpis: [{ label: "Records", icon, compute: (rows) => rows.length }],
    bulkActions: [], formFields: [], searchFields, primaryField: searchFields[0] ?? "id",
  };
}

const simpleColumns = (key: string, label: string, dateKey?: string): WallConfig["columns"] => [
  { key, header: label },
  { key: "status", header: "Status", render: (row) => <StatusPill value={row.status} /> },
  ...(dateKey ? [{ key: dateKey, header: "Updated" }] : []),
];

const workflowWall = (scope: string, title: string, table: string, key: string, label: string, dateKey?: string): WallConfig => ({
  scope, entity: title.toLowerCase(), eyebrow: "Influencer Operations", title,
  subtitle: `Live ${title.toLowerCase()} records from the influencer workflow.`, icon: Target,
  primaryLabel: `New ${title.replace(/s$/, "")}`, canCreate: false, seed: [], columns: simpleColumns(key, label, dateKey), filters: [],
  kpis: [{ label: "Records", icon: Target, compute: (rows) => rows.length }], bulkActions: [], formFields: [], searchFields: [key], primaryField: key,
});

function Dashboard({ onNavigate }: { onNavigate?: (id: string) => void }) {
  return <InfluencerReferenceDashboard config={influencerConfig} onNavigate={onNavigate} />;
}

export const influencerRegistry: Record<string, SectionEntry> = {
  Dashboard, "Manager Console": Dashboard, Influencers: influencerWall, "Creator Profiles": influencerWall, "Social Accounts": influencerWall, Performance: influencerWall,
  Campaigns: campaignWall, Collaborations: campaignWall, Leads: leadWall,
  Applications: applicationWall,
  Verification: workflowWall("influencer-verification", "Verification", "influencer_social_accounts", "handle", "Handle", "verified_at"),
  Compliance: existingMarketingWall("influencer-compliance", "Compliance", CheckCircle2, "marketing_compliance_records", ["item", "regulation", "owner"], simpleColumns("item", "Item", "last_checked")),
  "Content Library": existingMarketingWall("influencer-content-library", "Content Library", Megaphone, "marketing_content_items", ["title", "author", "channel"], simpleColumns("title", "Title", "created_at")),
  "Media Assets": existingMarketingWall("influencer-media-assets", "Media Assets", Megaphone, "marketing_creatives", ["name", "asset_type", "uploaded_by"], simpleColumns("name", "Asset", "created_at")),
  "Content Approval": existingMarketingWall("influencer-content-approval", "Content Approval", CheckCircle2, "marketing_approvals", ["item_name", "requested_by", "item_type"], simpleColumns("item_name", "Content", "requested_at")),
  Analytics: existingMarketingWall("influencer-analytics", "Analytics", Target, "marketing_channel_performance", ["channel"], simpleColumns("channel", "Channel", "period_start")),
  Reports: existingMarketingWall("influencer-reports", "Reports", Target, "marketing_reports", ["name", "report_type", "generated_by"], simpleColumns("name", "Report", "generated_at")),
  Notifications: workflowWall("influencer-notifications", "Notifications", "influencer_notifications", "title", "Alert", "created_at"),
  Communication: existingMarketingWall("influencer-communication", "Communication", Target, "marketing_messages", ["name", "channel"], simpleColumns("name", "Message", "scheduled_at")),
  Calendar: existingMarketingWall("influencer-calendar", "Calendar", Target, "marketing_schedules", ["title", "channel", "owner"], simpleColumns("title", "Schedule", "scheduled_at")),
  "AI Studio": existingMarketingWall("influencer-ai-studio", "AI Studio", Target, "marketing_ai_recommendations", ["title", "category", "recommendation"], simpleColumns("title", "Recommendation", "created_at")),
  Activity: workflowWall("influencer-activity", "Activity", "influencer_activity", "external_event_id", "Event", "occurred_at"),
  Commissions: workflowWall("influencer-earnings", "Commissions", "influencer_earnings", "campaign_id", "Campaign", "created_at"),
  Wallet: workflowWall("influencer-earnings-wallet", "Wallet", "influencer_earnings", "profile_id", "Profile", "created_at"),
  Payouts: workflowWall("influencer-payouts", "Payouts", "influencer_payouts", "idempotency_key", "Payout", "created_at"),
  Withdrawals: workflowWall("influencer-payouts-withdrawals", "Withdrawals", "influencer_payouts", "idempotency_key", "Request", "created_at"),
  Invoices: workflowWall("influencer-invoices", "Invoices", "influencer_invoices", "invoice_number", "Invoice", "created_at"),
  Agreements: workflowWall("influencer-agreements", "Agreements", "influencer_agreements", "version", "Version", "created_at"),
  Documents: workflowWall("influencer-documents", "Documents", "influencer_agreements", "version", "Agreement", "created_at"),
};

for (const group of influencerGroups) {
  for (const item of group.items) {
    if (!influencerRegistry[item.label]) influencerRegistry[item.label] = {
      scope: `influencer-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, entity: item.label.toLowerCase(), eyebrow: group.label, title: item.label,
      subtitle: `${item.label} has no connected resource in the current database schema.`, icon: item.icon, primaryLabel: `New ${item.label}`, canCreate: false, seed: [], columns: [{ key: "name", header: "Name" }], filters: [], kpis: [], bulkActions: [], formFields: [], searchFields: ["name"], primaryField: "name",
    };
  }
}