import { useState } from "react";
import { ChatAppButton } from "@/components/chat/ChatAppButton";
import { motion } from "framer-motion";
import { useQuery, useQueryClient, useIsFetching } from "@tanstack/react-query";
import { Search, Settings, Globe, Monitor, Activity, Users, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import GlobalNotificationHeader from "@/components/shared/GlobalNotificationHeader";
import type { NotificationAlert } from "@/components/shared/GlobalNotificationHeader";
import { listDemoHealth } from "@/lib/marketplace-demo.functions";
import { useTranslation } from "@/lib/i18n/use-translation";
import { demoAlertsKey, fetchDemoAlerts } from "./demoAlertsSource";

interface DemoManagerTopBarProps {
  onNotificationsClick: () => void;
  notifications?: NotificationAlert[];
  onDismissNotification?: (id: string) => void;
  onNotificationAction?: (id: string) => void;
}

/**
 * The header used to show four figures typed into this file ("47" active
 * demos, "1,842" live visitors, "1.2s", "12" regions) and a fixed "99.9%
 * UPTIME". They are now counted from mm_demo_health - the same monitor
 * checks the Uptime screen reads - and the two the platform does not record
 * (live visitors, regions) show a dash with the reason.
 */
type TopBarHealthRow = {
  status: string | null;
  checks: number | null;
  uptime_percent: number | null;
  avg_response_ms: number | null;
};

const DemoManagerTopBar = ({
  onNotificationsClick,
  notifications = [],
  onDismissNotification = () => {},
  onNotificationAction = () => {},
}: DemoManagerTopBarProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetching = useIsFetching();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const healthQuery = useQuery<TopBarHealthRow[]>({
    queryKey: ["demo-health", "topbar"],
    queryFn: () => listDemoHealth({ data: { days: 30 } }) as Promise<TopBarHealthRow[]>,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const alertsQuery = useQuery({
    queryKey: demoAlertsKey,
    queryFn: () => fetchDemoAlerts(50),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const rows = healthQuery.data ?? [];
  const ready = !!healthQuery.data;
  const unavailable = healthQuery.isLoading ? "…" : "—";
  const weighted = rows.reduce(
    (acc, d) =>
      d.avg_response_ms == null || !d.checks
        ? acc
        : { sum: acc.sum + d.avg_response_ms * d.checks, n: acc.n + d.checks },
    { sum: 0, n: 0 },
  );
  const uptimes = rows
    .map((d) => d.uptime_percent)
    .filter((u): u is number => typeof u === "number");
  const uptime = uptimes.length ? uptimes.reduce((a, b) => a + b, 0) / uptimes.length : null;

  const liveMetrics = [
    {
      label: t("demo.topbar.active_demos"),
      value: ready ? String(rows.filter((d) => d.status === "active").length) : unavailable,
      icon: Monitor,
      color: "text-neon-green",
      title: t("demo.topbar.active_demos_note"),
    },
    {
      label: t("demo.topbar.live_visitors"),
      value: "—",
      icon: Users,
      color: "text-neon-teal",
      title: t("demo.topbar.live_visitors_note"),
    },
    {
      label: t("demo.topbar.avg_load_time"),
      value:
        ready && weighted.n > 0 ? `${(weighted.sum / weighted.n / 1000).toFixed(1)}s` : unavailable,
      icon: Zap,
      color: "text-neon-cyan",
      title: t("demo.topbar.avg_load_time_note"),
    },
    {
      label: t("demo.topbar.regions"),
      value: "—",
      icon: Globe,
      color: "text-primary",
      title: t("demo.topbar.regions_note"),
    },
  ];

  // Unresolved monitor alerts feed the bell; "View alerts" opens the alerts sheet.
  const liveNotifications: NotificationAlert[] = (alertsQuery.data ?? [])
    .filter((a) => !a.is_resolved && !dismissed.has(a.id))
    .map((a): NotificationAlert => ({
      id: a.id,
      type: a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "info",
      message: `${a.demoName}: ${a.message}`,
      timestamp: new Date(a.created_at),
      eventType: a.alert_type,
      actionLabel: t("demo.topbar.view_alerts"),
    }));
  const shownNotifications = notifications.length > 0 ? notifications : liveNotifications;
  const dismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    onDismissNotification(id);
  };
  const act = (id: string) => {
    onNotificationAction(id);
    onNotificationsClick();
  };
  const refresh = () => {
    void queryClient.refetchQueries({ type: "active" });
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="h-16 glass-panel border-b border-border/30 px-6 flex items-center justify-between sticky top-0 z-40"
    >
      {/* Left Section - Search */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search demos, categories..."
            disabled
            title={t("demo.topbar.no_search")}
            className="w-64 lg:w-80 pl-10 bg-secondary/50 border-border/50 focus:border-neon-teal/50"
          />
        </div>
      </div>

      {/* Center Section - Live Metrics */}
      <div className="hidden xl:flex items-center gap-6">
        {liveMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-2"
              title={metric.title}
            >
              <Icon className={`w-4 h-4 ${metric.color}`} />
              <div>
                <div className={`text-sm font-mono font-bold ${metric.color}`}>{metric.value}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  {metric.label}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-3">
        {/* Refresh Status */}
        <Button
          variant="ghost"
          size="icon"
          className="text-neon-teal hover:text-neon-teal"
          onClick={refresh}
          disabled={fetching > 0}
          aria-label={t("demo.topbar.refresh")}
        >
          <RefreshCw className={`w-4 h-4 ${fetching > 0 ? "animate-spin" : ""}`} />
        </Button>

        {/* System Health */}
        <div
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neon-green/10 border border-neon-green/30"
          title={t("demo.topbar.uptime_note")}
        >
          <Activity className="w-4 h-4 text-neon-green animate-pulse" />
          <span className="text-xs font-mono text-neon-green">
            {t("demo.topbar.uptime", {
              value: uptime === null ? unavailable : `${uptime.toFixed(1)}%`,
            })}
          </span>
        </div>

        {/* Internal chat */}
        <ChatAppButton className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" />

        {/* Global Notification Header */}
        <GlobalNotificationHeader
          userRole="demo_manager"
          notifications={shownNotifications}
          onDismiss={dismiss}
          onAction={act}
        />

        {/* Settings */}
        <Button variant="ghost" size="icon" disabled title={t("demo.topbar.no_settings")}>
          <Settings className="w-5 h-5" />
        </Button>

        {/* Manager Avatar with Role Badge */}
        <div className="flex items-center gap-3 pl-3 border-l border-border/50">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-neon-teal to-neon-green flex items-center justify-center">
            <Monitor className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="hidden md:block">
            <Badge
              variant="outline"
              className="bg-neon-teal/10 text-neon-teal border-neon-teal/30 text-[10px] px-1.5"
            >
              DEMO MANAGER
            </Badge>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default DemoManagerTopBar;
