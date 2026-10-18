import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authHeaders } from "@/lib/auth/operator-fetch";

type Link = {
  id: string;
  code: string;
  active: boolean;
  created_at: string;
  url: string;
  clicks: number;
  visitors: number;
  conversions: number;
};

async function call<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(endpoint, {
    ...init,
    headers: { ...(await authHeaders()), ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `The request did not go through (${response.status})`);
  return body;
}

/**
 * A partner's referral link generator: real codes on the platform's one
 * referral engine. The reseller's come from /api/reseller/referral and the
 * affiliate's from /api/affiliate/account, which answer in the same shape and
 * take the same create-link and toggle-link actions. A visit through a link is
 * recorded by /api/track/ref, and an order it leads to is credited to the
 * partner within the attribution window.
 */
export function ResellerReferralLinks({ endpoint = "/api/reseller/referral" }: { endpoint?: string } = {}) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const key = ["referral-links", endpoint];
  const query = useQuery({
    queryKey: key,
    queryFn: () => call<{ attributionWindowDays: number; links: Link[] }>(endpoint),
  });
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const create = async () => {
    setBusy(true);
    try {
      await call(endpoint, { method: "POST", body: JSON.stringify({ action: "create-link" }) });
      toast.success("Referral link created");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (link: Link) => {
    setBusy(true);
    try {
      await call(endpoint, { method: "POST", body: JSON.stringify({ action: "toggle-link", linkId: link.id, active: !link.active }) });
      toast.success(link.active ? "Link paused" : "Link active again");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed - select the link and copy it by hand.");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground max-w-xl">
          Share a link; an order placed through it
          {query.data ? ` within ${query.data.attributionWindowDays} days` : ""} is credited to you.
        </p>
        <button
          type="button"
          onClick={() => void create()}
          disabled={busy || query.isLoading || query.isError}
          className="press-3d inline-flex items-center gap-2 rounded-lg bg-brand text-brand-foreground px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> New link
        </button>
      </div>

      {query.isLoading && <p className="text-sm text-muted-foreground">Loading your links…</p>}
      {query.isError && <p className="text-sm text-destructive">{(query.error as Error).message}</p>}
      {query.data && query.data.links.length === 0 && (
        <p className="text-sm text-muted-foreground">You have no referral link yet. Create one to start sharing.</p>
      )}

      <ul className="space-y-2">
        {(query.data?.links ?? []).map((link) => (
          <li key={link.id} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-xs">{origin + link.url}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void copy(origin + link.url)}
                  aria-label={`Copy link ${link.code}`}
                  className="press-3d inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
                <button
                  type="button"
                  onClick={() => void toggle(link)}
                  disabled={busy}
                  className="press-3d rounded-lg border border-border px-2 py-1 text-xs disabled:opacity-50"
                >
                  {link.active ? "Pause" : "Activate"}
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>{link.active ? "Active" : "Paused"}</span>
              <span>{link.clicks} clicks</span>
              <span>{link.visitors} visitors</span>
              <span>{link.conversions} orders</span>
              <span>Created {new Date(link.created_at).toLocaleDateString()}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
