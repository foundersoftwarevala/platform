import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";
import { ROLES } from "@/lib/ams/roles";

export const Route = createFileRoute("/ams/role-manager/")({
  head: () => ({
    meta: [
      { title: "Role Manager — AMS" },
      { name: "description", content: "Every role is its own professional world — motto, journey, passport, trophies and language. Open a role to view its full DNA." },
      { property: "og:title", content: "Role Manager — AMS" },
      { property: "og:description", content: "Every role is its own professional world — motto, journey, passport, trophies and language. Open a role to view its full DNA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const rows = ROLES.map((r) => ({
    id: r.slug,
    name: (
      <Link to="/role-manager/$slug" params={{ slug: r.slug }} className="group flex items-center gap-2">
        <span className="text-lg" style={{ color: r.accent }}>{r.glyph}</span>
        <span>
          <div className="font-medium flex items-center gap-1 group-hover:underline">
            {r.name} <ArrowUpRight className="h-3 w-3 opacity-40 group-hover:opacity-100" />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.archetype}</div>
        </span>
      </Link>
    ),
    behavior: r.behavior.slice(0, 2).join(" · "),
    motto: <span className="italic text-muted-foreground">"{r.motto}"</span>,
    passport: <span className="font-mono text-xs">{r.passportPrefix}</span>,
    status: <StatusChip tone="success">Active</StatusChip>,
  }));

  return (
    <EngineDashboard
      kicker="AMS Manager"
      title="Role DNA Engine"
      description="Every role is its own professional world — motto, journey, passport, trophies and language. Open a role to view its full DNA."
      primaryAction="New Role"
      kpis={[
        { label: "Roles", value: ROLES.length },
        { label: "Trophy Tiers", value: 7 },
        { label: "Journey Stages", value: 8 },
        { label: "Badge Types", value: 7 },
        { label: "Certificate Levels", value: 7 },
        { label: "Reputation Pillars", value: 7 },
      ]}
      filters={[{ label: "Behavior", values: ["Engineer", "Merchant", "Leader", "Creator", "Support", "Learner"] }]}
      columns={[
        { key: "name", label: "Role" },
        { key: "behavior", label: "Behavior" },
        { key: "motto", label: "Motto" },
        { key: "passport", label: "Passport" },
        { key: "status", label: "Status" },
      ]}
      rows={rows}
    />
  );
}
