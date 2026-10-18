import { HomeCommandCenter } from "./home-command-center";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Bot,
  Boxes,
  Code2,
  Factory,
  GitBranch,
  Home as HomeIcon,
  Images,
  LayoutDashboard,
  Shield,
} from "lucide-react";
import { SoftwareFactory } from "@/components/vala-ai/studio/software-factory";
import { AgentBuildPanel } from "@/components/vala-ai/studio/agent-build-panel";
import { DeveloperPanel } from "@/components/vala-ai/studio/developer-panel";
import { LiveAgentCard } from "@/components/vala-ai/studio/live-agent-card";
import { ScreenshotComparison } from "./screenshot-comparison";

type Tab = "Overview" | "Home" | "Developer" | "Agent" | "Factory" | "Compare";
const TABS: { id: Tab; label: string; icon: typeof HomeIcon; hint: string }[] = [
  { id: "Overview", label: "Live overview", icon: LayoutDashboard, hint: "Live status" },
  { id: "Home", label: "Home", icon: HomeIcon, hint: "Start here" },
  { id: "Developer", label: "Projects", icon: Boxes, hint: "Requirement → matched software" },
  { id: "Agent", label: "AI Agent", icon: Bot, hint: "Write new code" },
  { id: "Factory", label: "Code check", icon: Factory, hint: "Find bugs & missing parts" },
  { id: "Compare", label: "Screenshot compare", icon: Images, hint: "Compare and export" },
];
const PAGES = [
  { to: "/vala-ai/command-center", label: "Command Center", icon: LayoutDashboard },
  { to: "/vala-ai/projects", label: "Engineering projects", icon: Boxes },
  { to: "/vala-ai/pipeline", label: "Execution pipeline", icon: GitBranch },
  { to: "/vala-ai/qa", label: "QA & Verification", icon: Shield },
  { to: "/vala-ai/approvals", label: "Approvals", icon: Shield },
  { to: "/vala-ai/releases", label: "Versions & Releases", icon: Boxes },
  { to: "/vala-ai/activity", label: "Activity & Audit", icon: LayoutDashboard },
  { to: "/vala-ai/chat", label: "Task Chat", icon: Bot },
  { to: "/vala-ai/flow", label: "Flow (30 steps)", icon: GitBranch },
  { to: "/vala-ai/builder", label: "Website builder", icon: Code2 },
  { to: "/vala-ai/admin", label: "Admin", icon: LayoutDashboard },
  { to: "/vala-ai/owner", label: "Owner", icon: Shield },
] as const;

export function StudioHome() {
  const [tab, setTab] = useState<Tab>("Home");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  return (
    <div className="studio-layout flex h-[calc(100vh-44px)] w-full overflow-hidden bg-background font-studio-body text-sm text-foreground antialiased">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-studio-line bg-studio-panel">
        <div className="flex h-14 items-center gap-2 border-b border-studio-line px-4">
          <span className="grid size-6 place-items-center rounded-md bg-accent font-mono text-[11px] font-semibold text-primary-foreground">
            V
          </span>
          <span className="font-studio-display text-[16px] tracking-tight">Vala AI</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${tab === t.id ? "bg-accent/12 font-medium text-foreground" : "text-studio-dim hover:bg-studio-raise hover:text-foreground"}`}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
          <div className="px-2.5 pb-1 pt-4 font-mono text-[10px] uppercase tracking-[.18em] text-studio-faint">
            Pages
          </div>
          {PAGES.map((p) => (
            <Link
              key={p.to}
              to={p.to}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-studio-dim hover:bg-studio-raise hover:text-foreground"
            >
              <p.icon className="size-4" />
              {p.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {tab === "Overview" ? (
          <HomeCommandCenter onOpenWorkspace={() => setTab("Agent")} />
        ) : tab === "Home" ? (
          <HomeView go={setTab} />
        ) : tab === "Developer" ? (
          <DeveloperPanel />
        ) : tab === "Factory" ? (
          <SoftwareFactory />
        ) : tab === "Compare" ? (
          <section className="space-y-4 p-6">
            <h1 className="text-xl font-semibold">Screenshot comparison</h1>
            <p className="text-sm text-studio-dim">
              Compare screenshots with linked zoom and pan, overlay mode and report export. The
              initial checkout image is the source design template.
            </p>
            <button
              onClick={() => setComparisonOpen(true)}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
            >
              Open comparison
            </button>
            <ScreenshotComparison open={comparisonOpen} onOpenChange={setComparisonOpen} />
          </section>
        ) : (
          <div className="p-6">
            <AgentBuildPanel />
          </div>
        )}
      </main>
    </div>
  );
}

function HomeView({ go }: { go: (t: Tab) => void }) {
  const steps: { n: string; title: string; text: string; action: () => void; cta: string }[] = [
    {
      n: "1",
      title: "Add the requirement",
      text: "Create a project with the client's requirement. AI reads it and finds matching software from your library.",
      action: () => go("Developer"),
      cta: "Open Projects",
    },
    {
      n: "2",
      title: "Run the flow",
      text: "One click runs branding, AI development, testing, bug fixing, delivery and a new version.",
      action: () => window.location.assign("/vala-ai/flow"),
      cta: "Open Flow",
    },
    {
      n: "3",
      title: "Build a website",
      text: "Describe a website in chat. Vala AI builds it and updates it as you ask for changes.",
      action: () => window.location.assign("/vala-ai/builder"),
      cta: "Open Builder",
    },
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-studio-display text-[32px] leading-tight tracking-tight">
          What do you want to do?
        </h1>
        <p className="mt-1 text-studio-dim">
          Vala AI turns a client requirement into branded, tested, delivered software.
        </p>
        <p className="mt-2 text-xs text-studio-dim">
          Studio checks are AI review, not executed tests. Use QA &amp; Verification and Approvals
          for verified engineering releases.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <button
            key={s.n}
            onClick={s.action}
            className="group flex flex-col rounded-lg border border-studio-line bg-studio-panel p-5 text-left hover:border-accent"
          >
            <span className="grid size-7 place-items-center rounded-full bg-accent/15 font-mono text-[12px] text-accent">
              {s.n}
            </span>
            <span className="mt-3 text-[15px] font-medium">{s.title}</span>
            <span className="mt-1 flex-1 text-[13px] text-studio-dim">{s.text}</span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-accent">
              {s.cta}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>
      <LiveAgentCard onOpen={() => go("Agent")} />
    </div>
  );
}
