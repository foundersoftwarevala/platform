import { useState } from "react";
import {
  Github,
  GitlabIcon as Gitlab,
  GitBranch,
  Rocket,
  Globe2,
  ShieldCheck,
  Activity,
  RotateCcw,
  Terminal,
  Link2,
  Plus,
  CheckCircle2,
  Clock3,
  ExternalLink,
} from "lucide-react";
import { Card, PageHeader, PillButton, StatCard, SubNav } from "../ui";

const PROVIDERS = [
  { id: "github", label: "GitHub", desc: "OAuth · Repos · Actions", Icon: Github, status: "Connect" },
  { id: "gitlab", label: "GitLab", desc: "OAuth · Repos · CI/CD", Icon: Gitlab, status: "Connect" },
];

const TARGETS = [
  { name: "Vercel", note: "Edge · Preview URLs", color: "from-foreground/80 to-foreground/40" },
  { name: "Netlify", note: "CDN · Build hooks", color: "from-[oklch(0.80_0.13_192)] to-[oklch(0.50_0.09_215)]" },
  { name: "Railway", note: "Long-running · DBs", color: "from-[oklch(0.78_0.17_152)] to-[oklch(0.50_0.09_215)]" },
  { name: "Cloudflare", note: "Workers · KV · R2", color: "from-[oklch(0.82_0.16_75)] to-[oklch(0.62_0.18_25)]" },
];

const FLOW = [
  "Connect Git provider",
  "Select repository",
  "Pick branch",
  "Set environment variables",
  "Deploy",
  "Monitor build & runtime logs",
  "Live URL generated",
];

export function DeploymentSection() {
  const [tab, setTab] = useState("Overview");
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Deployment Center · Software Vala"
        title="Ship to production"
        description="One-click flow: connect Git, pick branch, set env, deploy, watch logs, get a live URL. Real providers only — no mock deploys."
        actions={
          <>
            <PillButton variant="ghost">
              <span className="inline-flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Connect Git</span>
            </PillButton>
            <PillButton variant="primary">
              <span className="inline-flex items-center gap-1.5"><Rocket className="h-3.5 w-3.5" /> New Deployment</span>
            </PillButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Production" value="—" tone="success" />
        <StatCard label="Preview Builds" value="—" tone="default" />
        <StatCard label="Avg Build Time" value="—" />
        <StatCard label="Health" value="—" tone="success" />
      </div>

      <SubNav
        items={["Overview", "Providers", "Repositories", "Environment", "Builds", "Domains", "Demo URLs", "History"]}
        active={tab}
        onChange={setTab}
      />

      {/* Providers */}
      <div className="grid gap-4 md:grid-cols-2">
        {PROVIDERS.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.50_0.09_215)] to-[oklch(0.80_0.13_192)] text-primary-foreground shadow-[0_8px_24px_-10px_oklch(0.80_0.13_192/0.7)]">
                  <p.Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground">{p.desc}</div>
                </div>
              </div>
              <PillButton variant="primary">{p.status}</PillButton>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {["Repos", "Branches", "Webhooks"].map((k) => (
                <div key={k} className="rounded-lg bg-background/40 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
                  <div className="text-sm font-bold">—</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Deployment targets */}
      <h3 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Deployment Targets</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TARGETS.map((t) => (
          <Card key={t.name} className="relative overflow-hidden">
            <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${t.color} opacity-30 blur-2xl`} />
            <div className="relative">
              <div className="text-base font-bold">{t.name}</div>
              <div className="text-[11px] text-muted-foreground">{t.note}</div>
              <div className="mt-3 flex items-center gap-2">
                <PillButton variant="ghost">Configure</PillButton>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Not connected</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* One-click flow */}
      <Card className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">One-Click Deploy Flow</h3>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">7 steps</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FLOW.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">{i + 1}</span>
                {s}
              </span>
              {i < FLOW.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* Repos + Env + Logs grid */}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">Repositories</h3>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add</span></PillButton>
          </div>
          <div className="space-y-2">
            <div className="rounded-lg border border-dashed border-border bg-background/40 p-4 text-center text-xs text-muted-foreground">
              Connect GitHub or GitLab to list repositories.
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold inline-flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5 text-accent" /> Branch & Env</h3>
            <PillButton variant="ghost">Save</PillButton>
          </div>
          <div className="space-y-2 text-xs">
            <Row k="Branch" v="—" />
            <Row k="Node version" v="—" />
            <Row k="Build command" v="—" />
            <Row k="Output dir" v="—" />
            <div className="mt-3 rounded-lg bg-background/40 p-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Environment Variables</div>
              <div className="text-xs text-muted-foreground">No variables configured.</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold inline-flex items-center gap-1.5"><Terminal className="h-3.5 w-3.5 text-accent" /> Build & Deploy Logs</h3>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">live</span>
          </div>
          <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-[oklch(0.10_0.02_240)] p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
{`> waiting for first deployment
> connect a repository to stream live logs here`}
          </pre>
        </Card>
      </div>

      {/* History + Domains */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-accent" /> Deployment History</h3>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Rollback</span></PillButton>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-background/40 p-6 text-center text-xs text-muted-foreground">
            No deployments yet.
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold inline-flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5 text-accent" /> Domains & SSL</h3>
            <PillButton variant="primary">+ Domain</PillButton>
          </div>
          <div className="space-y-2 text-xs">
            <Row k="Production" v="—" badge={<Badge tone="success" icon={<CheckCircle2 className="h-3 w-3" />}>SSL</Badge>} />
            <Row k="Preview" v="—" badge={<Badge tone="default" icon={<Activity className="h-3 w-3" />}>Health</Badge>} />
            <Row k="Custom Domain" v="—" badge={<Badge tone="warning" icon={<ShieldCheck className="h-3 w-3" />}>DNS</Badge>} />
          </div>
        </Card>
      </div>

      {/* Demo URL management */}
      <Card className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold inline-flex items-center gap-1.5"><ExternalLink className="h-3.5 w-3.5 text-accent" /> Demo URL Management</h3>
          <PillButton variant="premium">+ Create Demo URL</PillButton>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {["Product Demo", "Sandbox", "Sales Walkthrough"].map((s) => (
            <div key={s} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="text-sm font-bold">{s}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">No product mapped · disabled</div>
              <div className="mt-3 flex items-center gap-2">
                <PillButton variant="ghost">Edit</PillButton>
                <PillButton variant="ghost">Enable</PillButton>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Row({ k, v, badge }: { k: string; v: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</span>
      <span className="flex items-center gap-2 font-mono text-xs text-foreground">{v}{badge}</span>
    </div>
  );
}

function Badge({
  children,
  tone,
  icon,
}: {
  children: React.ReactNode;
  tone: "success" | "default" | "warning";
  icon?: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : "bg-accent/15 text-accent";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {icon}
      {children}
    </span>
  );
}
