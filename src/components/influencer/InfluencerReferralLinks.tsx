import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2, Power } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

/**
 * Influencer dashboard → Referral Links.
 *
 * The screen the chain was missing. marketplace_referral_codes,
 * marketplace_referral_sessions and marketplace_order_attributions all carry an
 * influencer_profile_id and not one row had ever been written with it, because
 * an influencer had no way to get a code - so a link could not be tracked and a
 * sale could not be credited.
 *
 * A link made here is resolved by the same /api/track/ref that resolves an
 * affiliate's, and credited by the same attribution at checkout. Every figure
 * below is counted from the sessions and the partner commission ledger; a link
 * nobody has used reads zero, and nothing on this screen is generated.
 */

type Link = {
  id: string;
  code: string;
  active: boolean;
  url: string;
  clicks: number;
  visitors: number;
  conversions: number;
  conversionRate: number;
};

type Tier = {
  tier: {
    code: string;
    name: string;
    commission_percent: number;
    hold_days: number;
    payout_floor: number;
    currency: string;
    benefits: string[];
  } | null;
  standing: { verified_followers: number; sales_90d: number; revenue_180d: number };
  next: {
    name: string;
    commission_percent: number;
    needs_followers: number;
    needs_sales: number;
    needs_revenue: number;
  } | null;
};

type Account = {
  profile: { id: string; full_name: string | null; status: string };
  tier: Tier | null;
  attributionWindowDays: number;
  links: Link[];
  commissions: { pending: number; approved: number; paid: number; reversed: number; lines: number };
};

async function call(method: "GET" | "POST", body?: unknown): Promise<Account | { ok: true }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch("/api/influencer/referral", {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? "That did not work"));
  return payload as Account | { ok: true };
}

const money = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function InfluencerReferralLinks({ onBack }: { onBack?: () => void }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);

  const account = useQuery({
    queryKey: ["influencer-referral"],
    queryFn: () => call("GET") as Promise<Account>,
    staleTime: 20_000,
  });

  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => call("POST", body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["influencer-referral"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async (link: Link) => {
    const absolute = `${window.location.origin}${link.url}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(link.id);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy — the link is shown in full below");
    }
  };

  if (account.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your links
      </div>
    );
  }
  if (account.error) {
    return <div className="p-6 text-sm text-destructive">{(account.error as Error).message}</div>;
  }

  const data = account.data as Account;
  const c = data.commissions;

  return (
    <section className="space-y-6" data-referral-screen>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Referral</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-black tracking-tight">
          <Link2 className="h-5 w-5 text-primary" /> Your referral links
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share a link. A sale through it is credited to you when the payment clears, inside a{" "}
          {data.attributionWindowDays}-day window from the visitor's last click.
        </p>
      </header>

      {data.tier?.tier && (
        <div className="rounded-xl border border-border bg-card p-5" data-influencer-tier={data.tier.tier.code}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Your tier</p>
              <p className="mt-1 text-xl font-black">{data.tier.tier.name}</p>
            </div>
            <p className="text-2xl font-black text-primary">
              {data.tier.tier.commission_percent}%
              <span className="ml-1 text-xs font-medium text-muted-foreground">per referred sale</span>
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Held {data.tier.tier.hold_days} days before payout · paid from{" "}
            {money(Number(data.tier.tier.payout_floor))}
          </p>
          {Array.isArray(data.tier.tier.benefits) && data.tier.tier.benefits.length > 0 && (
            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              {data.tier.tier.benefits.map((b) => (
                <li key={b} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {b}
                </li>
              ))}
            </ul>
          )}
          {/* The exact number that moves them up, not "keep going". */}
          {data.tier.next && (
            <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {data.tier.next.name} pays {data.tier.next.commission_percent}%.
              </span>{" "}
              {[
                data.tier.next.needs_followers > 0
                  ? `${data.tier.next.needs_followers.toLocaleString("en-IN")} more verified followers`
                  : null,
                data.tier.next.needs_sales > 0 ? `${data.tier.next.needs_sales} more sales in 90 days` : null,
                data.tier.next.needs_revenue > 0
                  ? `${money(Number(data.tier.next.needs_revenue))} more attributed revenue in 180 days`
                  : null,
              ]
                .filter(Boolean)
                .join(", or ") || "You already qualify — the next run will move you up."}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Pending", c.pending],
          ["Approved", c.approved],
          ["Paid", c.paid],
          ["Reversed", c.reversed],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-black">{money(Number(value))}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data.links.length === 0
            ? "You have no links yet."
            : `${data.links.length} link${data.links.length === 1 ? "" : "s"}, ${c.lines} commission line${c.lines === 1 ? "" : "s"}.`}
        </p>
        <button
          type="button"
          disabled={act.isPending}
          onClick={() => act.mutate({ action: "create-link" })}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {act.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Create a link
        </button>
      </div>

      {data.links.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3 text-right">Clicks</th>
                <th className="px-4 py-3 text-right">Visitors</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.links.map((link) => (
                <tr key={link.id} data-referral-link={link.code} className="border-t border-border">
                  <td className="px-4 py-3 font-mono">{link.code}</td>
                  <td className="px-4 py-3 text-muted-foreground">{link.url}</td>
                  <td className="px-4 py-3 text-right">{link.clicks}</td>
                  <td className="px-4 py-3 text-right">{link.visitors}</td>
                  <td className="px-4 py-3 text-right">{link.conversions}</td>
                  <td className="px-4 py-3 text-right">{link.conversionRate}%</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void copy(link)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs"
                      >
                        {copied === link.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy
                      </button>
                      <button
                        type="button"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ action: "toggle-link", linkId: link.id, active: !link.active })}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs"
                      >
                        <Power className={`h-3.5 w-3.5 ${link.active ? "text-emerald-500" : "text-muted-foreground"}`} />
                        {link.active ? "Active" : "Off"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductPromotion />

      {onBack && (
        <button type="button" onClick={onBack} className="text-sm text-muted-foreground underline">
          Back
        </button>
      )}
    </section>
  );
}

type Found = { id: string; slug: string; name: string };

type QrRow = {
  qr_code: string;
  product_name: string | null;
  product_slug: string | null;
  scans: number;
  active: boolean;
  image_png: string;
  image_svg: string;
};

/**
 * Promote one product: a link for that product, and a QR for the poster.
 *
 * A general referral link sends everyone to the home page, which is fine for a
 * bio but useless for "this is the software I was talking about". This picks a
 * real product from the catalogue and gives back the link and a QR pointing at
 * that product, both carrying the influencer's own code.
 *
 * One QR per influencer per product, enforced by a unique index, so asking
 * twice returns the same code rather than minting a rival - which is what makes
 * a printed poster keep working and a scan resolve to exactly one influencer.
 */
function ProductPromotion() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const found = useQuery({
    queryKey: ["influencer-product-search", query],
    enabled: query.trim().length >= 2,
    queryFn: async (): Promise<Found[]> => {
      const response = await fetch(
        `/api/marketplace/search?q=${encodeURIComponent(query.trim())}&limit=8`,
      );
      if (!response.ok) throw new Error("Search is unavailable just now");
      const body = (await response.json()) as { products?: Found[] };
      return body.products ?? [];
    },
  });

  const mine = useQuery({
    queryKey: ["influencer-qr"],
    queryFn: async (): Promise<QrRow[]> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const response = await fetch("/api/influencer/qr", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Your QR codes could not be read");
      const body = (await response.json()) as { qr_codes?: QrRow[] };
      return body.qr_codes ?? [];
    },
    staleTime: 20_000,
  });

  const promote = useMutation({
    mutationFn: async (productId: string) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const response = await fetch("/api/influencer/qr", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId }),
      });
      const body = (await response.json()) as { error?: string; referral?: { url: string } };
      if (!response.ok) throw new Error(body.error ?? "That did not work");
      return body;
    },
    onSuccess: (body) => {
      toast.success(`Ready — ${body.referral?.url ?? "link created"}`);
      void qc.invalidateQueries({ queryKey: ["influencer-qr"] });
      void qc.invalidateQueries({ queryKey: ["influencer-referral"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyProductLink = async (row: QrRow) => {
    const absolute = `${window.location.origin}/api/qr/scan/${row.qr_code}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(row.qr_code);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy — the address is shown below");
    }
  };

  return (
    <div className="space-y-4 border-t border-border pt-6" data-product-promotion>
      <div>
        <h2 className="text-lg font-semibold">Promote a product</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a product and get a link and a QR code for it. A scan is counted, then the person
          lands on that product with your code attached.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(term);
        }}
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search the catalogue — at least two letters"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
        >
          Search
        </button>
      </form>

      {found.isFetching && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching
        </p>
      )}
      {found.data && found.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing matched that.</p>
      )}
      {found.data && found.data.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {found.data.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 truncate text-sm">{product.name}</span>
              <button
                type="button"
                disabled={promote.isPending}
                onClick={() => promote.mutate(product.id)}
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                Get link &amp; QR
              </button>
            </li>
          ))}
        </ul>
      )}

      {(mine.data?.length ?? 0) > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mine.data!.map((row) => (
            <div key={row.qr_code} className="rounded-xl border border-border bg-card p-4" data-product-qr={row.qr_code}>
              <div className="flex items-start gap-3">
                {/* Rendered by the server from what this QR encodes. */}
                <img
                  src={row.image_png}
                  alt={`QR for ${row.product_name ?? "this product"}`}
                  className="h-20 w-20 shrink-0 rounded-lg bg-white p-1"
                  width={80}
                  height={80}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.product_name ?? "Product"}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{row.qr_code}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.scans} scan{row.scans === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyProductLink(row)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs"
                >
                  {copied === row.qr_code ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy link
                </button>
                <a
                  href={row.image_png}
                  download={`${row.qr_code}.png`}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
                >
                  PNG
                </a>
                <a
                  href={row.image_svg}
                  download={`${row.qr_code}.svg`}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
                >
                  SVG for print
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
