import {
  TrendingUp,
  Package,
  CheckCircle2,
  Clock3,
  Users2,
  Store,
  ShoppingCart,
  Download,
  DollarSign,
  RotateCcw,
  Activity,
  Plus,
  Megaphone,
  Tag,
  FolderTree,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { Card, EmptyHint, LoadFailure, PageHeader, PillButton, SectionRow, StatCard } from "../ui";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  marketplaceControlSummary,
  marketplaceRevenueSeries,
  type MarketplaceDashboard,
  type RevenueSeries,
} from "@/lib/marketplace-manager/homepage-rows.functions";
import { listHomepageRows, type HomepageRow } from "@/lib/marketplace-manager/rows.functions";

// The static WALLS list is gone. It named ten walls in a fixed order whatever
// the marketplace actually had, on a screen whose job is to report what the
// marketplace actually has. The walls now come from the same registry the
// Homepage Rows manager writes and the front page reads.

type NavId =
  | "products"
  | "hero"
  | "walls"
  | "categories"
  | "offers"
  | "marketing"
  | "analytics"
  | "approval"
  | "payments"
  | "ai"
  | "seo"
  | "homepage-rows"
  | "layout-order"
  | "authors"
  | "vendors"
  | "orders"
  | "downloads"
  | "reviews"
  | "notifications";

/**
 * The control room's numbers, counted in one round trip.
 *
 * Kept in one hook so every card on this screen agrees with every other; two
 * queries would let a KPI and its own queue disagree by a refresh.
 */
function useControlRoom() {
  return useQuery<MarketplaceDashboard>({
    queryKey: ["marketplace", "control-room"],
    queryFn: () => marketplaceControlSummary(),
    staleTime: 30_000,
  });
}

/**
 * Opening the assistant the workspace already mounts.
 *
 * MarketplaceWorkspace listens for `sv:open-vala-ai` and opens the panel it
 * keeps mounted, so a screen asks for the assistant instead of carrying one.
 * The seed rides along in `detail` so the question arrives knowing where it
 * was asked from — an assistant opened from the control room with no idea
 * what the control room is showing is the generic chat this must not be.
 */
function askVala(seed: string) {
  window.dispatchEvent(new CustomEvent("sv:open-vala-ai", { detail: { seed } }));
}

/**
 * The three assistants, each seeded with the figures on this screen.
 *
 * The seed is built from what was actually counted, so the assistant is asked
 * about this marketplace rather than about marketplaces in general. Where a
 * figure has not been measured the sentence says so instead of guessing.
 */
const ASSISTANTS: {
  t: string;
  d: string;
  seed: (d?: MarketplaceDashboard) => string;
}[] = [
  {
    t: "Revenue Assistant",
    d: "Forecasts, opportunity gaps, vendor lift.",
    seed: (d) =>
      d?.revenue
        ? `From the Marketplace control room. Revenue in ${d.revenue.currency}: today ${d.revenue.today}, ` +
          `this week ${d.revenue.this_week}, this month ${d.revenue.this_month}, this year ${d.revenue.this_year}. ` +
          `Refunded ${d.revenue.refunded}, net ${d.revenue.net}, across ${d.commerce.orders} order(s) ` +
          `(${d.commerce.paid} paid, ${d.commerce.pending} awaiting payment). ` +
          `Where is the revenue coming from, and where is it being lost? Cite the orders or products you used.`
        : "From the Marketplace control room. Revenue has not been counted yet — what should I check first?",
  },
  {
    t: "SEO Assistant",
    d: "Page-level meta, schema and ranking fixes.",
    seed: (d) =>
      d?.products
        ? `From the Marketplace control room. The catalogue holds ${d.products.total} product(s): ` +
          `${d.products.published} published, ${d.products.draft} draft, ${d.products.hidden} hidden, ` +
          `${d.products.with_image} with an image and ${d.products.with_demo} with a demo, across ` +
          `${d.products.categories} categories. Which pages lose the most search visibility, and why? ` +
          `Recommend fixes only — do not change anything.`
        : "From the Marketplace control room. The catalogue could not be counted — what should I check first?",
  },
  {
    t: "Campaign Assistant",
    d: "Drafts banners, copy and targeting.",
    seed: (d) =>
      `From the Marketplace control room. ${d?.products?.published ?? "an unknown number of"} published product(s) ` +
      `across ${d?.products?.categories ?? "?"} categories, ${d?.commerce?.orders ?? 0} order(s) so far. ` +
      `Suggest a campaign worth running next, with the audience and the homepage placement you would use. ` +
      `Draft it for review — nothing is published from this conversation.`,
  },
];

/** A timestamp as a reader reads it: how long ago, not an ISO string. */
function when(at: string): string {
  const then = new Date(at).getTime();
  if (!Number.isFinite(then)) return at;
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86_400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86_400)}d ago`;
}

/** A measured number, or an em dash while it is still being counted. */
function num(v: number | null | undefined, loading: boolean): string {
  if (loading) return "\u2014";
  if (v === null || v === undefined) return "not tracked";
  return new Intl.NumberFormat().format(v);
}

function money(v: number | null | undefined, currency: string, loading: boolean): string {
  if (loading) return "\u2014";
  if (v === null || v === undefined) return "not tracked";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
  } catch {
    return currency + " " + new Intl.NumberFormat().format(v);
  }
}

export function DashboardSection({ onNavigate }: { onNavigate?: (id: NavId) => void } = {}) {
  const room = useControlRoom();
  const d = room.data;
  const loading = room.isLoading;

  /**
   * The most pressing thing the marketplace is being told about.
   *
   * Ordered the way an operator would read it: how bad, then how many. A
   * critical check with 3,633 products behind it outranks a medium one with
   * 7,345, because severity is a judgement about consequence and a count is
   * only a size.
   */
  const RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const worst = (d?.attention?.items ?? [])
    .filter((i) => Number(i.count) > 0)
    .sort(
      (a, b) =>
        (RANK[String(a.severity ?? "low")] ?? 9) - (RANK[String(b.severity ?? "low")] ?? 9) ||
        Number(b.count) - Number(a.count),
    )[0];

  // The walls, from the registry that actually feeds the front page.
  const walls = useQuery<HomepageRow[]>({
    queryKey: ["marketplace", "rows"],
    queryFn: () => listHomepageRows(),
    staleTime: 30_000,
  });

  const go = (id: NavId) => onNavigate?.(id);
  return (
    <div className="px-4 py-8 md:px-8">
      {room.isError ? (
        <div className="mb-4">
          <LoadFailure
            error={room.error}
            what="the control room"
            onRetry={() => void room.refetch()}
          />
        </div>
      ) : null}
      <PageHeader
        eyebrow="Marketplace Control Center"
        title="Welcome back to your marketplace"
        description="One control room for products, walls, banners, offers, partners and revenue across the Software Vala marketplace."
        actions={
          <>
            <PillButton variant="ghost" onClick={() => window.open("/marketplace", "_blank")}>
              <span className="inline-flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5" /> View Storefront
              </span>
            </PillButton>
            <PillButton variant="primary" onClick={() => go("products")}>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Product
              </span>
            </PillButton>
          </>
        }
      />

      {/* Hero ribbon — frosted prism with aurora gradient + dot matrix overlay */}
      <div
        className="glow-primary relative mb-10 overflow-hidden rounded-[28px] border border-[oklch(1_0_0/0.10)] p-6 md:p-12"
        style={{ background: "var(--gradient-hero)" }}
      >
        {/* dot matrix */}
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-[0.18]" />
        {/* aurora drift highlights */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-premium/20 blur-[140px]" />
        {/* top inner rim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <div className="relative grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[oklch(0.80_0.13_192/0.30)] bg-[oklch(0.80_0.13_192/0.10)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
              Slide 1 of 10 · Operator Console
            </div>
            <h2 className="text-[40px] font-bold leading-[1.05] tracking-tight md:text-[56px]">
              Run the <span className="text-gradient">entire marketplace</span>
              <br />
              from one operator console.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Manage 20 categories, 18 homepage walls, 20 banner slots, offers, partners and
              approvals. Every dial hooked to live Software Vala data — no mock numbers.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <PillButton variant="primary" onClick={() => go("homepage-rows")}>
                Open Homepage Manager
              </PillButton>
              <PillButton variant="ghost" onClick={() => go("marketing")}>
                Launch Campaign
              </PillButton>
              <PillButton variant="premium" onClick={() => go("analytics")}>
                Boost Revenue
              </PillButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                l: "Revenue Today",
                tone: "text-accent",
                bar: "bg-accent",
                v:
                  d && !d.revenue.has_transactions
                    ? "No transactions yet"
                    : money(d?.revenue.today, d?.revenue.currency ?? "INR", loading),
                note: d
                  ? `${money(d.revenue.all_time, d.revenue.currency, loading)} all time`
                  : "Counting…",
              },
              {
                l: "Active Listings",
                tone: "text-success",
                bar: "bg-success",
                v: num(d?.products.published, loading),
                note: d ? `of ${num(d.products.total, loading)} in the catalogue` : "Counting…",
              },
              {
                l: "Open Queues",
                tone: "text-warning",
                bar: "bg-warning",
                v: num(d?.queues.filter((q) => q.count > 0).length, loading),
                note: d
                  ? `${num(
                      d.queues.reduce((n, q) => n + q.count, 0),
                      loading,
                    )} records waiting`
                  : "Counting…",
              },
              {
                l: "Marketplace Score",
                tone: "text-premium",
                bar: "bg-premium",
                v: loading
                  ? "—"
                  : (d?.score?.score ?? null) === null
                    ? "not scored"
                    : String(d?.score?.score),
                note: d ? `from ${d.score?.factors?.length ?? 0} measured factors` : "Counting…",
              },
            ].map((m) => (
              <div
                key={m.l}
                className="group relative overflow-hidden rounded-2xl border border-[oklch(1_0_0/0.08)] bg-white/[0.04] p-4 backdrop-blur-xl ring-rim transition-all hover:border-[oklch(0.80_0.13_192/0.30)] hover:bg-white/[0.06]"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {m.l}
                </div>
                <div className={`mt-3 font-mono text-2xl font-bold tabular ${m.tone}`}>{m.v}</div>
                <div className="mt-3 h-px w-full bg-border">
                  <div className={`h-full w-1/3 ${m.bar} opacity-70`} />
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">{m.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Zone */}
      <SectionRow title="Marketplace KPIs" cta="Open Analytics" onCta={() => go("analytics")}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Total Products"
            value={num(d?.products.total, loading)}
            delta={`${num(d?.products.categories, loading)} categories`}
            icon={<Package className="h-4 w-4" />}
          />
          <StatCard
            label="Active"
            value={num(d?.products.published, loading)}
            tone="success"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatCard
            label="Pending"
            value={num(d?.products.draft, loading)}
            tone="warning"
            delta="draft or unpublished"
            icon={<Clock3 className="h-4 w-4" />}
          />
          {/* There is no authors table in this database. Sellers is the real
              equivalent the catalogue records, so it is labelled as such
              rather than dressed up as an author count. */}
          <StatCard
            label="Sellers"
            value={num(d?.products.sellers, loading)}
            icon={<Users2 className="h-4 w-4" />}
          />
          <StatCard
            label="With a demo"
            value={num(d?.products.with_demo, loading)}
            tone={d && d.products.with_demo === 0 ? "destructive" : "default"}
            icon={<Store className="h-4 w-4" />}
          />
          <StatCard
            label="Orders"
            value={num(d?.commerce.orders, loading)}
            delta={`${num(d?.commerce.paid, loading)} paid`}
            icon={<ShoppingCart className="h-4 w-4" />}
          />
          <StatCard
            label="Downloads"
            value={num(d?.commerce.downloads, loading)}
            icon={<Download className="h-4 w-4" />}
          />
          <StatCard
            label="Revenue"
            value={
              d && !d.revenue.has_transactions
                ? "No transactions yet"
                : money(d?.revenue.all_time, d?.revenue.currency ?? "INR", loading)
            }
            tone="premium"
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatCard
            label="Refunds"
            value={num(d?.commerce.refunds, loading)}
            tone="destructive"
            delta={d ? money(d.revenue.refunded, d.revenue.currency, loading) : undefined}
            icon={<RotateCcw className="h-4 w-4" />}
          />
          <StatCard
            label="Net revenue"
            value={money(d?.revenue.net, d?.revenue.currency ?? "INR", loading)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          {/* The backend has always returned an attention list — what is
              wrong, how badly, and where to fix it — and nothing on this
              screen read it. The card now names the worst of them and opens
              the records it counted, rather than reporting how many checks
              exist. */}
          <StatCard
            label="Health checks"
            value={num(d?.health?.length, loading)}
            tone={worst && worst.severity === "critical" ? "destructive" : "success"}
            delta={
              loading
                ? undefined
                : worst
                  ? `${worst.label} · ${new Intl.NumberFormat().format(worst.count)}`
                  : d
                    ? "every check is clean"
                    : undefined
            }
            href={worst?.destination}
            icon={<Activity className="h-4 w-4" />}
          />
          <StatCard
            label="MP Score"
            value={
              loading
                ? "—"
                : (d?.score?.score ?? null) === null
                  ? "not scored"
                  : String(d?.score?.score)
            }
            tone="premium"
            icon={<Sparkles className="h-4 w-4" />}
          />
        </div>
      </SectionRow>

      {/* Quick actions */}
      <SectionRow title="Quick Actions" cta="Customize" onCta={() => go("homepage-rows")}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { l: "Add Product", i: Plus, id: "products" as NavId },
            { l: "Create Category", i: FolderTree, id: "categories" as NavId },
            { l: "Create Collection", i: LayoutGridIcon, id: "walls" as NavId },
            { l: "Launch Campaign", i: Megaphone, id: "marketing" as NavId },
            { l: "Create Offer", i: Tag, id: "offers" as NavId },
            { l: "Create Coupon", i: Tag, id: "offers" as NavId },
            { l: "Feature Product", i: Sparkles, id: "walls" as NavId },
            { l: "Approve Listing", i: CheckCircle2, id: "approval" as NavId },
            { l: "Send Announcement", i: Megaphone, id: "notifications" as NavId },
            { l: "Homepage Manager", i: ArrowUpRight, id: "homepage-rows" as NavId },
          ].map((a) => {
            const Icon = a.i;
            return (
              <button
                key={a.l}
                onClick={() => go(a.id)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-surface/40 p-4 text-left transition-all hover:border-accent/40 hover:bg-surface-elevated"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 text-accent group-hover:from-primary group-hover:to-accent group-hover:text-primary-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-semibold">{a.l}</div>
              </button>
            );
          })}
        </div>
      </SectionRow>

      {/* Product Walls (Netflix horizontal) */}
      <SectionRow
        title="Product Walls"
        count={walls.data?.length}
        cta="Open Wall Manager"
        onCta={() => go("homepage-rows")}
      >
        <div className="space-y-6">
          {walls.isLoading && (
            <div className="text-sm text-muted-foreground">Reading the walls…</div>
          )}
          {walls.isError && (
            <LoadFailure
              error={walls.error}
              what="the product walls"
              onRetry={() => void walls.refetch()}
            />
          )}
          {/* The four the front page reaches first, rather than four names
              from a list that never asked the database anything. */}
          {(walls.data ?? []).slice(0, 4).map((row) => (
            <ProductWallRow key={row.key} row={row} onEdit={() => go("homepage-rows")} />
          ))}
          {!walls.isLoading && !walls.isError && (walls.data ?? []).length === 0 && (
            <EmptyHint text="No product walls are configured yet" />
          )}
        </div>
      </SectionRow>

      {/* Two-column ops */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">Approval Center</h3>
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
              Live queue
            </span>
          </div>
          <ul className="divide-y divide-border">
            {loading && (
              <li className="py-3 text-sm text-muted-foreground">Counting the queues…</li>
            )}
            {!loading && (d?.queues ?? []).length === 0 && (
              <li className="py-3 text-sm text-muted-foreground">Nothing is waiting for review.</li>
            )}
            {(d?.queues ?? []).map((q) => (
              <li key={q.key} className="flex items-center justify-between py-3">
                <span className="text-sm">{q.label}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      q.count > 0
                        ? "bg-warning/15 text-warning"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {new Intl.NumberFormat().format(q.count)}
                  </span>
                  {/* Opens the exact set of records the number counted. */}
                  <a
                    href={q.destination}
                    className={`text-xs font-semibold ${
                      q.count > 0 ? "text-accent hover:text-cyan-glow" : "text-muted-foreground"
                    }`}
                  >
                    Review
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">Revenue Center</h3>
            <span className="text-xs text-muted-foreground">INR · live</span>
          </div>
          <div className="space-y-2">
            {/* Each line is the figure mm_dashboard counted, and opens the
                orders it was counted from. */}
            {(
              [
                ["Today", d?.revenue?.today, "today"],
                ["This Week", d?.revenue?.this_week, "week"],
                ["This Month", d?.revenue?.this_month, "month"],
                ["This Year", d?.revenue?.this_year, "year"],
                ["Refunds", d?.revenue?.refunded, "refunds"],
                ["Net Revenue", d?.revenue?.net, "net"],
              ] as [string, number | null | undefined, string][]
            ).map(([k, v, scope]) => (
              <a
                key={k}
                href={`/marketplace-manager?section=commerce&range=${scope}`}
                className="flex items-center justify-between rounded-lg bg-surface/40 px-3 py-2 transition hover:bg-surface/70"
              >
                <span className="text-sm text-muted-foreground">{k}</span>
                <span className="text-sm font-bold">
                  {money(v, d?.revenue?.currency ?? "INR", loading)}
                </span>
              </a>
            ))}
          </div>
          {!loading && d?.revenue && !d.revenue.has_transactions ? (
            <div className="mt-4 rounded-lg border border-dashed border-border/60 bg-background/40 p-3">
              <EmptyHint text="No transactions yet" />
            </div>
          ) : (
            <RevenueGraph currency={d?.revenue?.currency ?? "INR"} />
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">Activity Feed</h3>
            {/* What it actually is. The events are read with the rest of the
                control room every 30 seconds; calling that "real time" would
                be a claim the transport does not make. */}
            <span className="text-xs text-muted-foreground">
              {room.isFetching
                ? "Refreshing…"
                : room.isError
                  ? "Stream unavailable"
                  : "Refreshed every 30s"}
            </span>
          </div>
          <ul className="space-y-3">
            {loading && (
              <li className="text-sm text-muted-foreground">Reading the event stream…</li>
            )}
            {!loading && (d?.activity ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">No recent activity</li>
            )}
            {(d?.activity ?? []).slice(0, 8).map((e, i) => {
              // detail carries the record's own path when the event has one,
              // so an event opens the thing it happened to.
              const target = e.detail?.startsWith("/") ? e.detail : null;
              const Row = (
                <>
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{e.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.kind.replace(/_/g, " ")} · {when(e.at)}
                      {target ? "" : ` · ${e.source}`}
                    </div>
                  </div>
                </>
              );
              return target ? (
                <li key={`${e.at}-${i}`}>
                  <a
                    href={target}
                    className="flex items-start gap-3 rounded-lg px-1 py-0.5 transition hover:bg-surface/50"
                  >
                    {Row}
                  </a>
                </li>
              ) : (
                <li key={`${e.at}-${i}`} className="flex items-start gap-3">
                  {Row}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* AI Insights */}
      <SectionRow
        title="AI Marketplace Insights"
        cta="Open AI Assistant"
        onCta={() =>
          askVala(
            `From the Marketplace control room. ${d?.products?.total ?? 0} product(s), ` +
              `${d?.commerce?.orders ?? 0} order(s), net revenue ` +
              `${d?.revenue ? `${d.revenue.net} ${d.revenue.currency}` : "not counted"}. ` +
              `What should I look at first?`,
          )
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {ASSISTANTS.map((c) => (
            <Card key={c.t} className="border-accent/20">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 px-2.5 py-1 text-xs font-semibold text-accent">
                <Sparkles className="h-3 w-3" /> AI
              </div>
              <h4 className="text-base font-bold">{c.t}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
              {/* Opens the assistant the workspace already mounts, carrying
                  what this screen is looking at. A question asked from the
                  control room should arrive knowing it came from there. */}
              <button
                type="button"
                onClick={() => askVala(c.seed(d))}
                className="mt-4 text-sm font-semibold text-accent hover:text-cyan-glow"
              >
                Ask now →
              </button>
            </Card>
          ))}
        </div>
      </SectionRow>
    </div>
  );
}

function LayoutGridIcon(props: { className?: string }) {
  return <FolderTree {...props} />;
}

/**
 * The graph the panel used to promise.
 *
 * Bars, not a chart library, because the box it lives in is 96px tall and a
 * reader wants the shape of the month rather than a plottable surface. The
 * range buttons are the ones the panel above already names, so clicking
 * "This Week" in the list and "week" here read the same window.
 *
 * Its arithmetic is mm_dashboard's, through mm_revenue_series: paid order
 * lines less refunds. The two were reconciled against each other before this
 * shipped, and they agree to the cent.
 */
function RevenueGraph({ currency }: { currency: string }) {
  const [range, setRange] = useState<"today" | "week" | "month" | "year">("month");
  const series = useQuery<RevenueSeries>({
    queryKey: ["marketplace", "revenue-series", range],
    queryFn: () => marketplaceRevenueSeries({ data: range }),
    staleTime: 30_000,
  });

  const points = series.data?.points ?? [];
  const peak = points.reduce((m, p) => Math.max(m, Number(p.gross ?? 0)), 0);
  const total = points.reduce((s, p) => s + Number(p.net ?? 0), 0);
  const unit = series.data?.unit ?? "day";

  const label = (at: string) =>
    unit === "hour"
      ? new Date(at).getHours() + ":00"
      : unit === "month"
        ? new Date(at).toLocaleString(undefined, { month: "short" })
        : new Date(at).getDate().toString();

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1">
          {(["today", "week", "month", "year"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                range === r
                  ? "bg-accent/20 text-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {series.isLoading
            ? "counting…"
            : series.isError
              ? "unavailable"
              : `net ${money(total, currency, false)}`}
        </span>
      </div>

      <div className="h-24 rounded-lg border border-border/60 bg-background/40 p-2">
        {series.isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-1">
            <span className="text-xs text-muted-foreground">
              The revenue series could not be read.
            </span>
            <button
              type="button"
              onClick={() => void series.refetch()}
              className="text-[11px] font-semibold text-accent hover:text-cyan-glow"
            >
              Try again
            </button>
          </div>
        ) : series.isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Counting the transactions…
          </div>
        ) : peak === 0 ? (
          // Every bucket empty. Not the same as never having sold anything,
          // which the panel above says instead.
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Nothing was taken in this {unit === "hour" ? "day" : range}.
          </div>
        ) : (
          <div className="flex h-full items-end gap-[2px]">
            {points.map((p) => {
              const h = peak > 0 ? Math.max(2, Math.round((Number(p.gross) / peak) * 100)) : 2;
              return (
                <div
                  key={p.at}
                  className="group relative flex-1 rounded-t bg-accent/70 transition hover:bg-accent"
                  style={{ height: `${h}%` }}
                  title={`${label(p.at)} · gross ${p.gross} · refunds ${p.refunds} · net ${p.net} · ${p.orders} order(s)`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A product wall, showing what is actually in it.
 *
 * This used to draw ten identical "Slot N — Empty — Assign a product" cards
 * whatever the row held, on a screen whose whole job is to say what the
 * marketplace looks like. It now reads the row the Homepage Rows manager
 * writes, so a filled wall looks filled and an empty one says how many
 * positions are waiting.
 */
function ProductWallRow({ row, onEdit }: { row: HomepageRow; onEdit?: () => void }) {
  const filled = Number(row.filled_slots ?? 0);
  const capacity = Number(row.max_products ?? 60);
  const eligible = Number(row.eligible_products ?? 0);
  const shown = Math.min(Math.max(filled, Math.min(eligible, capacity)), 10);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {row.title}
        </h4>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground">
            {filled > 0
              ? `${filled} placed · ${capacity - filled} open of ${capacity}`
              : `${eligible} eligible · ${capacity} positions open`}
          </span>
          <button
            onClick={onEdit}
            className="text-xs font-semibold text-accent hover:text-cyan-glow"
          >
            Edit wall →
          </button>
        </div>
      </div>
      <div className="scroll-row flex gap-3 overflow-x-auto pb-3">
        {Array.from({ length: Math.max(shown, 3) }, (_, i) => {
          const placed = i < filled;
          const auto = !placed && i < Math.min(eligible, capacity);
          return (
            <div
              key={i}
              className="group relative h-44 w-72 flex-none overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface to-surface-elevated"
            >
              <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(135deg,oklch(0.66_0.21_255/0.4),oklch(0.82_0.16_200/0.2))]" />
              <div className="relative flex h-full flex-col justify-between p-4">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent backdrop-blur">
                    Slot {i + 1}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      placed
                        ? "bg-success/20 text-success"
                        : auto
                          ? "bg-accent/20 text-accent"
                          : "bg-premium/20 text-premium"
                    }`}
                  >
                    {placed ? "Placed" : auto ? "Auto-filled" : "Empty"}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-bold">
                    {placed
                      ? "Placed by hand"
                      : auto
                        ? `Filled by ${row.auto_rule ?? "the row rule"}`
                        : "Assign a product"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {placed || auto
                      ? "Open Homepage Rows to change it"
                      : "Drag from catalog or auto-fill"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
