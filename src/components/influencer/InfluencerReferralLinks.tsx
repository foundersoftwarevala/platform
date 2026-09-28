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

type Account = {
  profile: { id: string; full_name: string | null; status: string };
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

      {onBack && (
        <button type="button" onClick={onBack} className="text-sm text-muted-foreground underline">
          Back
        </button>
      )}
    </section>
  );
}
