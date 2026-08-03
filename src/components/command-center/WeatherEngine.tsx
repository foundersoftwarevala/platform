/**
 * WEATHER ENGINE — real Open-Meteo data with a fully animated premium scene.
 * Animated sun / moon / stars / clouds / rain / snow / thunder / fog / wind,
 * optional ambient audio (procedural WebAudio — no asset files),
 * city + country search, GPS detect, favourites, hourly and 7-day forecast.
 */

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  CloudRain,
  CloudSnow,
  Cloud,
  CloudFog,
  CloudLightning,
  Sun,
  Moon,
  Wind,
  Droplets,
  Gauge,
  Eye,
  Sunrise,
  Sunset,
  Search,
  LocateFixed,
  Star,
  Volume2,
  VolumeX,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlace, usePlaceSearch, useWeather } from "./useLive";
import type { GeoPlace } from "@/lib/live-data.functions";

/* --------------------------- WMO code semantics --------------------------- */

type Scene = "clear" | "cloud" | "rain" | "snow" | "thunder" | "fog";

export function wmo(code: number): { label: string; scene: Scene } {
  if (code === 0) return { label: "Clear sky", scene: "clear" };
  if (code <= 2) return { label: "Partly cloudy", scene: "cloud" };
  if (code === 3) return { label: "Overcast", scene: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", scene: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", scene: "rain" };
  if (code >= 61 && code <= 67) return { label: "Rain", scene: "rain" };
  if (code >= 71 && code <= 77) return { label: "Snow", scene: "snow" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", scene: "rain" };
  if (code >= 85 && code <= 86) return { label: "Snow showers", scene: "snow" };
  if (code >= 95) return { label: "Thunderstorm", scene: "thunder" };
  return { label: "Unsettled", scene: "cloud" };
}

function SceneIcon({ scene, isDay, className }: { scene: Scene; isDay: boolean; className?: string }) {
  const Icon =
    scene === "rain"
      ? CloudRain
      : scene === "snow"
        ? CloudSnow
        : scene === "thunder"
          ? CloudLightning
          : scene === "fog"
            ? CloudFog
            : scene === "cloud"
              ? Cloud
              : isDay
                ? Sun
                : Moon;
  return <Icon className={className} />;
}

/* --------------------------- moon phase (real) ---------------------------- */

function moonPhase(d: Date) {
  const synodic = 29.530588853;
  const known = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const days = d.getTime() / 86400000 - known;
  const p = ((days % synodic) + synodic) % synodic;
  const frac = p / synodic;
  const names = [
    "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
    "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent",
  ];
  return { name: names[Math.round(frac * 8) % 8], illum: Math.round((1 - Math.cos(2 * Math.PI * frac)) * 50) };
}

/* ------------------------------ ambient audio ----------------------------- */

function useAmbient(scene: Scene, windKph: number, enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (!enabled) {
      nodesRef.current?.stop();
      nodesRef.current = null;
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = ctxRef.current ?? new AC();
    ctxRef.current = ctx;
    void ctx.resume();

    // procedural pink-ish noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099;
      b1 = 0.963 * b1 + white * 0.2965;
      b2 = 0.57 * b2 + white * 1.0526;
      ch[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    if (scene === "rain" || scene === "thunder") {
      filter.type = "highpass";
      filter.frequency.value = 900;
      gain.gain.value = 0.16;
    } else if (scene === "snow" || scene === "fog") {
      filter.type = "lowpass";
      filter.frequency.value = 420;
      gain.gain.value = 0.07;
    } else {
      filter.type = "lowpass";
      filter.frequency.value = 300 + Math.min(windKph, 40) * 12;
      gain.gain.value = 0.06 + Math.min(windKph, 40) / 500;
    }

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();

    // occasional thunder rumble
    let rumble: number | undefined;
    if (scene === "thunder") {
      rumble = window.setInterval(() => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(48, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(22, ctx.currentTime + 1.4);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 1.7);
      }, 9000);
    }

    nodesRef.current = {
      stop: () => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
        if (rumble) window.clearInterval(rumble);
      },
    };
    return () => nodesRef.current?.stop();
  }, [scene, enabled, windKph]);
}

/* ------------------------------ animated sky ------------------------------ */

const Sky = memo<{ scene: Scene; isDay: boolean; wind: number; cloud: number }>(
  ({ scene, isDay, wind, cloud }) => {
    const drops = scene === "rain" || scene === "thunder" ? 26 : 0;
    const flakes = scene === "snow" ? 22 : 0;
    const stars = !isDay ? 26 : 0;
    const speed = Math.max(6, 26 - Math.min(wind, 40) * 0.4);

    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: isDay
            ? "linear-gradient(180deg,#123a72 0%,#1b5aa8 45%,#0b1e3d 100%)"
            : "linear-gradient(180deg,#050b1c 0%,#0b1c3a 55%,#04091a 100%)",
        }}
      >
        {Array.from({ length: stars }).map((_, i) => (
          <span
            key={`s${i}`}
            className="absolute rounded-full bg-white"
            style={{
              width: 1.6,
              height: 1.6,
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 62}%`,
              opacity: 0.35 + ((i * 13) % 50) / 100,
              animation: `wx-twinkle ${2 + (i % 5) * 0.6}s ease-in-out ${i * 0.13}s infinite`,
            }}
          />
        ))}

        {isDay && scene === "clear" && (
          <span
            className="absolute rounded-full"
            style={{
              width: 54,
              height: 54,
              right: 14,
              top: 8,
              background: "radial-gradient(circle,#ffe9a8 0%,#ffc247 45%,rgba(255,178,40,0) 72%)",
              animation: "wx-sun 5s ease-in-out infinite",
            }}
          />
        )}
        {!isDay && (
          <span
            className="absolute rounded-full"
            style={{
              width: 34,
              height: 34,
              right: 20,
              top: 12,
              background: "radial-gradient(circle at 35% 35%,#f4f7ff 0%,#c8d6f0 55%,rgba(150,180,230,0) 75%)",
              boxShadow: "0 0 26px rgba(180,210,255,0.55)",
              animation: "wx-sun 7s ease-in-out infinite",
            }}
          />
        )}

        {Array.from({ length: cloud > 15 || scene !== "clear" ? 3 : 1 }).map((_, i) => (
          <span
            key={`c${i}`}
            className="absolute rounded-full"
            style={{
              width: 90 + i * 26,
              height: 26 + i * 6,
              left: -120,
              top: 10 + i * 22,
              background: `rgba(210,228,255,${0.1 + (cloud / 100) * 0.22})`,
              filter: "blur(7px)",
              animation: `wx-drift ${speed + i * 5}s linear ${i * 2}s infinite`,
            }}
          />
        ))}

        {Array.from({ length: drops }).map((_, i) => (
          <span
            key={`r${i}`}
            className="absolute w-px bg-gradient-to-b from-transparent via-sky-200/70 to-sky-100/20"
            style={{
              height: 14 + (i % 4) * 5,
              left: `${(i * 41) % 100}%`,
              top: -20,
              animation: `wx-rain ${0.6 + (i % 5) * 0.12}s linear ${i * 0.07}s infinite`,
            }}
          />
        ))}

        {Array.from({ length: flakes }).map((_, i) => (
          <span
            key={`f${i}`}
            className="absolute rounded-full bg-white/85"
            style={{
              width: 3,
              height: 3,
              left: `${(i * 43) % 100}%`,
              top: -10,
              animation: `wx-snow ${4 + (i % 5)}s linear ${i * 0.2}s infinite`,
            }}
          />
        ))}

        {scene === "thunder" && (
          <span
            className="absolute inset-0 bg-white"
            style={{ animation: "wx-flash 7s steps(1,end) infinite", opacity: 0 }}
          />
        )}

        {scene === "fog" &&
          Array.from({ length: 3 }).map((_, i) => (
            <span
              key={`g${i}`}
              className="absolute h-8 w-[160%] bg-white/12"
              style={{
                left: "-30%",
                top: 22 + i * 18,
                filter: "blur(9px)",
                animation: `wx-drift ${16 + i * 6}s linear ${i * 3}s infinite`,
              }}
            />
          ))}

        <span className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/45 to-transparent" />
      </div>
    );
  },
);
Sky.displayName = "Sky";

/* --------------------------------- widget --------------------------------- */

const Chip = ({ k, v, icon: Icon }: { k: string; v: string; icon: React.ElementType }) => (
  <div className="rounded-lg border border-white/10 bg-white/[0.05] px-1.5 py-1">
    <div className="flex items-center gap-1">
      <Icon className="h-2.5 w-2.5 text-sky-300" />
      <span className="text-[8px] uppercase tracking-wider text-foreground/50">{k}</span>
    </div>
    <p className="text-[10.5px] font-extrabold tabular-nums text-foreground/90">{v}</p>
  </div>
);

export const WeatherEngine = memo(() => {
  const { place, setPlace, favorites, toggleFavorite, detectGps } = usePlace();
  const { data, isFetching, refetch, dataUpdatedAt } = useWeather(place);
  const [q, setQ] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const [sound, setSound] = useState(false);
  const [tab, setTab] = useState<"hourly" | "daily">("hourly");
  const results = usePlaceSearch(q);

  const cur = data?.current;
  const info = wmo(cur?.code ?? 0);
  const scene = info.scene;
  const isDay = cur?.isDay ?? true;
  useAmbient(scene, cur?.wind ?? 0, sound);

  const [displayTemp, setDisplayTemp] = useState(0);
  useEffect(() => {
    if (cur == null) return;
    const target = cur.temp;
    let raf = 0;
    const start = performance.now();
    const from = displayTemp;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      setDisplayTemp(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.temp]);

  const phase = useMemo(() => moonPhase(new Date(dataUpdatedAt || Date.now())), [dataUpdatedAt]);
  const aqiTone =
    (data?.aqi?.us ?? 0) <= 50
      ? "text-emerald-300"
      : (data?.aqi?.us ?? 0) <= 100
        ? "text-amber-300"
        : "text-rose-300";
  const hhmm = (iso: string) => (iso ? iso.slice(11, 16) : "--:--");

  return (
    <section className="relative overflow-hidden rounded-xl border border-primary/30 bg-[linear-gradient(160deg,rgba(56,130,255,0.18),rgba(10,20,40,0.82))] p-2.5 shadow-[0_10px_28px_-18px_rgba(40,120,255,0.9)]">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <SceneIcon scene={scene} isDay={isDay} className="h-3.5 w-3.5 shrink-0 text-sky-300" />
          <h3 className="truncate text-[9.5px] font-bold uppercase tracking-[0.16em] text-foreground/75">
            Live Weather Engine
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSound((s) => !s)}
            title="Ambient weather sound"
            className={cn(
              "rounded-md border px-1 py-0.5 transition-colors",
              sound
                ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                : "border-white/10 bg-white/5 text-foreground/50 hover:text-foreground/80",
            )}
          >
            {sound ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
          </button>
          <button
            onClick={() => void detectGps()}
            title="GPS auto detect"
            className="rounded-md border border-white/10 bg-white/5 px-1 py-0.5 text-foreground/60 transition-colors hover:text-sky-300"
          >
            <LocateFixed className="h-3 w-3" />
          </button>
          <button
            onClick={() => setOpenSearch((v) => !v)}
            title="Search country / state / city"
            className="rounded-md border border-white/10 bg-white/5 px-1 py-0.5 text-foreground/60 transition-colors hover:text-sky-300"
          >
            <Search className="h-3 w-3" />
          </button>
          <button
            onClick={() => void refetch()}
            title="Refresh now"
            className="rounded-md border border-white/10 bg-white/5 px-1 py-0.5 text-foreground/60 transition-colors hover:text-sky-300"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
          </button>
        </div>
      </header>

      {openSearch && (
        <div className="mb-2 space-y-1">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search city, state or country…"
            className="w-full rounded-md border border-white/12 bg-black/40 px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-sky-400/60"
          />
          {results.data && results.data.length > 0 && (
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {results.data.map((p: GeoPlace) => (
                <button
                  key={`${p.id}-${p.lat}`}
                  onClick={() => {
                    setPlace(p);
                    setOpenSearch(false);
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between rounded-md border border-white/8 bg-white/[0.04] px-2 py-1 text-left text-[10px] text-foreground/85 hover:bg-white/[0.1]"
                >
                  <span className="truncate">
                    {p.name}
                    {p.admin ? `, ${p.admin}` : ""} · {p.country}
                  </span>
                  <span className="shrink-0 text-[8.5px] text-foreground/45">{p.timezone}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* animated hero scene */}
      <div className="relative h-[104px] overflow-hidden rounded-lg border border-white/10">
        <Sky scene={scene} isDay={isDay} wind={cur?.wind ?? 0} cloud={cur?.cloud ?? 0} />
        <div className="relative flex h-full flex-col justify-between p-2">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-extrabold text-white drop-shadow">
                {place.name}
                {place.admin ? `, ${place.admin}` : ""}
              </p>
              <p className="truncate text-[9px] text-white/70">
                {place.country} · {data?.place.timezone ?? place.timezone}
              </p>
            </div>
            <button
              onClick={() => toggleFavorite(place)}
              className="rounded-md bg-black/30 p-1 text-white/70 transition-colors hover:text-amber-300"
              title="Save favourite city"
            >
              <Star
                className={cn(
                  "h-3 w-3",
                  favorites.some((f) => f.name === place.name) && "fill-amber-300 text-amber-300",
                )}
              />
            </button>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[34px] font-extrabold leading-none tracking-tight text-white tabular-nums drop-shadow-[0_4px_14px_rgba(0,0,0,0.6)]">
                {data?.ok ? displayTemp.toFixed(1) : "--"}
                <span className="text-[15px]">°C</span>
              </p>
              <p className="text-[9.5px] font-semibold text-white/80">
                {info.label} · feels {cur ? Math.round(cur.apparent) : "--"}°
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9.5px] font-bold text-white/85">
                H {Math.round(data?.today.max ?? 0)}° · L {Math.round(data?.today.min ?? 0)}°
              </p>
              <p className={cn("text-[9.5px] font-bold", aqiTone)}>
                AQI {data?.aqi ? Math.round(data.aqi.us) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {favorites.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {favorites.map((f) => (
            <button
              key={`${f.name}-${f.lat}`}
              onClick={() => setPlace(f)}
              className="rounded-full border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[9px] font-semibold text-foreground/75 hover:bg-white/[0.14]"
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 grid grid-cols-4 gap-1">
        <Chip k="Hum" v={`${Math.round(cur?.humidity ?? 0)}%`} icon={Droplets} />
        <Chip k="Wind" v={`${Math.round(cur?.wind ?? 0)}k`} icon={Wind} />
        <Chip k="Rain" v={`${Math.round(data?.today.rainProb ?? 0)}%`} icon={CloudRain} />
        <Chip k="Press" v={`${Math.round(cur?.pressure ?? 0)}`} icon={Gauge} />
        <Chip k="Vis" v={`${(cur?.visibility ?? 0).toFixed(1)}km`} icon={Eye} />
        <Chip k="UV" v={`${(data?.today.uvMax ?? 0).toFixed(1)}`} icon={Sun} />
        <Chip k="Rise" v={hhmm(data?.today.sunrise ?? "")} icon={Sunrise} />
        <Chip k="Set" v={hhmm(data?.today.sunset ?? "")} icon={Sunset} />
      </div>

      <div className="mt-1.5 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1">
        <span className="flex items-center gap-1 text-[9px] text-foreground/60">
          <Moon className="h-3 w-3 text-sky-200" /> {phase.name}
        </span>
        <span className="text-[9px] font-bold text-foreground/75">{phase.illum}% illuminated</span>
      </div>

      <div className="mt-2 flex gap-1">
        {(["hourly", "daily"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-md border px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors",
              tab === t
                ? "border-sky-400/55 bg-sky-400/20 text-sky-100"
                : "border-white/8 bg-white/[0.04] text-foreground/50",
            )}
          >
            {t === "hourly" ? "Hourly" : "7 day"}
          </button>
        ))}
      </div>

      <div className="mt-1.5 flex gap-1 overflow-x-auto pb-1">
        {(tab === "hourly" ? data?.hourly ?? [] : data?.daily ?? []).map((row, i) => {
          const isHour = tab === "hourly";
          const r = row as { t?: string; date?: string; temp?: number; max?: number; min?: number; code: number; rain: number };
          const s = wmo(r.code).scene;
          return (
            <div
              key={i}
              className="min-w-[46px] shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-1 py-1 text-center"
            >
              <p className="text-[8.5px] text-foreground/55">
                {isHour
                  ? (r.t ?? "").slice(11, 16)
                  : new Date(r.date ?? "").toLocaleDateString(undefined, { weekday: "short" })}
              </p>
              <SceneIcon scene={s} isDay={isDay} className="mx-auto my-0.5 h-3 w-3 text-sky-300" />
              <p className="text-[10px] font-extrabold text-foreground/90 tabular-nums">
                {isHour ? Math.round(r.temp ?? 0) : Math.round(r.max ?? 0)}°
              </p>
              <p className="text-[8px] text-sky-300/80">{Math.round(r.rain)}%</p>
            </div>
          );
        })}
      </div>

      <p className="mt-1 text-center text-[8px] uppercase tracking-[0.18em] text-foreground/35">
        {data?.ok ? "Open-Meteo live · auto refresh 60s" : "Reconnecting to weather service…"}
      </p>
    </section>
  );
});
WeatherEngine.displayName = "WeatherEngine";
