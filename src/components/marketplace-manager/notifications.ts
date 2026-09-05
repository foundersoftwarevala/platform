import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppNotification = {
  id: string;
  title: string;
  detail: string;
  tone: "info" | "success" | "warning";
  read: boolean;
};

const READ_KEY = "sv:notifications:read";

function loadRead(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(READ_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveRead(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

function toneOf(kind: string): AppNotification["tone"] {
  if (kind === "promo" || kind === "success") return "success";
  if (kind === "warning" || kind === "alert") return "warning";
  return "info";
}

let items: AppNotification[] = [
  { id: "n1", title: "Deployment succeeded", detail: "Storefront build 214 is live.", tone: "success", read: false },
  { id: "n2", title: "3 products await approval", detail: "Author submissions in moderation queue.", tone: "warning", read: false },
  { id: "n3", title: "SEO audit ready", detail: "New crawl report generated for 42 pages.", tone: "info", read: false },
];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let hydrated = false;

/** Pull live notifications from the backend (site_notifications) once per session. */
export async function hydrateNotifications() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const { data, error } = await supabase
    .from("site_notifications" as never)
    .select("id,title,body,kind,is_published,sort_order")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (error || !data) return;
  const read = loadRead();
  const rows = data as unknown as Array<{ id: string; title: string; body: string; kind: string }>;
  if (!rows.length) return;
  items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    detail: r.body ?? "",
    tone: toneOf(r.kind ?? "info"),
    read: read.has(r.id),
  }));
  emit();
}

export function markAllRead() {
  items = items.map((n) => ({ ...n, read: true }));
  saveRead(new Set(items.map((n) => n.id)));
  emit();
}

export function markRead(id: string) {
  items = items.map((n) => (n.id === id ? { ...n, read: true } : n));
  const read = loadRead();
  read.add(id);
  saveRead(read);
  emit();
}

export function useNotifications() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      void hydrateNotifications();
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
}

export function useUnreadCount() {
  return useNotifications().filter((n) => !n.read).length;
}
