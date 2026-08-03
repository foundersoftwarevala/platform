/**
 * BANNER THEME CONTROLS — 3D glow color density + shine intensity.
 * Values are written to CSS variables on <html> so every SliderBanner
 * in the project stays in sync with one palette.
 */

import { useSyncExternalStore } from "react";

export interface BannerTheme {
  /** 0.2 – 1.6 — how dense/saturated the 3D glow halo is */
  glowDensity: number;
  /** 0 – 1.4 — gloss / specular shine strength */
  shine: number;
}

const STORAGE_KEY = "banner-theme-v1";
const DEFAULT_THEME: BannerTheme = { glowDensity: 0.9, shine: 0.85 };

let theme: BannerTheme = { ...DEFAULT_THEME };
const listeners = new Set<() => void>();

function applyToDom(t: BannerTheme) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.style.setProperty("--banner-glow-density", String(t.glowDensity));
  el.style.setProperty("--banner-shine", String(t.shine));
}

export function setBannerTheme(patch: Partial<BannerTheme>) {
  theme = { ...theme, ...patch };
  applyToDom(theme);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function resetBannerTheme() {
  setBannerTheme(DEFAULT_THEME);
}

export function hydrateBannerTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) theme = { ...DEFAULT_THEME, ...(JSON.parse(raw) as BannerTheme) };
  } catch {
    /* ignore */
  }
  applyToDom(theme);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return theme;
}

export function useBannerTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_THEME);
}
