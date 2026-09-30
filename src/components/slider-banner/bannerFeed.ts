/**
 * BANNER FEED — the Control Panel's live items, shared by the slider banner
 * and the Command Center.
 *
 * This used to be six sentences typed into this file (a ₹8,42,000 payout, a
 * 91% load on "EU-Cluster-2", 142 leads) held in memory, and every button only
 * removed them from the screen and announced success. The items now come from
 * /api/control-panel/feed - open applications, open alerts, the viewer's own
 * tasks, today's arrivals - and each action changes the row behind the item:
 *
 *   approve      decides the application through the applications API
 *   acknowledge  marks the alert acknowledged in the module that raised it
 *   open         goes to the module that owns the item
 *
 * Dismiss only hides an item from this viewer's banner, in this browser. It
 * changes nothing on the platform and says so.
 */

import { useCallback, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { authHeaders } from "@/lib/auth/operator-fetch";
import type { FeedItem } from "@/lib/control-panel/feed";

export type BannerKind = FeedItem["kind"];
export type BannerItem = FeedItem;

const FEED_KEY = ["control-panel", "feed"] as const;
const HIDDEN_KEY = "sv.banner.hidden.v1";

/* ----------------------------- hidden items ------------------------------ */

let hidden: Set<string> = new Set();
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    if (raw) hidden = new Set(JSON.parse(raw) as string[]);
  } catch {
    /* storage unavailable: nothing is hidden */
  }
}

function persistHidden() {
  try {
    // Only the most recent few hundred; old ids belong to rows long gone.
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden].slice(-300)));
  } catch {
    /* storage unavailable: hidden for this visit only */
  }
}

function subscribe(cb: () => void) {
  hydrate();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function hiddenSnapshot() {
  return hidden;
}

/** Hide an item from this viewer's banner. Nothing on the platform changes. */
export function dismissBannerItem(id: string) {
  hydrate();
  hidden = new Set(hidden).add(id);
  persistHidden();
  listeners.forEach((l) => l());
}

/* --------------------------------- feed ---------------------------------- */

async function api<T>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(await authHeaders()),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `The request did not go through (${response.status})`);
  return body;
}

export type BannerFeed = {
  items: BannerItem[];
  loading: boolean;
  error: string | null;
  /** Sources that could not be read this time; their items are missing. */
  unavailable: string[];
  refresh: () => void;
};

export function useBannerFeed(): BannerFeed {
  const hiddenIds = useSyncExternalStore(subscribe, hiddenSnapshot, hiddenSnapshot);
  const query = useQuery({
    queryKey: FEED_KEY,
    queryFn: () => api<{ items: BannerItem[]; unavailable: string[] }>("/api/control-panel/feed"),
    refetchInterval: 60_000,
  });
  return {
    items: (query.data?.items ?? []).filter((i) => !hiddenIds.has(i.id)),
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    unavailable: query.data?.unavailable ?? [],
    refresh: () => void query.refetch(),
  };
}

/** The main button's label for an item. */
export function primaryLabelOf(item: BannerItem): string {
  switch (item.action.type) {
    case "approve":
      return "Approve";
    case "acknowledge":
      return "Acknowledge";
    default:
      return "Open";
  }
}

/**
 * The item's main action. Resolves with a message describing what changed, or
 * with a destination to go to; throws with the platform's own refusal.
 */
export function useBannerAction() {
  const client = useQueryClient();
  return useCallback(
    async (item: BannerItem): Promise<{ message?: string; navigate?: string }> => {
      const action = item.action;
      if (action.type === "open") return { navigate: item.href };
      if (action.type === "approve") {
        // Approving is a real decision on someone's application; it is asked,
        // not taken on a stray click.
        if (!window.confirm(`Approve ${item.title}?`)) return {};
        await api("/api/applications/queue", {
          method: "POST",
          body: JSON.stringify({ action: "decide", kind: action.kind, id: action.id, status: "approved" }),
        });
        await Promise.all([
          client.invalidateQueries({ queryKey: FEED_KEY }),
          client.invalidateQueries({ queryKey: ["control-panel", "cockpit"] }),
        ]);
        return { message: `Approved: ${item.title}` };
      }
      await api("/api/control-panel/feed", {
        method: "POST",
        body: JSON.stringify({ action: "acknowledge", source: action.source, id: action.id }),
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: FEED_KEY }),
        client.invalidateQueries({ queryKey: ["control-panel", "cockpit"] }),
      ]);
      return { message: `Acknowledged: ${item.title}` };
    },
    [client],
  );
}
