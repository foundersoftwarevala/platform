import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { Input } from "@/components/rd-module/ui/input";
import { rdGateStatus } from "@/lib/rd-module/rd-gate.functions";
import { TeamMembersPanel } from "@/components/rd-module/rd-manager/TeamMembers";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Inbox,
  Rocket,
  Handshake,
  Lightbulb,
  List,
  FlaskConical,
  Beaker,
  ClipboardCheck,
  Network,
  BarChart3,
  Settings,
  ExternalLink,
} from "lucide-react";
import logo from "@/assets/rd-module/software-vala-logo.png";
import { Toaster } from "@/components/rd-module/ui/sonner";
import { cn } from "@/lib/rd-module/utils";
import { useOpportunities, useRdEvaluations, useRdProjects } from "@/hooks/rd-module/useRdManager";
import { OpportunityDetail } from "@/components/rd-module/rd-manager/OpportunityDetail";
import { RdAlertBanner } from "@/components/rd-module/rd-manager/AlertBanner";
import {
  RdAnalytics,
  RdClusters,
  RdDashboard,
  RdEvaluationsScreen,
  RdInbox,
  RdProjectsScreen,
  RdSettings,
  emptyFilters,
  type InboxFilters,
} from "@/components/rd-module/rd-manager/screens";

export const Route = createFileRoute("/rd-manager/")({
  head: () => ({
    meta: [
      { title: "R&D Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Review, evaluate and convert public software requests, SaaS partnerships and ideas.",
      },
      { property: "og:title", content: "R&D Manager — Software Vala" },
      { property: "og:description", content: "Central R&D workspace for incoming opportunities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RdManagerGate,
});

const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "software", label: "Software On Demand", icon: Rocket },
  { id: "saas", label: "SaaS Partnerships", icon: Handshake },
  { id: "build", label: "Build With Us", icon: Lightbulb },
  { id: "all", label: "All Opportunities", icon: List },
  { id: "research", label: "Research Projects", icon: FlaskConical },
  { id: "poc", label: "Experiments / POC", icon: Beaker },
  { id: "evaluations", label: "Evaluations", icon: ClipboardCheck },
  { id: "clusters", label: "Demand Clusters", icon: Network },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const ACTIVE = ["NEW", "UNDER_REVIEW", "NEEDS_INFORMATION"];

function RdManagerGate() {
  const status = useServerFn(rdGateStatus);
  const { data, error, isLoading } = useQuery({ queryKey: ["rd-gate"], queryFn: () => status() });
  if (isLoading)
    return (
      <div role="status" className="p-8">
        Checking Control Panel access...
      </div>
    );
  if (error)
    return (
      <div role="alert" className="p-8 text-danger">
        {error.message}
      </div>
    );
  if (!data?.unlocked)
    return (
      <div role="alert" className="p-8">
        Control Panel access is required.
      </div>
    );
  return <RdManagerPage isAdmin={data.isAdmin} member={data.member ?? ""} />;
}

function RdManagerPage({ isAdmin, member }: { isAdmin: boolean; member: string }) {
  const [section, setSection] = useState<SectionId>("dashboard");
  const [openId, setOpenId] = useState<string | null>(null);
  const [filters, setFilters] = useState<InboxFilters>({ ...emptyFilters });
  const [actor, setActorState] = useState("R&D Manager");
  useEffect(() => {
    const saved = window.localStorage.getItem("rd-manager-actor");
    if (member && member !== "Admin") setActorState(member);
    else if (saved) setActorState(saved);
  }, [member]);
  const setActor = (v: string) => {
    setActorState(v);
    window.localStorage.setItem("rd-manager-actor", v);
  };

  const { data: items = [], isLoading } = useOpportunities();
  const { data: projects = [] } = useRdProjects();
  const { data: evaluations = [] } = useRdEvaluations();
  const inboxItems = items.filter((o) => ACTIVE.includes(o.status));
  const newCount = items.filter((o) => o.status === "NEW").length;

  const go = (id: SectionId) => {
    setSection(id);
    const preset: Partial<InboxFilters> =
      id === "software"
        ? { type: "SOFTWARE_ON_DEMAND" }
        : id === "saas"
          ? { type: "SAAS_PARTNERSHIP" }
          : id === "build"
            ? { type: "BUILD_WITH_US" }
            : {};
    setFilters({ ...emptyFilters, ...preset });
  };

  const listFor = section === "inbox" ? inboxItems : items;
  const listTitle = SECTIONS.find((s) => s.id === section)?.label ?? "";

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside
        aria-label="R&D Manager sections"
        className="border-b border-border bg-sidebar/80 backdrop-blur-xl lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r"
      >
        <div className="flex items-center gap-3 border-b border-border px-6 py-5">
          <img
            src={logo}
            alt=""
            width={40}
            height={40}
            className="h-11 w-11 rounded-full object-contain"
          />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-foreground">Control Panel</p>
            <p className="truncate text-xs text-brand">
              {member ? `Signed in: ${member}` : "R&D Manager"}
            </p>
          </div>
        </div>
        <nav className="scroll-slim flex gap-1 overflow-x-auto p-3 lg:flex-col lg:overflow-visible lg:p-4">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              aria-current={section === id ? "page" : undefined}
              className={cn(
                "relative flex h-11 shrink-0 items-center gap-3 rounded-xl px-4 text-sm font-medium transition-all duration-200",
                section === id
                  ? "brand-soft border border-brand/30 text-foreground lg:before:absolute lg:before:-left-4 lg:before:h-6 lg:before:w-1 lg:before:rounded-r-full lg:before:bg-brand"
                  : "border border-transparent text-muted-foreground hover:translate-x-0.5 hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", section === id && "text-brand")} aria-hidden="true" />
              <span className="whitespace-nowrap lg:flex-1 lg:text-left">{label}</span>
              {id === "inbox" && newCount > 0 && (
                <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs text-brand">
                  {newCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="hidden space-y-2 border-t border-border p-4 lg:block">
          <Link
            to="/rd-manager/lab"
            className="flex min-h-11 items-center justify-center rounded-xl border border-border text-xs text-muted-foreground hover:bg-surface-2"
          >
            R&amp;D Workspace
          </Link>
          <Link
            to="/rd-manager/pro-manager"
            className="flex min-h-11 items-center justify-center rounded-xl border border-border text-xs text-muted-foreground hover:bg-surface-2"
          >
            Pro Manager
          </Link>
          <button
            type="button"
            onClick={() => window.location.assign("/control-panel")}
            className="flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border border-border text-xs text-muted-foreground hover:bg-surface-2"
          >
            <Lock className="h-3 w-3" /> Control Panel
          </button>
          <a
            href="/rd-manager/start"
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border text-xs text-muted-foreground hover:bg-surface-2"
          >
            Public request page <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
        <RdAlertBanner items={items} onOpen={setOpenId} />
        {section === "dashboard" && (
          <RdDashboard
            items={items}
            loading={isLoading}
            onOpen={setOpenId}
            onFilter={(status, type) => {
              setSection("all");
              setFilters({ ...emptyFilters, status: status ?? "", type: type ?? "" });
            }}
          />
        )}
        {["inbox", "software", "saas", "build", "all"].includes(section) && (
          <RdInbox
            title={listTitle}
            items={listFor}
            loading={isLoading}
            filters={filters}
            setFilters={setFilters}
            onOpen={setOpenId}
          />
        )}
        {section === "research" && (
          <RdProjectsScreen
            title="Research Projects"
            kinds={["RESEARCH", "DEVELOPMENT_HANDOFF", "PARTNERSHIP"]}
            projects={projects}
            items={items}
            onOpen={setOpenId}
          />
        )}
        {section === "poc" && (
          <RdProjectsScreen
            title="Experiments / POC"
            kinds={["POC"]}
            projects={projects}
            items={items}
            onOpen={setOpenId}
          />
        )}
        {section === "evaluations" && (
          <RdEvaluationsScreen evaluations={evaluations} items={items} onOpen={setOpenId} />
        )}
        {section === "clusters" && <RdClusters items={items} onOpen={setOpenId} />}
        {section === "analytics" && <RdAnalytics items={items} projects={projects} />}
        {section === "settings" && (
          <div className="space-y-6">
            <RdSettings actor={actor} setActor={setActor} />
            {isAdmin && <TeamMembersPanel />}
          </div>
        )}
      </main>
      <OpportunityDetail id={openId} actor={actor} onClose={() => setOpenId(null)} />
      <Toaster />
    </div>
  );
}
