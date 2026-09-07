import { createServerFn } from "@tanstack/react-start";

/**
 * Which fields, actions and badges the product card should draw.
 *
 * Read through mm_card_fields(), which returns only the enabled keys grouped by
 * kind — a small object, resolved once and held briefly, because it changes
 * when a manager saves rather than between requests.
 *
 * Null is returned on every failure path, and the card treats null as "draw
 * everything", so a configuration lookup can never strip a card down.
 */

export type CardComposition = {
  visual: string[];
  metadata: string[];
  action: string[];
  badge: string[];
  platform: string[];
};

const CACHE_MS = 30_000;
let cached: { at: number; payload: CardComposition | null } | null = null;

export const getCardComposition = createServerFn({ method: "GET" }).handler(
  async (): Promise<CardComposition | null> => {
    const now = Date.now();
    if (cached && now - cached.at < CACHE_MS) return cached.payload;

    const base = process.env.SUPABASE_URL?.trim() ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
    if (!base) return null;

    try {
      const res = await fetch(`${base}/rest/v1/rpc/mm_card_fields`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (!res.ok) return null;
      const raw = (await res.json()) as Record<string, unknown>;
      if (!raw || typeof raw !== "object") return null;

      const list = (k: string) =>
        Array.isArray(raw[k]) ? (raw[k] as unknown[]).map(String) : [];

      const payload: CardComposition = {
        visual: list("visual"),
        metadata: list("metadata"),
        action: list("action"),
        badge: list("badge"),
        platform: list("platform"),
      };
      cached = { at: now, payload };
      return payload;
    } catch {
      return null;
    }
  },
);
