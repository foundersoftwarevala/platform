import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Download, Eye, Search, Shield, ShieldCheck, XCircle } from "lucide-react";

import { fraudAlertsQuery } from "@/lib/finance/queries";
import { useUpdateFraudAlert } from "@/lib/finance/mutations";
import type { FraudAlert } from "@/lib/finance/types";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { downloadCsv, formatCurrency, relativeTime } from "@/lib/finance/format";

function riskTone(score: number) {
  if (score >= 75) return "text-destructive bg-destructive/15";
  if (score >= 40) return "text-warning bg-warning/15";
  return "text-success bg-success/15";
}

export default function FraudScanner() {
  const [search, setSearch] = useState("");
  const fraudState = useQuery(fraudAlertsQuery());
  const updateFraud = useUpdateFraudAlert();

  const rows = fraudState.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (a) => a.alert_code.toLowerCase().includes(q) || a.entity.toLowerCase().includes(q) || a.reason.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const open = rows.filter((a) => a.status === "open").length;
    const investigating = rows.filter((a) => a.status === "investigating").length;
    const resolved = rows.filter((a) => a.status === "resolved").length;
    const falsePositive = rows.filter((a) => a.status === "false_positive").length;
    const avgRisk = rows.length ? rows.reduce((s, a) => s + Number(a.risk_score), 0) / rows.length : 0;
    return { open, investigating, resolved, falsePositive, avgRisk };
  }, [rows]);

  const handleExport = () => {
    if (!filtered.length) return;
    downloadCsv(
      "fraud-alerts.csv",
      filtered.map((a) => ({
        alert_code: a.alert_code,
        entity: a.entity,
        reason: a.reason,
        amount: a.amount,
        risk_score: a.risk_score,
        status: a.status,
        detected_at: a.detected_at,
        resolved_at: a.resolved_at,
      })),
    );
  };

  const act = (id: string, status: FraudAlert["status"]) => updateFraud.mutate({ id, status, actor: "finance_manager" });

  return (
    <SectionShell
      title="AI Fraud Scanner"
      description="Real-time fraud detection and transaction monitoring"
      icon={Shield}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      }
    >
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Open Alerts" value={stats.open} icon={AlertTriangle} tone="danger" loading={fraudState.isLoading} />
          <StatCard label="Investigating" value={stats.investigating} icon={Eye} tone="info" loading={fraudState.isLoading} />
          <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle} tone="success" loading={fraudState.isLoading} />
          <StatCard label="Avg Risk Score" value={stats.avgRisk.toFixed(1)} icon={ShieldCheck} tone={stats.avgRisk >= 50 ? "danger" : "warning"} loading={fraudState.isLoading} />
        </StatGrid>

        <PanelCard
          title="Flagged Transactions"
          actions={
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="w-64 pl-9" placeholder="Search alerts..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Badge variant="outline">{filtered.length} items</Badge>
            </div>
          }
        >
          <QueryState isLoading={fraudState.isLoading} error={fraudState.error} isEmpty={filtered.length === 0} emptyLabel="No fraud alerts found">
            <div className="space-y-3">
              {filtered.map((alert) => (
                <div key={alert.id} className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${riskTone(Number(alert.risk_score))}`}>
                        <AlertTriangle className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">{alert.alert_code}</p>
                          <Badge variant="outline" className={`text-xs ${riskTone(Number(alert.risk_score))}`}>
                            risk {alert.risk_score}
                          </Badge>
                          <StatusBadge status={alert.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{alert.reason}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{alert.entity}</span>
                          <span>•</span>
                          <span>{formatCurrency(alert.amount)}</span>
                          <span>•</span>
                          <span>{relativeTime(alert.detected_at)}</span>
                          {alert.txn_reference ? (
                            <>
                              <span>•</span>
                              <span className="font-mono">{alert.txn_reference}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {alert.status === "open" && (
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-info" disabled={updateFraud.isPending} onClick={() => act(alert.id, "investigating")}>
                          <Eye className="h-3.5 w-3.5" /> Investigate
                        </Button>
                      )}
                      {(alert.status === "open" || alert.status === "investigating") && (
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-success" disabled={updateFraud.isPending} onClick={() => act(alert.id, "resolved")}>
                          <CheckCircle className="h-3.5 w-3.5" /> Resolve
                        </Button>
                      )}
                      {(alert.status === "open" || alert.status === "investigating") && (
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-muted-foreground" disabled={updateFraud.isPending} onClick={() => act(alert.id, "false_positive")}>
                          <XCircle className="h-3.5 w-3.5" /> False Positive
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}
