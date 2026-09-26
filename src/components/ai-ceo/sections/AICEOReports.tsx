import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  DegradedNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import { useFounderReports, type ReportRecord, type ReportTotals } from "@/hooks/useFounderBrain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Calendar,
  Download,
  Mail,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

/**
 * The reports the report generator has actually produced.
 *
 * This screen carried four reports written into the component under a
 * comment reading "Mock reports data", with delivery times and accuracy
 * percentages nobody had measured. The layout is unchanged; only where the
 * rows come from has.
 */

/** What a report is shown as: its findings, or why it has none. */
const highlightsOf = (report: ReportRecord): string[] => {
  if (report.insufficientData || report.findings.length === 0) {
    return report.limitations.length > 0
      ? report.limitations
      : ["No sufficient data available for this period."];
  }
  return report.findings.map((f) => f.statement);
};

/** Who may read it. An empty list means everyone holding report.read. */
const audienceOf = (report: ReportRecord): string =>
  report.allowedRoles.length > 0
    ? report.allowedRoles.join(", ")
    : "everyone who holds report.read";

const generatedOn = (value: string): string => {
  const at = new Date(value);
  return Number.isFinite(at.getTime()) ? at.toISOString().replace("T", " ").slice(0, 16) : value;
};

/**
 * The four headline figures.
 *
 * They read 365 daily, 52 weekly, 12 monthly and "100% delivered" — written
 * into this file, never counted, and in the last case describing something
 * the platform does not do: no report is delivered anywhere. These four are
 * counted in SQL by founder_report_totals, scoped to the roles of whoever is
 * reading, so a restricted reader is not shown a total that includes reports
 * they cannot open.
 *
 * A count that could not be taken shows as "—", never as 0.
 */
const statsOf = (
  totals: ReportTotals | null,
): { label: string; count: string; icon: LucideIcon; color: string }[] => {
  const shown = (value: number | undefined): string =>
    typeof value === "number" ? value.toLocaleString() : "—";
  return [
    {
      label: "Reports Generated",
      count: shown(totals?.generated),
      icon: FileText,
      color: "text-primary-glow",
    },
    {
      label: "With Findings",
      count: shown(totals?.withFindings),
      icon: TrendingUp,
      color: "text-accent-pink",
    },
    {
      label: "Insufficient Data",
      count: shown(totals?.insufficientData),
      icon: AlertTriangle,
      color: "text-accent-amber",
    },
    {
      label: "Failed",
      count: shown(totals?.failed),
      icon: CheckCircle,
      color: "text-accent-emerald",
    },
  ];
};

/**
 * Download is a real download.
 *
 * The button had no handler at all. It now writes out exactly the report the
 * screen is already holding — period, basis, findings, recommendations,
 * limitations and confidence — as JSON. Nothing is fetched, nothing is
 * rendered into a document that claims more than the record contains.
 */
const downloadReport = (report: ReportRecord): void => {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.reportType.toLowerCase()}-${report.generatedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/**
 * The badge colour for a report type.
 *
 * The three cases here were "daily", "weekly" and "monthly", which no report
 * has ever been: the generator files EXECUTIVE_SUMMARY, OPERATIONAL_HEALTH,
 * DECISION_REVIEW, RISK_REVIEW and KPI_REVIEW, so every badge fell through to
 * the muted default. The original three are kept so nothing that did match
 * stops matching.
 */
const getTypeColor = (type: string) => {
  switch (type) {
    case "EXECUTIVE_SUMMARY":
    case "daily":
      return "bg-primary/20 text-primary-glow";
    case "OPERATIONAL_HEALTH":
    case "weekly":
      return "bg-accent-pink/20 text-accent-pink";
    case "KPI_REVIEW":
    case "monthly":
      return "bg-accent-emerald/20 text-accent-emerald";
    case "RISK_REVIEW":
      return "bg-accent-amber/20 text-accent-amber";
    case "DECISION_REVIEW":
      return "bg-primary/20 text-primary-glow";
    default:
      return "bg-muted/20 text-muted-foreground";
  }
};

const AICEOReports = () => {
  const { t } = useTranslation();
  const { reports, totals, degraded, isLoading, failed, refetch, generate, isGenerating } =
    useFounderReports();

  if (isLoading) {
    return (
      <PageShell>
        <PageBanner icon={FileText} title={t("ceo.reports_title")} />
        <LoadingState label={t("ceo.reports_loading")} />
      </PageShell>
    );
  }

  if (failed) {
    return (
      <PageShell>
        <PageBanner icon={FileText} title={t("ceo.reports_title")} />
        <ErrorState
          title={t("ceo.reports_failed")}
          description="The report register could not be read, so this screen cannot say what has been generated."
          onRetry={() => void refetch()}
        />
      </PageShell>
    );
  }
  return (
    <PageShell>
      <PageBanner
        icon={FileText}
        title={t("ceo.reports_title")}
        subtitle="Executive briefings and AI-generated reports, ready for download and board review."
        status={totals ? `${totals.total} report(s) on the register` : "Register count unavailable"}
        actions={
          <Button
            size="sm"
            onClick={() => void generate({ reportType: "EXECUTIVE_SUMMARY", days: 7 })}
            disabled={isGenerating}
          >
            <FileText className="w-4 h-4 mr-1" />
            {isGenerating ? "Generating…" : "Generate executive summary"}
          </Button>
        }
      />

      {degraded.length > 0 && <DegradedNotice sources={degraded} />}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {statsOf(totals).map((stat) => (
          <Card key={stat.label} className="card3d premium-halo enter-soft rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <p className="text-lg font-bold text-foreground">{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Reports */}
        <div className="lg:col-span-2">
          <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl h-full">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-glow" />
                Recent Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {reports.length === 0 && (
                    <EmptyState
                      icon={FileText}
                      title="No report has been generated yet"
                      description="This register fills when a report is generated. Nothing here is simulated, and no report is produced on a schedule."
                    />
                  )}
                  {reports.map((report, i) => (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-4 rounded-xl bg-surface border border-border hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-foreground">{report.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {generatedOn(report.generatedAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getTypeColor(report.reportType)}>
                            {report.reportType.replace(/_/g, " ").toLowerCase()}
                          </Badge>
                          <Badge className="bg-accent-emerald/20 text-accent-emerald">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {report.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {t("ceo.readable_by")} {audienceOf(report)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {highlightsOf(report).map((highlight, j) => (
                          <Badge key={j} variant="outline" className="text-xs">
                            {highlight}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-primary-glow hover:text-primary-glow"
                          onClick={() => downloadReport(report)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Reports */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent-pink" />
              Upcoming Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/*
                Reports are generated on request. Nothing schedules them yet,
                so this says so rather than listing times nobody will honour —
                which is what the four hardcoded entries here used to do.
              */}
              <div className="p-4 rounded-lg bg-surface border border-border">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t("ceo.nothing_scheduled")}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Notice */}
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary-glow" />
          <p className="text-sm text-primary-glow/80">
            <strong>{t("ceo.reports_note_label")}</strong> {t("ceo.reports_note")}
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEOReports;
