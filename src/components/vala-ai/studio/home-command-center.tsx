import { useApi, ACTIVE_STATES, type Status, type Task, type Project } from "../api";
import { useState } from "react";
import { Play, AlertTriangle, Rocket, ArrowRight } from "lucide-react";
import { LiveAgentCard } from "@/components/vala-ai/studio/live-agent-card";

type Tone = "ok" | "run" | "fail" | "idle";
const toneDot: Record<Tone, string> = {
  ok: "bg-studio-ok",
  run: "bg-accent animate-pulse",
  fail: "bg-studio-fail",
  idle: "bg-studio-faint",
};
const toneText: Record<Tone, string> = {
  ok: "text-studio-ok",
  run: "text-accent",
  fail: "text-studio-fail",
  idle: "text-studio-faint",
};

function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rise rounded-lg border border-studio-line bg-studio-panel p-4 ${className}`}
    >
      <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[.2em] text-studio-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function HomeCommandCenter({ onOpenWorkspace }: { onOpenWorkspace: () => void }) {
  const status = useApi<Status>(["status"], "/status", { refetchInterval: 10000 });
  const tasks = useApi<Task[]>(["tasks", "all"], "/tasks", { refetchInterval: 5000 });
  const projects = useApi<Project[]>(["projects"], "/projects");
  const active = (tasks.data ?? []).filter((task) => ACTIVE_STATES.includes(task.state));
  const attention = (tasks.data ?? []).filter((task) => ["FAILED", "BLOCKED"].includes(task.state));
  const STATS: { label: string; value: string; tone: Tone }[] = [
    {
      label: "Running / queued",
      value: status.data ? String(active.length) : "UNVERIFIED",
      tone: "run",
    },
    {
      label: "Needs attention",
      value: tasks.data ? String(attention.length) : "UNVERIFIED",
      tone: "fail",
    },
    {
      label: "AI completed (loaded scope)",
      value: tasks.data
        ? String(tasks.data.filter((task) => task.state === "COMPLETE").length)
        : "UNVERIFIED",
      tone: "ok",
    },
    { label: "Live deployments", value: "UNVERIFIED", tone: "idle" },
  ];
  const PROJECTS = (projects.data ?? []).map((project) => ({
    name: project.name,
    stack: project.source_kind,
    status: project.status,
    tone: "idle" as Tone,
    updated: new Date(project.updated_at).toLocaleDateString(),
  }));
  const BUILDS = active.map((task) => ({
    name: task.title,
    step: task.state,
    stepIndex: 0,
    stepTotal: 0,
    pct: "UNVERIFIED",
    tone: "run" as Tone,
    state: task.state,
    activity: [
      {
        t: new Date(task.updated_at).toLocaleTimeString(),
        msg: task.result_summary ?? task.instruction,
        who: task.id,
        tone: "run" as Tone,
      },
    ],
  }));
  const FAILED = attention.map((task) => ({
    what: task.error ?? task.blocked_reason ?? task.state,
    where: task.title,
  }));
  const AI = (tasks.data ?? [])
    .slice(0, 6)
    .map((task) => ({ t: task.id, msg: task.result_summary ?? task.state, who: task.title }));
  const DEPLOYS: { name: string; env: string; when: string; tone: Tone }[] = [];
  const QUICK_ACTIONS = [
    {
      icon: Play,
      label: "Open agent",
      detail: active.length + " active",
      hint: "View the real execution pipeline",
    },
    {
      icon: AlertTriangle,
      label: "Review attention items",
      detail: attention.length + " in scope",
      hint: "Blocked and failed tasks",
    },
    {
      icon: Rocket,
      label: "Open workspace",
      detail: "Control Panel",
      hint: "Existing projects and approvals",
    },
  ];
  const HEALTH: { name: string; value: string; tone: Tone }[] = [
    {
      name: "AI gateway",
      value: status.data ? (status.data.model.online ? "Online" : "Offline") : "UNVERIFIED",
      tone: status.data?.model.online ? "ok" : "fail",
    },
    {
      name: "Worker",
      value: status.data ? (status.data.worker.running ? "Running" : "Stopped") : "UNVERIFIED",
      tone: "idle",
    },
    {
      name: "Audit chain",
      value: status.data ? (status.data.audit.ok ? "Intact" : "Broken") : "UNVERIFIED",
      tone: status.data?.audit.ok ? "ok" : "fail",
    },
    { name: "Live deployment monitoring", value: "UNVERIFIED", tone: "idle" },
  ];
  const error = status.error ?? tasks.error ?? projects.error;
  const [idea, setIdea] = useState("");
  const [more, setMore] = useState(false);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-[1180px] space-y-5">
        <div className="veil">
          <div className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">
            Command center · live module data
          </div>
          <h1 className="mt-1 font-studio-display text-[34px] uppercase leading-none tracking-tight">
            Vala AI command center
          </h1>
          <p className="mt-2 text-studio-dim">
            {active.length} tasks active, {attention.length} need attention. Live deployment count
            is UNVERIFIED.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-destructive">
            {error.message}
          </p>
        )}
        <LiveAgentCard onOpen={onOpenWorkspace} />

        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={onOpenWorkspace}
              className="rise group flex items-center gap-3 rounded-lg border border-studio-line bg-studio-panel p-3.5 text-left transition-colors hover:border-accent/50 hover:bg-studio-raise"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-studio-line bg-studio-raise text-accent group-hover:border-accent/50">
                <a.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="font-studio-display text-[13px] uppercase tracking-tight">
                    {a.label}
                  </span>
                  <span className="font-mono text-[10px] text-accent">{a.detail}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-studio-faint">
                  {a.hint}
                </span>
              </span>
            </button>
          ))}
        </div>

        <section className="rise rounded-lg border border-studio-line bg-studio-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-[10px] uppercase tracking-[.2em] text-studio-faint">
              Build progress
            </h2>
            <span className="font-mono text-[10px] text-studio-faint">
              {BUILDS.length} active · loaded task scope
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {BUILDS.map((b) => (
              <article
                key={b.name}
                className="flex flex-col rounded-md border border-studio-line bg-studio-raise p-3"
              >
                <div className="flex items-center gap-2">
                  <span className={`size-1.5 rounded-full ${toneDot[b.tone]}`} />
                  <span className="font-mono text-[12px]">{b.name}</span>
                  <span className={`ml-auto font-mono text-[11px] ${toneText[b.tone]}`}>
                    {b.pct}
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-studio-panel">
                  <div
                    className={`h-full ${b.tone === "fail" ? "bg-studio-fail" : "bg-accent"}`}
                    style={{ width: "0%" }}
                  />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-mono text-[10px] text-studio-faint">
                    Execution progress unverified
                  </span>
                  <span className="truncate text-[12px]">{b.step}</span>
                </div>
                <div className="font-mono text-[10px] text-studio-faint">{b.state}</div>
                <div className="mt-2.5 space-y-1.5 border-t border-studio-line pt-2.5">
                  {b.activity.map((a) => (
                    <div key={a.t} className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] text-studio-faint">{a.t}</span>
                      <span
                        className={`truncate text-[11px] ${a.tone ? toneText[a.tone] : "text-studio-dim"}`}
                      >
                        {a.msg}
                      </span>
                      <span className="ml-auto font-mono text-[9px] text-studio-faint">
                        {a.who}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={onOpenWorkspace}
                  className="mt-3 flex h-8 items-center justify-center gap-2 rounded-md border border-studio-line text-[12px] text-studio-dim transition-colors hover:border-accent/50 hover:text-accent"
                >
                  Resume build <ArrowRight className="size-3.5" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="rise rounded-lg border border-studio-line bg-studio-panel p-4">
          <label
            htmlFor="idea"
            className="font-studio-display text-[15px] uppercase tracking-tight"
          >
            What would you like to build?
          </label>
          <textarea
            id="idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={2}
            placeholder="Build a multi-vendor marketplace with seller dashboard, customer app, payments and admin panel."
            className="mt-2 w-full resize-none rounded-md border border-studio-line bg-background px-3 py-2.5 text-[14px] placeholder:text-studio-faint focus:border-accent focus:outline-none"
          />
          {more && (
            <div className="mt-3 grid grid-cols-5 gap-2 font-mono text-[11px]">
              {[
                ["Type", "Web app"],
                ["Technology", "React · TS"],
                ["AI model", "Auto"],
                ["Complexity", "Medium"],
                ["Environment", "Staging"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-md border border-studio-line bg-studio-raise px-2.5 py-1.5"
                >
                  <div className="text-[9px] uppercase tracking-[.16em] text-studio-faint">{k}</div>
                  <div className="mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenWorkspace}
              className="h-8 rounded-md bg-accent px-4 font-medium text-primary-foreground hover:brightness-110"
            >
              Build project
            </button>
            <button
              onClick={() => setMore(!more)}
              className="h-8 rounded-md border border-studio-line px-3 text-studio-dim hover:text-foreground"
            >
              {more ? "Hide options" : "Options"}
            </button>
            <span className="ml-auto flex gap-3 text-[12px] text-studio-dim">
              <button onClick={onOpenWorkspace} className="hover:text-foreground">
                Start from template
              </button>
              <button className="hover:text-foreground">Import project</button>
              <button className="hover:text-foreground">GitHub repository</button>
            </span>
          </div>
        </section>

        <div className="grid grid-cols-4 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rise rounded-lg border border-studio-line bg-studio-panel p-4"
            >
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.16em] text-studio-faint">
                <span className={`size-1.5 rounded-full ${toneDot[s.tone]}`} />
                {s.label}
              </div>
              <div
                className={`mt-2 font-studio-display text-[30px] leading-none ${toneText[s.tone]}`}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Section title="Active projects" className="col-span-2">
            <div className="divide-y divide-studio-line">
              {PROJECTS.map((p) => (
                <button
                  key={p.name}
                  onClick={onOpenWorkspace}
                  className="flex w-full items-center gap-3 py-2 text-left hover:bg-studio-raise"
                >
                  <span className={`size-1.5 rounded-full ${toneDot[p.tone]}`} />
                  <span className="w-44 font-mono text-[12px]">{p.name}</span>
                  <span className="flex-1 text-[12px] text-studio-dim">{p.stack}</span>
                  <span className={`font-mono text-[11px] ${toneText[p.tone]}`}>{p.status}</span>
                  <span className="w-10 text-right font-mono text-[10px] text-studio-faint">
                    {p.updated}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Needs attention">
            <div className="space-y-2.5">
              {FAILED.map((f) => (
                <div key={f.what} className="border-l-2 border-studio-fail pl-2.5">
                  <div className="text-[12px]">{f.what}</div>
                  <div className="font-mono text-[10px] text-studio-faint">{f.where}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="AI activity">
            <div className="space-y-2.5">
              {AI.map((a) => (
                <div key={a.t} className="flex gap-2.5">
                  <span className="font-mono text-[10px] text-studio-faint">{a.t}</span>
                  <div>
                    <div className="text-[12px]">{a.msg}</div>
                    <div className="font-mono text-[10px] text-accent">{a.who}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Recent deployments">
            <p className="mb-3 text-xs text-studio-dim">
              UNVERIFIED — no live deployment feed is connected.
            </p>
            <div className="space-y-2 font-mono text-[11px]">
              {DEPLOYS.map((d) => (
                <div key={d.name + d.when} className="flex items-center gap-2">
                  <span className={`size-1.5 rounded-full ${toneDot[d.tone]}`} />
                  <span>{d.name}</span>
                  <span className="text-studio-faint">{d.env}</span>
                  <span className="ml-auto text-studio-faint">{d.when}</span>
                </div>
              ))}
            </div>
          </Section>
          <Section title="System health">
            <div className="space-y-2 font-mono text-[11px]">
              {HEALTH.map((h) => (
                <div key={h.name} className="flex items-center gap-2">
                  <span className={`size-1.5 rounded-full ${toneDot[h.tone]}`} />
                  <span className="text-studio-dim">{h.name}</span>
                  <span className={`ml-auto ${toneText[h.tone]}`}>{h.value}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
