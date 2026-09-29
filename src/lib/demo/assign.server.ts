import { assertPublicUrl } from "./safe-fetch.server";
import type { Actor } from "./process.server";

/**
 * Taking demo addresses in, and deciding which product each one belongs to.
 *
 * Add Demo and Bulk Add wrote into `demos`, a table with no product
 * relationship that the storefront has never read - so a demo added through
 * either screen could not appear anywhere, and the screen said "completed". The
 * canonical relationship is product_demo_urls.product_id, and this is the only
 * path to one.
 *
 * The rule that shapes everything here: a demo's address says nothing about its
 * product. pixel-till-pro.lovable.app is CounterPOS; temple-learn-sync is
 * AnnadanamKitchen. So nothing is inferred from a URL, and a row is assigned
 * only when the caller named the product or a name matches exactly one product
 * on sale. Everything else is taken in unassigned and left for an operator,
 * because a wrong assignment is how admissionschool-desk came to carry an
 * AnnadanamKitchen demo - and that is worse than no assignment at all.
 *
 * Twelve thousand addresses can go through this. None of them is guessed.
 */

type Row = Record<string, unknown>;

/** What happened to one address. */
export type RowState =
  | "ASSIGNED"
  | "ALREADY_ASSIGNED"
  | "AMBIGUOUS"
  | "UNMATCHED"
  | "INVALID"
  | "ERROR";

export type RowResult = {
  url: string;
  state: RowState;
  reason: string;
  productId?: string | null;
  productSlug?: string | null;
  candidates?: { id: string; name: string; slug: string }[];
  demoUrlId?: string | null;
};

export type AssignInput = {
  /** One line each: the address, and optionally a product and a name to match on. */
  rows: { url: string; product?: string | null; name?: string | null }[];
  /** False previews without writing anything. */
  commit: boolean;
  actor: Actor;
};

export type AssignReport = {
  committed: boolean;
  totals: Record<RowState, number>;
  rows: RowResult[];
  /** The batch as a whole, for the audit trail and for an operator to undo by. */
  batchId: string;
};

function db() {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) throw new Error("The database is not configured on this server.");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  return {
    async rpc<T>(fn: string, args: Row): Promise<T> {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers,
        body: JSON.stringify(args),
      });
      if (!r.ok) throw new Error(`${fn} failed (${r.status}): ${(await r.text()).slice(0, 180)}`);
      return (await r.json()) as T;
    },
    async post<T>(path: string, body: Row): Promise<T> {
      const r = await fetch(`${url}/rest/v1/${path}`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`insert failed (${r.status}): ${(await r.text()).slice(0, 180)}`);
      const rows = (await r.json()) as T[];
      return rows[0] as T;
    },
  };
}

/** The address as it will be stored and compared: trimmed, no trailing slash. */
export function normaliseDemoUrl(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "") || trimmed;
}

const EMPTY_TOTALS = (): Record<RowState, number> => ({
  ASSIGNED: 0,
  ALREADY_ASSIGNED: 0,
  AMBIGUOUS: 0,
  UNMATCHED: 0,
  INVALID: 0,
  ERROR: 0,
});

/**
 * Preview or commit a batch of demo addresses.
 *
 * With `commit: false` nothing is written and the same decisions are returned,
 * so an operator sees exactly what would happen - which matters most for the
 * rows that would NOT be assigned, because those are the ones a careless import
 * would have guessed at.
 *
 * One bad row never takes the batch with it: each is decided, written and
 * reported on its own, and a row that throws is reported as ERROR with the
 * message rather than aborting the rest.
 */
export async function assignDemoUrls(input: AssignInput): Promise<AssignReport> {
  const store = db();
  const batchId = crypto.randomUUID();
  const totals = EMPTY_TOTALS();
  const rows: RowResult[] = [];
  const seen = new Set<string>();

  for (const raw of input.rows) {
    const url = normaliseDemoUrl(raw.url);
    const result: RowResult = { url, state: "ERROR", reason: "" };

    try {
      // A demo must be a public address this server can actually reach. The
      // same check the pipeline uses, so an address refused here is refused
      // there too rather than failing later.
      try {
        assertPublicUrl(url);
      } catch (error) {
        result.state = "INVALID";
        result.reason = error instanceof Error ? error.message : "That is not a usable address.";
        rows.push(result);
        totals.INVALID += 1;
        continue;
      }

      // The same address twice in one file is the file's mistake, not a reason
      // to write it twice.
      if (seen.has(url)) {
        result.state = "ALREADY_ASSIGNED";
        result.reason = "this address appears earlier in the same batch";
        rows.push(result);
        totals.ALREADY_ASSIGNED += 1;
        continue;
      }
      seen.add(url);

      const match = await store.rpc<{
        state: "ALREADY_ASSIGNED" | "MATCHED" | "AMBIGUOUS" | "UNMATCHED";
        product_id?: string;
        reason?: string;
        evidence?: Record<string, unknown>;
        candidates?: { id: string; name: string; slug: string }[];
        demo_url_id?: string;
      }>("demo_match_product", {
        p_url: url,
        p_hint: raw.name ?? null,
        p_product: raw.product ?? null,
      });

      result.reason = String(match.reason ?? "");
      if (match.candidates) result.candidates = match.candidates;

      if (match.state === "ALREADY_ASSIGNED") {
        result.state = "ALREADY_ASSIGNED";
        result.productId = match.product_id ?? null;
        result.demoUrlId = match.demo_url_id ?? null;
        result.productSlug = String(match.evidence?.product_slug ?? "") || null;
        rows.push(result);
        totals.ALREADY_ASSIGNED += 1;
        continue;
      }

      const assigned = match.state === "MATCHED";
      result.state = assigned ? "ASSIGNED" : match.state;
      result.productId = assigned ? (match.product_id ?? null) : null;
      result.productSlug = assigned ? (String(match.evidence?.product_slug ?? "") || null) : null;

      if (!input.commit) {
        rows.push(result);
        totals[result.state] += 1;
        continue;
      }

      /**
       * Written to the canonical table either way.
       *
       * An assigned row carries its product. One that is not assigned is taken
       * in with product_id null, which keeps it in the one table an operator
       * reviews and keeps it off the storefront, since the proxy and the badge
       * both look a demo up by product. The decision, its reason and its
       * evidence ride along in `processing`, so why a row is where it is can be
       * answered months later.
       *
       * Nothing is published here. A new row is inactive and unprocessed; it
       * still has to go through investigate and activate, which is where the
       * branding and the category checks live.
       */
      const created = await store.post<Row>("product_demo_urls", {
        product_id: result.productId,
        url,
        demo_name: raw.name?.trim() || new URL(url).hostname,
        status: "inactive",
        processing_status: "unprocessed",
        processing: {
          assignment: {
            state: result.state,
            reason: result.reason,
            evidence: match.evidence ?? null,
            candidates: match.candidates ?? null,
            batch_id: batchId,
            decided_at: new Date().toISOString(),
            decided_by: input.actor.email ?? input.actor.id ?? "unknown",
          },
        },
      });
      result.demoUrlId = created?.id ? String(created.id) : null;
      rows.push(result);
      totals[result.state] += 1;
    } catch (error) {
      // This row and no other.
      result.state = "ERROR";
      result.reason = error instanceof Error ? error.message : String(error);
      rows.push(result);
      totals.ERROR += 1;
    }
  }

  return { committed: input.commit, totals, rows, batchId };
}
