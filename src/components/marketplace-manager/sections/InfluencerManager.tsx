import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Info, Link2, Search, Users } from "lucide-react";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  createInfluencerCode, getInfluencers, setInfluencerStatus,
  type InfluencerOverview, type InfluencerRow,
} from "@/lib/marketplace-manager/influencers.functions";

/**
 * Influencer — the screen that already existed, now connected.
 *
 * It was a ModulePage listing nineteen feature names over four stat cards with
 * no values. The data was in the database the whole time: ten creators, five
 * applications, two social accounts declaring 197,500 followers between them,
 * and real money in influencer_earnings and influencer_payouts.
 *
 * The one thing genuinely missing was tracking. Six referral codes existed and
 * every one belonged to an affiliate — not a single influencer had a code, so
 * no creator could be credited for anything. That is what the Referral link
 * button here fixes, and it writes into marketplace_referral_codes, the table
 * /api/track/ref already reads, rather than a second table beside it.
 *
 * What still cannot be shown, and is labelled rather than zeroed:
 *
 * Conversions were the second half of the same problem. The attribution engine
 * was complete and never called: /api/affiliate/attribute stamps a sale onto
 * the affiliate or creator who brought it in, and nothing invoked it, so not
 * one paid order carried an attribution. Checkout now does it, in
 * /api/payment/initiate, which is the last moment the buyer's referral cookie
 * is still on the request — the PayU webhook arrives without cookies. It can
 * never block a payment; an unattributed order is what every order is today.
 *
 * What still cannot be shown, and is labelled rather than zeroed:
 *
 *   Verified reach followers and engagement are the creator's own declaration
 *                  from their application; no platform API is connected to
 *                  confirm or refresh them
 *   ROI            needs attributed revenue, so it fills in once a referred
 *                  order is paid
 */

const money = (v: unknown) =>
  typeof v === "number" || typeof v === "string"
    ? `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : "—";

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600",
  pending: "bg-amber-500/10 text-amber-600",
  suspended: "bg-rose-500/10 text-rose-600",
  inactive: "bg-muted text-muted-foreground",
};

function Unavailable({ items }: { items?: Record<string, string> }) {
  const entries = Object.entries(items ?? {});
  if (entries.length === 0) return null;
  return (
    <Card className="mt-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
        <Info className="h-4 w-4 text-muted-foreground" />
        Not connected yet
      </h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        These are on the influencer feature list but have nothing real to read. Each
        says why, rather than showing a zero that would look like an answer.
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

function CreatorRow({ row, onRefresh }: { row: InfluencerRow; onRefresh: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const [word, setWord] = useState("");
  const [opening, setOpening] = useState(false);

  const mint = useMutation({
    mutationFn: () => createInfluencerCode({ data: { profile: row.id, code: word } }),
    onSuccess: (res) => {
      if (res.ok && res.share_url) {
        setNote(res.share_url);
        setWord("");
        setOpening(false);
        onRefresh();
      } else {
        setNote(res.message ?? `Could not create the code (${res.reason ?? "unknown"})`);
      }
    },
    onError: (e: Error) => setNote(e.message),
  });

  const status = useMutation({
    mutationFn: (to: InfluencerRow["status"]) =>
      setInfluencerStatus({ data: { profile: row.id, status: to } }),
    onSuccess: (res) => {
      if (!res.ok) setNote(`Could not change status (${res.reason ?? "unknown"})`);
      onRefresh();
    },
    onError: (e: Error) => setNote(e.message),
  });

  return (
    <div className="rounded-xl border border-border/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[180px] flex-1">
          <div className="text-sm font-semibold">{row.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {row.email}
            {row.niche ? ` · ${row.niche}` : ""}
            {row.country ? ` · ${row.country}` : ""}
          </div>
        </div>

        <div className="text-center">
          <div className="text-sm font-semibold">{row.referral_codes}</div>
          <div className="text-[10px] uppercase text-muted-foreground">codes</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold">{money(row.earnings_net)}</div>
          <div className="text-[10px] uppercase text-muted-foreground">earned</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold">{money(row.payouts_paid)}</div>
          <div className="text-[10px] uppercase text-muted-foreground">paid out</div>
        </div>

        <select
          value={row.status}
          disabled={status.isPending}
          onChange={(e) => status.mutate(e.target.value as InfluencerRow["status"])}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            STATUS_TONE[row.status] ?? STATUS_TONE.inactive
          }`}
        >
          <option value="pending">pending</option>
          <option value="active">active</option>
          <option value="suspended">suspended</option>
          <option value="inactive">inactive</option>
        </select>

        <button
          onClick={() => (opening ? mint.mutate() : setOpening(true))}
          disabled={mint.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
        >
          <Link2 className="h-3.5 w-3.5" />
          {mint.isPending ? "Creating…" : opening ? "Create" : "Referral link"}
        </button>
      </div>

      {opening && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Optional word, e.g. their name — leave empty for a generated code"
            className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <button
            onClick={() => { setOpening(false); setWord(""); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {note && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
          <code className="flex-1 truncate text-[11px]">{note}</code>
          {note.startsWith("http") && (
            <button
              onClick={() => navigator.clipboard?.writeText(note)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function InfluencerManager() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | InfluencerRow["status"]>("");

  const q = useQuery({
    queryKey: ["marketplace", "influencers", search, status],
    queryFn: () =>
      getInfluencers({
        data: { search: search || undefined, status: status || undefined },
      }),
    staleTime: 15_000,
  });

  const d = q.data as InfluencerOverview | undefined;
  const refresh = () => qc.invalidateQueries({ queryKey: ["marketplace", "influencers"] });

  if (q.isError) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Creator & Influencer" title="Influencer" />
        <EmptyHint text={(q.error as Error).message} />
      </div>
    );
  }

  if (d && d.ok === false) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Creator & Influencer" title="Influencer" />
        <EmptyHint text="This console is for operators. Sign in with an operator account to manage creators." />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Creator & Influencer"
        title="Influencer"
        description="Creator roster, referral tracking, earnings and payouts — from the influencer tables and the referral engine already running."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Creators" value={String(d?.creators ?? "—")} />
        <StatCard label="Referral codes" value={String(d?.referral_codes ?? "—")} tone="premium" />
        <StatCard label="Earned (net)" value={money(d?.earnings_net)} tone="success" />
        <StatCard label="Payouts pending" value={money(d?.payouts_pending)} tone="warning" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Applications" value={String(d?.applications ?? "—")} />
        <StatCard label="Social accounts" value={String(d?.social_accounts ?? "—")} />
        <StatCard
          label="Declared followers"
          value={(d?.declared_followers ?? 0).toLocaleString()}
        />
        <StatCard label="Paid out" value={money(d?.payouts_paid)} />
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or niche"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <Users className="h-4 w-4 text-muted-foreground" />
          Creators
        </h3>

        {q.isLoading ? (
          <EmptyHint text="Loading creators…" />
        ) : (d?.profiles?.length ?? 0) === 0 ? (
          <EmptyHint text="No creator matches this search. Approved applications become creators here." />
        ) : (
          <div className="space-y-2">
            {d?.profiles?.map((row) => (
              <CreatorRow key={row.id} row={row} onRefresh={refresh} />
            ))}
          </div>
        )}
      </Card>

      <Unavailable items={d?.unavailable} />
    </div>
  );
}

export default InfluencerManager;
