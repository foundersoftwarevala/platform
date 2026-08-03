/**
 * LIVE HOOKS — real data plumbing for the Command Center.
 * Background refresh via TanStack Query + real browser runtime telemetry.
 * No mock values anywhere.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMarkets,
  getSystemPulse,
  getWeather,
  reverseGeocode,
  searchPlaces,
  type GeoPlace,
} from "@/lib/live-data.functions";

/* ------------------------------- location -------------------------------- */

const PLACE_KEY = "cc.place.v1";
const FAV_KEY = "cc.favcities.v1";

export const DEFAULT_PLACE: GeoPlace = {
  id: 1255364,
  name: "Surat",
  admin: "Gujarat",
  country: "India",
  countryCode: "IN",
  lat: 21.1959,
  lon: 72.8302,
  timezone: "Asia/Kolkata",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function usePlace() {
  const [place, setPlaceState] = useState<GeoPlace>(DEFAULT_PLACE);
  const [favorites, setFavorites] = useState<GeoPlace[]>([]);

  useEffect(() => {
    setPlaceState(read(PLACE_KEY, DEFAULT_PLACE));
    setFavorites(read<GeoPlace[]>(FAV_KEY, []));
  }, []);

  const setPlace = (p: GeoPlace) => {
    setPlaceState(p);
    try {
      window.localStorage.setItem(PLACE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  };

  const toggleFavorite = (p: GeoPlace) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.name === p.name && f.country === p.country);
      const next = exists
        ? prev.filter((f) => !(f.name === p.name && f.country === p.country))
        : [...prev, p].slice(-6);
      try {
        window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const detectGps = () =>
    new Promise<GeoPlace | null>((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const found = await reverseGeocode({
            data: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          });
          if (found) {
            const withTz = { ...found, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
            setPlace(withTz);
            resolve(withTz);
          } else resolve(null);
        },
        () => resolve(null),
        { timeout: 8000, maximumAge: 300000 },
      );
    });

  return { place, setPlace, favorites, toggleFavorite, detectGps };
}

export function usePlaceSearch(q: string) {
  return useQuery({
    queryKey: ["places", q],
    queryFn: () => searchPlaces({ data: { q } }),
    enabled: q.trim().length >= 2,
    staleTime: 10 * 60_000,
  });
}

/* -------------------------------- weather -------------------------------- */

export function useWeather(place: GeoPlace) {
  return useQuery({
    queryKey: ["weather", place.lat, place.lon],
    queryFn: () =>
      getWeather({
        data: {
          lat: place.lat,
          lon: place.lon,
          name: place.name,
          admin: place.admin,
          country: place.country,
          timezone: place.timezone || "auto",
        },
      }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

/* -------------------------------- markets -------------------------------- */

export function useMarkets() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: () => getMarkets(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/* ------------------------------ system pulse ------------------------------ */

export function useSystemPulse() {
  return useQuery({
    queryKey: ["pulse"],
    queryFn: () => getSystemPulse(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

/* --------------------------- browser telemetry ---------------------------- */

export interface RuntimeStats {
  fps: number;
  heapUsedMb: number | null;
  heapLimitMb: number | null;
  memoryPct: number | null;
  downlink: number | null;
  effectiveType: string;
  rtt: number | null;
  online: boolean;
  cores: number;
  resources: number;
  transferredKb: number;
  domNodes: number;
  longTasks: number;
  uptimeSec: number;
}

export function useRuntimeStats(): RuntimeStats {
  const [stats, setStats] = useState<RuntimeStats>({
    fps: 0,
    heapUsedMb: null,
    heapLimitMb: null,
    memoryPct: null,
    downlink: null,
    effectiveType: "—",
    rtt: null,
    online: true,
    cores: 0,
    resources: 0,
    transferredKb: 0,
    domNodes: 0,
    longTasks: 0,
    uptimeSec: 0,
  });
  const longTasks = useRef(0);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    let fps = 0;

    const loop = (t: number) => {
      frames += 1;
      if (t - last >= 1000) {
        fps = Math.round((frames * 1000) / (t - last));
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let obs: PerformanceObserver | undefined;
    try {
      obs = new PerformanceObserver((list) => {
        longTasks.current += list.getEntries().length;
      });
      obs.observe({ entryTypes: ["longtask"] });
    } catch {
      /* not supported */
    }

    const sample = () => {
      const perf = performance as Performance & {
        memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      };
      const conn = (navigator as Navigator & {
        connection?: { downlink?: number; effectiveType?: string; rtt?: number };
      }).connection;
      const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const bytes = res.reduce((sum, r) => sum + (r.transferSize || 0), 0);
      const used = perf.memory ? perf.memory.usedJSHeapSize / 1048576 : null;
      const limit = perf.memory ? perf.memory.jsHeapSizeLimit / 1048576 : null;

      setStats({
        fps,
        heapUsedMb: used === null ? null : Math.round(used),
        heapLimitMb: limit === null ? null : Math.round(limit),
        memoryPct: used !== null && limit ? Math.round((used / limit) * 100) : null,
        downlink: conn?.downlink ?? null,
        effectiveType: conn?.effectiveType ?? "—",
        rtt: conn?.rtt ?? null,
        online: navigator.onLine,
        cores: navigator.hardwareConcurrency || 0,
        resources: res.length,
        transferredKb: Math.round(bytes / 1024),
        domNodes: document.getElementsByTagName("*").length,
        longTasks: longTasks.current,
        uptimeSec: Math.round(performance.now() / 1000),
      });
    };

    sample();
    const timer = setInterval(sample, 2000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      obs?.disconnect();
    };
  }, []);

  return stats;
}

/* ------------------------------- live clock ------------------------------- */

export function useLiveClock(intervalMs = 50) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
