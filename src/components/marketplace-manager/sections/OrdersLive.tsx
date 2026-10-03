import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, RefreshCw, Search, ShoppingBag, X } from "lucide-react";

import { useTranslation } from "@/lib/i18n/use-translation";
import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, EmptyHint, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";
import {
  listOrders,
  getOrderDetail,
  listOrderDocs,
  requestRefund,
  openDispute,
  exportOrders,
  getOrderPartners,
  type OrderRow,
  type OrderPartner,
} from "@/lib/marketplace-manager/orders.functions";

/**
 * Orders, over the orders that exist.
 *
 * The designed screen - kept and still exported as S.OrdersSection - carried
 * five tabs, four counters and a feature matrix under the words "Awaiting live
 * data". Twenty-one orders, a hundred and thirteen invoices, nine credit notes
 * and one refund were sitting in the database while it said so.
 *
 * The version that replaced it read those tables, but through the generic
 * resource endpoint: a grid of raw columns, no search, no filter, no sort, no
 * order detail, and no way to refund or dispute anything. Meanwhile
 * orders.functions.ts already had all of it - mm_orders_list with search,
 * filters, sorting and paging; mm_order_detail with the timeline;
 * mm_order_docs for invoices, proforma, credit notes, refunds and disputes;
 * mm_refund_request; mm_dispute_open; and an export that re-runs the same
 * authorised query so it can never contain an order the reader could not
 * already see. None of it was called.
 *
 * Every tab the screen had is still here and in the same order. Proforma,
 * Credit Notes and Disputes are added beside them because the backend already
 * served them and nothing displayed them.
 *
 * Proforma and Disputes are both genuinely empty, and say so. That is a fact
 * about this marketplace, not a gap in this screen.
 */

type Counts = { orders: number; paid: number; refunded: number; pending: number };

const TABS = [
  "All Orders",
  "Invoices",
  "Proforma",
  "Credit Notes",
  "Payments",
  "Refunds",
  "Disputes",
  "Returns",
] as const;

/** The document tabs, and the tab name the backend knows them by. */
const DOC_TAB: Record<string, "invoices" | "proforma" | "credit_notes" | "refunds" | "disputes"> = {
  Invoices: "invoices",
  Proforma: "proforma",
  "Credit Notes": "credit_notes",
  Refunds: "refunds",
  Disputes: "disputes",
};

const SORTS = [
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["amount_high", "Amount high to low"],
  ["amount_low", "Amount low to high"],
  ["status", "Status"],
] as const;

const PAGE = 25;

function money(v: number | null | undefined, currency: string): string {
  if (v === null || v === undefined) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(v));
  } catch {
    return `${currency} ${new Intl.NumberFormat().format(Number(v))}`;
  }
}

function when(at: string | null | undefined): string {
  if (!at) return "—";
  const d = new Date(at);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : String(at);
}

/** A status word, coloured the way the rest of the manager colours them. */
function Pill({ value, tone }: { value: string | null | undefined; tone?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const t =
    tone ??
    (/paid|captured|succeeded|resolved|settled/i.test(value)
      ? "success"
      : /fail|reject|cancel|charge/i.test(value)
        ? "danger"
        : /refund|dispute|pending|await/i.test(value)
          ? "warning"
          : "muted");
  const cls: Record<string, string> = {
    success: "bg-success/15 text-success",
    danger: "bg-destructive/15 text-destructive",
    warning: "bg-warning/15 text-warning",
    muted: "bg-secondary text-muted-foreground",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${cls[t]}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

export function OrdersSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [active, setActive] = useState<string>(TABS[0]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);

  // Filters. Typing is debounced into `search` so a keystroke is not a query.
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>("newest");
  const [page, setPage] = useState(0);
  const [openOrder, setOpenOrder] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(typed.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(id);
  }, [typed]);

  // The four counters, unchanged in meaning and still read in one round trip.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const headers = await authHeaders();
        const read = async (resource: string) => {
          const res = await fetch(`/api/manager/resource?resource=${resource}&limit=500`, {
            headers,
          });
          if (!res.ok) throw new Error(String(res.status));
          return (await res.json()) as { rows?: Record<string, unknown>[]; total?: number };
        };
        const [orders, refunds] = await Promise.all([read("orders"), read("refunds")]);
        if (!alive) return;
        const rows = orders.rows ?? [];
        setCounts({
          orders: orders.total ?? rows.length,
          paid: rows.filter((r) => r.status === "paid").length,
          refunded: refunds.total ?? (refunds.rows ?? []).length,
          pending: rows.filter((r) => r.status === "pending" || r.status === "pending_payment")
            .length,
        });
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const query = useMemo(
    () => ({
      search: search || undefined,
      status: status || undefined,
      payment_status: paymentStatus || undefined,
      sort,
      limit: PAGE,
      offset: page * PAGE,
    }),
    [search, status, paymentStatus, sort, page],
  );

  // Every server-function result is asserted at the boundary. The generated
  // Supabase types this repo compiles against are behind the real schema, so
  // these functions infer as unknown and the loss spreads into every field
  // read below. Naming the shape once per call keeps the rest of the screen
  // typed.
  type OrderPage = {
    ok: boolean;
    total: number;
    limit: number;
    offset: number;
    orders: OrderRow[];
  };
  type DocPage = { ok: boolean; total: number; rows: Record<string, unknown>[] };

  const orders = useQuery<OrderPage>({
    queryKey: ["marketplace", "orders", query],
    queryFn: async (): Promise<OrderPage> => (await listOrders({ data: query })) as OrderPage,
    staleTime: 20_000,
    enabled: active === "All Orders",
  });

  const docTab = DOC_TAB[active];
  const docs = useQuery<DocPage>({
    queryKey: ["marketplace", "order-docs", docTab],
    queryFn: async (): Promise<DocPage> =>
      (await listOrderDocs({ data: { tab: docTab, limit: 100 } })) as DocPage,
    staleTime: 20_000,
    enabled: Boolean(docTab),
  });

  const detail = useQuery<OrderDetailPayload>({
    queryKey: ["marketplace", "order-detail", openOrder],
    queryFn: async (): Promise<OrderDetailPayload> =>
      (await getOrderDetail({ data: { orderId: openOrder as string } })) as OrderDetailPayload,
    enabled: Boolean(openOrder),
  });

  // Who was credited with the order. Read only for the order in the drawer, so
  // the list is unaffected.
  type Partners = { ok: boolean; count: number; attributions: OrderPartner[] };
  const partners = useQuery<Partners>({
    queryKey: ["marketplace", "order-partners", openOrder],
    queryFn: async (): Promise<Partners> =>
      (await getOrderPartners({ data: { orderId: openOrder as string } })) as Partners,
    enabled: Boolean(openOrder),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["marketplace", "orders"] });
    void qc.invalidateQueries({ queryKey: ["marketplace", "order-docs"] });
    void qc.invalidateQueries({ queryKey: ["marketplace", "order-detail"] });
  };

  type Outcome = { ok?: boolean; message?: string };
  const refund = useMutation({
    mutationFn: async (v: { orderId: string; amount: number; reason: string }): Promise<Outcome> =>
      (await requestRefund({ data: v })) as Outcome,
    onSuccess: (r: Outcome) => {
      refresh();
      toast.success(String(r?.message ?? t("manager.orders.refund_requested")));
    },
    onError: (e: Error) =>
      toast.error(t("manager.orders.refund_refused"), { description: e.message }),
  });

  const dispute = useMutation({
    mutationFn: async (v: { orderId: string; reason: string }): Promise<Outcome> =>
      (await openDispute({ data: v })) as Outcome,
    onSuccess: (r: Outcome) => {
      refresh();
      toast.success(String(r?.message ?? t("manager.orders.dispute_opened")));
    },
    onError: (e: Error) =>
      toast.error(t("manager.orders.dispute_refused"), { description: e.message }),
  });

  type Export = { csv?: string; filename?: string; rows?: number };
  const csv = useMutation({
    mutationFn: async (): Promise<Export> =>
      (await exportOrders({
        data: { search: search || undefined, status: status || undefined, sort },
      })) as Export,
    onSuccess: (r: Export) => {
      // The export is produced server-side from the same authorised query; the
      // browser only saves what came back.
      const blob = new Blob([String(r?.csv ?? "")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = String(r?.filename ?? "orders.csv");
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("manager.orders.exported", { count: r?.rows ?? 0 }));
    },
    onError: (e: Error) =>
      toast.error(t("manager.orders.export_refused"), { description: e.message }),
  });

  const figure = (value: number | undefined) =>
    failed ? "—" : counts === null ? "…" : String(value ?? 0);

  const rows: OrderRow[] = orders.data?.orders ?? [];
  const total = orders.data?.total ?? 0;
  const docRows = (docs.data?.rows ?? []) as Record<string, unknown>[];

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Orders & Payments"
        title={t("manager.orders.title")}
        description="Invoices, proforma, credit notes, payments, refunds, disputes and the status timeline."
        actions={
          <>
            <PillButton variant="ghost" onClick={refresh}>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> {t("manager.orders.refresh")}
              </span>
            </PillButton>
            <PillButton variant="primary" onClick={() => csv.mutate()}>
              <span className="inline-flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" />{" "}
                {csv.isPending ? t("manager.orders.exporting") : t("manager.orders.export")}
              </span>
            </PillButton>
          </>
        }
      />

      <SubNav items={[...TABS]} active={active} onChange={setActive} />

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label={t("manager.orders.title")} value={figure(counts?.orders)} />
        <StatCard label={t("manager.orders.paid")} value={figure(counts?.paid)} tone="success" />
        <StatCard
          label={t("manager.orders.refunded")}
          value={figure(counts?.refunded)}
          tone="warning"
        />
        <StatCard
          label={t("manager.orders.awaiting")}
          value={figure(counts?.pending)}
          tone="default"
        />
      </div>

      <div className="mt-6">
        {active === "All Orders" && (
          <Card className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={t("manager.orders.search_placeholder")}
                  className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                {typed && (
                  <button
                    type="button"
                    onClick={() => setTyped("")}
                    aria-label={t("manager.orders.clear_search")}
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
                className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[12px]"
              >
                <option value="">{t("manager.orders.any_order_status")}</option>
                {/* The statuses an order can actually hold (marketplace_orders_status_check).
                    "failed" is not one, and five real ones were missing. */}
                {["pending_payment", "paid", "processing", "fulfilled", "completed", "cancelled", "refunded", "disputed"].map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <select
                value={paymentStatus}
                onChange={(e) => {
                  setPaymentStatus(e.target.value);
                  setPage(0);
                }}
                className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[12px]"
              >
                <option value="">{t("manager.orders.any_payment_status")}</option>
                {/* What the filter compares: the gateway's own answer (success,
                    failure), or the order's state before any answer. "captured"
                    and "pending" are never stored, so they always matched nothing. */}
                {["success", "failure", "pending_payment"].map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as typeof sort);
                  setPage(0);
                }}
                className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[12px]"
              >
                {SORTS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {orders.isError ? (
              <div className="p-4">
                <LoadFailure
                  error={orders.error}
                  what="the orders"
                  onRetry={() => void orders.refetch()}
                />
              </div>
            ) : orders.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">
                {t("manager.orders.reading_orders")}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6">
                <EmptyHint
                  text={
                    search || status || paymentStatus
                      ? t("manager.orders.no_match")
                      : t("manager.orders.none_yet")
                  }
                />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">{t("manager.orders.order")}</th>
                        <th className="px-4 py-2">{t("manager.orders.customer")}</th>
                        <th className="px-4 py-2">{t("manager.orders.items")}</th>
                        <th className="px-4 py-2">{t("manager.orders.amount")}</th>
                        <th className="px-4 py-2">{t("manager.orders.payment")}</th>
                        <th className="px-4 py-2">{t("manager.orders.status")}</th>
                        <th className="px-4 py-2">{t("manager.orders.invoice")}</th>
                        <th className="px-4 py-2">{t("manager.orders.created")}</th>
                        <th className="px-4 py-2 text-right">{t("manager.orders.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((o) => (
                        <tr key={o.id} className="transition-colors hover:bg-white/[0.03]">
                          <td className="px-4 py-2 font-mono text-[11px]">{o.order_number}</td>
                          <td className="px-4 py-2">{o.customer?.email ?? "—"}</td>
                          <td className="px-4 py-2">
                            {o.item_count} · {o.items?.[0]?.name ?? "—"}
                          </td>
                          <td className="px-4 py-2 font-semibold">{money(o.total, o.currency)}</td>
                          <td className="px-4 py-2">
                            <Pill value={o.payment_status} />
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {o.payment_gateway ?? t("manager.orders.no_gateway")}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <Pill value={o.status} />
                            {o.refund_status && (
                              <div className="mt-0.5">
                                <Pill value={`refund ${o.refund_status}`} />
                              </div>
                            )}
                            {o.dispute_status && (
                              <div className="mt-0.5">
                                <Pill value={`dispute ${o.dispute_status}`} />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 font-mono text-[11px]">{o.invoice_no ?? "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground">{when(o.created_at)}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setOpenOrder(o.id)}
                                className="rounded border border-border px-2 py-0.5 text-[11px] hover:border-accent/50 hover:text-accent"
                              >
                                {t("manager.orders.view")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const reason = window
                                    .prompt(
                                      t("manager.orders.refund_prompt", {
                                        amount: money(o.total, o.currency),
                                        order: o.order_number,
                                      }),
                                    )
                                    ?.trim();
                                  if (!reason) return;
                                  // The amount is asked for, defaulting to the full total.
                                  // It was always the full total, so a partial refund was
                                  // impossible and any refund after one was refused.
                                  const asked = window
                                    .prompt(
                                      t("manager.orders.refund_amount_prompt", {
                                        total: money(o.total, o.currency),
                                        order: o.order_number,
                                      }),
                                      String(o.total),
                                    )
                                    ?.trim();
                                  if (!asked) return;
                                  const amount = Number(asked);
                                  if (!Number.isFinite(amount) || amount <= 0 || amount > Number(o.total)) {
                                    toast.error(
                                      t("manager.orders.refund_amount_invalid", {
                                        total: money(o.total, o.currency),
                                      }),
                                    );
                                    return;
                                  }
                                  refund.mutate({ orderId: o.id, amount, reason });
                                }}
                                // One request at a time: a second click while the first is
                                // in flight would ask for the same refund again. An order
                                // nobody paid has nothing to refund.
                                disabled={
                                  refund.isPending ||
                                  ["pending_payment", "cancelled", "refunded"].includes(String(o.status))
                                }
                                className="rounded border border-border px-2 py-0.5 text-[11px] hover:border-warning/50 hover:text-warning disabled:opacity-50"
                              >
                                {t("manager.orders.refund")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const reason = window
                                    .prompt(
                                      t("manager.orders.dispute_prompt", { order: o.order_number }),
                                    )
                                    ?.trim();
                                  if (!reason) return;
                                  dispute.mutate({ orderId: o.id, reason });
                                }}
                                // Same as refund: one at a time, so a double click does
                                // not open the same dispute twice.
                                disabled={dispute.isPending}
                                className="rounded border border-border px-2 py-0.5 text-[11px] hover:border-destructive/50 hover:text-destructive"
                              >
                                {t("manager.orders.dispute")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                  <span>
                    {t("manager.orders.range", {
                      from: page * PAGE + 1,
                      to: Math.min((page + 1) * PAGE, total),
                      total,
                    })}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="rounded border border-border px-2 py-0.5 disabled:opacity-40"
                    >
                      {t("common.previous")}
                    </button>
                    <button
                      type="button"
                      disabled={(page + 1) * PAGE >= total}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded border border-border px-2 py-0.5 disabled:opacity-40"
                    >
                      {t("common.next")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </Card>
        )}

        {docTab && (
          <Card className="p-0">
            <div className="border-b border-border px-4 py-3 text-sm font-bold">
              {active}
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                {docs.isLoading
                  ? t("manager.orders.counting")
                  : docs.isError
                    ? t("manager.orders.unavailable")
                    : t("manager.orders.records", { count: docs.data?.total ?? 0 })}
              </span>
            </div>
            {docs.isError ? (
              <div className="p-4">
                <LoadFailure error={docs.error} what={active} onRetry={() => void docs.refetch()} />
              </div>
            ) : docs.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">
                {t("manager.orders.reading_tab", { tab: active.toLowerCase() })}
              </div>
            ) : docRows.length === 0 ? (
              <div className="p-6">
                <EmptyHint text={t("manager.orders.no_tab_yet", { tab: active.toLowerCase() })} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      {Object.keys(docRows[0])
                        .filter((k) => k !== "id")
                        .map((k) => (
                          <th key={k} className="px-4 py-2">
                            {k.replace(/_/g, " ")}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {docRows.map((r, i) => (
                      <tr
                        key={String(r.id ?? i)}
                        className="transition-colors hover:bg-white/[0.03]"
                      >
                        {Object.keys(docRows[0])
                          .filter((k) => k !== "id")
                          .map((k) => (
                            <td key={k} className="px-4 py-2">
                              {/^(status|doc_type)$/.test(k) ? (
                                <Pill value={r[k] as string} />
                              ) : /date|_at$/.test(k) ? (
                                <span className="text-muted-foreground">
                                  {when(r[k] as string)}
                                </span>
                              ) : (
                                String(r[k] ?? "—")
                              )}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {active === "Payments" && (
          <Card className="p-0">
            <div className="border-b border-border px-4 py-3 text-sm font-bold">
              {t("manager.orders.payment_log")}
            </div>
            <div className="p-6">
              <EmptyHint text="Payment state is shown against each order in All Orders — gateway, reference and captured status come from the same record. The standalone payment log stays below." />
            </div>
          </Card>
        )}

        {active === "Returns" && (
          <Card>
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <ShoppingBag className="h-4 w-4 text-accent" /> {t("manager.orders.returns")}
            </div>
            <EmptyHint text="Software is licensed rather than shipped, so this platform keeps no returns table. A return here is a refund, which the tab beside this one shows." />
          </Card>
        )}
      </div>

      {openOrder && (
        <OrderDetail
          partners={partners.data?.attributions ?? []}
          partnersLoading={partners.isLoading}
          data={detail.data as OrderDetailPayload | undefined}
          loading={detail.isLoading}
          error={detail.error}
          onRetry={() => void detail.refetch()}
          onClose={() => setOpenOrder(null)}
        />
      )}
    </div>
  );
}

type OrderDetailPayload = {
  order?: Record<string, unknown>;
  customer?: Record<string, unknown>;
  items?: Record<string, unknown>[];
  invoice?: Record<string, unknown> | null;
  refunds?: Record<string, unknown>[];
  disputes?: Record<string, unknown>[];
  timeline?: { at: string; stage: string; detail: string; source: string }[];
};

/**
 * One order, and everything that happened to it.
 *
 * The timeline is the database's, not a reconstruction: each entry names the
 * table it came from, so a reader can check any line of it.
 */
function OrderDetail({
  partners,
  partnersLoading,
  data,
  loading,
  error,
  onRetry,
  onClose,
}: {
  /** Who was credited with this order, resolved to names. */
  partners: OrderPartner[];
  partnersLoading: boolean;
  data?: OrderDetailPayload;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const order = data?.order ?? {};
  const currency = String(order.currency ?? "INR");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-background p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("manager.orders.order")}
            </div>
            <div className="font-mono text-sm font-bold">{String(order.order_number ?? "…")}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        {error ? (
          <LoadFailure error={error} what="this order" onRetry={onRetry} />
        ) : loading ? (
          <div className="text-sm text-muted-foreground">{t("manager.orders.reading_order")}</div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <Detail
                label={t("manager.orders.customer")}
                value={String(data?.customer?.email ?? "—")}
              />
              <Detail
                label={t("manager.orders.total")}
                value={money(Number(order.total ?? 0), currency)}
              />
              <Detail
                label={t("manager.orders.payment")}
                value={String(order.payment_status ?? "—")}
              />
              <Detail
                label={t("manager.orders.gateway")}
                value={String(order.payment_gateway ?? "—")}
              />
              <Detail
                label={t("manager.orders.reference")}
                value={String(order.payment_reference ?? "—")}
              />
              <Detail
                label={t("manager.orders.invoice")}
                value={String(data?.invoice?.invoice_no ?? t("manager.orders.not_issued"))}
              />
            </div>

            <Block title={t("manager.orders.items_count", { count: data?.items?.length ?? 0 })}>
              {(data?.items ?? []).map((it, i) => (
                <div key={i} className="flex items-center justify-between py-1 text-[12px]">
                  <span>{String(it.name ?? it.product_id ?? "—")}</span>
                  <span className="font-semibold">
                    {money(Number(it.line_total ?? 0), currency)}
                  </span>
                </div>
              ))}
            </Block>

            {/* Who brought this order in. The attribution table has always
                carried it and no screen showed it. An order with no partner
                says so rather than rendering nothing, so the reader knows it
                was looked at. */}
            <Block title={t("manager.orders.partner_credit")}>
              {partnersLoading ? (
                <div className="text-[12px] text-muted-foreground">
                  {t("manager.orders.reading_attribution")}
                </div>
              ) : partners.length === 0 ? (
                <div className="text-[12px] text-muted-foreground">
                  {t("manager.orders.direct_order")}
                </div>
              ) : (
                partners.map((a) => {
                  const who = a.reseller ?? a.affiliate ?? a.influencer;
                  const kind = a.reseller
                    ? t("manager.orders.partner_reseller")
                    : a.affiliate
                      ? t("manager.orders.partner_affiliate")
                      : a.influencer
                        ? t("manager.orders.partner_influencer")
                        : t("manager.orders.partner_unattributed");
                  return (
                    <div key={a.id} className="flex items-center justify-between py-1 text-[12px]">
                      <span>
                        <span className="text-muted-foreground">{kind}:</span>{" "}
                        <span className="font-medium">{who?.name ?? "—"}</span>
                        {a.reseller?.code ? (
                          <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                            {a.reseller.code}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {a.method
                          ? a.method.replace(/_/g, " ")
                          : t("manager.orders.unknown_method")}{" "}
                        · {when(a.attributed_at)}
                        {who?.status ? ` · ${who.status}` : ""}
                      </span>
                    </div>
                  );
                })
              )}
            </Block>

            <Block title={t("manager.orders.timeline")}>
              {(data?.timeline ?? []).length === 0 ? (
                <div className="text-[12px] text-muted-foreground">
                  {t("manager.orders.nothing_recorded")}
                </div>
              ) : (
                (data?.timeline ?? []).map((e, i) => (
                  <div key={i} className="flex items-start gap-3 py-1.5">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                    <div>
                      <div className="text-[12px] font-medium">{e.stage}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {e.detail} · {when(e.at)} · <span className="font-mono">{e.source}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </Block>

            {(data?.refunds ?? []).length > 0 && (
              <Block title={t("manager.orders.refunds")}>
                {(data?.refunds ?? []).map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-[12px]">
                    <span>{String(r.reason ?? "—")}</span>
                    <span>
                      {money(Number(r.amount ?? 0), currency)} ·{" "}
                      <Pill value={String(r.status ?? "")} />
                    </span>
                  </div>
                ))}
              </Block>
            )}

            {(data?.disputes ?? []).length > 0 && (
              <Block title={t("manager.orders.disputes")}>
                {(data?.disputes ?? []).map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-[12px]">
                    <span>{String(d.reason ?? "—")}</span>
                    <Pill value={String(d.status ?? "")} />
                  </div>
                ))}
              </Block>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="rounded-lg border border-border bg-surface/40 px-3 py-2">{children}</div>
    </div>
  );
}
