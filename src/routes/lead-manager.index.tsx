import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Clock, Download, Menu, Search, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar, useSidebarState } from "@/components/lead-manager/AppSidebar";

import { NAV_SECTIONS, SECTION_SCREEN, STAGE_SECTIONS, SOURCE_FILTERS } from "@/lib/lead-manager/nav";
import { useAgents, useLeads } from "@/lib/lead-manager/queries";
import type { Agent, Lead } from "@/lib/lead-manager/types";
import { LeadDetailSheet } from "@/components/lead-manager/LeadDetailSheet";
import { CreateLeadDialog } from "@/components/lead-manager/CreateLeadDialog";
import { ActionsScreen } from "@/components/lead-manager/screens/ActionsScreen";
import { AlertsScreen } from "@/components/lead-manager/screens/AlertsScreen";
import { AllLeadsScreen } from "@/components/lead-manager/screens/AllLeadsScreen";
import { AutomationScreen } from "@/components/lead-manager/screens/AutomationScreen";
import { CaptureScreen } from "@/components/lead-manager/screens/CaptureScreen";
import { EscalationsScreen } from "@/components/lead-manager/screens/EscalationsScreen";
import { IntegrationsScreen } from "@/components/lead-manager/screens/IntegrationsScreen";
import { OverviewScreen } from "@/components/lead-manager/screens/OverviewScreen";
import { PipelineScreen } from "@/components/lead-manager/screens/PipelineScreen";
import { QualificationScreen } from "@/components/lead-manager/screens/QualificationScreen";
import { ReportsScreen } from "@/components/lead-manager/screens/ReportsScreen";
import { SecurityScreen } from "@/components/lead-manager/screens/SecurityScreen";
import { SettingsScreen } from "@/components/lead-manager/screens/SettingsScreen";
import { SourcesScreen } from "@/components/lead-manager/screens/SourcesScreen";
import { SpamScreen } from "@/components/lead-manager/screens/SpamScreen";
import { TeamScreen } from "@/components/lead-manager/screens/TeamScreen";
import { Panel, exportLeadsCsv } from "@/components/lead-manager/shared";


export const Route = createFileRoute("/lead-manager/")({
  head: () => ({
    meta: [
      { title: "Lead Manager — Software Vala" },
      {
        name: "description",
        content:
          "Software Vala Lead Manager: capture, route, qualify and convert leads across website, SEO, ads, social and marketplace sources.",
      },
      { property: "og:title", content: "Lead Manager — Software Vala" },
      {
        property: "og:description",
        content:
          "Real-time lead pipeline, AI scoring, routing rules, agent performance and conversion analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadManagerPage,
});

function LeadManagerPage() {
  const [section, setSection] = useState("dashboard");
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarState();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);

  const screen = SECTION_SCREEN[section] ?? "overview";
  const stage = STAGE_SECTIONS[section];
  const sourceFilter = SOURCE_FILTERS[section];

  const { data: leads = [], isLoading } = useLeads({ search });
  const { data: agents = [] } = useAgents();

  useEffect(() => {
    if (!selected) return;
    const refreshed = leads.find((lead) => lead.id === selected.id);
    if (refreshed && refreshed !== selected) setSelected(refreshed);
  }, [leads, selected]);

  const visible = useMemo(() => {
    let rows = leads;
    if (stage) rows = rows.filter((l) => l.status === stage);
    if (sourceFilter?.source) rows = rows.filter((l) => l.source === sourceFilter.source);
    if (sourceFilter?.subSource)
      rows = rows.filter((l) => l.sub_source === sourceFilter.subSource);
    if (screen === "spam") rows = rows.filter((l) => l.status === "spam");
    return rows;
  }, [leads, stage, sourceFilter, screen]);

  const title = sourceFilter?.label ?? titleFor(section);

  return (
    <div className="creator-theme mm-scope flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar
        section={section}
        onSelectSection={setSection}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOP BAR */}
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-xl lg:px-5">
          <button
            onClick={() => setMobileOpen(true)}
            className="icon3d grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:text-foreground lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>

          <div className="focus-glow flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface/80 px-3 py-2 sm:max-w-md">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads…"
              aria-label="Search leads"
              className="h-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <LiveClock />
            <button
              onClick={() => exportLeadsCsv(visible)}
              className="icon3d grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="Export CSV"
              title="Export CSV"
            >
              <Download className="h-4 w-4" />
            </button>
            <CreateLeadDialog onCreated={setSelected} />
          </div>
        </header>

        <main
          key={section}
          className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
        >
          {/* SCREEN BANNER */}
          <section className="hero-surface relative overflow-hidden p-5 shadow-glow sm:p-7 lg:p-9">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent-pink/40 blur-3xl" />
            <div className="relative min-w-0">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
                <Target className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Lead Manager</span>
              </div>
              <h1 className="mt-4 truncate text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[34px]">
                {title}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-white/80 sm:text-[15px]">
                Live data from the Software Vala lead database — every action is written back
                through the API.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  className="rounded-full bg-white px-5 font-semibold text-primary hover:bg-white/90"
                  onClick={() => exportLeadsCsv(visible)}
                >
                  Export CSV <Download className="h-4 w-4" />
                </Button>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-medium">
                  <Activity className="h-3 w-3" />
                  {visible.length} records in view
                </span>
              </div>
            </div>
          </section>

          <Screen
            screen={screen}
            section={section}
            {...(sourceFilter ? { sourceFilter } : {})}
            visible={visible}
            leads={leads}
            agents={agents}
            isLoading={isLoading}
            onSelect={setSelected}
          />
        </main>
      </div>

      <LeadDetailSheet
        lead={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
      <Toaster position="top-right" />
    </div>
  );
}


function Screen({ screen, section, sourceFilter, visible, leads, agents, isLoading, onSelect }: {
  screen: string; section: string; sourceFilter?: { source?: string; subSource?: string; label: string };
  visible: Lead[]; leads: Lead[]; agents: Agent[];
  isLoading: boolean; onSelect: (lead: Lead) => void;
}) {
  if (screen === "overview") return <OverviewScreen onSelect={onSelect} />;
  if (screen === "allLeads") return <AllLeadsScreen onSelect={onSelect} />;
  if (screen === "sources") return <SourcesScreen section={section} onSelect={onSelect} />;
  if (screen === "capture") return <CaptureScreen onSelect={onSelect} />;
  if (screen === "qualification") return <QualificationScreen section={section} onSelect={onSelect} />;
  if (screen === "spam") return <SpamScreen onSelect={onSelect} />;
  if (screen === "pipeline") return <PipelineScreen section={section} onSelect={onSelect} />;
  if (screen === "actions") return <ActionsScreen section={section} onSelect={onSelect} />;
  if (screen === "automation") return <AutomationScreen onSelect={onSelect} />;
  if (screen === "team") return <TeamScreen />;
  if (screen === "alerts") return <AlertsScreen section={section} onSelect={onSelect} />;
  if (screen === "escalations") return <EscalationsScreen />;
  if (screen === "reports") return <ReportsScreen />;
  if (screen === "integrations") return <IntegrationsScreen />;
  if (screen === "security") return <SecurityScreen />;
  if (screen === "settings") return <SettingsScreen />;
  return <Panel title={`${sourceFilter?.label ?? "Leads"} — ${visible.length}`}><div className="text-sm text-muted-foreground">{isLoading ? "Loading…" : `${leads.length} records loaded across ${agents.length} agents.`}</div></Panel>;
}

function titleFor(section: string) {
  for (const s of NAV_SECTIONS) {
    for (const item of s.items) {
      if (item.id === section) return item.label;
      const child = item.children?.find((c) => c.id === section);
      if (child) return child.label;
    }
  }
  return "Lead Dashboard";
}

/** Executive top-bar widget: live local time, date and timezone. */
function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const tz = now ? Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop()?.replace("_", " ") : "Local";

  return (
    <div className="hidden items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_10px_24px_-18px_rgba(0,0,0,0.8)] md:flex">
      <span className="relative z-[3] flex items-center gap-2 text-primary">
        <Clock className="size-4" />
        <span className="num text-sm font-semibold tabular-nums text-foreground">
          {now ? now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "--:--:--"}
        </span>
      </span>
      <span className="relative z-[3] border-l border-border/70 pl-3 text-[11px] leading-tight text-muted-foreground">
        <span className="block">
          {now ? now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }) : "Loading"}
        </span>
        <span className="block">{tz}</span>
      </span>
    </div>
  );
}
