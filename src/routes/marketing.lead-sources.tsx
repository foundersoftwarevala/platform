import { createFileRoute } from "@tanstack/react-router";
import { Filter, IndianRupee, Target, Users } from "lucide-react";

import { DataScreen } from "@/components/marketing/data-screen";
import { ScreenHeader, StatusBadge } from "@/components/marketing/kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { compactInr, inr, num, pct, shortDate, titleCase } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/lead-sources")({
  head: () => ({
    meta: [
      { title: "Lead Sources — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Track every lead source and captured lead with qualification rates, cost per lead and pipeline stage.",
      },
      { property: "og:title", content: "Lead Sources — Software Vala" },
      {
        property: "og:description",
        content: "Source-level lead economics plus the live lead pipeline.",
      },
    ],
  }),
  component: LeadSourcesScreen,
});

const SOURCE_TYPES = ["paid", "organic", "referral", "direct", "partner", "event", "offline"] as const;
const SOURCE_STATUS = ["active", "paused", "testing", "archived"] as const;
const LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;
const LEAD_STATUS = ["new", "working", "nurturing", "converted", "disqualified"] as const;
const CHANNELS = [
  "Google Ads",
  "Meta Ads",
  "Instagram",
  "LinkedIn",
  "YouTube",
  "WhatsApp",
  "SEO",
  "Email",
  "Referral",
] as const;

function LeadSourcesScreen() {
  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Lead Sources"
        description="Where every lead comes from, what it costs and how well it converts."
      />
      <Tabs defaultValue="sources" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="sources">
          <DataScreen
            headless
            table="marketing_lead_sources"
            title="Lead sources"
            description="Source economics"
            module="Lead Sources"
            entityLabel="Lead source"
            order={{ column: "leads_count" }}
            searchKeys={["name", "channel", "source_type", "region"]}
            filterKey="status"
            filterOptions={SOURCE_STATUS}
            minWidth={1040}
            stats={[
              { label: "Sources", icon: Filter, tone: "violet", value: (r) => num(r.length) },
              {
                label: "Total leads",
                icon: Users,
                tone: "blue",
                value: (r) => num(r.reduce((s, x) => s + Number(x.leads_count ?? 0), 0)),
              },
              {
                label: "Qualified",
                icon: Target,
                tone: "green",
                value: (r) => num(r.reduce((s, x) => s + Number(x.qualified_count ?? 0), 0)),
              },
              {
                label: "Avg cost / lead",
                icon: IndianRupee,
                tone: "gold",
                value: (r) =>
                  r.length
                    ? inr(r.reduce((s, x) => s + Number(x.cost_per_lead ?? 0), 0) / r.length)
                    : inr(0),
              },
            ]}
            columns={[
              { key: "name", header: "Source", render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "source_type", header: "Type", render: (r) => titleCase(r.source_type) },
              { key: "channel", header: "Channel", render: (r) => r.channel },
              { key: "leads_count", header: "Leads", align: "right", render: (r) => num(r.leads_count) },
              {
                key: "qualified_count",
                header: "Qualified",
                align: "right",
                render: (r) => num(r.qualified_count),
              },
              {
                key: "conversion_rate",
                header: "Conv. rate",
                align: "right",
                render: (r) => pct(r.conversion_rate),
              },
              {
                key: "cost_per_lead",
                header: "CPL",
                align: "right",
                render: (r) => compactInr(r.cost_per_lead),
              },
              { key: "region", header: "Region", render: (r) => r.region ?? "—" },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
            ]}
            fields={[
              { key: "name", label: "Source name", kind: "text", required: true },
              { key: "source_type", label: "Source type", kind: "select", options: SOURCE_TYPES },
              { key: "channel", label: "Channel", kind: "select", options: CHANNELS },
              { key: "status", label: "Status", kind: "select", options: SOURCE_STATUS },
              { key: "leads_count", label: "Leads", kind: "number" },
              { key: "qualified_count", label: "Qualified leads", kind: "number" },
              { key: "conversion_rate", label: "Conversion rate %", kind: "number" },
              { key: "cost_per_lead", label: "Cost per lead (₹)", kind: "number" },
              { key: "region", label: "Region", kind: "text" },
            ]}
          />
        </TabsContent>

        <TabsContent value="leads">
          <DataScreen
            headless
            table="marketing_leads"
            title="Leads"
            description="Live lead pipeline"
            module="Leads"
            entityLabel="Lead"
            order={{ column: "created_at" }}
            searchKeys={["full_name", "email", "company", "city", "assigned_to"]}
            filterKey="stage"
            filterOptions={LEAD_STAGES}
            minWidth={1120}
            stats={[
              { label: "Leads", icon: Users, tone: "violet", value: (r) => num(r.length) },
              {
                label: "Qualified+",
                icon: Target,
                tone: "green",
                value: (r) =>
                  num(
                    r.filter((x) =>
                      ["qualified", "proposal", "negotiation", "won"].includes(String(x.stage)),
                    ).length,
                  ),
              },
              {
                label: "Won",
                icon: Filter,
                tone: "teal",
                value: (r) => num(r.filter((x) => x.stage === "won").length),
              },
              {
                label: "Avg score",
                icon: Target,
                tone: "gold",
                value: (r) =>
                  r.length
                    ? (r.reduce((s, x) => s + Number(x.score ?? 0), 0) / r.length).toFixed(0)
                    : "0",
              },
            ]}
            columns={[
              {
                key: "full_name",
                header: "Lead",
                render: (r) => <span className="font-medium">{r.full_name}</span>,
              },
              { key: "company", header: "Company", render: (r) => r.company ?? "—" },
              { key: "email", header: "Email", render: (r) => r.email ?? "—" },
              { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
              { key: "score", header: "Score", align: "right", render: (r) => num(r.score) },
              { key: "stage", header: "Stage", render: (r) => <StatusBadge value={r.stage} /> },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
              {
                key: "geo",
                header: "Location",
                render: (r) => [r.city, r.state].filter(Boolean).join(", ") || "—",
              },
              { key: "assigned_to", header: "Owner", render: (r) => r.assigned_to ?? "—" },
              { key: "created_at", header: "Created", render: (r) => shortDate(r.created_at) },
            ]}
            fields={[
              { key: "full_name", label: "Full name", kind: "text", required: true },
              { key: "company", label: "Company", kind: "text" },
              { key: "email", label: "Email", kind: "text" },
              { key: "phone", label: "Phone", kind: "text" },
              { key: "score", label: "Score (0-100)", kind: "number" },
              { key: "stage", label: "Stage", kind: "select", options: LEAD_STAGES },
              { key: "status", label: "Status", kind: "select", options: LEAD_STATUS },
              { key: "city", label: "City", kind: "text" },
              { key: "state", label: "State", kind: "text" },
              { key: "assigned_to", label: "Assigned to", kind: "text" },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
