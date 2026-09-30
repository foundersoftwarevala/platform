/**
 * PREMIUM ENTERPRISE COMMAND CENTER (RIGHT PANEL)
 * Full-height, zero empty space, 10 dense sections.
 */

import React, { memo, useCallback, useState } from "react";
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
  ArrowRightLeft,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Divide,
  Info,
  ListTodo,
  Mic,
  Percent,
} from "lucide-react";
import mascot from "@/assets/vala-ai-agent.png";
import { useNavigate } from "@tanstack/react-router";
import { useCockpitFigures } from "@/lib/control-panel/use-cockpit";
import { useBannerFeed } from "@/components/slider-banner/bannerFeed";

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

/* ------------------------------ 2. calendar ------------------------------- */

/**
 * The executive calendar. It listed three meetings ("Board sync — Q3
 * revenue", ...) and a holiday four days away, none of which existed - the
 * platform keeps no calendar. What it does keep is work with a deadline, so
 * the agenda is the viewer's own open tasks, soonest first, and the counts are
 * the Task Manager's.
 */
const ExecCalendar = memo(() => {
  const navigate = useNavigate();
  const feed = useBannerFeed();
  const cockpit = useCockpitFigures();
  const f = cockpit.data;
  const agenda = feed.items.filter((i) => i.kind === "todo" && i.at).slice(0, 3);
  const figure = (n: number | undefined) => (n == null ? "—" : String(n));
  const today = new Date().toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
  return (
    <Panel
      icon={CalendarDays}
      title="AI Executive Calendar"
      right={
        <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300">
          {today.toUpperCase()}
        </span>
      }
    >
      <div className="space-y-1.5">
        {agenda.length ? (
          agenda.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => void navigate({ to: m.href })}
              className="flex w-full items-center gap-2 rounded-lg border border-white/6 bg-white/[0.04] px-2 py-1.5 text-left transition-colors hover:bg-white/[0.09]"
            >
              <span className="rounded-md bg-primary/25 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-primary-glow">
                {new Date(m.at as string).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
              </span>
              <span className="truncate text-[10.5px] font-medium text-foreground/85">{m.title}</span>
            </button>
          ))
        ) : (
          <p className="rounded-lg border border-white/6 bg-white/[0.04] px-2 py-1.5 text-[10px] text-foreground/60">
            {feed.loading ? "Loading your tasks…" : "No task with a deadline is assigned to you."}
          </p>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <Row label="Tasks due today" value={figure(f?.tasks_due_today)} tone="warn" icon={ListTodo} />
        <Row label="Due this week" value={figure(f?.tasks_due_week)} tone="info" icon={CalendarDays} />
        <Row label="Completed today" value={figure(f?.tasks_completed_today)} tone="ok" icon={CheckCircle2} />
      </div>
    </Panel>
  );
});
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

/* --------------------------- 10. founder AI card -------------------------- */

/**
 * The Founder AI card. Its "smart insight" was a sentence typed into the page
 * (an APAC margin, two onboardings) and its chips only echoed their own names.
 * The line is now the platform's own open work, and each chip opens the screen
 * that does that job.
 */
const FOUNDER_CHIPS: { label: string; to: string | null }[] = [
  { label: "Daily brief", to: "/ai-ceo" },
  { label: "Risk scan", to: "/ai-ceo/insights" },
  { label: "Cash flow", to: "/finance-manager" },
  // No hiring system is connected to the platform.
  { label: "Hire plan", to: null },
];

const FounderAI = memo(() => {
  const navigate = useNavigate();
  const cockpit = useCockpitFigures();
  const f = cockpit.data;
  const insight = f
    ? `${f.role_applications ?? "?"} applications waiting · ${f.alerts.critical} critical alerts · ${f.tickets_open} open tickets.`
    : cockpit.isError
      ? "The platform figures could not be read."
      : "Reading the platform…";
  return (
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
          AI CEO
        </span>
        <p className="mt-1 text-[9.5px] leading-snug text-foreground/70">{insight}</p>
      </div>
    </div>
    <div className="relative mt-2 flex flex-wrap gap-1">
      {FOUNDER_CHIPS.map(({ label: s, to }) => (
        <button
          key={s}
          type="button"
          onClick={() =>
            to
              ? void navigate({ to })
              : toast.info("No hiring system is connected", {
                  description: "There is nothing to plan hiring from yet.",
                })
          }
          className="rounded-full border border-white/12 bg-white/[0.07] px-2 py-0.5 text-[9px] font-semibold text-foreground/80 transition-colors hover:bg-white/[0.15]"
        >
          {s}
        </button>
      ))}
    </div>
    <button
      onClick={() =>
        // Nothing listens. Speech capture is not wired to the command palette,
        // and claiming otherwise left people talking at a dead microphone.
        toast.info("Voice command is not available yet", {
          description: "Use the command palette or the shortcuts above.",
        })
      }
      className="relative mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary via-accent to-primary-glow py-1.5 text-[10.5px] font-extrabold text-white shadow-[0_10px_24px_-12px_rgba(60,160,255,0.9)] transition-transform active:scale-[0.98]"
    >
      <Mic className="h-3.5 w-3.5" />
      Voice Command
    </button>
  </section>
  );
});
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
