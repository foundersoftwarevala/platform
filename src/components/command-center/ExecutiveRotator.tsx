/**
 * EXECUTIVE PRODUCTIVITY PANEL
 * A single rotating widget surface for the right-hand panel.
 * Every widget has its own purpose and reads REAL in-app signals
 * (banner feed, demo-url store, session activity, browser telemetry).
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  BellRing,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Flame,
  Gauge,
  LifeBuoy,
  Link2,
  ListChecks,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  StickyNote,
  Target,
  Timer,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  completeBannerItem,
  resolveBannerItem,
  useBannerFeed,
  type BannerItem,
} from "@/components/slider-banner/bannerFeed";
import { useDemoState } from "@/components/marketplace/demoUrlStore";
import { logExecAction, saveExecNotes, useExecSignals } from "./execSignals";

/* --------------------------------- atoms --------------------------------- */

const Btn = memo<{
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "primary" | "graphite";
  className?: string;
  title?: string;
  disabled?: boolean;
}>(({ children, onClick, tone = "primary", className, title, disabled }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      tone === "primary" ? "btn-premium" : "btn-graphite",
      "btn-premium-hover text-[10px]",
      className,
    )}
  >
    {children}
  </button>
));
Btn.displayName = "Btn";

const Stat = memo<{ k: string; v: string; tone?: string }>(({ k, v, tone }) => (
  <div className="rounded-lg border border-[rgba(130,170,230,0.22)] bg-[linear-gradient(180deg,rgba(38,62,110,0.72),rgba(14,26,50,0.9))] px-2 py-1.5">
    <p className="truncate text-[8.5px] font-bold uppercase tracking-[0.14em] text-foreground/55">{k}</p>
    <p className={cn("mt-0.5 text-[15px] font-extrabold leading-none tracking-tight text-foreground tabular-nums", tone)}>
      {v}
    </p>
  </div>
));
Stat.displayName = "Stat";

const Line = memo<{ label: string; value: string; tone?: string; onClick?: () => void }>(
  ({ label, value, tone, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-[rgba(130,170,230,0.18)] bg-[rgba(20,36,66,0.85)] px-2 py-1.5 text-left transition-colors hover:border-[rgba(150,195,255,0.5)] hover:bg-[rgba(30,52,96,0.95)] active:translate-y-[1px]"
    >
      <span className="truncate text-[10.5px] font-semibold text-foreground/85">{label}</span>
      <span className={cn("shrink-0 text-[10px] font-extrabold tabular-nums", tone ?? "text-sky-300")}>{value}</span>
    </button>
  ),
);
Line.displayName = "Line";

const Empty = memo<{ text: string }>(({ text }) => (
  <p className="rounded-lg border border-dashed border-[rgba(140,175,230,0.25)] px-2 py-4 text-center text-[10px] font-medium text-foreground/45">
    {text}
  </p>
));
Empty.displayName = "Empty";

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function hhmmss(ms: number) {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

/* ------------------------------- widget ctx ------------------------------- */

interface Ctx {
  feed: BannerItem[];
  demos: ReturnType<typeof useDemoState>["demos"];
  products: ReturnType<typeof useDemoState>["products"];
  actions: ReturnType<typeof useExecSignals>["actions"];
  notes: string;
  sessionStart: number;
  now: number;
  go: (to: string) => void;
}

interface Widget {
  id: string;
  title: string;
  icon: React.ElementType;
  accent: string;
  render: (c: Ctx) => React.ReactNode;
}

const KIND_WEIGHT: Record<BannerItem["kind"], number> = { alert: 3, approval: 2, todo: 1, notification: 0 };

const WIDGETS: Widget[] = [
  {
    id: "priority",
    title: "Today's Priority",
    icon: Flame,
    accent: "text-rose-300",
    render: ({ feed }) => {
      const open = feed.filter((i) => !i.done);
      const top = [...open].sort((a, b) => KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind])[0];
      if (!top) return <Empty text="Nothing open — the board is clear." />;
      return (
        <div className="space-y-2">
          <p className="text-[12.5px] font-extrabold leading-tight tracking-tight text-foreground">{top.title}</p>
          <p className="text-[10.5px] leading-snug text-foreground/65">{top.detail}</p>
          <div className="flex gap-1.5">
            <Btn
              onClick={() => {
                resolveBannerItem(top.id);
                logExecAction("approval", "Cleared priority", top.title);
                toast.success("Priority cleared");
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
            </Btn>
            <Btn tone="graphite" onClick={() => toast.info(top.meta ?? "No source metadata")}>
              Details
            </Btn>
          </div>
          <p className="text-[9px] uppercase tracking-[0.14em] text-foreground/40">
            {open.length} open items · {top.kind}
          </p>
        </div>
      );
    },
  },
  {
    id: "tasks",
    title: "My Tasks",
    icon: ListChecks,
    accent: "text-emerald-300",
    render: ({ feed }) => {
      const todos = feed.filter((i) => i.kind === "todo");
      if (!todos.length) return <Empty text="No tasks assigned to you." />;
      return (
        <div className="space-y-1.5">
          {todos.slice(0, 4).map((t) => (
            <Line
              key={t.id}
              label={t.title}
              value={t.done ? "DONE" : "MARK"}
              tone={t.done ? "text-emerald-300" : "text-amber-300"}
              onClick={() => {
                if (t.done) return;
                completeBannerItem(t.id);
                logExecAction("task", "Completed task", t.title);
                toast.success("Task completed");
              }}
            />
          ))}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <Stat k="Open" v={String(todos.filter((t) => !t.done).length)} />
            <Stat k="Done" v={String(todos.filter((t) => t.done).length)} tone="text-emerald-300" />
          </div>
        </div>
      );
    },
  },
  {
    id: "reviews",
    title: "Pending Reviews",
    icon: ClipboardList,
    accent: "text-amber-300",
    render: ({ feed }) => {
      const items = feed.filter((i) => i.kind === "approval" && !i.done);
      if (!items.length) return <Empty text="No approvals waiting on you." />;
      return (
        <div className="space-y-1.5">
          {items.slice(0, 3).map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-[rgba(130,170,230,0.2)] bg-[rgba(19,34,64,0.9)] px-2 py-1.5"
            >
              <p className="truncate text-[10.5px] font-bold text-foreground/90">{a.title}</p>
              <p className="truncate text-[9.5px] text-foreground/55">{a.meta ?? a.detail}</p>
              <div className="mt-1.5 flex gap-1.5">
                <Btn
                  className="px-2 py-1"
                  onClick={() => {
                    resolveBannerItem(a.id);
                    logExecAction("approval", "Approved", a.title);
                    toast.success("Approved");
                  }}
                >
                  Approve
                </Btn>
                <Btn className="px-2 py-1" tone="graphite" onClick={() => toast.info("Sent back for revision")}>
                  Revise
                </Btn>
              </div>
            </div>
          ))}
        </div>
      );
    },
  },
  {
    id: "recent-approvals",
    title: "Recent Approvals",
    icon: ShieldCheck,
    accent: "text-sky-300",
    render: ({ actions, now }) => {
      const list = actions.filter((a) => a.kind === "approval");
      if (!list.length) return <Empty text="No approvals recorded this session." />;
      return (
        <div className="space-y-1.5">
          {list.slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-[rgba(20,36,66,0.8)] px-2 py-1.5">
              <span className="truncate text-[10px] font-semibold text-foreground/80">{a.detail || a.label}</span>
              <span className="shrink-0 text-[9px] font-bold text-foreground/45">{ago(a.at, now)}</span>
            </div>
          ))}
        </div>
      );
    },
  },
  {
    id: "notifications",
    title: "Recent Notifications",
    icon: BellRing,
    accent: "text-violet-300",
    render: ({ feed }) => {
      const items = feed.filter((i) => i.kind === "notification");
      if (!items.length) return <Empty text="Inbox zero." />;
      return (
        <div className="space-y-1.5">
          {items.slice(0, 4).map((n) => (
            <div key={n.id} className="rounded-lg border border-violet-400/20 bg-[rgba(38,28,72,0.8)] px-2 py-1.5">
              <p className="truncate text-[10.5px] font-bold text-foreground/90">{n.title}</p>
              <p className="truncate text-[9.5px] text-foreground/55">{n.detail}</p>
            </div>
          ))}
        </div>
      );
    },
  },
  {
    id: "escalations",
    title: "Support Escalations",
    icon: LifeBuoy,
    accent: "text-rose-300",
    render: ({ feed }) => {
      const alerts = feed.filter((i) => i.kind === "alert" && !i.done);
      if (!alerts.length) return <Empty text="No live escalations." />;
      return (
        <div className="space-y-1.5">
          {alerts.slice(0, 3).map((a) => (
            <Line
              key={a.id}
              label={a.title}
              value="ESCALATED"
              tone="text-rose-300"
              onClick={() => toast.error(a.detail)}
            />
          ))}
          <Stat k="Open escalations" v={String(alerts.length)} tone="text-rose-300" />
        </div>
      );
    },
  },
  {
    id: "demo-health",
    title: "Demo Server Health",
    icon: Gauge,
    accent: "text-emerald-300",
    render: ({ demos }) => {
      const working = demos.filter((d) => d.health === "working").length;
      const slow = demos.filter((d) => d.health === "slow").length;
      const offline = demos.filter((d) => d.health === "offline").length;
      const checked = demos.filter((d) => d.lastChecked).length;
      const avg = (() => {
        const t = demos.filter((d) => d.responseTimeMs != null);
        if (!t.length) return "—";
        return `${Math.round(t.reduce((s, d) => s + (d.responseTimeMs ?? 0), 0) / t.length)} ms`;
      })();
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <Stat k="Working" v={String(working)} tone="text-emerald-300" />
          <Stat k="Slow" v={String(slow)} tone="text-amber-300" />
          <Stat k="Offline" v={String(offline)} tone="text-rose-300" />
          <Stat k="Avg latency" v={avg} />
          <div className="col-span-2">
            <Stat k="Checked endpoints" v={`${checked} / ${demos.length}`} />
          </div>
        </div>
      );
    },
  },
  {
    id: "marketplace",
    title: "Marketplace Performance",
    icon: ShoppingBag,
    accent: "text-sky-300",
    render: ({ demos, products, go }) => {
      const ssl = demos.filter((d) => d.ssl).length;
      const active = demos.filter((d) => d.active).length;
      return (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <Stat k="Products" v={String(products.length)} />
            <Stat k="Demo URLs" v={String(demos.length)} />
            <Stat k="Active" v={String(active)} tone="text-emerald-300" />
            <Stat k="SSL secured" v={`${ssl}/${demos.length}`} tone="text-sky-300" />
          </div>
          <Btn className="w-full" onClick={() => go("/marketplace")}>
            <Link2 className="h-3.5 w-3.5" /> Open Marketplace Manager
          </Btn>
        </div>
      );
    },
  },
  {
    id: "review-queue",
    title: "Product Review Queue",
    icon: Timer,
    accent: "text-amber-300",
    render: ({ demos, go }) => {
      const unchecked = demos.filter((d) => !d.lastChecked);
      return (
        <div className="space-y-1.5">
          {unchecked.length === 0 ? (
            <Empty text="Every demo endpoint has been validated." />
          ) : (
            unchecked.slice(0, 4).map((d) => (
              <Line key={d.id} label={d.demoName} value="UNVERIFIED" tone="text-amber-300" onClick={() => go("/marketplace")} />
            ))
          )}
          <Stat k="Awaiting validation" v={String(unchecked.length)} tone="text-amber-300" />
        </div>
      );
    },
  },
  {
    id: "goals",
    title: "Goal Progress",
    icon: Target,
    accent: "text-emerald-300",
    render: ({ demos, feed }) => {
      const coverage = demos.length ? Math.round((demos.filter((d) => d.lastChecked).length / demos.length) * 100) : 0;
      const todos = feed.filter((i) => i.kind === "todo");
      const taskPct = todos.length ? Math.round((todos.filter((t) => t.done).length / todos.length) * 100) : 0;
      const open = feed.filter((i) => !i.done).length;
      const inboxPct = feed.length ? Math.round(((feed.length - open) / feed.length) * 100) : 100;
      const rows = [
        { l: "Demo validation coverage", p: coverage },
        { l: "Task completion", p: taskPct },
        { l: "Inbox cleared", p: inboxPct },
      ];
      return (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.l} className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold text-foreground/75">
                <span>{r.l}</span>
                <span className="tabular-nums">{r.p}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[rgba(10,20,40,0.9)] shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#1f7a5a,#34d399)] transition-[width] duration-700"
                  style={{ width: `${r.p}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      );
    },
  },
  {
    id: "productivity",
    title: "Personal Productivity",
    icon: Activity,
    accent: "text-sky-300",
    render: ({ actions, sessionStart, now }) => {
      const lastHour = actions.filter((a) => now - a.at < 3600_000).length;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <Stat k="Session time" v={hhmmss(now - sessionStart)} />
          <Stat k="Actions" v={String(actions.length)} tone="text-emerald-300" />
          <Stat k="Last hour" v={String(lastHour)} />
          <Stat k="Last action" v={actions[0] ? ago(actions[0].at, now) : "—"} />
        </div>
      );
    },
  },
  {
    id: "activity",
    title: "Live Activity Feed",
    icon: RefreshCw,
    accent: "text-sky-300",
    render: ({ actions, now }) => {
      if (!actions.length) return <Empty text="Your actions will stream here in real time." />;
      return (
        <div className="space-y-1">
          {actions.slice(0, 6).map((a) => (
            <div key={a.id} className="flex items-center gap-1.5 rounded-md bg-[rgba(20,36,66,0.75)] px-2 py-1">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="truncate text-[10px] font-semibold text-foreground/80">{a.label}</span>
              <span className="ml-auto shrink-0 text-[9px] text-foreground/45">{ago(a.at, now)}</span>
            </div>
          ))}
        </div>
      );
    },
  },
  {
    id: "connection",
    title: "Session & Connection",
    icon: Wifi,
    accent: "text-emerald-300",
    render: () => <ConnectionWidget />,
  },
  {
    id: "calendar",
    title: "Calendar Intelligence",
    icon: CalendarClock,
    accent: "text-violet-300",
    render: ({ now }) => {
      const d = new Date(now);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      const qEnd = new Date(d.getFullYear(), quarter * 3, 0);
      const daysToQ = Math.ceil((qEnd.getTime() - d.getTime()) / 86400000);
      const start = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <Stat k="Today" v={d.toLocaleDateString(undefined, { day: "2-digit", month: "short" })} />
          <Stat k="Week" v={`W${week}`} />
          <Stat k="Days left in month" v={String(endOfMonth - d.getDate())} />
          <Stat k={`Q${quarter} closes in`} v={`${daysToQ}d`} tone="text-amber-300" />
        </div>
      );
    },
  },
  {
    id: "notes",
    title: "Quick Notes",
    icon: StickyNote,
    accent: "text-amber-300",
    render: ({ notes }) => <NotesWidget initial={notes} />,
  },
  {
    id: "shortcuts",
    title: "Quick Shortcuts",
    icon: BrainCircuit,
    accent: "text-sky-300",
    render: ({ go }) => (
      <div className="grid grid-cols-2 gap-1.5">
        <Btn onClick={() => go("/marketplace")}>Marketplace</Btn>
        <Btn tone="graphite" onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); logExecAction("nav", "Jumped to KPI grid"); }}>
          KPI Grid
        </Btn>
        <Btn
          tone="graphite"
          onClick={() => {
            document.querySelector<HTMLButtonElement>("[data-vala-launcher]")?.click();
            logExecAction("nav", "Opened Vala AI");
          }}
        >
          Ask Vala AI
        </Btn>
        <Btn
          tone="graphite"
          onClick={() => {
            void navigator.clipboard.writeText(window.location.href);
            toast.success("Dashboard link copied");
          }}
        >
          Copy Link
        </Btn>
      </div>
    ),
  },
];

/* --------------------------- stateful sub-widgets -------------------------- */

const ConnectionWidget = memo(() => {
  const [info, setInfo] = useState<{ online: boolean; rtt?: number; down?: number; type?: string; cores?: number }>({
    online: true,
  });
  useEffect(() => {
    const read = () => {
      const nav = navigator as Navigator & {
        connection?: { rtt?: number; downlink?: number; effectiveType?: string };
        hardwareConcurrency?: number;
      };
      setInfo({
        online: navigator.onLine,
        ...(nav.connection?.rtt !== undefined ? { rtt: nav.connection.rtt } : {}),
        ...(nav.connection?.downlink !== undefined ? { down: nav.connection.downlink } : {}),
        ...(nav.connection?.effectiveType !== undefined ? { type: nav.connection.effectiveType } : {}),
        ...(nav.hardwareConcurrency !== undefined ? { cores: nav.hardwareConcurrency } : {}),
      });
    };
    read();
    const t = setInterval(read, 4000);
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <Stat k="Network" v={info.online ? "ONLINE" : "OFFLINE"} tone={info.online ? "text-emerald-300" : "text-rose-300"} />
      <Stat k="Link" v={info.type ? info.type.toUpperCase() : "—"} />
      <Stat k="RTT" v={info.rtt != null ? `${info.rtt} ms` : "—"} />
      <Stat k="Downlink" v={info.down != null ? `${info.down} Mb/s` : "—"} />
      <div className="col-span-2">
        <Stat k="CPU threads available" v={info.cores != null ? String(info.cores) : "—"} />
      </div>
    </div>
  );
});
ConnectionWidget.displayName = "ConnectionWidget";

const NotesWidget = memo<{ initial: string }>(({ initial }) => {
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial]);
  return (
    <div className="space-y-1.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Boardroom notes, follow-ups, reminders…"
        className="w-full resize-none rounded-lg border border-[rgba(130,170,230,0.24)] bg-[rgba(8,16,32,0.9)] px-2 py-1.5 text-[10.5px] font-medium text-foreground outline-none focus:border-[rgba(150,195,255,0.6)]"
      />
      <div className="flex gap-1.5">
        <Btn
          className="flex-1"
          onClick={() => {
            saveExecNotes(text);
            logExecAction("note", "Saved quick note");
            toast.success("Notes saved");
          }}
        >
          Save
        </Btn>
        <Btn tone="graphite" onClick={() => setText("")}>
          Clear
        </Btn>
      </div>
    </div>
  );
});
NotesWidget.displayName = "NotesWidget";

/* --------------------------------- panel ---------------------------------- */

export const ExecutiveRotator: React.FC<{ intervalMs?: number }> = memo(({ intervalMs = 7000 }) => {
  const navigate = useNavigate();
  const feed = useBannerFeed();
  const { demos, products } = useDemoState();
  const { actions, notes, sessionStart } = useExecSignals();

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(sessionStart);
  const [mounted, setMounted] = useState(false);
  const hover = useRef(false);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      if (!hover.current) setIndex((i) => (i + 1) % WIDGETS.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [paused, intervalMs]);

  const go = useCallback(
    (to: string) => {
      logExecAction("nav", `Navigated to ${to}`);
      void navigate({ to });
    },
    [navigate],
  );

  const ctx: Ctx = useMemo(
    () => ({ feed, demos, products, actions, notes, sessionStart, now, go }),
    [feed, demos, products, actions, notes, sessionStart, now, go],
  );

  const widget = WIDGETS[index]!;
  const Icon = widget.icon;
  const openCount = feed.filter((i) => !i.done).length;

  return (
    <section
      onMouseEnter={() => (hover.current = true)}
      onMouseLeave={() => (hover.current = false)}
      className="card-premium overflow-hidden"
    >
      <header className="flex items-center justify-between gap-2 border-b border-[rgba(130,170,230,0.2)] bg-[linear-gradient(180deg,rgba(40,68,120,0.7),rgba(14,26,50,0.5))] px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5 shrink-0", widget.accent)} />
          <h3 className="truncate text-[10px] font-extrabold uppercase tracking-[0.16em] text-foreground/85">
            {widget.title}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-300 tabular-nums">
            {mounted ? new Date(now).toLocaleTimeString([], { hour12: false }) : "--:--:--"}
          </span>
          {openCount > 0 && (
            <span className="rounded-md bg-[linear-gradient(180deg,#e2536b,#a5203a)] px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.3)_inset]">
              {openCount}
            </span>
          )}
        </div>
      </header>

      <div key={widget.id} className="p-2.5" style={{ animation: "exec-in 320ms ease-out both" }}>
        {widget.render(ctx)}
      </div>

      <footer className="flex items-center gap-1.5 border-t border-[rgba(130,170,230,0.18)] px-2 py-1.5">
        <Btn tone="graphite" className="px-1.5 py-1" title="Previous" onClick={() => setIndex((i) => (i - 1 + WIDGETS.length) % WIDGETS.length)}>
          <ChevronLeft className="h-3 w-3" />
        </Btn>
        <Btn tone="graphite" className="px-1.5 py-1" title={paused ? "Resume rotation" : "Pause rotation"} onClick={() => setPaused((p) => !p)}>
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        </Btn>
        <div className="mx-1 flex min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
          {WIDGETS.map((w, i) => (
            <button
              key={w.id}
              type="button"
              aria-label={w.title}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i === index ? "bg-[linear-gradient(90deg,#4f8ff5,#8fd0ff)]" : "bg-white/15 hover:bg-white/30",
              )}
            />
          ))}
        </div>
        <Btn tone="graphite" className="px-1.5 py-1" title="Next" onClick={() => setIndex((i) => (i + 1) % WIDGETS.length)}>
          <ChevronRight className="h-3 w-3" />
        </Btn>
      </footer>
    </section>
  );
});
ExecutiveRotator.displayName = "ExecutiveRotator";

export default ExecutiveRotator;
