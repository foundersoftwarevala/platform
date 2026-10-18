import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Demo Manager's reads and writes, against the database the platform actually
 * keeps its data in.
 *
 * This exists because of a split that is invisible from the screen. The browser
 * client in `integrations/supabase/client` is built from VITE_SUPABASE_URL and
 * talks to the hosted Supabase project directly. The server is configured
 * against the VPS gateway. They are two databases:
 *
 *     demo_categories   VPS 90 rows   hosted 0 rows
 *     demos             VPS  n rows   hosted 0 rows
 *
 * So Demo Manager's category dropdown was fetched from hosted, came back `200
 * []`, and every row of a bulk upload was refused with "category ... is not one
 * of the 0" - while ninety categories sat in the database the rest of the
 * platform reads. A demo created from the browser would have been written to
 * hosted, where nothing else looks for it.
 *
 * The VPS is the source of truth for this work, so the fix is to go through the
 * server rather than to copy data into hosted. Everything here runs on the
 * server, against `SUPABASE_URL`, and carries the operator's own token so row
 * level security decides what they may do - the service-role key is never used
 * to write on a browser's behalf.
 */

const BULK_LIMIT = 500;

function gateway(): string {
  const base = process.env.SUPABASE_URL?.trim() ?? process.env.VITE_SUPABASE_URL?.trim() ?? "";
  if (!base) throw new Error("The database is not configured on this server.");
  return base.replace(/\/+$/, "");
}

/** The caller's own token. Their roles, not ours, decide what happens. */
function callerToken(): string {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");
  return token;
}

function asCaller(): Record<string, string> {
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    "";
  return {
    apikey: publishable,
    Authorization: `Bearer ${callerToken()}`,
    "Content-Type": "application/json",
  };
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${gateway()}/rest/v1/${path}`, {
    ...init,
    headers: { ...asCaller(), ...((init.headers as Record<string, string>) ?? {}) },
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* a non-JSON body is surfaced as text below */
  }
  return { ok: response.ok, status: response.status, json, text };
}

export type DemoCategory = { name: string; display_order: number };

/** The categories a demo may be filed under, from the VPS. */
export const listDemoCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<DemoCategory[]> => {
    const result = await rest("demo_categories?select=name,display_order&is_active=is.true&order=display_order");
    if (!result.ok) {
      throw new Error(`Categories could not be read: ${result.status} ${result.text.slice(0, 160)}`);
    }
    return (Array.isArray(result.json) ? result.json : []) as DemoCategory[];
  },
);

const DemoInput = z.object({
  title: z.string().trim().min(1).max(300),
  url: z.string().trim().url().max(2000),
  category: z.string().trim().min(1).max(200),
  demo_type: z.enum(["web", "mobile", "desktop", "api"]).default("web"),
  description: z.string().trim().max(4000).nullable().optional(),
  login_url: z.string().trim().max(2000).nullable().optional(),
});

export type BulkOutcome = {
  requested: number;
  inserted: number;
  alreadyThere: number;
  refused: { reason: string; count: number }[];
};

/**
 * Creates demos, refusing anything it cannot file properly.
 *
 * The category is checked against `demo_categories` on the server rather than
 * trusted from the browser: a category that is not in that list would put the
 * demo where the marketplace cannot see it, and the screen is not the place
 * that decision should be enforceable from.
 *
 * A URL already in the catalogue is skipped, not duplicated and not an error,
 * because a load of twelve thousand may have to be resumed after failing
 * part-way. That is the unique index on demos.normalized_url doing the work;
 * `resolution=ignore-duplicates` is how it is asked to skip rather than fail.
 *
 * The counts returned are counted from what the database gave back, never from
 * what was sent.
 */
export const createDemosBulk = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ rows: z.array(DemoInput).min(1).max(BULK_LIMIT) }).parse(input))
  .handler(async ({ data }): Promise<BulkOutcome> => {
    const allowed = await rest("demo_categories?select=name&is_active=is.true");
    if (!allowed.ok) {
      throw new Error(`Categories could not be read: ${allowed.status} ${allowed.text.slice(0, 160)}`);
    }
    const known = new Map(
      (Array.isArray(allowed.json) ? allowed.json : ([] as { name: string }[])).map((row) => [
        String((row as { name: string }).name).toLowerCase().trim(),
        String((row as { name: string }).name),
      ]),
    );
    if (known.size === 0) {
      throw new Error(
        "No demo categories are configured, so a demo cannot be filed. Seed demo_categories before loading demos.",
      );
    }

    const refusals = new Map<string, number>();
    const refuse = (reason: string) => refusals.set(reason, (refusals.get(reason) ?? 0) + 1);

    const payload: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const row of data.rows) {
      const category = known.get(row.category.toLowerCase().trim());
      if (!category) {
        refuse(`category "${row.category.slice(0, 40)}" is not one of the ${known.size}`);
        continue;
      }
      // Two identical URLs in one statement would collide with each other
      // rather than with the table, so the batch is made distinct first.
      const key = row.url.toLowerCase().replace(/\/+$/, "");
      if (seen.has(key)) {
        refuse("repeated inside the same upload");
        continue;
      }
      seen.add(key);

      payload.push({
        title: row.title,
        url: row.url,
        category,
        demo_type: row.demo_type,
        description: row.description ?? null,
        login_url: row.login_url ?? null,
        status: "inactive",
        lifecycle_status: "pending",
        is_bulk_created: true,
      });
    }

    let inserted = 0;
    if (payload.length > 0) {
      const created = await rest("demos?on_conflict=normalized_url", {
        method: "POST",
        headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
        body: JSON.stringify(payload),
      });
      if (!created.ok) {
        throw new Error(`The demos could not be saved: ${created.status} ${created.text.slice(0, 200)}`);
      }
      inserted = Array.isArray(created.json) ? created.json.length : 0;
    }

    return {
      requested: data.rows.length,
      inserted,
      alreadyThere: Math.max(0, payload.length - inserted),
      refused: [...refusals.entries()].map(([reason, count]) => ({ reason, count })),
    };
  });

/** How many demos exist, so a screen can say so without fetching them all. */
export const countDemos = createServerFn({ method: "GET" }).handler(async (): Promise<number> => {
  const response = await fetch(`${gateway()}/rest/v1/demos?select=id`, {
    headers: { ...asCaller(), Prefer: "count=exact", Range: "0-0" },
  });
  if (!response.ok) return 0;
  const range = response.headers.get("content-range") ?? "";
  return Number(range.split("/")[1]) || 0;
});
