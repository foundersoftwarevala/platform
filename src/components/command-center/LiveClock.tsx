/**
 * LIVE CLOCK — real millisecond precision, timezone selector, business-hours
 * status, ISO week, holiday/working-day awareness, smooth animated dial.
 */

import React, { memo, useMemo, useState } from "react";
import { Clock, Globe2, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveClock } from "./useLive";

const ZONES = [
  { k: "Local", tz: "UTC" },
  { k: "UTC", tz: "UTC" },
  { k: "NY", tz: "America/New_York" },
  { k: "LDN", tz: "Europe/London" },
  { k: "DXB", tz: "Asia/Dubai" },
  { k: "TYO", tz: "Asia/Tokyo" },
  { k: "SGP", tz: "Asia/Singapore" },
];


function partsIn(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return p as Record<string, string>;
}

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - start.getTime()) / 86400000 + 1) / 7);
}

export const LiveClock = memo(() => {
  const now = useLiveClock(50);
  const [tz, setTz] = useState("UTC");
  const [zoneKey, setZoneKey] = useState("Local");

  // Resolve the visitor's real timezone only after hydration so SSR and the
  // first client render produce identical markup.
  React.useEffect(() => {
    setTz((current) => {
      if (zoneKey !== "Local") return current;
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneKey]);


  const p = useMemo(() => (now ? partsIn(now, tz) : null), [now, tz]);
  const ms = now ? String(now.getMilliseconds()).padStart(3, "0") : "---";
  const hourNum = p ? Number(p["hour"]) : 0;
  const weekend = p ? p["weekday"] === "Sat" || p["weekday"] === "Sun" : false;
  const office = !weekend && hourNum >= 9 && hourNum < 19;
  const secAngle = now ? (now.getSeconds() + now.getMilliseconds() / 1000) * 6 : 0;
  const minAngle = now ? (now.getMinutes() + now.getSeconds() / 60) * 6 : 0;
  const hrAngle = now ? ((now.getHours() % 12) + now.getMinutes() / 60) * 30 : 0;

  return (
    <section className="rounded-xl border border-primary/30 bg-[linear-gradient(160deg,rgba(56,130,255,0.18),rgba(10,20,40,0.82))] p-2.5 shadow-[0_10px_28px_-18px_rgba(40,120,255,0.9)]">
      <header className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary-glow" />
          <h3 className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-foreground/75">
            Live Clock
          </h3>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8.5px] font-bold",
            office
              ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-300"
              : "border-amber-400/35 bg-amber-400/12 text-amber-300",
          )}
        >
          <Briefcase className="h-2.5 w-2.5" />
          {office ? "OFFICE OPEN" : weekend ? "WEEKEND" : "AFTER HOURS"}
        </span>
      </header>

      <div className="flex items-center gap-2.5">
        <div className="relative h-[62px] w-[62px] shrink-0 rounded-full border border-sky-400/35 bg-[radial-gradient(circle,rgba(30,80,160,0.45),rgba(5,12,28,0.9))] shadow-[0_0_20px_-6px_rgba(90,180,255,0.7)]">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 h-[26px] w-px origin-bottom bg-white/25"
              style={{ transform: `translate(-50%,-100%) rotate(${i * 30}deg)` }}
            />
          ))}
          <span
            className="absolute left-1/2 top-1/2 h-[16px] w-[2px] origin-bottom rounded bg-white"
            style={{ transform: `translate(-50%,-100%) rotate(${hrAngle}deg)` }}
          />
          <span
            className="absolute left-1/2 top-1/2 h-[22px] w-[1.5px] origin-bottom rounded bg-sky-200"
            style={{ transform: `translate(-50%,-100%) rotate(${minAngle}deg)` }}
          />
          <span
            className="absolute left-1/2 top-1/2 h-[25px] w-px origin-bottom rounded bg-rose-400"
            style={{ transform: `translate(-50%,-100%) rotate(${secAngle}deg)` }}
          />
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[22px] font-extrabold leading-none tracking-tight text-foreground tabular-nums">
            {p ? `${p["hour"]}:${p["minute"]}:${p["second"]}` : "--:--:--"}
            <span className="text-[11px] text-sky-300">.{ms}</span>
          </p>
          <p className="mt-0.5 truncate text-[9.5px] font-medium text-foreground/65">
            {p ? `${p["weekday"]} ${p["day"]} ${p["month"]} ${p["year"]}` : "—"} · W{now ? isoWeek(now) : "--"}
          </p>
          <p className="truncate text-[9px] text-foreground/45">
            <Globe2 className="mr-1 inline h-2.5 w-2.5" />
            {zoneKey} · {tz}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1">
        {ZONES.map((z) => {
          const zp = now ? partsIn(now, z.tz) : null;
          return (
            <button
              key={z.k}
              onClick={() => {
                setTz(z.tz);
                setZoneKey(z.k);
              }}
              className={cn(
                "rounded-lg border px-1 py-1 text-center transition-colors",
                zoneKey === z.k
                  ? "border-sky-400/55 bg-sky-400/18"
                  : "border-white/8 bg-white/[0.04] hover:bg-white/[0.09]",
              )}
            >
              <p className="text-[8px] uppercase tracking-wider text-foreground/50">{z.k}</p>
              <p className="font-mono text-[10px] font-bold text-foreground/90 tabular-nums">
                {zp ? `${zp["hour"]}:${zp["minute"]}` : "--:--"}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
});
LiveClock.displayName = "LiveClock";
