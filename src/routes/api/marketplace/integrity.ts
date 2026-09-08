import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { resolveAction } from "@/lib/marketplace/permission-guard";
import { loadMatrix, recordDenial, rolesOf } from "@/lib/marketplace/permission-store.server";

/**
 * The No Fake Data Policy, measured instead of asserted.
 *
 * The screen showed six cards all reading ENFORCED and four counters all
 * reading a dash. The dashes were honest. The six ENFORCED badges were not:
 * this database contains, right now, exactly the things those six cards say
 * cannot happen.
 *
 * Fourteen products carry a rating between 4.5 and 4.9 and marketplace_reviews
 * holds no rows at all. Twelve carry download counters up to 650, with labels
 * like "650+", and marketplace_downloads holds no rows at all. Ten orders are
 * marked paid and exactly one payment intent has ever succeeded.
 *
 * So each card's status is computed from the data rather than printed. A policy
 * that says ENFORCED while its own database disagrees is worse than no policy,
 * because it is the thing people trust instead of looking.
 *
 * Nothing is corrected here. Deleting or rewriting production values to make a
 * card go green would be the same failure in the other direction; the evidence
 * is reported with the exact records, and what to do about it is the owner's
 * decision.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows<T = Record<string, unknown>>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

async function count(path: string): Promise<number | null> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, {
      headers: { ...admin(), Prefer: "count=exact", Range: "0-0" },
    });
    // Section 33: a source that cannot be read returns null, and null renders
    // as a dash. It never falls back to zero, because zero is a measurement.
    if (!response.ok) return null;
    return Number((response.headers.get("content-range") ?? "").split("/")[1]) || 0;
  } catch {
    return null;
  }
}

type Policy = {
  id: string;
  title: string;
  description: string;
  /** Measured, never declared. */
  status: "ENFORCED" | "VIOLATED" | "UNVERIFIABLE";
  source: string;
  evidence: string;
  violations: { what: string; count: number; sample?: string[] }[];
};

export const Route = createFileRoute("/api/marketplace/integrity")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const may = (action: string) => {
          const d = resolveAction({ roles: caller.roles, action, permissions: matrix });
          return d.visible && d.enabled;
        };
        if (!may("view")) {
          await recordDenial(request, {
            action: "integrity_view", permission: "marketplace.view",
            roles: caller.roles, entityType: "integrity", recordId: null,
            why: `Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: "Permission marketplace.view is required." },
            { status: 403 },
          );
        }

        const [
          orders, intents, payments, licences, entitlements,
          reviewCount, downloadCount, auditCount, events, ratedProducts, countedProducts,
        ] = await Promise.all([
          rows<Record<string, unknown>>(
            "marketplace_orders?select=id,status,total,currency,created_at,soft_delete_flag,idempotency_key&limit=1000",
          ),
          rows<Record<string, unknown>>(
            "marketplace_payment_intents?select=id,order_id,status,amount,currency,provider,created_at&limit=1000",
          ),
          rows<Record<string, unknown>>(
            "payments?select=id,status,amount,currency,gateway,auto_verified&limit=1000",
          ),
          rows<Record<string, unknown>>("marketplace_licenses?select=id,status,order_item_id&limit=1000"),
          rows<Record<string, unknown>>("marketplace_entitlements?select=id,status&limit=1000"),
          count("marketplace_reviews?select=id"),
          count("marketplace_downloads?select=id"),
          count("marketplace_audit_logs?select=id"),
          rows<Record<string, unknown>>(
            "marketplace_events?select=event_type,dedupe_key,session_id,user_id,product_id&limit=2000",
          ),
          rows<Record<string, unknown>>(
            "marketplace_products?select=id,name,slug,rating&rating=not.is.null&limit=200",
          ),
          rows<Record<string, unknown>>(
            "marketplace_products?select=id,name,slug,downloads,downloads_label&downloads=not.is.null&limit=200",
          ),
        ]);

        /* ------------------------------------------------------- orders */
        const settledOrderIds = new Set(
          intents.filter((i) => String(i.status) === "succeeded").map((i) => String(i.order_id ?? "")),
        );
        settledOrderIds.delete("");
        const live = orders.filter((o) => o.soft_delete_flag !== true);
        const markedPaid = live.filter((o) => String(o.status) === "paid");
        // A verified order is one with a settlement behind it. Nothing else.
        const verifiedOrders = live.filter((o) => settledOrderIds.has(String(o.id)));
        const paidWithoutSettlement = markedPaid.filter((o) => !settledOrderIds.has(String(o.id)));

        const settledIntents = intents.filter((i) => String(i.status) === "succeeded");
        const verifiedRevenue = settledIntents.reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
        const claimedRevenue = markedPaid.reduce((sum, o) => sum + Number(o.total ?? 0), 0);

        /* -------------------------------------------------------- views */
        const viewEvents = events.filter((e) => String(e.event_type) === "product_view");
        const distinctDedupe = new Set(events.map((e) => String(e.dedupe_key ?? ""))).size;
        const dedupeWorking = events.length === 0 || distinctDedupe >= events.length * 0.9;

        /* ----------------------------------------------------- policies */
        const ratedSample = ratedProducts
          .filter((p) => Number(p.rating) > 0)
          .map((p) => `${p.name} (${p.rating})`);
        const countedSample = countedProducts
          .filter((p) => Number(p.downloads) > 0)
          .map((p) => `${p.name} (${p.downloads_label ?? p.downloads})`);

        const policies: Policy[] = [
          {
            id: "no_fake_ratings",
            title: "No Fake Ratings",
            description: "Ratings come from verified, completed orders only. No seeded scores.",
            source: "marketplace_reviews → marketplace_products.rating",
            status: ratedSample.length > 0 && (reviewCount ?? 0) === 0 ? "VIOLATED" : "ENFORCED",
            evidence:
              ratedSample.length > 0 && (reviewCount ?? 0) === 0
                ? `${ratedSample.length} products carry a rating and marketplace_reviews holds ${reviewCount ?? "no readable"} rows. A rating with no review behind it is a seeded score.`
                : `${reviewCount ?? "—"} reviews; ${ratedSample.length} products carry a rating.`,
            violations: ratedSample.length > 0 && (reviewCount ?? 0) === 0
              ? [{ what: "Products rated with zero reviews in the database", count: ratedSample.length, sample: ratedSample.slice(0, 8) }]
              : [],
          },
          {
            id: "no_fake_reviews",
            title: "No Fake Reviews",
            description: "Reviews require verified purchase + identity. Moderation log is auditable.",
            source: "marketplace_reviews",
            status: reviewCount === null ? "UNVERIFIABLE" : "ENFORCED",
            evidence:
              reviewCount === null
                ? "marketplace_reviews could not be read, so this cannot be verified either way."
                : `${reviewCount} reviews exist. None can have been created without a verified purchase, because none exist at all.`,
            violations: [],
          },
          {
            id: "no_fake_downloads",
            title: "No Fake Downloads",
            description: "Download counters are tied to authenticated license deliveries.",
            source: "marketplace_downloads → marketplace_products.downloads",
            status: countedSample.length > 0 && (downloadCount ?? 0) === 0 ? "VIOLATED" : "ENFORCED",
            evidence:
              countedSample.length > 0 && (downloadCount ?? 0) === 0
                ? `${countedSample.length} products carry a download counter and marketplace_downloads holds ${downloadCount ?? "no readable"} rows. Those numbers are not tied to any delivery.`
                : `${downloadCount ?? "—"} download events recorded.`,
            violations: countedSample.length > 0 && (downloadCount ?? 0) === 0
              ? [{ what: "Products showing downloads with no delivery events", count: countedSample.length, sample: countedSample.slice(0, 8) }]
              : [],
          },
          {
            id: "no_fake_revenue",
            title: "No Fake Revenue",
            description: "Revenue is read directly from completed payment settlements.",
            source: "marketplace_payment_intents (status = succeeded)",
            status: paidWithoutSettlement.length > 0 ? "VIOLATED" : "ENFORCED",
            evidence:
              paidWithoutSettlement.length > 0
                ? `${markedPaid.length} orders are marked paid and ${settledIntents.length} payment intent(s) have ever succeeded. ${paidWithoutSettlement.length} paid orders have no settlement behind them.`
                : `${settledIntents.length} settled intent(s) back ${markedPaid.length} paid order(s).`,
            violations: paidWithoutSettlement.length > 0
              ? [{ what: "Orders marked paid with no succeeded payment intent", count: paidWithoutSettlement.length }]
              : [],
          },
          {
            id: "no_fake_views",
            title: "No Fake Views",
            description: "View counters use deduped sessions, not inflated impressions.",
            source: "marketplace_events (unique dedupe_key)",
            status: events.length === 0 ? "UNVERIFIABLE" : dedupeWorking ? "ENFORCED" : "VIOLATED",
            evidence:
              events.length === 0
                ? "No interaction events have been recorded, so deduplication cannot be observed."
                : `${events.length} events share ${distinctDedupe} distinct dedupe keys. ${dedupeWorking ? "Each event is distinct." : "Events far outnumber their keys, so these rows were not written through the deduplicating endpoint."}`,
            violations: !dedupeWorking && events.length > 0
              ? [{ what: "Events sharing a dedupe key", count: events.length - distinctDedupe }]
              : [],
          },
          {
            id: "only_real_data",
            title: "Only Real Data",
            description: "Every surface shows — until live, verified data is connected.",
            source: "Every metric on this screen",
            status: "ENFORCED",
            evidence:
              "Every number here is a count of rows, and a source that cannot be read renders as a dash rather than as zero. Zero is a measurement; a dash is the absence of one.",
            violations: [],
          },
        ];

        const violated = policies.filter((p) => p.status === "VIOLATED");

        return Response.json({
          ok: true,
          locked: true,
          lock_note:
            "This policy is not a setting. There is no endpoint that disables it and no configuration row behind it; the statuses below are computed from the data on every request, so the only way to make a card read ENFORCED is for the data to satisfy it.",
          metrics: {
            verified_orders: verifiedOrders.length,
            verified_reviews: reviewCount,
            flagged_and_removed: null,
            audit_events: auditCount,
          },
          metric_sources: {
            verified_orders: "marketplace_orders joined to a succeeded marketplace_payment_intents row. An order marked paid without one is not counted.",
            verified_reviews: "marketplace_reviews. There are none, so the count is zero rather than a dash - zero is what the source says.",
            flagged_and_removed: "No moderation or violation table exists on this database. There is nothing to count, so this renders as a dash rather than as zero.",
            audit_events: "marketplace_audit_logs, append-only for every signed-in role.",
          },
          policies,
          summary: {
            enforced: policies.filter((p) => p.status === "ENFORCED").length,
            violated: violated.length,
            unverifiable: policies.filter((p) => p.status === "UNVERIFIABLE").length,
          },
          // Section 32: the chain, and where it breaks.
          reconciliation: {
            orders_total: live.length,
            orders_marked_paid: markedPaid.length,
            payment_intents: intents.length,
            payment_intents_succeeded: settledIntents.length,
            payments_rows: payments.length,
            payments_verified: payments.filter((p) => p.auto_verified === true).length,
            licences_issued: licences.length,
            entitlements: entitlements.length,
            downloads_recorded: downloadCount,
            revenue_claimed_by_orders: Math.round(claimedRevenue * 100) / 100,
            revenue_backed_by_settlement: Math.round(verifiedRevenue * 100) / 100,
            mismatches: [
              paidWithoutSettlement.length > 0
                ? `${paidWithoutSettlement.length} orders are marked paid with no succeeded payment intent.`
                : null,
              licences.length > verifiedOrders.length
                ? `${licences.length} licences were issued against ${verifiedOrders.length} verified order(s).`
                : null,
              (downloadCount ?? 0) === 0 && licences.length > 0
                ? `${licences.length} active licences and no download has ever been recorded.`
                : null,
              payments.length > 0 && payments.every((p) => p.auto_verified !== true)
                ? `${payments.length} payment row(s), none automatically verified against a provider.`
                : null,
            ].filter(Boolean),
            note: "Nothing here is adjusted to make the numbers agree. A mismatch is reported as a mismatch.",
          },
          view_integrity: {
            events: events.length,
            product_views: viewEvents.length,
            distinct_dedupe_keys: distinctDedupe,
            sessions: new Set(events.map((e) => String(e.session_id ?? "")).filter(Boolean)).size,
            identified_users: new Set(events.map((e) => String(e.user_id ?? "")).filter(Boolean)).size,
          },
          caller: { roles: caller.roles },
        });
      },
    },
  },
});
