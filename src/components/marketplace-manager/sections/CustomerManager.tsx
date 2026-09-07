import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Crown, Info, Search, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  getCustomersOverview, listCustomers, getCustomerProfile, type CustomerRow,
} from "@/lib/marketplace-manager/customers.functions";

/**
 * Customers — the screen that already existed, now connected.
 *
 * It was a ModulePage listing ten feature names over four stat cards with no
 * values. The data it describes has been in the database all along: 84
 * accounts, 15 with an order, 8 who have paid, 20 orders, 10 licences.
 *
 * No customer table was created. auth.users and profiles already are the
 * customer record, and a third would have been the duplication this must not
 * become. Customer type and VIP are derived from real purchase history rather
 * than stored in a column that nothing maintains.
 *
 * Five of the ten features in the original list cannot be shown, and each says
 * why rather than displaying a zero that would read as "none":
 *
 *   Support tickets  the eleven tickets carry a customer_id that matches no
 *                    auth.users id — they belong to another customer system
 *   Subscriptions    finance_subscriptions has no user column at all
 *   Activity         activity_logs is empty
 *   Wishlist         there is no wishlist table in this database
 *   Reviews          marketplace_reviews holds no rows
 */

const money = (v: unknown) =>
  typeof v === "number" || typeof v === "string"
    ? `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : "—";

const when = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString() : "—";

function Unavailable({ items }: { items: Record<string, string> }) {
  const entries = Object.entries(items ?? {});
  if (entries.length === 0) return null;
  return (
    <Card className="mt-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
        <Info className="h-4 w-4 text-muted-foreground" />
        Not connected yet
      </h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        These appear in the customer feature list but have nothing to read. Each says
        why, rather than showing a zero that would look like an answer.
      </p>
      <div className="space-y-1">
        {entries.map(([k, reason]) => (
          <div key={k} className="rounded-lg border border-border/60 px-3 py-1.5">
            <div className="text-xs font-semibold capitalize">{k.replace(/_/g, " ")}</div>
            <div className="text-[11px] text-muted-foreground">{reason}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CustomerProfile({ id, onBack }: { id: string; onBack: () => void }) {
  const profile = useQuery({
    queryKey: ["marketplace", "customer", id],
    queryFn: () => getCustomerProfile({ data: { id } }),
    staleTime: 15_000,
  });

  const d = profile.data as {
    ok?: boolean;
    customer?: Record<string, string | null>;
    orders?: Record<string, unknown>[];
    licences?: Record<string, unknown>[];
    entitlements?: Record<string, unknown>[];
    lifetime_value?: number;
  } | undefined;

  const c = d?.customer;

  return (
    <div className="px-4 py-8 md:px-8">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All customers
      </button>

      <PageHeader
        eyebrow="Customer"
        title={c?.full_name || c?.email || "Customer"}
        description={`${c?.email ?? ""}${c?.phone ? ` · ${c.phone}` : ""}`}
      />

      {profile.isLoading && <EmptyHint text="Reading the customer…" />}
      {d?.ok === false && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          This customer could not be read.
        </div>
      )}

      {d?.ok && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Lifetime value" value={money(d.lifetime_value)} tone="success" />
            <StatCard label="Orders" value={String(d.orders?.length ?? 0)} />
            <StatCard label="Licences" value={String(d.licences?.length ?? 0)} tone="premium" />
            <StatCard label="Entitlements" value={String(d.entitlements?.length ?? 0)} />
          </div>

          <div className="mb-3 text-[11px] text-muted-foreground">
            Registered {when(c?.registered_at)} · last signed in {when(c?.last_sign_in_at)}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-base font-bold">Orders</h3>
              <div className="space-y-1">
                {(d.orders ?? []).map((o) => (
                  <div key={String(o.id)} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold">{String(o.order_number ?? o.id)}</div>
                      <div className="text-[11px] text-muted-foreground">{when(String(o.created_at))}</div>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      <span className="text-xs font-bold">{money(o.total)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        o.status === "paid" ? "bg-success/15 text-success" : "bg-muted/40 text-muted-foreground"
                      }`}>{String(o.status)}</span>
                    </div>
                  </div>
                ))}
                {(d.orders ?? []).length === 0 && <EmptyHint text="This account has never ordered." />}
              </div>
            </Card>

            <Card>
              <h3 className="mb-3 text-base font-bold">Licences</h3>
              <div className="space-y-1">
                {(d.licences ?? []).map((l, i) => (
                  <div key={i} className="rounded-lg border border-border/60 px-3 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">{String(l.product ?? "—")}</span>
                      <span className="flex-none rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                        {String(l.status)}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {String(l.license_key)} · {String(l.model)}
                    </div>
                  </div>
                ))}
                {(d.licences ?? []).length === 0 && <EmptyHint text="No licence has been issued to this account." />}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export function CustomersSection() {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<"all" | "customers" | "registered" | "vip">("all");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(term.trim()); setOffset(0); }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const overview = useQuery({
    queryKey: ["marketplace", "customers-overview"],
    queryFn: () => getCustomersOverview(),
    staleTime: 30_000,
  });

  const list = useQuery({
    queryKey: ["marketplace", "customers", debounced, filter, offset],
    queryFn: () => listCustomers({ data: { search: debounced || undefined, filter, limit: 25, offset } }),
    staleTime: 15_000,
  });

  const o = overview.data as Record<string, number | Record<string, string> | boolean> | undefined;
  const rows = (list.data?.customers ?? []) as CustomerRow[];
  const total = list.data?.total ?? 0;

  const n = (k: string) => (overview.isLoading ? "…" : String((o?.[k] as number) ?? 0));

  if (open) return <CustomerProfile id={open} onBack={() => setOpen(null)} />;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Customers"
        title="Customers"
        description="Profiles, wishlists, orders, tickets and lifetime activity timeline."
      />

      {(o as { ok?: boolean } | undefined)?.ok === false && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>Customer data needs marketplace operator rights.</span>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Accounts" value={n("accounts")} />
        <StatCard label="Paying customers" value={n("customers")} tone="success" />
        <StatCard label="With any order" value={n("with_any_order")} />
        <StatCard label="VIP" value={n("vip")} tone="premium" />
        <StatCard label="Licences" value={n("licences")} />
        <StatCard label="Lifetime value" value={money(o?.lifetime_value)} tone="success" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search name, email, phone or customer id"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
        {(["all", "customers", "registered", "vip"] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setOffset(0); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              filter === f ? "bg-accent text-accent-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {list.isLoading && <EmptyHint text="Reading customers…" />}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-3 font-semibold">Customer</th>
              <th className="pb-2 pr-3 font-semibold">Type</th>
              <th className="pb-2 pr-3 text-right font-semibold">Orders</th>
              <th className="pb-2 pr-3 text-right font-semibold">Licences</th>
              <th className="pb-2 pr-3 text-right font-semibold">Lifetime</th>
              <th className="pb-2 font-semibold">Registered</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                onClick={() => setOpen(c.id)}
                className="cursor-pointer border-b border-border/40 hover:bg-muted/20"
              >
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold">
                        {c.full_name || c.email}
                        {c.vip && <Crown className="ml-1 inline h-3 w-3 text-amber-400" />}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">{c.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2 pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    c.customer_type === "customer" ? "bg-success/15 text-success" : "bg-muted/40 text-muted-foreground"
                  }`}>{c.customer_type}</span>
                </td>
                <td className="py-2 pr-3 text-right text-xs">{c.paid_orders}/{c.orders}</td>
                <td className="py-2 pr-3 text-right text-xs">{c.licences}</td>
                <td className="py-2 pr-3 text-right text-xs font-bold">{money(c.lifetime_value)}</td>
                <td className="py-2 text-[11px] text-muted-foreground">{when(c.registered_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.isLoading && rows.length === 0 && <EmptyHint text="No customer matches that." />}
      </Card>

      {total > 25 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {offset + 1}–{Math.min(offset + 25, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 25))}
              className="rounded-full border border-border px-3 py-1 font-semibold disabled:opacity-30"
            >
              Previous
            </button>
            <button
              disabled={offset + 25 >= total}
              onClick={() => setOffset(offset + 25)}
              className="rounded-full border border-border px-3 py-1 font-semibold disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <Unavailable items={(o?.unavailable as Record<string, string>) ?? {}} />
    </div>
  );
}

export default CustomersSection;
