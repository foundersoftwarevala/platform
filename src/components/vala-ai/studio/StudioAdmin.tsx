import { useOperator, useCan } from "../session";
import { useStudioManagement } from "./management-data";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ManagerPage } from "@/components/vala-ai/studio/manager-page";
import { devDashboardFn } from "@/lib/vala-ai/studio/developer/developer.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/vala-ai/studio/ui/dropdown-menu";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Rocket,
  PanelLeft,
  Infinity as InfinityIcon,
  Bell,
  Moon,
  Wand2,
  ChevronDown,
  Clock,
  FolderOpen,
  Files,
  Database,
  CreditCard,
  Settings,
  LayoutGrid,
  Users,
  Crown,
  Receipt,
  Gift,
  Package,
  Bot,
  Cpu,
  LayoutTemplate,
  Sparkles,
  RefreshCw,
  LayoutTemplate as Layout2,
  Palette,
  ArrowRight as Arrow,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowRight,
} from "lucide-react";

const MAIN = [
  { l: "All Projects", i: FolderOpen },
  { l: "File Manager", i: Files },
  { l: "Database", i: Database },
  { l: "Billing", i: CreditCard },
  { l: "Settings", i: Settings },
];
const ADMIN = [
  { l: "Overview", i: LayoutGrid },
  { l: "Users", i: Users },
  { l: "Subscriptions", i: Crown },
  { l: "Transactions", i: Receipt },
  { l: "Referrals", i: Gift },
  { l: "Plans", i: Package },
  { l: "AI Builders", i: Bot },
  { l: "AI Providers", i: Cpu },
  { l: "AI Templates", i: LayoutTemplate },
];

function Item({
  l,
  i: I,
  on,
  onClick,
}: {
  l: string;
  i: typeof Users;
  on?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm ${on ? "bg-secondary font-medium" : "hover:bg-secondary"}`}
    >
      <I className="size-4" /> {l}
    </button>
  );
}

export function StudioAdmin() {
  const [view, setView] = useState("Overview");
  const operator = useOperator();
  const { dashboard, error } = useStudioManagement();
  const STATS = [
    { t: "Projects", v: dashboard?.projects.length ?? "UNVERIFIED", i: FolderOpen, ch: null },
    { t: "Library items", v: dashboard?.librarySize ?? "UNVERIFIED", i: Package, ch: null },
    { t: "Versions", v: dashboard?.versions.length ?? "UNVERIFIED", i: Files, ch: null },
    { t: "Recent events", v: dashboard?.logs.length ?? "UNVERIFIED", i: Clock, ch: null },
    { t: "Revenue", v: "UNVERIFIED", i: DollarSign, ch: null },
  ];
  const days = projectTrend(dashboard?.projects ?? []);
  const [metric, setMetric] = useState<"Revenue" | "Users" | "Projects">("Revenue");
  return (
    <div className="theme-builder studio-layout flex h-[calc(100vh-44px)] bg-background text-foreground">
      <aside className="flex w-[254px] shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="relative grid size-11 place-items-center rounded-xl bg-ink">
            <Rocket className="size-5" />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-studio-ok" />
          </div>
          <div>
            <div className="text-xl font-bold leading-none">Vala AI</div>
            <div className="mt-1 text-[11px] text-studio-dim">Build websites with AI</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <Item l="Create" i={Wand2} on={view === "Create"} onClick={() => setView("Create")} />
          <div className="mt-4 flex items-center justify-between px-2 py-1 text-xs text-studio-dim">
            Projects <ChevronDown className="size-4" />
          </div>
          <Item l="Recent" i={Clock} on={view === "Recent"} onClick={() => setView("Recent")} />
          <Link
            to="/vala-ai/builder"
            className="block truncate py-2 pl-8 pr-2 text-sm text-studio-dim hover:text-foreground"
          >
            Design a landing page for...
          </Link>
          {MAIN.map((m) => (
            <Item key={m.l} {...m} on={m.l === view} onClick={() => setView(m.l)} />
          ))}
          <div className="mt-4 flex items-center justify-between px-2 py-1 text-xs text-studio-dim">
            Administration <ChevronDown className="size-4" />
          </div>
          {ADMIN.map((m) => (
            <Item key={m.l} {...m} on={m.l === view} onClick={() => setView(m.l)} />
          ))}
        </nav>
        <div className="space-y-3 border-t border-border p-3">
          <button
            onClick={() => setView("Referrals")}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border px-4 py-2.5 text-left"
          >
            <Gift className="size-4" />
            <span>
              <span className="block text-sm font-medium">Invite Friends</span>
              <span className="text-[11px] text-studio-dim">Module referral records</span>
            </span>
          </button>
          <button
            onClick={() => setView("Plans")}
            className="flex w-full items-center gap-3 rounded-lg bg-ink px-4 py-2.5 text-left"
          >
            <Sparkles className="size-4" />
            <span>
              <span className="block text-sm font-semibold">Service plans</span>
              <span className="text-[11px] opacity-80">Module service metadata</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-5 py-2.5">
          <div className="flex items-center gap-4 text-xs text-studio-dim">
            <PanelLeft className="size-4" />
            <span className="flex items-center gap-1">
              <InfinityIcon className="size-3.5" /> Control Panel session
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Bell className="size-4" />
            <span className="text-xs">EN</span>
            <Moon className="size-4" />
            <div className="flex items-center gap-2 text-right">
              <div>
                <div className="text-sm font-medium">Admin</div>
                <div className="text-xs text-studio-dim">{operator.email}</div>
              </div>
              <span className="grid size-8 place-items-center rounded-full bg-ink text-sm font-semibold">
                A
              </span>
            </div>
          </div>
        </header>

        {view === "Create" ? (
          <CreateView />
        ) : view === "Recent" || view === "All Projects" ? (
          <ProjectsView recent={view === "Recent"} />
        ) : view !== "Overview" ? (
          <main className="flex-1 overflow-y-auto">
            <ManagerPage name={view} />
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto px-8 py-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">Overview</h1>
                <p className="mt-4 text-sm text-studio-dim">Dashboard overview and key metrics</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
              >
                <RefreshCw className="size-4" /> Refresh
              </button>
            </div>

            {error && (
              <p role="alert" className="mt-4 text-destructive">
                {error}
              </p>
            )}
            <div className="mt-6 grid grid-cols-5 gap-4">
              {STATS.map(({ t, v, i: I, ch }) => (
                <div key={t} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-center justify-between text-sm text-studio-dim">
                    {t}
                    <span className="grid size-9 place-items-center rounded-lg bg-secondary">
                      <I className="size-4 text-foreground" />
                    </span>
                  </div>
                  <div className="mt-4 text-3xl font-bold">{v}</div>
                  {ch && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-studio-dim">
                      <span
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${ch === "up" ? "bg-studio-ok/15 text-studio-ok" : "bg-destructive/15 text-destructive"}`}
                      >
                        {ch === "up" ? (
                          <TrendingUp className="size-3" />
                        ) : (
                          <TrendingDown className="size-3" />
                        )}{" "}
                        100%
                      </span>{" "}
                      vs last month
                    </div>
                  )}
                </div>
              ))}
            </div>

            <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">30-Day Trends</h2>
              <div className="mt-8 inline-flex rounded-lg bg-secondary p-1">
                {(["Revenue", "Users", "Projects"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`w-36 rounded-md py-1.5 text-sm ${metric === m ? "bg-card font-medium shadow-sm" : "text-studio-dim"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-studio-dim">
                {metric === "Projects"
                  ? "Project creation counts in the loaded dashboard scope."
                  : `${metric} metrics are not connected; UNVERIFIED.`}
              </p>
              <div className="mt-6 h-64">
                <ResponsiveContainer>
                  <AreaChart data={days}>
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--emerald)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--emerald)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="d"
                      tick={{ fontSize: 11, fill: "var(--dim)" }}
                      axisLine={false}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--dim)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (metric === "Revenue" ? `$${v}` : v)}
                      width={40}
                    />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey={metric}
                      stroke="var(--emerald)"
                      strokeWidth={2}
                      fill="url(#g)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="mt-8 grid grid-cols-2 gap-6">
              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Subscriptions by Plan</h2>
                <div className="mt-6 flex items-center justify-between text-sm">
                  <span>Platform subscription metrics</span>
                  <span className="font-medium">UNVERIFIED</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-secondary"></div>
              </section>
              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Users className="size-5" /> Referrals
                  </h2>
                  <button
                    onClick={() => setView("Referrals")}
                    className="flex items-center gap-1 text-sm"
                  >
                    View All <ArrowRight className="size-4" />
                  </button>
                </div>
                <p className="mt-6 text-sm text-studio-dim">
                  Referral totals are UNVERIFIED here. Open Referrals to manage module records.
                </p>
              </section>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

const IDEAS = [
  "Build a task management app",
  "Create a portfolio website",
  "Design a landing page",
  "Make an e-commerce store",
];

function CreateView() {
  const [text, setText] = useState("");
  const [layout, setLayout] = useState("Automatic");
  const [theme, setTheme] = useState("Automatic");
  const navigate = useNavigate();
  const start = () =>
    text.trim() &&
    navigate({
      to: "/vala-ai/builder",
      search: {
        prompt: text.trim(),
        theme: theme === "Automatic" ? undefined : theme.toLowerCase(),
        layout: layout === "Automatic" ? undefined : layout,
      },
    });
  return (
    <main className="create-canvas flex flex-1 flex-col items-center justify-center px-8">
      <h1 className="text-4xl font-bold">What would you like to create?</h1>
      <div className="mt-10 w-full max-w-3xl rounded-xl border border-border bg-card shadow-lg">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              start();
            }
          }}
          rows={3}
          placeholder="Build me a modern portfolio website with dark mode..."
          className="w-full resize-none rounded-t-xl bg-transparent px-4 py-3 outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-studio-dim">
          <span className="flex items-center gap-2">
            Press{" "}
            <kbd className="rounded border border-border px-1.5 font-mono text-[11px]">⌘ Enter</kbd>{" "}
            to start
          </span>
          <div className="flex gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-foreground">
                  <Layout2 className="size-4" /> {layout} <ChevronDown className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="theme-builder bg-card text-foreground">
                {["Automatic", "Landing page", "Dashboard", "Portfolio", "E-commerce", "Blog"].map(
                  (o) => (
                    <DropdownMenuItem key={o} onSelect={() => setLayout(o)}>
                      {o}
                      {o === layout && " ✓"}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-foreground">
                  <Palette className="size-4" /> {theme} <ChevronDown className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="theme-builder bg-card text-foreground">
                {[
                  "Automatic",
                  "Default",
                  "Arctic",
                  "Summer",
                  "Fragrant",
                  "Slate",
                  "Feminine",
                  "Forest",
                  "Midnight",
                ].map((o) => (
                  <DropdownMenuItem key={o} onSelect={() => setTheme(o)}>
                    {o}
                    {o === theme && " ✓"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={start}
              disabled={!text.trim()}
              className="flex items-center gap-2 rounded-lg bg-ink px-3 py-1.5 font-medium disabled:opacity-50"
            >
              Start <Arrow className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4 flex max-w-3xl flex-wrap justify-center gap-3">
        {IDEAS.map((i) => (
          <button
            key={i}
            onClick={() => setText(i)}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-studio-dim"
          >
            {i}
          </button>
        ))}
      </div>
    </main>
  );
}

function ProjectsView({ recent }: { recent: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<
    | {
        id: string;
        name: string;
        project_code: string;
        status: string;
        client_name: string | null;
        updated_at: string;
      }[]
    | null
  >(null);
  useEffect(() => {
    void devDashboardFn()
      .then((d) => setList(d.projects as never))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Projects could not load."));
  }, []);
  const shown = (list ?? []).slice(0, recent ? 5 : 100);
  return (
    <main className="flex-1 overflow-y-auto px-8 py-8">
      <h1 className="text-2xl font-bold">{recent ? "Recent" : "All Projects"}</h1>
      <p className="mt-2 text-sm text-studio-dim">
        Real client projects. Open one in Flow to run its steps.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-destructive">
          {error}
        </p>
      )}
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary text-xs text-studio-dim">
            <tr>
              <th className="px-4 py-2.5">Project</th>
              <th>ID</th>
              <th>Client</th>
              <th>Status</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list === null && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-studio-dim">
                  Loading…
                </td>
              </tr>
            )}
            {list && !shown.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-studio-dim">
                  No projects yet.
                </td>
              </tr>
            )}
            {shown.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="font-mono text-xs text-studio-dim">{p.project_code}</td>
                <td className="text-studio-dim">{p.client_name ?? "—"}</td>
                <td>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {p.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="text-xs text-studio-dim">
                  {new Date(p.updated_at).toLocaleString()}
                </td>
                <td className="pr-4 text-right">
                  <Link to="/vala-ai/flow" className="text-xs text-primary hover:underline">
                    Open in Flow →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function projectTrend(projects: { created_at: string }[]) {
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 29 + i);
    const key = date.toISOString().slice(0, 10);
    return {
      d: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      Projects: projects.filter((p) => p.created_at.startsWith(key)).length,
      Revenue: null,
      Users: null,
    };
  });
}
