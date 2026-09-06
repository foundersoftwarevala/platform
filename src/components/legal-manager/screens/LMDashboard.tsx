import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle,
  Copyright,
  FileCheck,
  Globe,
  Lock,
  Scale,
  ShieldAlert,
  Timer,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AsyncState } from "../common/AsyncState";
import { CatalogueSection } from "../common/CatalogueSection";
import { statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";
import {
  useLegalAlerts,
  useLegalLogs,
  useLegalRecords,
  useLegalViolations,
  useTrademarkAssets,
  useUpdateRecordStatus,
  type LegalRecord,
} from "@/lib/legal-data";

interface LMDashboardProps {
  activeSubSection: string;
}

const TONES: Record<string, string> = {
  emerald: "text-emerald-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
  orange: "text-orange-400",
  cyan: "text-cyan-400",
  blue: "text-blue-400",
};

const LMDashboard = ({ activeSubSection }: LMDashboardProps) => {
  const agreementsQuery = useLegalRecords("agreement");
  const { data: recentAgreements = [] } = agreementsQuery;
  const { data: roleAgreements = [] } = useLegalRecords("role_agreement");
  const { data: compliance = [] } = useLegalRecords("international_law");
  const { data: contracts = [] } = useLegalRecords("contract");
  const { data: approvals = [] } = useLegalRecords("approval");
  const { data: violations = [] } = useLegalViolations();
  const {
    data: alerts = [],
    isLoading: alertsLoading,
    isError: alertsError,
    error: alertsErrorObj,
    refetch: refetchAlerts,
  } = useLegalAlerts();
  const {
    data: logs = [],
    isLoading: logsLoading,
    isError: logsError,
    error: logsErrorObj,
    refetch: refetchLogs,
  } = useLegalLogs();
  const { data: trademarkAssets = [] } = useTrademarkAssets();
  const updateRecord = useUpdateRecordStatus();

  const totalAcceptances = roleAgreements.reduce((sum, r) => sum + Number(r.acceptances ?? 0), 0);
  const pendingAcceptances = roleAgreements
    .filter((r) => r.status !== "active")
    .reduce((sum, r) => sum + Number(r.acceptances ?? 0), 0);
  const coverageValues = compliance
    .map((c) => parseInt(String(c.coverage ?? "0"), 10))
    .filter((n) => !Number.isNaN(n));
  const avgCoverage = coverageValues.length
    ? Math.round(coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length)
    : 0;

  const pendingReviews = approvals.filter((a) => String(a.status).toLowerCase() === "pending");
  const expiring = [...contracts, ...recentAgreements].filter((record) => {
    const raw = String(record.expiry ?? record.validity ?? "");
    const match = raw.match(/\d{4}-\d{2}-\d{2}/g);
    const end = match?.[match.length - 1];
    if (!end) return false;
    const days = (new Date(end).getTime() - Date.now()) / 86_400_000;
    return days > 0 && days < 365;
  });
  const criticalAlerts = alerts.filter((a) =>
    ["critical", "high"].includes(String(a.severity ?? "").toLowerCase()),
  );

  const stats = [
    { label: "Active Agreements", value: String(totalAcceptances), icon: FileCheck, color: "emerald" },
    { label: "Pending Acceptances", value: String(pendingAcceptances), icon: AlertTriangle, color: "yellow" },
    {
      label: "Policy Violations",
      value: String(violations.filter((v) => v.status !== "resolved").length),
      icon: XCircle,
      color: "red",
    },
    {
      label: "Copyright Alerts",
      value: String(alerts.filter((a) => a.alert_type === "copyright_misuse").length),
      icon: Copyright,
      color: "orange",
    },
    {
      label: "Trademark Status",
      value: trademarkAssets.every((t) => t.status === "protected") ? "Active" : "Review",
      icon: Award,
      color: "cyan",
    },
    { label: "Country Compliance", value: `${avgCoverage}%`, icon: Globe, color: "blue" },
  ];

  const secondary = [
    { label: "Open cases", value: violations.filter((v) => v.status !== "resolved").length, icon: ShieldAlert },
    { label: "Pending reviews", value: pendingReviews.length, icon: CheckCircle },
    { label: "Expiring documents", value: expiring.length, icon: Timer },
    { label: "Critical alerts", value: criticalAlerts.length, icon: AlertTriangle },
  ];

  const updateAgreement = (record: LegalRecord, status: string, action: string) => {
    updateRecord.mutate(
      {
        id: record.id,
        category: "agreement",
        status,
        action,
        details: `${record.name} set to ${status}`,
      },
      {
        onSuccess: () => toast.success(`${action}: ${record.name}`),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg">
          <Scale className="h-7 w-7 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">Legal Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of all legal &amp; compliance matters</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="h-full border-border/50 bg-card/50">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <stat.icon className={`h-5 w-5 shrink-0 ${TONES[stat.color]}`} aria-hidden="true" />
                  <span className={`truncate text-2xl font-bold ${TONES[stat.color]}`}>{stat.value}</span>
                </div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {secondary.map((item) => (
          <Card key={item.label} className="border-border/50 bg-card/50">
            <CardContent className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15">
                <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-foreground">{item.value}</p>
                <p className="truncate text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5 text-primary" aria-hidden="true" />
              Compliance status by regulation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {compliance.map((item) => {
              const value = parseInt(String(item.coverage ?? "0"), 10) || 0;
              return (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-foreground">{item.name}</span>
                    <span className="shrink-0 text-muted-foreground">{value}%</span>
                  </div>
                  <Progress value={value} aria-label={`${item.name} coverage`} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
              Critical alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AsyncState
              isLoading={alertsLoading}
              isError={alertsError}
              error={alertsErrorObj as { message?: string } | null}
              isEmpty={criticalAlerts.length === 0}
              onRetry={() => void refetchAlerts()}
              rows={3}
              emptyTitle="No critical alerts"
              emptyDescription="High and critical severity alerts will surface here the moment they are detected."
            >
              <ul className="space-y-3">
                {criticalAlerts.slice(0, 5).map((alert) => (
                  <li
                    key={alert.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{alert.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{alert.description}</p>
                    </div>
                    <Badge className="shrink-0 bg-red-500/15 text-red-400">{alert.severity}</Badge>
                  </li>
                ))}
              </ul>
            </AsyncState>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncState
            isLoading={logsLoading}
            isError={logsError}
            error={logsErrorObj as { message?: string } | null}
            isEmpty={logs.length === 0}
            onRetry={() => void refetchLogs()}
            rows={3}
            emptyTitle="No activity recorded yet"
            emptyDescription="Every action taken in the legal workspace is appended to the immutable audit trail."
          >
            <ol className="relative space-y-4 border-l border-border pl-5">
              {logs.slice(0, 6).map((log) => (
                <li key={log.id} className="relative">
                  <span
                    className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-foreground">{log.action}</p>
                  <p className="text-xs text-muted-foreground">{log.details}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {new Date(log.logged_at).toLocaleString()} · {log.actor}
                  </p>
                </li>
              ))}
            </ol>
          </AsyncState>
        </CardContent>
      </Card>

      <CatalogueSection
        title="Recent Agreements"
        icon={FileCheck}
        records={recentAgreements}
        isLoading={agreementsQuery.isLoading}
        isError={agreementsQuery.isError}
        error={agreementsQuery.error as { message?: string } | null}
        onRetry={() => void agreementsQuery.refetch()}
        focusLabel={subsectionLabel(activeSubSection)}
        columns={[
          { key: "name", header: "Agreement" },
          { key: "type", header: "Type" },
          { key: "updated", header: "Updated" },
          { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
        ]}
        rowActions={(record) => (
          <>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Lock ${record.name}`}
              disabled={updateRecord.isPending}
              onClick={() => updateAgreement(record, "locked", "Agreement Locked")}
            >
              <Lock className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Publish ${record.name}`}
              disabled={updateRecord.isPending}
              onClick={() => updateAgreement(record, "active", "Agreement Published")}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          </>
        )}
        drawerActions={(record) => (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={updateRecord.isPending}
              onClick={() => updateAgreement(record, "locked", "Agreement Locked")}
            >
              <Lock className="mr-2 h-4 w-4" /> Lock
            </Button>
            <Button
              size="sm"
              disabled={updateRecord.isPending}
              onClick={() => updateAgreement(record, "active", "Agreement Published")}
            >
              <CheckCircle className="mr-2 h-4 w-4" /> Publish
            </Button>
          </>
        )}
      />
    </div>
  );
};

export default LMDashboard;
