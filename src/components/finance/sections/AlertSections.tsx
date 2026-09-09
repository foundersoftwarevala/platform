import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Download,
  Eye,
  Shield,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv, formatCurrency, formatDateTime, relativeTime } from "@/lib/finance/format";
import { alertsQuery, approvalsQuery, fraudAlertsQuery, transactionsQuery } from "@/lib/finance/queries";
import { useDecideApproval, useUpdateAlert } from "@/lib/finance/mutations";
import type { FinanceView } from "@/lib/finance/views";

type Props = { view: FinanceView };

const HIGH_AMOUNT_THRESHOLD = 100_000;

export default function AlertSections({ view }: Props) {
  const approvalsQ = useQuery(approvalsQuery());
  const alertsQ = useQuery(alertsQuery());
  const transactionsQ = useQuery(transactionsQuery({ limit: 300 }));
  const fraudQ = useQuery(fraudAlertsQuery());

  const decideApproval = useDecideApproval();
  const updateAlert = useUpdateAlert();

  const [severity, setSeverity] = useState<string>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const approvals = approvalsQ.data ?? [];
  const alerts = alertsQ.data ?? [];
  const transactions = transactionsQ.data ?? [];
  const fraudAlerts = fraudQ.data ?? [];

  const pendingApprovals = useMemo(
    () => approvals.filter((a) => a.status === "pending"),
    [approvals],
  );

  const highAmountApprovals = useMemo(
    () =>
      pendingApprovals.filter(
        (a) => a.amount >= HIGH_AMOUNT_THRESHOLD || a.request_type === "high_amount",
      ),
    [pendingApprovals],
  );

  const manualOverrides = useMemo(
    () => approvals.filter((a) => a.request_type === "manual_override" || a.request_type === "override"),
    [approvals],
  );

  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.status !== "resolved"),
    [alerts],
  );

  const filteredAlerts = useMemo(() => {
    if (severity === "all") return activeAlerts;
    return activeAlerts.filter((a) => a.severity === severity);
  }, [activeAlerts, severity]);

  const riskyFraudAlerts = useMemo(
    () => fraudAlerts.filter((f) => f.status !== "resolved" && f.status !== "false_positive"),
    [fraudAlerts],
  );

  const riskyTransactions = useMemo(() => {
    return riskyFraudAlerts.map((f) => {
      const txn = transactions.find(
        (t) => t.txn_code === f.txn_reference || t.id === f.txn_reference,
      );
      return { fraud: f, txn };
    });
  }, [riskyFraudAlerts, transactions]);

  const approvedToday = useMemo(() => {
    const today = new Date().toDateString();
    return approvals.filter(
      (a) => a.status === "approved" && a.decided_at && new Date(a.decided_at).toDateString() === today,
    ).length;
  }, [approvals]);

  const rejectedToday = useMemo(() => {
    const today = new Date().toDateString();
    return approvals.filter(
      (a) => a.status === "rejected" && a.decided_at && new Date(a.decided_at).toDateString() === today,
    ).length;
  }, [approvals]);

  const highRiskCount = useMemo(
    () => activeAlerts.filter((a) => a.severity === "critical" || a.severity === "high").length +
      riskyFraudAlerts.filter((f) => f.risk_score >= 75).length,
    [activeAlerts, riskyFraudAlerts],
  );

  function handleDecide(id: string, decision: "approved" | "rejected") {
    decideApproval.mutate({ id, decision, actor: "finance_manager", note: notes[id] || undefined });
  }

  function handleAlertStatus(id: string, status: "open" | "acknowledged" | "resolved") {
    updateAlert.mutate({ id, status });
  }

  function exportApprovals(rows: typeof approvals, filename: string) {
    if (rows.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    downloadCsv(
      filename,
      rows.map((r) => ({
        id: r.id,
        request_type: r.request_type,
        reference: r.reference,
        amount: r.amount,
        requested_by: r.requested_by,
        status: r.status,
        notes: r.notes ?? "",
        created_at: r.created_at,
        decided_at: r.decided_at ?? "",
      })),
    );
  }

  function exportRisky() {
    if (riskyTransactions.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    downloadCsv(
      "risky-transactions.csv",
      riskyTransactions.map(({ fraud, txn }) => ({
        alert_code: fraud.alert_code,
        entity: fraud.entity,
        reason: fraud.reason,
        amount: fraud.amount,
        risk_score: fraud.risk_score,
        status: fraud.status,
        txn_reference: fraud.txn_reference ?? "",
        txn_status: txn?.status ?? "",
        detected_at: fraud.detected_at,
      })),
    );
  }

  const isLoading = approvalsQ.isLoading || alertsQ.isLoading || transactionsQ.isLoading || fraudQ.isLoading;
  const error = approvalsQ.error || alertsQ.error || transactionsQ.error || fraudQ.error;

  const titleMap: Record<string, { title: string; description: string; icon: typeof Bell }> = {
    alert_high_amount: {
      title: "High Amount Approvals",
      description: "Review and approve requests above the risk threshold",
      icon: Bell,
    },
    alert_manual_override: {
      title: "Manual Override Requests",
      description: "Track manual overrides raised by finance staff",
      icon: Shield,
    },
    alert_risky_transaction: {
      title: "Risky Transaction Alerts",
      description: "Fraud-flagged transactions requiring review",
      icon: AlertTriangle,
    },
  };
  const meta = titleMap[view] ?? titleMap["alert_high_amount"]!;

  return (
    <SectionShell
      title={meta.title}
      description={meta.description}
      icon={meta.icon}
      actions={
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            if (view === "alert_high_amount") exportApprovals(highAmountApprovals, "high-amount-approvals.csv");
            else if (view === "alert_manual_override") exportApprovals(manualOverrides, "manual-overrides.csv");
            else exportRisky();
          }}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      }
    >
      <StatGrid>
        <StatCard label="Pending Approvals" value={pendingApprovals.length} icon={Clock} tone="warning" loading={isLoading} />
        <StatCard label="High Risk Alerts" value={highRiskCount} icon={AlertTriangle} tone="danger" loading={isLoading} />
        <StatCard label="Approved Today" value={approvedToday} icon={CheckCircle} tone="success" loading={isLoading} />
        <StatCard label="Rejected Today" value={rejectedToday} icon={XCircle} tone="default" loading={isLoading} />
      </StatGrid>

      {view === "alert_high_amount" && (
        <PanelCard title="High Amount Approval Requests">
          <QueryState isLoading={isLoading} error={error} isEmpty={highAmountApprovals.length === 0} emptyLabel="No pending high-amount approvals">
            <div className="space-y-3">
              {highAmountApprovals.map((request) => (
                <div key={request.id} className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{request.reference}</p>
                      <p className="text-xs text-muted-foreground">
                        {request.request_type} • Requested by {request.requested_by} • {relativeTime(request.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-semibold text-foreground">{formatCurrency(request.amount)}</p>
                      <StatusBadge status={request.status} />
                    </div>
                  </div>
                  <Textarea
                    placeholder="Optional note for this decision..."
                    value={notes[request.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))}
                    className="mt-3 h-16"
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1 bg-success text-success-foreground hover:bg-success/90"
                      disabled={decideApproval.isPending}
                      onClick={() => handleDecide(request.id, "approved")}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1"
                      disabled={decideApproval.isPending}
                      onClick={() => handleDecide(request.id, "rejected")}
                    >
                      <ThumbsDown className="h-3 w-3" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </QueryState>
        </PanelCard>
      )}

      {view === "alert_manual_override" && (
        <PanelCard title="Manual Override Requests">
          <QueryState isLoading={isLoading} error={error} isEmpty={manualOverrides.length === 0} emptyLabel="No manual override requests">
            <div className="space-y-3">
              {manualOverrides.map((override) => (
                <div key={override.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div>
                    <p className="font-medium text-foreground">{override.reference}</p>
                    <p className="text-xs text-muted-foreground">
                      By {override.requested_by} • {formatCurrency(override.amount)} • {relativeTime(override.created_at)}
                    </p>
                    {override.notes ? <p className="mt-1 text-xs text-muted-foreground">{override.notes}</p> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={override.status} />
                    {override.status === "pending" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="gap-1 bg-success text-success-foreground hover:bg-success/90"
                          disabled={decideApproval.isPending}
                          onClick={() => handleDecide(override.id, "approved")}
                        >
                          <CheckCircle className="h-3 w-3" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          disabled={decideApproval.isPending}
                          onClick={() => handleDecide(override.id, "rejected")}
                        >
                          <XCircle className="h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </QueryState>
        </PanelCard>
      )}

      {view === "alert_risky_transaction" && (
        <>
          <PanelCard
            title="Active Alerts"
            actions={
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="h-8 w-36">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            }
          >
            <QueryState isLoading={isLoading} error={error} isEmpty={filteredAlerts.length === 0} emptyLabel="No active alerts">
              <div className="space-y-2">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{alert.title}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">{alert.category}</Badge>
                        <StatusBadge status={alert.severity} />
                      </div>
                      <p className="text-xs text-muted-foreground">{alert.message}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{relativeTime(alert.created_at)}</span>
                      <StatusBadge status={alert.status} />
                      {alert.status !== "resolved" && (
                        <div className="flex gap-1">
                          {alert.status === "open" && (
                            <Button size="sm" variant="outline" onClick={() => handleAlertStatus(alert.id, "acknowledged")}>
                              Acknowledge
                            </Button>
                          )}
                          <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => handleAlertStatus(alert.id, "resolved")}>
                            Resolve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </QueryState>
          </PanelCard>

          <PanelCard title="Risky Transactions (Fraud Linked)">
            <QueryState isLoading={isLoading} error={error} isEmpty={riskyTransactions.length === 0} emptyLabel="No risky transactions detected">
              <div className="space-y-3">
                {riskyTransactions.map(({ fraud, txn }) => (
                  <div key={fraud.id} className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <span className="font-mono text-sm text-foreground">{fraud.txn_reference ?? fraud.alert_code}</span>
                        <StatusBadge status={fraud.risk_score >= 75 ? "critical" : fraud.risk_score >= 50 ? "warning" : "info"} />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-foreground">{formatCurrency(fraud.amount)}</span>
                        <span className="text-xs text-muted-foreground">{relativeTime(fraud.detected_at)}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {fraud.reason} • Entity: {fraud.entity} • Risk score {fraud.risk_score}
                      {txn ? ` • Txn status: ${txn.status}` : ""}
                    </p>
                    <div className="mt-2">
                      <StatusBadge status={fraud.status} />
                    </div>
                  </div>
                ))}
              </div>
            </QueryState>
          </PanelCard>
        </>
      )}
    </SectionShell>
  );
}
