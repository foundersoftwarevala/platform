import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, Clock, Download, TrendingUp } from "lucide-react";

import { activityHeatQuery } from "@/lib/finance/queries";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { downloadCsv, formatCurrency, formatDate } from "@/lib/finance/format";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function heatColor(intensity: number) {
  if (intensity <= 0) return "bg-muted";
  if (intensity < 0.25) return "bg-primary/20";
  if (intensity < 0.5) return "bg-primary/40";
  if (intensity < 0.75) return "bg-primary/70";
  return "bg-primary";
}

export default function TransactionHeatmap() {
  const heatState = useQuery(activityHeatQuery());
  const rows = heatState.data ?? [];

  const dates = useMemo(() => Array.from(new Set(rows.map((r) => r.activity_date))).sort(), [rows]);

  const grid = useMemo(() => {
    const map = new Map<string, { txn_count: number; volume: number }>();
    for (const r of rows) {
      map.set(`${r.activity_date}-${r.hour_slot}`, { txn_count: r.txn_count, volume: r.volume });
    }
    return map;
  }, [rows]);

  const maxCount = useMemo(() => rows.reduce((max, r) => Math.max(max, r.txn_count), 0), [rows]);

  const stats = useMemo(() => {
    if (rows.length === 0) return { peakHour: "—", peakDate: "—", totalVolume: 0, totalTxns: 0 };
    let peak = rows[0];
    for (const r of rows) if (r.txn_count > (peak?.txn_count ?? 0)) peak = r;
    const totalVolume = rows.reduce((s, r) => s + Number(r.volume), 0);
    const totalTxns = rows.reduce((s, r) => s + r.txn_count, 0);
    return {
      peakHour: peak ? `${String(peak.hour_slot).padStart(2, "0")}:00` : "—",
      peakDate: peak ? formatDate(peak.activity_date) : "—",
      totalVolume,
      totalTxns,
    };
  }, [rows]);

  const hourlyTotals = useMemo(() => {
    const totals = new Map<number, number>();
    for (const r of rows) totals.set(r.hour_slot, (totals.get(r.hour_slot) ?? 0) + r.txn_count);
    return HOURS.map((h) => ({ hour: h, txns: totals.get(h) ?? 0 }));
  }, [rows]);

  const maxHourlyTotal = useMemo(() => hourlyTotals.reduce((max, h) => Math.max(max, h.txns), 0), [hourlyTotals]);

  const handleExport = () => {
    if (!rows.length) return;
    downloadCsv(
      "transaction-heatmap.csv",
      rows.map((r) => ({
        activity_date: r.activity_date,
        hour_slot: r.hour_slot,
        txn_count: r.txn_count,
        volume: r.volume,
      })),
    );
  };

  return (
    <SectionShell
      title="Transaction Heatmap"
      description="Visualize transaction patterns and peak activity periods"
      icon={Activity}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      }
    >
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Peak Hour" value={stats.peakHour} hint={stats.peakDate} icon={Clock} loading={heatState.isLoading} />
          <StatCard label="Days Tracked" value={dates.length} icon={CalendarDays} loading={heatState.isLoading} />
          <StatCard label="Total Volume" value={formatCurrency(stats.totalVolume)} icon={TrendingUp} tone="success" loading={heatState.isLoading} />
          <StatCard label="Total Transactions" value={stats.totalTxns} icon={Activity} loading={heatState.isLoading} />
        </StatGrid>

        <PanelCard title="Day × Hour Activity Grid">
          <QueryState isLoading={heatState.isLoading} error={heatState.error} isEmpty={dates.length === 0}>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="flex">
                  <div className="w-24 shrink-0" />
                  <div className="flex gap-1">
                    {HOURS.map((h) => (
                      <div key={h} className="w-6 text-center text-[10px] text-muted-foreground">
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-1 space-y-1">
                  {dates.map((date) => (
                    <div key={date} className="flex items-center">
                      <div className="w-24 shrink-0 pr-2 text-right text-xs text-muted-foreground">{formatDate(date)}</div>
                      <div className="flex gap-1">
                        {HOURS.map((h) => {
                          const cell = grid.get(`${date}-${h}`);
                          const count = cell?.txn_count ?? 0;
                          const intensity = maxCount > 0 ? count / maxCount : 0;
                          return (
                            <div
                              key={h}
                              title={`${formatDate(date)} ${h}:00 — ${count} txns, ${formatCurrency(cell?.volume ?? 0)}`}
                              className={`h-6 w-6 rounded-sm ${heatColor(intensity)} transition-all hover:ring-2 hover:ring-primary`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <span className="text-xs text-muted-foreground">Less</span>
                  <div className="flex gap-1">
                    <div className="h-4 w-4 rounded-sm bg-muted" />
                    <div className="h-4 w-4 rounded-sm bg-primary/20" />
                    <div className="h-4 w-4 rounded-sm bg-primary/40" />
                    <div className="h-4 w-4 rounded-sm bg-primary/70" />
                    <div className="h-4 w-4 rounded-sm bg-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">More</span>
                </div>
              </div>
            </div>
          </QueryState>
        </PanelCard>

        <PanelCard title="Hourly Distribution (aggregated)">
          <QueryState isLoading={heatState.isLoading} error={heatState.error} isEmpty={hourlyTotals.every((h) => h.txns === 0)}>
            <div className="space-y-2">
              {hourlyTotals.map((h) => (
                <div key={h.hour} className="flex items-center gap-3">
                  <span className="w-12 text-xs text-muted-foreground">{String(h.hour).padStart(2, "0")}:00</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${maxHourlyTotal > 0 ? (h.txns / maxHourlyTotal) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-xs text-muted-foreground">{h.txns} txns</span>
                </div>
              ))}
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}
