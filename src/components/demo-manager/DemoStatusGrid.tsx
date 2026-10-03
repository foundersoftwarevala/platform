import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Monitor,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Globe,
  Eye,
  Clock,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listDemoHealth, type DemoHealth } from "@/lib/marketplace-demo.functions";
import { useTranslation, type Translate } from "@/lib/i18n/use-translation";

/**
 * Demo Status Grid — the demos that exist, as they have actually behaved.
 *
 * This screen used to render twelve demos written into the file: "E-Commerce
 * Pro" at 99.99% uptime with 234 visitors and a 1.1s load, "Banking Portal" at
 * 523 visitors, "Inventory System" offline, and nine more. None of them was in
 * the catalogue and not one of those figures had been measured. The category
 * and status dropdowns filtered that array perfectly, which is what made it
 * convincing.
 *
 * What the platform knows is better. demo_url_audit_log holds the monitor's own
 * entries — 5,723 of them between 2026-09-07 and 2026-09-25, each carrying a
 * result, an HTTP status, a response time and the SSL days remaining — and
 * demo_clicks holds real visits. mm_demo_health counts both in SQL, so uptime
 * is working checks over total checks and the load figure is the mean response
 * time that was recorded rather than a number somebody liked.
 *
 * Three of the old card's fields have no source at all: a demo's region, the
 * devices it covers, and the technology behind it are not stored anywhere. The
 * slots stay, because the card is the design; what they no longer do is make
 * something up. Each says it is not recorded.
 *
 * The count is honest too. Nine of the ten demos the monitor has history for
 * were deleted on 2026-09-12; their checks remain in the log because it is an
 * audit trail, but they are not demos any more and do not appear here.
 */

type Tone = "active" | "degraded" | "offline";

/** What the card's badge should say, from what was measured rather than a label. */
function toneOf(d: DemoHealth): Tone {
  if (d.status && d.status !== "active") return "offline";
  if (d.latest_result && d.latest_result !== "working") return "offline";
  if (d.uptime_percent !== null && d.uptime_percent < 99) return "degraded";
  return "active";
}

const TONE_CLASS: Record<Tone, string> = {
  active: "bg-neon-green/20 text-neon-green border-neon-green/50",
  degraded: "bg-neon-orange/20 text-neon-orange border-neon-orange/50",
  offline: "bg-neon-red/20 text-neon-red border-neon-red/50",
};

function toneIcon(tone: Tone) {
  if (tone === "active") return <CheckCircle className="w-4 h-4 text-neon-green" />;
  if (tone === "degraded") return <AlertTriangle className="w-4 h-4 text-neon-orange" />;
  return <XCircle className="w-4 h-4 text-neon-red" />;
}

function sinceLabel(iso: string | null, t: Translate): string {
  if (!iso) return t("demo.status.never_checked");
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return t("demo.status.never_checked");
  if (mins < 1) return t("demo.status.just_now");
  if (mins < 60) return t("demo.status.minutes_ago", { count: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t("demo.status.hours_ago", { count: hours });
  return t("demo.status.days_ago", { count: Math.round(hours / 24) });
}

/** A figure with no source says so, in the slot where the number used to be. */
function NotRecorded() {
  const { t } = useTranslation();
  return <span className="text-muted-foreground/70">{t("demo.status.not_recorded")}</span>;
}

const DemoStatusGrid = () => {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [windowDays, setWindowDays] = useState("30");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DemoHealth[]>({
    queryKey: ["demo-health", windowDays],
    queryFn: () => listDemoHealth({ data: { days: Number(windowDays) } }) as Promise<DemoHealth[]>,
    staleTime: 60_000,
  });

  const demos = useMemo(() => data ?? [], [data]);

  const withTone = useMemo(() => demos.map((d) => ({ demo: d, tone: toneOf(d) })), [demos]);
  const filtered = withTone.filter((d) => statusFilter === "all" || d.tone === statusFilter);

  const activeCount = withTone.filter((d) => d.tone === "active").length;
  const degradedCount = withTone.filter((d) => d.tone === "degraded").length;
  const offlineCount = withTone.filter((d) => d.tone === "offline").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">{t("demo.status.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("demo.status.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-neon-green/20 text-neon-green border-neon-green/50 px-3 py-1">
            <CheckCircle className="w-3 h-3 mr-1" /> {t("demo.status.count_active", { count: activeCount })}
          </Badge>
          <Badge className="bg-neon-orange/20 text-neon-orange border-neon-orange/50 px-3 py-1">
            <AlertTriangle className="w-3 h-3 mr-1" /> {t("demo.status.count_degraded", { count: degradedCount })}
          </Badge>
          <Badge className="bg-neon-red/20 text-neon-red border-neon-red/50 px-3 py-1">
            <XCircle className="w-3 h-3 mr-1" /> {t("demo.status.count_offline", { count: offlineCount })}
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={windowDays} onValueChange={setWindowDays}>
          <SelectTrigger className="w-48 bg-secondary/50 border-border/50">
            <SelectValue placeholder={t("demo.status.window")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{t("demo.status.last_days", { count: 7 })}</SelectItem>
            <SelectItem value="30">{t("demo.status.last_days", { count: 30 })}</SelectItem>
            <SelectItem value="90">{t("demo.status.last_days", { count: 90 })}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-secondary/50 border-border/50">
            <SelectValue placeholder={t("demo.status.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("demo.status.all_status")}</SelectItem>
            <SelectItem value="active">{t("demo.status.active")}</SelectItem>
            <SelectItem value="degraded">{t("demo.status.degraded")}</SelectItem>
            <SelectItem value="offline">{t("demo.status.offline")}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? t("demo.status.reading") : t("demo.status.refresh")}
        </Button>
      </div>

      {isError && (
        <div className="glass-panel p-4 text-sm text-neon-red">
          {t("demo.status.read_failed")} {(error as Error)?.message}
        </div>
      )}

      {isLoading && (
        <div className="glass-panel p-4 text-sm text-muted-foreground">
          {t("demo.status.loading")}
        </div>
      )}

      {!isLoading && !isError && demos.length === 0 && (
        <div className="glass-panel p-4 text-sm text-muted-foreground">
          {t("demo.status.empty")}
        </div>
      )}

      {!isLoading && !isError && demos.length > 0 && filtered.length === 0 && (
        <div className="glass-panel p-4 text-sm text-muted-foreground">
          {t("demo.status.no_match")}
        </div>
      )}

      {/* Demo Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filtered.map(({ demo, tone }, index) => (
          <motion.div
            key={demo.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="glass-panel p-4 hover:border-neon-teal/50 transition-all duration-300 group"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-secondary to-card flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-mono font-semibold text-foreground truncate">
                    {demo.demo_name ?? t("demo.status.untitled")}
                  </h3>
                  <div className="text-xs text-muted-foreground truncate">
                    {demo.product_name ?? t("demo.status.not_linked")}
                  </div>
                </div>
              </div>
              <Badge className={TONE_CLASS[tone]}>
                {toneIcon(tone)}
                <span className="ml-1 text-[10px] uppercase">{tone}</span>
              </Badge>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div className="p-2 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">{t("demo.status.uptime")}</div>
                <div
                  className={`font-mono font-bold text-sm ${tone === "active" ? "text-neon-green" : "text-muted-foreground"}`}
                  title={
                    demo.checks
                      ? t("demo.status.checks_in_window", { checks: demo.checks, days: windowDays })
                      : t("demo.status.no_checks_in_window")
                  }
                >
                  {demo.uptime_percent === null ? "—" : `${demo.uptime_percent}%`}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">{t("demo.status.visits")}</div>
                <div className="font-mono font-bold text-sm text-primary">{demo.clicks}</div>
              </div>
              <div className="p-2 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">{t("demo.status.load")}</div>
                <div className="font-mono font-bold text-sm text-neon-cyan">
                  {demo.avg_response_ms === null ? "—" : `${demo.avg_response_ms}ms`}
                </div>
              </div>
            </div>

            {/* Info Row */}
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
              <div
                className="flex items-center gap-1"
                title={demo.unavailable?.region ?? t("demo.status.not_recorded")}
              >
                <Globe className="w-3 h-3" />
                <NotRecorded />
              </div>
              <div className="flex items-center gap-1">
                {demo.ssl_valid === null ? null : demo.ssl_valid ? (
                  <span
                    className="inline-flex items-center gap-1 text-neon-green"
                    title={
                      demo.ssl_days_left === null
                        ? t("demo.status.cert_valid")
                        : t("demo.status.cert_days_left", { count: demo.ssl_days_left })
                    }
                  >
                    <ShieldCheck className="w-3 h-3" />
                    {demo.ssl_days_left === null ? "SSL" /* i18n-ignore: protocol name */ : `${demo.ssl_days_left}d`}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-neon-red"
                    title={t("demo.status.cert_invalid")}
                  >
                    {/* i18n-ignore: protocol name */}
                    <ShieldAlert className="w-3 h-3" /> SSL
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1" title={demo.last_checked_at ?? ""}>
                <Clock className="w-3 h-3" />
                {sinceLabel(demo.last_checked_at, t)}
              </div>
            </div>

            {/* The address it actually points at, which is the thing an operator checks. */}
            <div className="text-[10px] text-muted-foreground mb-3 font-mono bg-secondary/30 px-2 py-1 rounded truncate">
              {demo.url || t("demo.status.no_address")}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                disabled={!demo.url}
                onClick={() => demo.url && window.open(demo.url, "_blank", "noopener,noreferrer")}
              >
                <Eye className="w-3 h-3 mr-1" />
                {t("demo.status.preview")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                disabled={!demo.product_id}
                onClick={() =>
                  demo.product_id &&
                  window.open(
                    `/marketplace/product/${demo.product_id}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                {t("demo.status.product")}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DemoStatusGrid;
