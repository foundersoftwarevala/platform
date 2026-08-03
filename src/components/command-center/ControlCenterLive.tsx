/**
 * CONTROL CENTER (LIVE) — real infrastructure telemetry.
 * Server-side probes (edge runtime, weather API, market API, AI gateway) plus
 * real browser runtime metrics: FPS, JS heap, network downlink/RTT, resource
 * transfer, DOM size, long tasks. Nothing here is fabricated.
 */

import React, { memo } from "react";
import {
  Activity,
  Brain,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  Radio,
  Signal,
  Wifi,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRuntimeStats, useSystemPulse } from "./useLive";

const Live = ({ ok }: { ok: boolean }) => (
  <span className="relative flex h-1.5 w-1.5">
    <span
      className={cn(
        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-70",
        ok ? "bg-emerald-400" : "bg-rose-400",
      )}
    />
    <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-400" : "bg-rose-400")} />
  </span>
);

const Line = ({
  icon: Icon,
  label,
  value,
  ok = true,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  ok?: boolean;
}) => (
  <div className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.04] px-2 py-1.5">
    <span className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-3 w-3 shrink-0 text-foreground/55" />
      <span className="truncate text-[10.5px] font-medium text-foreground/80">{label}</span>
    </span>
    <span className="flex shrink-0 items-center gap-1.5">
      <Live ok={ok} />
      <span className={cn("text-[10px] font-extrabold tabular-nums", ok ? "text-emerald-300" : "text-rose-300")}>
        {value}
      </span>
    </span>
  </div>
);

const Meter = ({ label, pct, unit }: { label: string; pct: number; unit: string }) => {
  const tone = pct > 85 ? "from-rose-500 to-red-400" : pct > 60 ? "from-amber-400 to-orange-300" : "from-emerald-400 to-teal-300";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-medium text-foreground/70">{label}</span>
        <span className="text-[9.5px] font-bold text-foreground/85 tabular-nums">{unit}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-500", tone)}
          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
        />
      </div>
    </div>
  );
};

export const ControlCenterLive = memo(() => {
  const { data: pulse, isFetching } = useSystemPulse();
  const rt = useRuntimeStats();

  return (
    <section className="rounded-xl border border-primary/30 bg-[linear-gradient(160deg,rgba(56,130,255,0.18),rgba(10,20,40,0.82))] p-2.5 shadow-[0_10px_28px_-18px_rgba(40,120,255,0.9)]">
      <header className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-primary-glow" />
          <h3 className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-foreground/75">
            Control Center · Live
          </h3>
        </div>
        <span className="flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-300">
          <Live ok={!!pulse?.ok} />
          {isFetching ? "SYNCING" : "STREAMING"}
        </span>
      </header>

      <div className="space-y-1">
        <Line
          icon={Radio}
          label={`Edge runtime · ${pulse?.region ?? "—"}`}
          value={pulse?.ok ? "ONLINE" : "PROBING"}
          ok={!!pulse?.ok}
        />
        <Line
          icon={Database}
          label="Weather data plane"
          value={pulse ? `${pulse.weatherApi.ms}ms` : "—"}
          ok={pulse?.weatherApi.up ?? false}
        />
        <Line
          icon={Zap}
          label="Market data plane"
          value={pulse ? `${pulse.marketApi.ms}ms` : "—"}
          ok={pulse?.marketApi.up ?? false}
        />
        <Line
          icon={Brain}
          label="AI gateway"
          value={pulse ? `${pulse.aiGateway.ms}ms` : "—"}
          ok={pulse?.aiGateway.up ?? false}
        />
        <Line
          icon={Wifi}
          label={`Network · ${rt.effectiveType}`}
          value={rt.online ? `${rt.downlink ?? "—"} Mb/s` : "OFFLINE"}
          ok={rt.online}
        />
        <Line icon={Signal} label="Client RTT" value={rt.rtt !== null ? `${rt.rtt}ms` : "—"} ok={(rt.rtt ?? 0) < 300} />
        <Line icon={Cpu} label={`Threads available`} value={`${rt.cores || "—"}`} ok={rt.cores > 0} />
      </div>

      <div className="mt-2 space-y-1.5">
        <Meter label="Render performance" pct={Math.min(100, (rt.fps / 60) * 100)} unit={`${rt.fps} FPS`} />
        {rt.memoryPct !== null && (
          <Meter
            label="JS heap"
            pct={rt.memoryPct}
            unit={`${rt.heapUsedMb}/${rt.heapLimitMb} MB`}
          />
        )}
        <Meter
          label="Asset transfer"
          pct={Math.min(100, rt.transferredKb / 40)}
          unit={`${rt.transferredKb} KB · ${rt.resources} req`}
        />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1">
        {[
          { i: Activity, k: "Session", v: `${Math.floor(rt.uptimeSec / 60)}m ${rt.uptimeSec % 60}s` },
          { i: HardDrive, k: "DOM", v: `${rt.domNodes}` },
          { i: Cpu, k: "Long tasks", v: `${rt.longTasks}` },
        ].map((s) => (
          <div key={s.k} className="rounded-lg border border-white/8 bg-white/[0.04] px-1 py-1 text-center">
            <s.i className="mx-auto mb-0.5 h-3 w-3 text-primary-glow" />
            <p className="text-[8px] uppercase tracking-wider text-foreground/50">{s.k}</p>
            <p className="text-[10px] font-extrabold text-foreground/90 tabular-nums">{s.v}</p>
          </div>
        ))}
      </div>
    </section>
  );
});
ControlCenterLive.displayName = "ControlCenterLive";
