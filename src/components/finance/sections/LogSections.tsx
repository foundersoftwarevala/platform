import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Download,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Search,
  Shield,
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
import { downloadCsv, formatCurrency, formatDateTime, maskValue } from "@/lib/finance/format";
import { auditLogsQuery, fraudAlertsQuery, transactionsQuery } from "@/lib/finance/queries";
import { useUpdateFraudAlert } from "@/lib/finance/mutations";
import type { FraudAlert } from "@/lib/finance/types";
import type { FinanceView } from "@/lib/finance/views";

type Props = { view: FinanceView };

const FRAUD_STATUS_FLOW: Record<string, FraudAlert["status"][]> = {
  open: ["investigating", "resolved", "false_positive"],
  investigating: ["resolved", "false_positive"],
  resolved: [],
  false_positive: [],
};

export default function LogSections({ view }: Props) {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [revealSession, setRevealSession] = useState(false);

  const transactionsQ = useQuery(transactionsQuery({ limit: 300 }));
  const auditQ = useQuery(auditLogsQuery());
  const fraudQ = useQuery(fraudAlertsQuery());

  const updateFraud = useUpdateFraudAlert();

  const transactions = transactionsQ.data ?? [];
  const auditLogs = auditQ.data ?? [];
  const fraudAlerts = fraudQ.data ?? [];

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (search && !`${t.txn_code} ${t.counterparty} ${t.category}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (dateFrom && new Date(t.occurred_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(t.occurred_at) > new Date(dateTo)) return false;
      return true;
    });
  }, [transactions, search, statusFilter, dateFrom, dateTo]);

  const filteredAudit = useMemo(() => {
    return auditLogs.filter((a) => {
      if (search && !`${a.actor} ${a.action} ${a.entity}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (dateFrom && new Date(a.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(a.created_at) > new Date(dateTo)) return false;
      return true;
    });
  }, [auditLogs, search, severityFilter, dateFrom, dateTo]);

  const filteredFraud = useMemo(() => {
    return fraudAlerts.filter((f) => {
      if (search && !`${f.alert_code} ${f.entity} ${f.reason}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      return true;
    });
  }, [fraudAlerts, search, statusFilter]);

  const stats = useMemo(() => {
    const failed = transactions.filter((t) => t.status === "failed").length;
    const suspicious = auditLogs.filter((a) => a.severity === "critical" || a.severity === "warning").length;
    const activeFraud = fraudAlerts.filter((f) => f.status === "open" || f.status === "investigating").length;
    const avgRisk = fraudAlerts.length
      ? Math.round(fraudAlerts.reduce((acc, f) => acc + f.risk_score, 0) / fraudAlerts.length)
      : 0;
    return { total: transactions.length + auditLogs.length, suspicious, failed, activeFraud, securityScore: Math.max(0, 100 - avgRisk) };
  }, [transactions, auditLogs, fraudAlerts]);

  function exportTransactions() {
    if (filteredTransactions.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    downloadCsv(
      "transaction-logs.csv",
      filteredTransactions.map((t) => ({
        txn_code: t.txn_code,
        category: t.category,
        direction: t.direction,
        amount: t.amount,
        counterparty: view === "log_masked_view" ? maskValue(t.counterparty) : t.counterparty,
        gateway: t.gateway ?? "",
        status: t.status,
        occurred_at: t.occurred_at,
      })),
    );
  }

  function exportAudit() {
    if (filteredAudit.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    downloadCsv(
      "activity-audit-log.csv",
      filteredAudit.map((a) => ({
        actor: a.actor,
        actor_role: a.actor_role,
        action: a.action,
        entity: a.entity,
        entity_ref: a.entity_ref ?? "",
        ip_address: a.ip_address,
        user_agent: a.user_agent,
        severity: a.severity,
        created_at: a.created_at,
      })),
    );
  }

  function exportFraud() {
    if (filteredFraud.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    downloadCsv(
      "fraud-detection.csv",
      filteredFraud.map((f) => ({
        alert_code: f.alert_code,
        entity: f.entity,
        reason: f.reason,
        amount: f.amount,
        risk_score: f.risk_score,
        status: f.status,
        txn_reference: f.txn_reference ?? "",
        detected_at: f.detected_at,
        resolved_at: f.resolved_at ?? "",
      })),
    );
  }

  const meta: Partial<Record<FinanceView, { title: string; description: string; icon: typeof Lock }>> = {
    log_transactions: { title: "Transaction Logs", description: "Full transaction ledger with search and filters", icon: FileText },
    log_activity: { title: "Finance Activity Log", description: "Audit trail of finance actions across the platform", icon: Activity },
    log_masked_view: { title: "Masked Data View", description: "Sensitive fields masked by default; reveal only for this session", icon: Eye },
    log_fraud_detection: { title: "Fraud Detection", description: "Risk-scored fraud alerts and status management", icon: Shield },
  };
  const current = meta[view] ?? meta.log_transactions!;

  const isLoading = transactionsQ.isLoading || auditQ.isLoading || fraudQ.isLoading;
  const error = transactionsQ.error || auditQ.error || fraudQ.error;

  return (
    <SectionShell
      title={current.title}
      description={current.description}
      icon={current.icon}
      actions={
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            if (view === "log_activity") exportAudit();
            else if (view === "log_fraud_detection") exportFraud();
            else exportTransactions();
          }}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      }
    >
      <StatGrid>
        <StatCard label="Total Logs" value={stats.total} icon={FileText} loading={isLoading} />
        <StatCard label="Suspicious Activity" value={stats.suspicious} icon={AlertTriangle} tone="warning" loading={isLoading} />
        <StatCard label="Failed Transactions" value={stats.failed} icon={XCircle} tone="danger" loading={isLoading} />
        <StatCard label="Security Score" value={`${stats.securityScore}%`} icon={Shield} tone="success" loading={isLoading} />
      </StatGrid>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs by id, action, entity..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {(view === "log_transactions" || view === "log_masked_view") && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        )}
        {view === "log_activity" && (
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        )}
        {view === "log_fraud_detection" && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="false_positive">False positive</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40" />
        {view === "log_masked_view" && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setRevealSession((v) => !v)}>
            {revealSession ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {revealSession ? "Hide sensitive data" : "Reveal for session"}
          </Button>
        )}
      </div>

      {(view === "log_transactions" || view === "log_masked_view") && (
        <PanelCard title="Transaction Logs">
          <QueryState isLoading={isLoading} error={error} isEmpty={filteredTransactions.length === 0} emptyLabel="No transactions match the filters">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Txn</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Counterparty</th>
                    <th className="pb-2 font-medium">Gateway</th>
                    <th className="pb-2 font-medium">Time</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTransactions.slice(0, 150).map((t) => {
                    const masked = view === "log_masked_view" && !revealSession;
                    return (
                      <tr key={t.id}>
                        <td className="py-2 font-mono text-xs text-primary">{masked ? maskValue(t.txn_code) : t.txn_code}</td>
                        <td className="py-2 text-foreground">{t.category}</td>
                        <td className="py-2 font-semibold text-foreground">{formatCurrency(t.amount)}</td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">{masked ? maskValue(t.counterparty) : t.counterparty}</td>
                        <td className="py-2 text-xs text-muted-foreground">{t.gateway ?? "—"}</td>
                        <td className="py-2 text-xs text-muted-foreground">{formatDateTime(t.occurred_at)}</td>
                        <td className="py-2">
                          <StatusBadge status={t.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </QueryState>
        </PanelCard>
      )}

      {view === "log_activity" && (
        <PanelCard title="Finance Activity Log">
          <QueryState isLoading={isLoading} error={error} isEmpty={filteredAudit.length === 0} emptyLabel="No activity logs match the filters">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Actor</th>
                    <th className="pb-2 font-medium">Action</th>
                    <th className="pb-2 font-medium">Entity</th>
                    <th className="pb-2 font-medium">IP Address</th>
                    <th className="pb-2 font-medium">User Agent</th>
                    <th className="pb-2 font-medium">Severity</th>
                    <th className="pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredAudit.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 text-foreground">
                        <span className="font-medium">{a.actor}</span>
                        <span className="ml-1 text-xs text-muted-foreground">({a.actor_role})</span>
                      </td>
                      <td className="py-2 text-foreground">{a.action}</td>
                      <td className="py-2 text-xs text-muted-foreground">{a.entity}{a.entity_ref ? ` • ${a.entity_ref}` : ""}</td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{a.ip_address}</td>
                      <td className="py-2 max-w-[200px] truncate text-xs text-muted-foreground" title={a.user_agent}>{a.user_agent}</td>
                      <td className="py-2">
                        <StatusBadge status={a.severity} />
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{formatDateTime(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QueryState>
        </PanelCard>
      )}

      {view === "log_fraud_detection" && (
        <PanelCard title="Fraud Detection Alerts">
          <QueryState isLoading={isLoading} error={error} isEmpty={filteredFraud.length === 0} emptyLabel="No fraud alerts match the filters">
            <div className="space-y-3">
              {filteredFraud.map((alert) => {
                const nextStates = FRAUD_STATUS_FLOW[alert.status] ?? [];
                return (
                  <div key={alert.id} className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="font-medium text-foreground">{alert.alert_code}</span>
                        <Badge variant="outline">{alert.entity}</Badge>
                        <StatusBadge status={alert.risk_score >= 75 ? "critical" : alert.risk_score >= 50 ? "warning" : "info"} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Risk {alert.risk_score}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(alert.detected_at)}</span>
                        <StatusBadge status={alert.status} />
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{alert.reason} • Amount {formatCurrency(alert.amount)}</p>
                    {nextStates.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {nextStates.map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={status === "resolved" ? "default" : status === "false_positive" ? "outline" : "secondary"}
                            className={status === "resolved" ? "gap-1 bg-success text-success-foreground hover:bg-success/90" : "gap-1"}
                            disabled={updateFraud.isPending}
                            onClick={() => updateFraud.mutate({ id: alert.id, status, actor: "finance_manager" })}
                          >
                            {status === "resolved" && <CheckCircle className="h-3 w-3" />}
                            {status === "investigating" && <Eye className="h-3 w-3" />}
                            {status === "false_positive" && <XCircle className="h-3 w-3" />}
                            {status.replace("_", " ")}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </QueryState>
        </PanelCard>
      )}
    </SectionShell>
  );
}
