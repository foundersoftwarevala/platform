/**
 * BANNER FEED — single source of truth for the auto-slider banner.
 *
 * Add a new important item any time (alert / notification / approval / todo)
 * and it will LIVE-slide into every SliderBanner in the project:
 *
 *   import { addBannerItem } from "@/components/slider-banner/bannerFeed";
 *   addBannerItem({ kind: "approval", title: "New payout ₹4.2L", detail: "Finance", });
 */

import { useSyncExternalStore } from "react";

export type BannerKind = "alert" | "notification" | "approval" | "todo";

export interface BannerItem {
  id: string;
  kind: BannerKind;
  title: string;
  detail: string;
  meta?: string;
  /** primary button label, defaults per kind */
  primaryLabel?: string;
  secondaryLabel?: string;
  done?: boolean;
}

const DEFAULT_ITEMS: BannerItem[] = [
  {
    id: "ap-1",
    kind: "approval",
    title: "Payout approval — ₹8,42,000",
    detail: "Finance Manager ne 3 vendor payouts approval ke liye bheje hain.",
    meta: "Finance • 4 min ago",
  },
  {
    id: "al-1",
    kind: "alert",
    title: "Server load 91% on EU-Cluster-2",
    detail: "Auto-scale trigger armed. Boss approval se extra node add hoga.",
    meta: "Server Manager • live",
  },
  {
    id: "nt-1",
    kind: "notification",
    title: "142 new leads captured today",
    detail: "Lead Manager pipeline me 18% growth vs yesterday.",
    meta: "Lead Manager • 12 min ago",
  },
  {
    id: "td-1",
    kind: "todo",
    title: "Review Q3 franchise expansion deck",
    detail: "Continent Admin ne 6 naye city proposals submit kiye hain.",
    meta: "To-Do • due today",
  },
  {
    id: "al-2",
    kind: "alert",
    title: "2 failed AI API keys detected",
    detail: "AI API Manager me rotation required — fallback gateway active hai.",
    meta: "AI API Manager • 1 min ago",
  },
  {
    id: "ap-2",
    kind: "approval",
    title: "Reseller tier upgrade — 9 partners",
    detail: "Reseller Manager ne Gold tier upgrade request bheji hai.",
    meta: "Reseller • 22 min ago",
  },
];

let items: BannerItem[] = [...DEFAULT_ITEMS];
const listeners = new Set<() => void>();

function emit() {
  items = [...items];
  listeners.forEach((l) => l());
}

export function addBannerItem(item: Omit<BannerItem, "id"> & { id?: string }) {
  items = [
    { id: item.id ?? `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...item },
    ...items,
  ];
  emit();
}

export function resolveBannerItem(id: string) {
  items = items.filter((i) => i.id !== id);
  emit();
}

export function completeBannerItem(id: string) {
  items = items.map((i) => (i.id === id ? { ...i, done: true } : i));
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return items;
}

export function useBannerFeed() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// expose for quick manual additions from the console
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>)["addBannerItem"] = addBannerItem;
}
