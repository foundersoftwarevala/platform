import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  DegradedNotice,
  ErrorState,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import { useFounderGovernance } from "@/hooks/useFounderGovernance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ShieldAlert, 
  AlertTriangle, 
  Shield, 
  Lock,
  FileWarning,
  DollarSign,
  Clock,
  CheckCircle
} from "lucide-react";

/**
 * An icon for a risk area.
 *
 * The areas are whatever the risk register actually holds, so this matches on
 * what the area is about and falls back rather than assuming a fixed five.
 */
const areaIcon = (area: string) => {
  const key = area.toLowerCase();
  if (key.includes("secur")) return Shield;
  if (key.includes("legal") || key.includes("complian")) return FileWarning;
  if (key.includes("financ") || key.includes("cost") || key.includes("revenue")) return DollarSign;
  if (key.includes("sla") || key.includes("deadline") || key.includes("time")) return Clock;
  return Lock;
};

/** A stored date, shown as a day rather than an invented "2 days ago". */
const reviewedOn = (value: string | null) => {
  if (!value) return "not recorded";
  const at = new Date(value);
  return Number.isFinite(at.getTime()) ? at.toISOString().slice(0, 10) : value;
};

const getLevelStyle = (level: string) => {
  switch (level) {
    case 'high': return { bg: 'bg-destructive/20', text: 'text-destructive', border: 'border-destructive/30' };
    case 'medium': return { bg: 'bg-accent-amber/20', text: 'text-accent-amber', border: 'border-accent-amber/30' };
    case 'critical': return { bg: 'bg-destructive/30', text: 'text-destructive', border: 'border-destructive/50' };
    default: return { bg: 'bg-accent-emerald/20', text: 'text-accent-emerald', border: 'border-accent-emerald/30' };
  }
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'compliant': return 'bg-accent-emerald/20 text-accent-emerald';
    case 'warning': return 'bg-accent-amber/20 text-accent-amber';
    case 'review': return 'bg-primary/20 text-primary-glow';
    default: return 'bg-destructive/20 text-destructive';
  }
};

const AICEORiskCompliance = () => {
  const { t } = useTranslation();
  const {
    riskCategories,
    compliance,
    preventive,
    openRisks,
    criticalRisks,
    degraded,
    isLoading,
    failed,
    refetch,
  } = useFounderGovernance();

  if (isLoading) {
    return (
      <PageShell>
        <PageBanner
          icon={ShieldAlert}
          title={t("ceo.risk_compliance")}
          subtitle="Fraud detection, anomaly flagging and compliance posture across the ecosystem."
        />
        <LoadingState label={t("ceo.risk_loading")} />
      </PageShell>
    );
  }

  if (failed) {
    return (
      <PageShell>
        <PageBanner icon={ShieldAlert} title={t("ceo.risk_compliance")} />
        <ErrorState
          title={t("ceo.risk_failed")}
          description="The risk register and policy set could not be read, so this screen cannot say what is outstanding."
          onRetry={() => void refetch()}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageBanner
        icon={ShieldAlert}
        title={t("ceo.risk_compliance")}
        subtitle="Fraud detection, anomaly flagging and compliance posture across the ecosystem."
        status={
          criticalRisks > 0
            ? `${criticalRisks} critical of ${openRisks} open`
            : `${openRisks} open risk${openRisks === 1 ? "" : "s"}`
        }
      />

      {degraded.length > 0 && <DegradedNotice sources={degraded} />}

      {/* Risk Categories Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {riskCategories.map((risk, i) => {
          const style = getLevelStyle(risk.level);
          return (
            <motion.div
              key={risk.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className={`bg-card ${style.border} backdrop-blur-xl`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {(() => {
                      const Icon = areaIcon(risk.category);
                      return <Icon className={`w-5 h-5 ${style.text}`} />;
                    })()}
                    <Badge className={`${style.bg} ${style.text} text-xs`}>
                      {risk.level}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground font-medium mb-2">{risk.category}</p>
                  <div className="space-y-2">
                    <Progress value={risk.score ?? 0} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{risk.issues} issues</span>
                      <span className={style.text} title={risk.scoringMethod ?? undefined}>
                        {risk.score === null ? "not scored" : `${risk.score}%`}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Compliance Status */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-accent-emerald" />
              {t("ceo.compliance_status")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {compliance.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.policy}</p>
                      <p className="text-xs text-muted-foreground">
                        Effective {reviewedOn(item.lastReviewed)} · {item.source}
                        {item.scope ? " · " + item.scope : ""}
                      </p>
                    </div>
                    <Badge className={getStatusStyle(item.status)}>
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Preventive Suggestions */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-accent-amber" />
              {t("ceo.preventive_suggestions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {preventive.map((suggestion, i) => (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-4 rounded-lg bg-accent-amber/5 border border-accent-amber/20"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-accent-amber flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-foreground">{suggestion.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {suggestion.severity.toLowerCase()} · from {suggestion.source}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Notice */}
      <div className="p-4 rounded-lg bg-accent-amber/5 border border-accent-amber/20">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-accent-amber" />
          <p className="text-sm text-accent-amber/80">
            <strong>{t("ceo.risk_monitoring")}</strong> AI continuously monitors all risk vectors. Critical issues are escalated to Boss immediately.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEORiskCompliance;
