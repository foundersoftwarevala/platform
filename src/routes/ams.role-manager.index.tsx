import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";
import { ROLES } from "@/lib/ams/roles";
import { useAmsCatalogue } from "@/hooks/useAmsCatalogue";
import { useTranslation } from "@/lib/i18n/use-translation";

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
  // The XP ladder is held in the database - a hundred and eighty rows, ten
  // stages for each role, with the title earned at each step and the XP it
  // takes. Nothing read them, so "Journey Stages" was the number 8 written
  // into the file. It is counted now, and each role says how many steps its
  // own ladder has and where that ladder ends.
  const { t } = useTranslation();
  const catalogue = useAmsCatalogue();
  const stages = catalogue.data?.roleStages ?? [];
  const stagesFor = (slug: string) => stages.filter((s) => s.role === slug);
  const longest = stages.reduce((most, s) => Math.max(most, s.stage), 0);
  const topXp = stages.reduce((most, s) => Math.max(most, s.minXp), 0);

  const rows = ROLES.map((r) => ({
    id: r.slug,
    name: (
      <Link to="/ams/role-manager/$slug" params={{ slug: r.slug }} className="group flex items-center gap-2">
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
    stages: (() => {
      const mine = stagesFor(r.slug);
      if (catalogue.isLoading) return <span className="text-muted-foreground">…</span>;
      if (mine.length === 0) {
        return <span className="text-muted-foreground">{t("manager.ams.no_ladder")}</span>;
      }
      const last = mine.reduce((highest, s) => (s.stage > highest.stage ? s : highest), mine[0]);
      return (
        <span className="text-xs">
          <span className="font-mono">{mine.length}</span>
          <span className="text-muted-foreground"> {t("manager.ams.ends_at", { title: last.title })}</span>
        </span>
      );
    })(),
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
        { label: "Journey Stages", value: catalogue.isLoading ? "…" : longest },
        { label: "Badge Types", value: 7 },
        { label: "Certificate Levels", value: 7 },
        { label: "Reputation Pillars", value: 7 },
        { label: "Top ladder XP", value: catalogue.isLoading ? "…" : topXp.toLocaleString() },
      ]}
      filters={[{ label: "Behavior", values: ["Engineer", "Merchant", "Leader", "Creator", "Support", "Learner"] }]}
      columns={[
        { key: "name", label: "Role" },
        { key: "behavior", label: "Behavior" },
        { key: "motto", label: "Motto" },
        { key: "passport", label: "Passport" },
        { key: "stages", label: "XP ladder" },
        { key: "status", label: "Status" },
      ]}
      rows={rows}
    />
  );
}
