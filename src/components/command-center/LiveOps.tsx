/**
 * LIVE OPS WIDGETS — priority, notifications, running pipelines, quick actions,
 * mini analytics and support. Every number is derived from a real signal:
 * the live banner feed, the session action log, the demo-URL health store,
 * TanStack Query pipeline state and browser runtime telemetry.
 */

import React, { memo, useEffect, useMemo, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Cpu,
  FileText,
  Flame,
  Headphones,
  LifeBuoy,
  ListTodo,
  Phone,
  RefreshCw,
  RotateCw,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  completeBannerItem,
  resolveBannerItem,
  useBannerFeed,
  type BannerItem,
} from "@/components/slider-banner/bannerFeed";
import { useDemoState } from "@/components/marketplace/demoUrlStore";
import { logExecAction, useExecSignals } from "./execSignals";
import { useRuntimeStats } from "./useLive";

const Panel = memo<{
  icon: React.ElementType;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}>(({ icon: Icon, title, right, children }) => (
  <section className="rounded-xl border border-primary/30 bg-[linear-gradient(160deg,rgba(56,130,255,0.18),rgba(10,20,40,0.82))] p-2.5 shadow-[0_10px_28px_-18px_rgba(40,120,255,0.9)] transition-colors hover:border-primary-glow/55">
    <header className="mb-2 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary-glow" />
        <h3 className="truncate text-[9.5px] font-bold uppercase tracking-[0.16em] text-foreground/75">
          {title}
        </h3>
      </div>
      {right}
    </header>
    {children}
  </section>
));
Panel.displayName = "Panel";

/* ------------------------------ 1. priority ------------------------------- */

function endOfDay() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export const TodaysPriority = memo(() => {
  const items = useBannerFeed();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const open = items.filter((i) => !i.done);
  const top =
    open.find((i) => i.kind === "alert") ??
    open.find((i) => i.kind === "approval") ??
    open[0] ??
    null;

  const deadline = endOfDay();
  const left = Math.max(0, deadline - (now ?? deadline));
  const hh = String(Math.floor(left / 3600000)).padStart(2, "0");
  const mm = String(Math.floor((left % 3600000) / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const dayPct = now ? Math.round(((86400000 - left) / 86400000) * 100) : 0;

  const critical = top?.kind === "alert";
  const tone = critical
    ? "border-rose-400/45 bg-rose-500/12"
    : top?.kind === "approval"
      ? "border-amber-400/45 bg-amber-400/12"
      : "border-sky-400/45 bg-sky-400/12";

  const act = (label: string, fn?: () => void) => {
    fn?.();
    logExecAction("approval", label, top?.title ?? "");
    toast.success(`${label} · ${top?.title ?? "priority"}`);
  };

  return (
    <Panel
      icon={Flame}
      title="Today's Priority"
      right={
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8.5px] font-bold",
            critical ? "border-rose-400/40 bg-rose-500/15 text-rose-300" : "border-sky-400/40 bg-sky-400/15 text-sky-200",
          )}
        >
          <span className={cn("h-1.5 w-1.5 animate-pulse rounded-full", critical ? "bg-rose-400" : "bg-sky-400")} />
          {critical ? "CRITICAL" : top ? "HIGH" : "CLEAR"}
        </span>
      }
    >
      {top ? (
        <div className={cn("rounded-lg border p-2", tone)}>
          <p className="truncate text-[11px] font-extrabold text-foreground">{top.title}</p>
          <p className="mt-0.5 line-clamp-2 text-[9.5px] text-foreground/70">{top.detail}</p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-foreground/50">Closes in</span>
            <span className="font-mono text-[14px] font-extrabold text-foreground tabular-nums">
              {hh}:{mm}:{ss}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-1000"
              style={{ width: `${dayPct}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {[
              { l: "Approve", i: Check, fn: () => resolveBannerItem(top.id) },
              { l: "Reject", i: X, fn: () => resolveBannerItem(top.id) },
              { l: "Assign", i: Users },
              { l: "Remind", i: Timer },
            ].map((b) => (
              <button
                key={b.l}
                onClick={() => act(b.l, b.fn)}
                className="flex items-center justify-center gap-1 rounded-md border border-white/12 bg-white/[0.07] py-1 text-[9px] font-bold text-foreground/85 transition-all hover:-translate-y-0.5 hover:bg-white/[0.16] active:scale-95"
              >
                <b.i className="h-3 w-3" />
                {b.l}
              </button>
            ))}
          </div>
          <p className="mt-1.5 flex items-start gap-1 text-[9px] text-sky-200/80">
            <Sparkles className="mt-0.5 h-2.5 w-2.5 shrink-0" />
            {open.length} open items in the live feed · {items.filter((i) => i.done).length} resolved this session.
          </p>
        </div>
      ) : (
        <p className="rounded-lg border border-emerald-400/35 bg-emerald-400/10 p-2 text-[10px] font-semibold text-emerald-300">
          Queue clear — no open priorities in the live feed.
        </p>
      )}
    </Panel>
  );
});
TodaysPriority.displayName = "TodaysPriority";

/* ---------------------------- 2. notifications ---------------------------- */

const kindStyle: Record<BannerItem["kind"], string> = {
  alert: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  approval: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  notification: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  todo: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
};

export const LiveNotifications = memo(() => {
  const items = useBannerFeed();
  const [filter, setFilter] = useState<"all" | BannerItem["kind"]>("all");
  const [read, setRead] = useState<string[]>([]);
  const visible = items.filter((i) => !i.done && (filter === "all" || i.kind === filter));
  const unread = visible.filter((i) => !read.includes(i.id)).length;

  return (
    <Panel
      icon={Bell}
      title="Live Notifications"
      right={
        <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[8.5px] font-bold text-white">
          {unread} NEW
        </span>
      }
    >
      <div className="mb-1.5 grid grid-cols-5 gap-1">
        {(["all", "alert", "approval", "notification", "todo"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md border px-0.5 py-0.5 text-[8px] font-bold uppercase transition-colors",
              filter === f
                ? "border-primary-glow/60 bg-primary/30 text-foreground"
                : "border-white/8 bg-white/[0.04] text-foreground/50",
            )}
          >
            {f === "notification" ? "note" : f}
          </button>
        ))}
      </div>
      <div className="max-h-[190px] space-y-1.5 overflow-y-auto pr-0.5">
        {visible.map((n) => (
          <div
            key={n.id}
            className={cn(
              "rounded-lg border px-2 py-1.5 transition-all",
              kindStyle[n.kind],
              read.includes(n.id) && "opacity-55",
            )}
            style={{ animation: "cc-arrive .45s ease-out both" }}
          >
            <div className="flex items-start justify-between gap-1">
              <p className="text-[9px] font-extrabold uppercase tracking-wider">{n.kind}</p>
              <p className="shrink-0 text-[8px] text-foreground/50">{n.meta}</p>
            </div>
            <p className="truncate text-[10.5px] font-bold text-foreground/90">{n.title}</p>
            <p className="line-clamp-2 text-[9px] text-foreground/65">{n.detail}</p>
            <div className="mt-1 flex gap-1">
              {[
                { l: "Approve", i: Check, fn: () => resolveBannerItem(n.id) },
                { l: "Read", i: CheckCircle2, fn: () => setRead((r) => [...r, n.id]) },
                { l: "Archive", i: Archive, fn: () => completeBannerItem(n.id) },
              ].map((b) => (
                <button
                  key={b.l}
                  onClick={() => {
                    b.fn();
                    logExecAction("task", b.l, n.title);
                  }}
                  className="flex flex-1 items-center justify-center gap-0.5 rounded-md border border-white/12 bg-white/[0.07] py-0.5 text-[8.5px] font-bold text-foreground/80 hover:bg-white/[0.16] active:scale-95"
                >
                  <b.i className="h-2.5 w-2.5" />
                  {b.l}
                </button>
              ))}
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <p className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-center text-[10px] text-foreground/55">
            Inbox zero for this filter.
          </p>
        )}
      </div>
    </Panel>
  );
});
LiveNotifications.displayName = "LiveNotifications";

/* ------------------------- 3. running data pipelines ---------------------- */

const PIPELINES = [
  { key: "weather", label: "Weather stream", every: 60_000 },
  { key: "markets", label: "Market feed", every: 60_000 },
  { key: "pulse", label: "Infra probes", every: 30_000 },
] as const;

export const RunningPipelines = memo(() => {
  const qc = useQueryClient();
  const inFlight = useIsFetching();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const rt = useRuntimeStats();

  const rows = PIPELINES.map((p) => {
    const q = qc.getQueryCache().findAll({ queryKey: [p.key] })[0];
    const updated = q?.state.dataUpdatedAt ?? 0;
    const fetching = q?.state.fetchStatus === "fetching";
    const elapsed = now && updated ? now - updated : 0;
    const pct = updated ? Math.min(100, (elapsed / p.every) * 100) : 0;
    const eta = Math.max(0, Math.ceil((p.every - elapsed) / 1000));
    return { ...p, fetching, pct, eta, ok: q?.state.status === "success" };
  });

  return (
    <Panel
      icon={Cpu}
      title="Running Processes"
      right={
        <span className="rounded-md border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[8.5px] font-bold text-sky-200">
          {inFlight} IN FLIGHT
        </span>
      }
    >
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] font-medium text-foreground/80">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    r.fetching ? "animate-pulse bg-sky-400" : r.ok ? "bg-emerald-400" : "bg-amber-400",
                  )}
                />
                {r.label}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-foreground/55 tabular-nums">
                  {r.fetching ? "streaming…" : `ETA ${r.eta}s`}
                </span>
                <button
                  onClick={() => {
                    void qc.refetchQueries({ queryKey: [r.key] });
                    logExecAction("test", "Restart pipeline", r.label);
                  }}
                  className="rounded border border-white/12 bg-white/[0.06] p-0.5 text-foreground/60 hover:text-sky-300"
                  title="Restart"
                >
                  <RotateCw className="h-2.5 w-2.5" />
                </button>
                <button
                  onClick={() => {
                    void qc.cancelQueries({ queryKey: [r.key] });
                    toast.info(`${r.label} cancelled`);
                  }}
                  className="rounded border border-white/12 bg-white/[0.06] p-0.5 text-foreground/60 hover:text-rose-300"
                  title="Cancel"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary-glow transition-[width] duration-200"
                style={{ width: `${r.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {[
          { i: Zap, k: "FPS", v: `${rt.fps}` },
          { i: Cpu, k: "Heap", v: rt.heapUsedMb !== null ? `${rt.heapUsedMb}MB` : "n/a" },
          { i: Wifi, k: "Requests", v: `${rt.resources}` },
        ].map((s) => (
          <div key={s.k} className="rounded-lg border border-white/8 bg-white/[0.04] px-1 py-1 text-center">
            <s.i className="mx-auto mb-0.5 h-3 w-3 text-primary-glow" />
            <p className="text-[8px] uppercase tracking-wider text-foreground/50">{s.k}</p>
            <p className="text-[10px] font-extrabold text-foreground/90 tabular-nums">{s.v}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
});
RunningPipelines.displayName = "RunningPipelines";

/* ----------------------------- 4. support --------------------------------- */

export const SupportCenterLive = memo(() => {
  const { demos } = useDemoState();
  const rt = useRuntimeStats();
  const offline = demos.filter((d) => d.health === "offline").length;
  const slow = demos.filter((d) => d.health === "slow").length;

  const tiles = [
    {
      i: Headphones,
      l: "Live desk",
      s: rt.online ? "Connected" : "Offline",
      c: rt.online ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-rose-400/25 bg-rose-400/10 text-rose-300",
    },
    { i: Bot, l: "Vala AI", s: "Instant reply", c: "border-sky-400/25 bg-sky-400/10 text-sky-200" },
    {
      i: AlertTriangle,
      l: "Open tickets",
      s: `${offline + slow} from health`,
      c: offline ? "border-rose-400/25 bg-rose-400/10 text-rose-300" : "border-amber-400/25 bg-amber-400/10 text-amber-300",
    },
    { i: Phone, l: "Escalate", s: "24×7 hotline", c: "border-sky-400/25 bg-sky-400/10 text-sky-300" },
  ];

  return (
    <Panel icon={LifeBuoy} title="Support Center">
      <div className="grid grid-cols-2 gap-1.5">
        {tiles.map((b) => (
          <button
            key={b.l}
            onClick={() => {
              logExecAction("nav", b.l);
              if (b.l === "Vala AI") {
                (document.querySelector("[data-vala-launcher]") as HTMLButtonElement | null)?.click();
              } else toast.success(`${b.l} · ${b.s}`);
            }}
            className={cn(
              "rounded-lg border px-2 py-2 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98]",
              b.c,
            )}
          >
            <b.i className="mb-1 h-3.5 w-3.5" />
            <p className="text-[10px] font-bold text-foreground/90">{b.l}</p>
            <p className="text-[9px] opacity-80">{b.s}</p>
          </button>
        ))}
      </div>
    </Panel>
  );
});
SupportCenterLive.displayName = "SupportCenterLive";

/* --------------------------- 5. quick actions ----------------------------- */

const QUICK = [
  { i: Users, l: "Add User", k: "U" },
  { i: FileText, l: "New Invoice", k: "I" },
  { i: ListTodo, l: "New Task", k: "T" },
  { i: Bot, l: "Ask Vala", k: "V" },
  { i: RefreshCw, l: "Refresh All", k: "R" },
  { i: Clock3, l: "Log Note", k: "N" },
];

export const QuickActionsLive = memo(() => {
  const qc = useQueryClient();

  const run = (label: string) => {
    if (label === "Refresh All") void qc.refetchQueries();
    if (label === "Ask Vala")
      (document.querySelector("[data-vala-launcher]") as HTMLButtonElement | null)?.click();
    logExecAction("nav", label);
    toast.success(`${label} triggered`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const hit = QUICK.find((a) => a.k.toLowerCase() === e.key.toLowerCase());
      if (hit) {
        e.preventDefault();
        run(hit.l);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Panel icon={Zap} title="Quick Actions">
      <div className="grid grid-cols-2 gap-1.5">
        {QUICK.map((a) => (
          <button
            key={a.l}
            onClick={() => run(a.l)}
            className="group relative flex items-center justify-between gap-1.5 overflow-hidden rounded-lg border border-primary/25 bg-primary/12 px-2 py-1.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary-glow/60 hover:bg-primary/25 active:scale-[0.98]"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="flex min-w-0 items-center gap-1.5">
              <a.i className="h-3.5 w-3.5 shrink-0 text-primary-glow" />
              <span className="truncate text-[10px] font-bold text-foreground/90">{a.l}</span>
            </span>
            <kbd className="shrink-0 rounded border border-white/15 bg-black/30 px-1 text-[8px] text-foreground/55">
              ⌥{a.k}
            </kbd>
          </button>
        ))}
      </div>
    </Panel>
  );
});
QuickActionsLive.displayName = "QuickActionsLive";

/* --------------------------- 6. mini analytics ---------------------------- */

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const pts = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${28 - (v / max) * 26}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-6 w-full">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-glow" />
    </svg>
  );
}

export const MiniAnalyticsLive = memo(() => {
  const { actions } = useExecSignals();
  const items = useBannerFeed();
  const { demos } = useDemoState();
  const rt = useRuntimeStats();

  const buckets = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 12 }).map((_, i) => {
      const from = now - (12 - i) * 5 * 60_000;
      const to = from + 5 * 60_000;
      return actions.filter((a) => a.at >= from && a.at < to).length;
    });
  }, [actions]);

  const working = demos.filter((d) => d.health === "working").length;
  const stats = [
    { k: "Session actions", v: actions.length, d: "live log" },
    { k: "Open items", v: items.filter((i) => !i.done).length, d: "feed" },
    { k: "Resolved", v: items.filter((i) => i.done).length, d: "today" },
    { k: "Demos healthy", v: `${working}/${demos.length}`, d: "validated" },
    { k: "Render FPS", v: rt.fps, d: rt.fps >= 50 ? "smooth" : "watch" },
    { k: "Net RTT", v: rt.rtt !== null ? `${rt.rtt}ms` : "—", d: rt.effectiveType },
  ];

  return (
    <Panel icon={TrendingUp} title="Mini Analytics">
      <div className="mb-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1">
        <p className="text-[8.5px] uppercase tracking-wider text-foreground/50">Actions · last 60 min</p>
        <Spark values={buckets} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {stats.map((m) => (
          <div
            key={m.k}
            className="rounded-lg border border-white/8 bg-white/[0.04] px-2 py-1.5 transition-colors hover:border-primary-glow/45"
          >
            <p className="truncate text-[8.5px] uppercase tracking-wider text-foreground/50">{m.k}</p>
            <p className="mt-0.5 text-[14px] font-extrabold leading-none tracking-tight text-foreground tabular-nums">
              {m.v}
            </p>
            <p className="text-[9px] font-bold text-emerald-300">{m.d}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
});
MiniAnalyticsLive.displayName = "MiniAnalyticsLive";
