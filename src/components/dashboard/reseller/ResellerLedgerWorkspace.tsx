import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Banknote, Loader2, RotateCcw, TrendingUp, Wallet } from "lucide-react";

import { useServerFn } from "@/lib/serverFn";
import { getResellerLedger, type ResellerLedger } from "@/lib/reseller-dashboard.functions";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The reseller's own money, read-only: commission earned, revenue referred, and
 * membership renewals — the same rows the Reseller Manager reads, scoped to the
 * reseller this account is linked to. These three dashboard modules used to open
 * a browser-local CrudWorkspace whose figures were invented and lost on reload;
 * they now read the real ledger. Nothing is written from here — commission is
 * earned by the attribution engine and paid through the Reseller Manager.
 */

type View = "commissions" | "revenue" | "renewals";

const money = (v: number, c = "USD") =>
  `${c === "USD" ? "$" : `${c} `}${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (v: string | null) => (v ? new Date(v).toLocaleDateString() : "—");

const STATUS_TONE: Record<string, string> = {
  paid: "bg-success/15 text-success border-success/30",
  available: "bg-success/15 text-success border-success/30",
  completed: "bg-success/15 text-success border-success/30",
  active: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-warning/15 text-warning border-warning/30",
  processing: "bg-warning/15 text-warning border-warning/30",
  reversed: "bg-destructive/15 text-destructive border-destructive/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  expired: "bg-destructive/15 text-destructive border-destructive/30",
};

function Pill({ value }: { value: string }) {
  const tone = STATUS_TONE[value] ?? "bg-muted text-muted-foreground border-border";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${tone}`}>{value}</span>;
}

function TableShell({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[520px] text-xs">
        <thead className="bg-surface text-muted-foreground">{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function ResellerLedgerWorkspace({ view, onBack }: { view: View; onBack: () => void }) {
  const { t } = useTranslation();
  const fetchLedger = useServerFn(getResellerLedger);
  const q = useQuery({
    queryKey: ["reseller-ledger"],
    queryFn: () => fetchLedger() as Promise<ResellerLedger>,
    staleTime: 20_000,
  });
  const meta = {
    commissions: {
      eyebrow: t("reseller.ledger_earnings"),
      title: t("reseller.ledger_commission_title"),
      intro: t("reseller.ledger_commission_intro"),
      icon: Wallet,
    },
    revenue: {
      eyebrow: t("reseller.ledger_performance"),
      title: t("reseller.ledger_revenue_title"),
      intro: t("reseller.ledger_revenue_intro"),
      icon: TrendingUp,
    },
    renewals: {
      eyebrow: t("reseller.ledger_lifecycle"),
      title: t("reseller.ledger_renewals_title"),
      intro: t("reseller.ledger_renewals_intro"),
      icon: RotateCcw,
    },
  }[view];
  const Icon = meta.icon;

  const totals = (() => {
    const c = q.data?.commissions ?? [];
    const live = c.filter((x) => x.status !== "reversed");
    return {
      earned: live.reduce((s, x) => s + Number(x.commission_amount || 0), 0),
      revenue: live.reduce((s, x) => s + Number(x.gross_amount || 0), 0),
      available: c.filter((x) => x.status === "available").reduce((s, x) => s + Number(x.commission_amount || 0), 0),
      paid: c.filter((x) => x.status === "paid").reduce((s, x) => s + Number(x.commission_amount || 0), 0),
    };
  })();

  return (
    <div className="space-y-5" data-reseller-ledger={view}>
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm hover:bg-card"
        >
          <ArrowLeft className="h-4 w-4" /> {t("reseller.ledger_back")}
        </button>
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 text-[oklch(0.72_0.2_265)]">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{meta.eyebrow}</div>
            <h1 className="text-xl font-semibold md:text-2xl">{meta.title}</h1>
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{meta.intro}</p>

      {q.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("reseller.ledger_loading")}
        </p>
      ) : q.error ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : q.data && !q.data.linked ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Banknote className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">{t("reseller.ledger_unlinked_title")}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            {t("reseller.ledger_unlinked_message")}
          </p>
        </div>
      ) : view === "renewals" ? (
        (q.data?.memberships ?? []).length === 0 ? (
          <Empty text={t("reseller.ledger_no_memberships")} />
        ) : (
          <TableShell
            head={
              <tr>
                <th className="p-2 text-left">{t("reseller.ledger_plan")}</th>
                <th className="p-2 text-left">{t("reseller.ledger_state")}</th>
                <th className="p-2 text-left">{t("reseller.ledger_activated")}</th>
                <th className="p-2 text-left">{t("reseller.ledger_expires")}</th>
                <th className="p-2 text-left">{t("reseller.ledger_renews")}</th>
              </tr>
            }
          >
            {(q.data?.memberships ?? []).map((m) => (
              <tr key={m.id} className="border-t border-border/60">
                <td className="p-2 font-medium">{m.plan_code ?? "—"}</td>
                <td className="p-2"><Pill value={m.membership_state} /></td>
                <td className="p-2 text-muted-foreground">{when(m.activated_at)}</td>
                <td className="p-2 text-muted-foreground">{when(m.expires_at)}</td>
                <td className="p-2 text-muted-foreground">{when(m.renewal_at)}</td>
              </tr>
            ))}
          </TableShell>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label={
                view === "revenue"
                  ? t("reseller.ledger_revenue_referred")
                  : t("reseller.ledger_commission_earned")
              }
              value={money(view === "revenue" ? totals.revenue : totals.earned)}
            />
            <Stat label={t("reseller.ledger_released_payable")} value={money(totals.available)} />
            <Stat label={t("reseller.ledger_paid")} value={money(totals.paid)} />
            <Stat
              label={t("reseller.ledger_lines")}
              value={String((q.data?.commissions ?? []).length)}
            />
          </div>
          {(q.data?.commissions ?? []).length === 0 ? (
            <Empty text={t("reseller.ledger_no_attributed_sales")} />
          ) : (
            <TableShell
              head={
                <tr>
                  <th className="p-2 text-left">{t("reseller.ledger_date")}</th>
                  <th className="p-2 text-left">{t("reseller.ledger_order")}</th>
                  <th className="p-2 text-right">{t("reseller.ledger_order_value")}</th>
                  <th className="p-2 text-right">{t("reseller.ledger_commission")}</th>
                  <th className="p-2 text-left">{t("reseller.ledger_status")}</th>
                </tr>
              }
            >
              {(q.data?.commissions ?? []).map((c) => (
                <tr key={c.id} className="border-t border-border/60">
                  <td className="p-2 text-muted-foreground">{when(c.created_at)}</td>
                  <td className="p-2 font-mono text-[11px]">{String(c.order_id).slice(0, 8)}</td>
                  <td className="p-2 text-right tabular-nums">{money(Number(c.gross_amount), c.currency)}</td>
                  <td className="p-2 text-right font-semibold tabular-nums">{money(Number(c.commission_amount), c.currency)}</td>
                  <td className="p-2"><Pill value={c.status} /></td>
                </tr>
              ))}
            </TableShell>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
