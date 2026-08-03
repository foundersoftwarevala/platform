/**
 * PREMIUM ENTERPRISE COMMAND CENTER (RIGHT PANEL)
 * Full-height, zero empty space, 10 dense sections.
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WeatherEngine } from "./WeatherEngine";
import { LiveClock } from "./LiveClock";
import { GlobalMarkets } from "./GlobalMarkets";
import { ControlCenterLive } from "./ControlCenterLive";
import {
  TodaysPriority,
  LiveNotifications,
  RunningPipelines,
  SupportCenterLive,
  QuickActionsLive,
  MiniAnalyticsLive,
} from "./LiveOps";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  Bot,
  Brain,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Clock,
  Cloud,
  Cpu,
  Database,
  Divide,
  FileText,
  Gauge,
  HardDrive,
  Headphones,
  Info,
  LifeBuoy,
  ListTodo,
  Mic,
  Percent,
  Phone,
  PlusCircle,
  RefreshCw,
  Rocket,
  Server,
  Shield,
  ShieldAlert,
  Sparkles,
  Terminal,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import mascot from "@/assets/vala-ai-agent.png";

/* ---------------------------------- shell --------------------------------- */

const Panel = memo<{
  icon: React.ElementType;
  title: string;
  accent?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}>(({ icon: Icon, title, accent = "text-primary-glow", right, children }) => (
  <section className="rounded-xl border border-primary/30 bg-[linear-gradient(160deg,rgba(56,130,255,0.18),rgba(10,20,40,0.78))] p-2.5 shadow-[0_10px_28px_-18px_rgba(40,120,255,0.9)] transition-colors hover:border-primary-glow/55">
    <header className="mb-2 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", accent)} />
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

const Row = memo<{
  label: string;
  value: React.ReactNode;
  tone?: "ok" | "warn" | "bad" | "info";
  icon?: React.ElementType;
  onClick?: () => void;
}>(({ label, value, tone = "info", icon: Icon, onClick }) => {
  const toneText = {
    ok: "text-emerald-300",
    warn: "text-amber-300",
    bad: "text-rose-300",
    info: "text-sky-300",
  }[tone];
  const dot = {
    ok: "bg-emerald-400",
    warn: "bg-amber-400",
    bad: "bg-rose-400",
    info: "bg-sky-400",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.04] px-2 py-1.5 text-left transition-all hover:border-primary-glow/45 hover:bg-white/[0.09] active:scale-[0.99]"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {Icon ? (
          <Icon className="h-3 w-3 shrink-0 text-foreground/55" />
        ) : (
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
        )}
        <span className="truncate text-[10.5px] font-medium text-foreground/80">{label}</span>
      </span>
      <span className={cn("shrink-0 text-[10px] font-extrabold tracking-tight", toneText)}>
        {value}
      </span>
    </button>
  );
});
Row.displayName = "Row";

const Bar = memo<{ label: string; pct: number; tone?: "ok" | "warn" | "bad" }>(
  ({ label, pct, tone = "ok" }) => {
    const fill = {
      ok: "bg-gradient-to-r from-emerald-400 to-teal-300",
      warn: "bg-gradient-to-r from-amber-400 to-orange-300",
      bad: "bg-gradient-to-r from-rose-500 to-red-400",
    }[tone];
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-[10px] font-medium text-foreground/75">{label}</span>
          <span className="text-[9.5px] font-bold text-foreground/60">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700", fill)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  },
);
Bar.displayName = "Bar";

/* ------------------------------ 1. time / wx ------------------------------ */

const TimeWeather = memo(() => {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const local = now ? now.toLocaleTimeString([], { hour12: false }) : "--:--:--";
  const utc = now ? now.toUTCString().slice(17, 25) : "--:--:--";
  const date = now
    ? now.toLocaleDateString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";


  return (
    <Panel icon={Clock} title="Live Time & Weather">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-primary/25 bg-primary/12 p-2">
          <p className="text-[9px] uppercase tracking-wider text-foreground/55">Local</p>
          <p className="font-mono text-[19px] font-extrabold leading-tight tracking-tight text-foreground tabular-nums">
            {local}
          </p>
          <p className="mt-0.5 text-[9.5px] font-medium text-foreground/60">{date}</p>
        </div>
        <div className="rounded-lg border border-sky-400/25 bg-sky-400/10 p-2">
          <div className="flex items-center gap-1.5">
            <Cloud className="h-4 w-4 text-sky-300" />
            <p className="text-[19px] font-extrabold leading-tight text-foreground">27°C</p>
          </div>
          <p className="text-[9.5px] font-medium text-foreground/60">Partly cloudy · Surat</p>
          <p className="text-[9px] text-foreground/45">H 33° · L 24° · AQI 62</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {[
          { k: "UTC", v: utc },
          { k: "NY", v: now ? new Date(now.getTime() - 5.5 * 36e5 - 4.5 * 36e5).toLocaleTimeString([], { hour12: false }).slice(0, 5) : "--:--" },
          { k: "LDN", v: now ? new Date(now.getTime() - 4.5 * 36e5).toLocaleTimeString([], { hour12: false }).slice(0, 5) : "--:--" },

        ].map((c) => (
          <div key={c.k} className="rounded-lg border border-white/8 bg-white/[0.04] px-1.5 py-1 text-center">
            <p className="text-[8.5px] uppercase tracking-wider text-foreground/50">{c.k}</p>
            <p className="font-mono text-[11px] font-bold text-foreground/85 tabular-nums">{c.v}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {[
          { k: "Systems", v: "OK", c: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10" },
          { k: "AI", v: "LIVE", c: "text-sky-200 border-sky-400/30 bg-sky-400/10" },
          { k: "Alerts", v: "3", c: "text-amber-300 border-amber-400/30 bg-amber-400/10" },
        ].map((s) => (
          <div key={s.k} className={cn("rounded-lg border px-1.5 py-1 text-center", s.c)}>
            <p className="text-[8.5px] uppercase tracking-wider opacity-75">{s.k}</p>
            <p className="text-[10.5px] font-extrabold">{s.v}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
});
TimeWeather.displayName = "TimeWeather";

/* ------------------------------ 2. calendar ------------------------------- */

const ExecCalendar = memo(() => (
  <Panel
    icon={CalendarDays}
    title="AI Executive Calendar"
    right={
      <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300">
        HOLIDAY IN 4D
      </span>
    }
  >
    <div className="space-y-1.5">
      {[
        { t: "09:30", n: "Board sync — Q3 revenue", tone: "ok" as const },
        { t: "11:00", n: "Vala AI roadmap review", tone: "info" as const },
        { t: "14:15", n: "Franchise expansion call", tone: "warn" as const },
      ].map((m) => (
        <div
          key={m.t}
          className="flex items-center gap-2 rounded-lg border border-white/6 bg-white/[0.04] px-2 py-1.5 transition-colors hover:bg-white/[0.09]"
        >
          <span className="rounded-md bg-primary/25 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-primary-glow">
            {m.t}
          </span>
          <span className="truncate text-[10.5px] font-medium text-foreground/85">{m.n}</span>
        </div>
      ))}
    </div>
    <div className="mt-2 space-y-1">
      <Row label="Tasks due today" value="7" tone="warn" icon={ListTodo} />
      <Row label="Events this week" value="18" tone="info" icon={CalendarDays} />
      <Row label="Completed today" value="12" tone="ok" icon={CheckCircle2} />
    </div>
  </Panel>
));
ExecCalendar.displayName = "ExecCalendar";

/* ----------------------------- 3. calculator ------------------------------ */

type CalcMode = "basic" | "sci" | "fx" | "pct";

const EnterpriseCalculator = memo(() => {
  const [mode, setMode] = useState<CalcMode>("basic");
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("0");
  const [amount, setAmount] = useState("1000");
  const [rate] = useState(83.4);
  const [base, setBase] = useState("2500");
  const [pct, setPct] = useState("18");

  const press = useCallback((k: string) => {
    if (k === "C") {
      setExpr("");
      setResult("0");
      return;
    }
    if (k === "=") {
      try {
        const safe = expr.replace(/[^0-9+\-*/().%\s]/g, "");
        // eslint-disable-next-line no-new-func
        const out = Function(`"use strict";return (${safe || 0})`)();
        setResult(String(Number(out).toFixed(4)).replace(/\.?0+$/, ""));
      } catch {
        setResult("Error");
      }
      return;
    }
    setExpr((e) => e + k);
  }, [expr]);

  const sci = useCallback((fn: "sin" | "cos" | "tan" | "log" | "sqrt" | "pow") => {
    const n = Number(result) || Number(expr) || 0;
    const map = {
      sin: Math.sin(n),
      cos: Math.cos(n),
      tan: Math.tan(n),
      log: Math.log10(Math.max(n, 1e-12)),
      sqrt: Math.sqrt(Math.abs(n)),
      pow: n * n,
    };
    setResult(String(Number(map[fn].toFixed(6))));
  }, [result, expr]);

  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"];

  return (
    <Panel icon={Calculator} title="Enterprise Calculator">
      <div className="mb-2 grid grid-cols-4 gap-1">
        {(
          [
            ["basic", Calculator],
            ["sci", Divide],
            ["fx", ArrowRightLeft],
            ["pct", Percent],
          ] as [CalcMode, React.ElementType][]
        ).map(([m, Icon]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex items-center justify-center gap-1 rounded-md border px-1 py-1 text-[9px] font-bold uppercase transition-all",
              mode === m
                ? "border-primary-glow/60 bg-primary/35 text-foreground"
                : "border-white/8 bg-white/[0.04] text-foreground/55 hover:bg-white/[0.09]",
            )}
          >
            <Icon className="h-3 w-3" />
            {m}
          </button>
        ))}
      </div>

      {(mode === "basic" || mode === "sci") && (
        <>
          <div className="mb-1.5 rounded-lg border border-white/8 bg-black/35 px-2 py-1.5 text-right">
            <p className="truncate font-mono text-[10px] text-foreground/50">{expr || "—"}</p>
            <p className="truncate font-mono text-[17px] font-extrabold text-foreground tabular-nums">{result}</p>
          </div>
          {mode === "sci" && (
            <div className="mb-1.5 grid grid-cols-6 gap-1">
              {(["sin", "cos", "tan", "log", "sqrt", "pow"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => sci(f)}
                  className="rounded-md border border-sky-400/25 bg-sky-400/10 py-1 text-[8.5px] font-bold text-sky-200 transition-colors hover:bg-sky-400/20"
                >
                  {f}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-4 gap-1">
            {keys.map((k) => (
              <button
                key={k}
                onClick={() => press(k)}
                className={cn(
                  "rounded-md py-1.5 text-[11px] font-bold transition-all active:scale-95",
                  k === "="
                    ? "bg-gradient-to-br from-primary to-accent text-white"
                    : "border border-white/8 bg-white/[0.05] text-foreground/85 hover:bg-white/[0.12]",
                )}
              >
                {k}
              </button>
            ))}
            <button
              onClick={() => press("C")}
              className="col-span-4 rounded-md border border-rose-400/30 bg-rose-500/15 py-1 text-[10px] font-bold text-rose-300 transition-colors hover:bg-rose-500/25"
            >
              CLEAR
            </button>
          </div>
        </>
      )}

      {mode === "fx" && (
        <div className="space-y-1.5">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-md border border-white/10 bg-black/35 px-2 py-1.5 text-[12px] font-bold text-foreground outline-none focus:border-primary-glow/60"
          />
          <div className="flex items-center justify-between rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-1.5">
            <span className="text-[10px] font-semibold text-foreground/70">USD → INR @ {rate}</span>
            <span className="text-[13px] font-extrabold text-emerald-300">
              ₹{((Number(amount) || 0) * rate).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center">
            {[
              { k: "EUR", v: 0.92 },
              { k: "GBP", v: 0.79 },
              { k: "AED", v: 3.67 },
            ].map((c) => (
              <div key={c.k} className="rounded-md border border-white/8 bg-white/[0.04] px-1 py-1">
                <p className="text-[8.5px] text-foreground/50">{c.k}</p>
                <p className="text-[10px] font-bold text-foreground/85">
                  {((Number(amount) || 0) * c.v).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "pct" && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-md border border-white/10 bg-black/35 px-2 py-1.5 text-[11px] font-bold text-foreground outline-none focus:border-primary-glow/60"
            />
            <input
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-md border border-white/10 bg-black/35 px-2 py-1.5 text-[11px] font-bold text-foreground outline-none focus:border-primary-glow/60"
            />
          </div>
          <Row
            label={`${pct}% of ${base}`}
            value={((Number(base) || 0) * (Number(pct) || 0)) / 100}
            tone="ok"
          />
          <Row
            label="After increase"
            value={(Number(base) || 0) * (1 + (Number(pct) || 0) / 100)}
            tone="info"
          />
          <Row
            label="After discount"
            value={(Number(base) || 0) * (1 - (Number(pct) || 0) / 100)}
            tone="warn"
          />
        </div>
      )}
    </Panel>
  );
});
EnterpriseCalculator.displayName = "EnterpriseCalculator";

/* --------------------------- 4. control center ---------------------------- */

const ControlCenter = memo(() => (
  <Panel icon={Gauge} title="Control Center">
    <div className="space-y-1">
      <Row label="System" value="OPERATIONAL" tone="ok" icon={Activity} />
      <Row label="Servers (12 nodes)" value="ONLINE" tone="ok" icon={Server} />
      <Row label="Database" value="98% HEALTHY" tone="ok" icon={Database} />
      <Row label="AI Engine" value="RUNNING" tone="info" icon={Brain} />
      <Row label="Queue" value="45 JOBS" tone="warn" icon={Terminal} />
      <Row label="API Gateway" value="132ms" tone="ok" icon={Zap} />
      <Row label="Security" value="PROTECTED" tone="ok" icon={Shield} />
    </div>
  </Panel>
));
ControlCenter.displayName = "ControlCenter";

/* ---------------------------- 5. notifications ---------------------------- */

const NOTIF = [
  { i: ShieldAlert, t: "Founder Alert", m: "Board deck approval pending", c: "text-cyan-300 border-cyan-400/25 bg-cyan-400/10" },
  { i: AlertTriangle, t: "Critical", m: "Node-07 CPU at 91%", c: "text-rose-300 border-rose-400/25 bg-rose-400/10" },
  { i: FileText, t: "Approvals", m: "6 requests awaiting sign-off", c: "text-amber-300 border-amber-400/25 bg-amber-400/10" },
  { i: Sparkles, t: "AI Suggests", m: "Shift 12% budget to APAC ads", c: "text-sky-200 border-sky-400/25 bg-sky-400/10" },
  { i: Shield, t: "Security", m: "2 logins from new devices", c: "text-sky-300 border-sky-400/25 bg-sky-400/10" },
];

const Notifications = memo(() => (
  <Panel
    icon={Bell}
    title="Live Notifications"
    right={
      <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[8.5px] font-bold text-white">5 NEW</span>
    }
  >
    <div className="space-y-1.5">
      {NOTIF.map((n) => (
        <button
          key={n.t}
          onClick={() => toast.info(`${n.t}: ${n.m}`)}
          className={cn(
            "flex w-full items-start gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-transform hover:translate-x-0.5",
            n.c,
          )}
        >
          <n.i className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[9.5px] font-extrabold uppercase tracking-wider">{n.t}</span>
            <span className="block truncate text-[10px] text-foreground/75">{n.m}</span>
          </span>
        </button>
      ))}
    </div>
  </Panel>
));
Notifications.displayName = "Notifications";

/* ------------------------------ 6. support -------------------------------- */

const SupportCenter = memo(() => (
  <Panel icon={LifeBuoy} title="Support Center">
    <div className="grid grid-cols-2 gap-1.5">
      {[
        { i: Headphones, l: "Live Support", s: "3 online", c: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" },
        { i: Bot, l: "AI Assistant", s: "Instant", c: "border-sky-400/25 bg-sky-400/10 text-sky-200" },
        { i: Users, l: "Team Chat", s: "12 active", c: "border-sky-400/25 bg-sky-400/10 text-sky-300" },
        { i: Phone, l: "Emergency", s: "24×7", c: "border-rose-400/25 bg-rose-400/10 text-rose-300" },
      ].map((b) => (
        <button
          key={b.l}
          onClick={() => toast.success(`Opening ${b.l}`)}
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
));
SupportCenter.displayName = "SupportCenter";

/* -------------------------- 7. running processes -------------------------- */

const RunningProcesses = memo(() => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 4000);
    return () => clearInterval(t);
  }, []);

  const jitter = useMemo(() => (tick * 7) % 9, [tick]);

  return (
    <Panel icon={Cpu} title="Running Processes">
      <div className="space-y-1.5">
        <Bar label="Background jobs (18)" pct={62 + jitter} />
        <Bar label="Queue processing" pct={45 + jitter} tone="warn" />
        <Bar label="Database backup" pct={88} />
        <Bar label="AI model training" pct={34 + jitter} tone="warn" />
        <Bar label="Cache refresh" pct={96} />
        <Bar label="Deployment #4521" pct={71} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {[
          { i: HardDrive, k: "Storage", v: "38%" },
          { i: Activity, k: "Memory", v: `${58 + jitter}%` },
          { i: Cpu, k: "CPU", v: `${32 + jitter}%` },
        ].map((s) => (
          <div key={s.k} className="rounded-lg border border-white/8 bg-white/[0.04] px-1.5 py-1.5 text-center">
            <s.i className="mx-auto mb-0.5 h-3 w-3 text-primary-glow" />
            <p className="text-[8.5px] uppercase tracking-wider text-foreground/50">{s.k}</p>
            <p className="text-[11px] font-extrabold text-foreground/90">{s.v}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
});
RunningProcesses.displayName = "RunningProcesses";

/* ---------------------------- 8. quick actions ---------------------------- */

const QUICK = [
  { i: Users, l: "Add User" },
  { i: PlusCircle, l: "New Company" },
  { i: FileText, l: "New Invoice" },
  { i: ListTodo, l: "New Task" },
  { i: Brain, l: "Launch AI" },
  { i: RefreshCw, l: "Backup Now" },
  { i: Terminal, l: "Command ⌘K" },
];

const QuickActionsGrid = memo(() => (
  <Panel icon={Zap} title="Quick Actions">
    <div className="grid grid-cols-2 gap-1.5">
      {QUICK.map((a, idx) => (
        <button
          key={a.l}
          onClick={() => toast.success(`${a.l} triggered`)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/12 px-2 py-1.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary-glow/60 hover:bg-primary/25 active:scale-[0.98]",
            idx === QUICK.length - 1 && "col-span-2 justify-center",
          )}
        >
          <a.i className="h-3.5 w-3.5 shrink-0 text-primary-glow" />
          <span className="truncate text-[10px] font-bold text-foreground/90">{a.l}</span>
        </button>
      ))}
    </div>
  </Panel>
));
QuickActionsGrid.displayName = "QuickActionsGrid";

/* --------------------------- 9. mini analytics ---------------------------- */

const MiniAnalytics = memo(() => (
  <Panel icon={TrendingUp} title="Mini Analytics">
    <div className="grid grid-cols-2 gap-1.5">
      {[
        { i: Wallet, k: "Revenue Today", v: "₹2.4L", d: "+12%", ok: true },
        { i: Users, k: "Active Users", v: "2,847", d: "+4.1%", ok: true },
        { i: FileText, k: "New Orders", v: "184", d: "+9%", ok: true },
        { i: PlusCircle, k: "New Customers", v: "37", d: "-3%", ok: false },
        { i: TrendingUp, k: "Growth", v: "18%", d: "MoM", ok: true },
        { i: Gauge, k: "Server Load", v: "32%", d: "stable", ok: true },
      ].map((m) => (
        <div
          key={m.k}
          className="rounded-lg border border-white/8 bg-white/[0.04] px-2 py-1.5 transition-colors hover:border-primary-glow/45"
        >
          <div className="flex items-center gap-1">
            <m.i className="h-3 w-3 text-primary-glow" />
            <p className="truncate text-[8.5px] uppercase tracking-wider text-foreground/50">{m.k}</p>
          </div>
          <p className="mt-0.5 text-[14px] font-extrabold leading-none tracking-tight text-foreground">{m.v}</p>
          <p className={cn("text-[9px] font-bold", m.ok ? "text-emerald-300" : "text-rose-300")}>{m.d}</p>
        </div>
      ))}
    </div>
  </Panel>
));
MiniAnalytics.displayName = "MiniAnalytics";

/* --------------------------- 10. founder AI card -------------------------- */

const FounderAI = memo(() => (
  <section className="relative overflow-hidden rounded-xl border border-primary-glow/45 bg-[linear-gradient(150deg,rgba(56,130,255,0.38),rgba(90,200,255,0.20),rgba(6,14,30,0.94))] p-2.5 shadow-[0_18px_44px_-20px_rgba(60,160,255,0.95)]">
    <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary-glow/35 blur-3xl" />
    <div className="relative flex items-start gap-2">
      <img
        src={mascot}
        alt="Founder AI assistant robot"
        loading="lazy"
        width={912}
        height={1104}
        className="h-16 w-14 shrink-0 rounded-lg object-cover object-top drop-shadow-[0_8px_18px_rgba(50,140,255,0.6)]"
      />
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold tracking-tight text-foreground">Founder AI Assistant</p>
        <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/12 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          ONLINE · GPT-CLASS
        </span>
        <p className="mt-1 text-[9.5px] leading-snug text-foreground/70">
          Smart insight: APAC franchise margin up 15% — approve 2 pending onboardings today.
        </p>
      </div>
    </div>
    <div className="relative mt-2 flex flex-wrap gap-1">
      {["Daily brief", "Risk scan", "Cash flow", "Hire plan"].map((s) => (
        <button
          key={s}
          onClick={() => toast.info(`AI: ${s}`)}
          className="rounded-full border border-white/12 bg-white/[0.07] px-2 py-0.5 text-[9px] font-semibold text-foreground/80 transition-colors hover:bg-white/[0.15]"
        >
          {s}
        </button>
      ))}
    </div>
    <button
      onClick={() => toast.success("Voice command listening…")}
      className="relative mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary via-accent to-primary-glow py-1.5 text-[10.5px] font-extrabold text-white shadow-[0_10px_24px_-12px_rgba(60,160,255,0.9)] transition-transform active:scale-[0.98]"
    >
      <Mic className="h-3.5 w-3.5" />
      Voice Command
    </button>
  </section>
));
FounderAI.displayName = "FounderAI";

/* --------------------------------- export --------------------------------- */

export const CommandCenter: React.FC = memo(() => (
  <div className="flex flex-col gap-2 p-2">
    <WeatherEngine />
    <LiveClock />
    <TodaysPriority />
    <ExecCalendar />
    <EnterpriseCalculator />
    <ControlCenterLive />
    <GlobalMarkets />
    <LiveNotifications />
    <SupportCenterLive />
    <RunningPipelines />
    <QuickActionsLive />
    <MiniAnalyticsLive />
    <FounderAI />
    <p className="pb-1 text-center text-[8.5px] uppercase tracking-[0.2em] text-foreground/35">
      <Info className="mr-1 inline h-2.5 w-2.5" />
      Live Operations Center · real-time feeds
    </p>
  </div>
));

CommandCenter.displayName = "CommandCenter";

export default CommandCenter;
