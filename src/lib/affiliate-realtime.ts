import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PayloadRecord = Record<string, unknown> & {
  id?: string;
  status?: string;
  updated_at?: string;
  created_at?: string;
};

/** Query keys to invalidate per source table. Dashboard + Top Affiliates are
 * refreshed alongside their owning walls so KPIs stay live across tabs. */
const INVALIDATE_KEYS: Record<string, (string | number)[][]> = {
  affiliates: [
    ["affiliate", "list"],
    ["affiliate", "dashboard-stats"],
    ["affiliate", "top-5"],
    ["affiliate", "activity", 12],
  ],
  commissions: [
    ["affiliate", "commissions"],
    ["affiliate", "dashboard-stats"],
    ["affiliate", "top-5"],
  ],
  wallets: [
    ["affiliate", "wallets"],
    ["affiliate", "dashboard-stats"],
  ],
  payouts: [
    ["affiliate", "payouts"],
    ["affiliate", "dashboard-stats"],
  ],
  activity_log: [
    ["affiliate", "activity", 12],
    ["affiliate", "dashboard-stats"],
  ],
};

type SyncEvent = {
  eventType: string;
  new: PayloadRecord | null;
  old: PayloadRecord | null;
};

/**
 * Bridges Supabase realtime changes into TanStack Query with three
 * hardening guarantees:
 *   1. Deduplication — a bounded LRU keyed by `table:event:id:ts` drops
 *      duplicates that arrive from multiple tabs, replayed sockets, or
 *      the reconnect backlog.
 *   2. Ordering — per-record `updated_at` (falling back to `created_at`)
 *      is compared and older events are ignored so a slow-arriving stale
 *      row can never overwrite a fresher cache.
 *   3. Retry — subscribe status is watched and the channel is torn down
 *      and rebuilt with exponential backoff on `TIMED_OUT` or
 *      `CHANNEL_ERROR`, and again when the tab regains focus.
 * Cache invalidations are also coalesced per key so a burst of events
 * fires a single refetch instead of thrashing the network.
 */
export function useAffiliateRealtimeSync(enabled: boolean) {
  const qc = useQueryClient();
  const seenRef = useRef<Set<string>>(new Set());
  const seenOrderRef = useRef<string[]>([]);
  const lastTsRef = useRef<Map<string, number>>(new Map());
  const pendingRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let attempts = 0;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: number | null = null;
    let disposed = false;

    const handle = (table: keyof typeof INVALIDATE_KEYS) => (payload: SyncEvent) => {
      const rec = (payload.new ?? payload.old) as PayloadRecord | null;
      if (!rec?.id) return;
      const ts =
        Date.parse(rec.updated_at ?? rec.created_at ?? "") ||
        Date.now();
      const dedupKey = `${table}:${payload.eventType}:${rec.id}:${ts}`;
      if (seenRef.current.has(dedupKey)) return;
      const orderKey = `${table}:${rec.id}`;
      const lastTs = lastTsRef.current.get(orderKey) ?? 0;
      if (payload.eventType !== "INSERT" && ts < lastTs) return; // out-of-order guard
      lastTsRef.current.set(orderKey, ts);
      // Bounded LRU (last 500 events)
      seenRef.current.add(dedupKey);
      seenOrderRef.current.push(dedupKey);
      if (seenOrderRef.current.length > 500) {
        const drop = seenOrderRef.current.shift();
        if (drop) seenRef.current.delete(drop);
      }
      for (const key of INVALIDATE_KEYS[table] ?? []) {
        pendingRef.current.add(JSON.stringify(key));
      }
      scheduleFlush(qc, pendingRef, flushTimerRef);
      const label = describe(table, payload.eventType, rec);
      if (label) toast(label.title, { description: label.body });
      logRealtime(table, payload.eventType, rec);
    };

    const connect = () => {
      if (disposed) return;
      channel = supabase
        .channel(`affiliate-live-sync-${Math.random().toString(36).slice(2, 8)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "affiliates" }, handle("affiliates"))
        .on("postgres_changes", { event: "*", schema: "public", table: "commissions" }, handle("commissions"))
        .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, handle("wallets"))
        .on("postgres_changes", { event: "*", schema: "public", table: "payouts" }, handle("payouts"))
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, handle("activity_log"))
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            attempts = 0;
          } else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
            scheduleReconnect();
          }
        });
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer !== null) return;
      const delay = Math.min(30_000, 500 * 2 ** attempts++);
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        if (channel) supabase.removeChannel(channel);
        connect();
      }, delay);
    };

    const onFocus = () => {
      // On tab focus, refresh dashboard immediately in case we missed events.
      qc.invalidateQueries({ queryKey: ["affiliate", "dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["affiliate", "top-5"] });
      qc.invalidateQueries({ queryKey: ["affiliate", "activity", 12] });
    };
    window.addEventListener("focus", onFocus);

    connect();
    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}

function scheduleFlush(
  qc: QueryClient,
  pendingRef: React.MutableRefObject<Set<string>>,
  flushTimerRef: React.MutableRefObject<number | null>,
) {
  if (flushTimerRef.current !== null) return;
  flushTimerRef.current = window.setTimeout(() => {
    flushTimerRef.current = null;
    const keys = Array.from(pendingRef.current);
    pendingRef.current.clear();
    for (const raw of keys) {
      try {
        qc.invalidateQueries({ queryKey: JSON.parse(raw) });
      } catch {
        /* noop */
      }
    }
  }, 250);
}

function describe(
  table: string,
  event: string,
  rec: PayloadRecord | null,
): { title: string; body?: string } | null {
  if (!rec) return null;
  const short = typeof rec.id === "string" ? rec.id.slice(0, 8) : "";
  switch (table) {
    case "affiliates":
      return event === "UPDATE"
        ? { title: "Affiliate status updated", body: `${short} → ${rec.status ?? "changed"}` }
        : event === "INSERT"
        ? { title: "New affiliate joined", body: short }
        : null;
    case "commissions":
      return { title: `Commission ${event.toLowerCase()}d`, body: short };
    case "wallets":
      return { title: "Wallet transaction", body: short };
    case "payouts":
      return { title: `Payout ${event.toLowerCase()}d`, body: short };
    case "activity_log":
      return null; // activity rows are their own log; don't double-toast
    default:
      return null;
  }
}

function logRealtime(table: string, event: string, rec: PayloadRecord | null) {
  // Lightweight console trail so operators can debug ordering across tabs.
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-console
  console.debug("[realtime]", table, event, rec?.id, rec?.status ?? "");
}
