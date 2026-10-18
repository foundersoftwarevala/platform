import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  Monitor,
  Globe,
  Zap,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import DataStateNotice from "./DataStateNotice";
import { demoAlertsKey, fetchDemoAlerts, relativeTime } from "./demoAlertsSource";

interface DemoNotificationsProps {
  open: boolean;
  onClose: () => void;
}

interface Notification {
  id: string;
  type: "alert" | "success" | "info" | "warning";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  demo?: string;
}

/**
 * The sheet used to list seven notifications typed into this file - "Banking
 * Portal is back online", "All 47 demos passed" - about demos this platform
 * does not run. It now lists the real alerts the monitor writes to
 * demo_alerts; an alert counts as unread until it is resolved.
 */
const humanise = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const DemoNotifications = ({ open, onClose }: DemoNotificationsProps) => {
  const alertsQuery = useQuery({
    queryKey: demoAlertsKey,
    queryFn: () => fetchDemoAlerts(50),
    enabled: open,
    staleTime: 30_000,
    retry: 1,
  });

  const notifications: Notification[] = (alertsQuery.data ?? []).map((a) => ({
    id: a.id,
    type: a.is_resolved
      ? "success"
      : a.severity === "critical"
        ? "alert"
        : a.severity === "warning"
          ? "warning"
          : "info",
    title: a.is_resolved ? `${humanise(a.alert_type)} - resolved` : humanise(a.alert_type),
    message: a.message,
    timestamp: relativeTime(a.is_resolved ? (a.resolved_at ?? a.created_at) : a.created_at),
    read: a.is_resolved,
    demo: a.demoName,
  }));

  const getIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <AlertTriangle className="w-5 h-5" />;
      case "success":
        return <CheckCircle className="w-5 h-5" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "alert":
        return "text-neon-red bg-neon-red/20 border-neon-red/50";
      case "success":
        return "text-neon-green bg-neon-green/20 border-neon-green/50";
      case "warning":
        return "text-neon-orange bg-neon-orange/20 border-neon-orange/50";
      default:
        return "text-neon-cyan bg-neon-cyan/20 border-neon-cyan/50";
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] bg-card border-border/30">
        <SheetHeader className="border-b border-border/30 pb-4">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-neon-teal" />
              <span className="font-mono">Demo Alerts</span>
            </div>
            {unreadCount > 0 && (
              <Badge className="bg-neon-teal/20 text-neon-teal border-neon-teal/50">
                {unreadCount} new
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-2 max-h-[calc(100vh-120px)] overflow-auto">
          <DataStateNotice
            isLoading={alertsQuery.isLoading}
            error={alertsQuery.error}
            isEmpty={notifications.length === 0}
            resource="demo alerts"
            emptyTitle="No demo alerts"
            emptyDescription="The monitor has not raised any alerts."
            emptyIcon={<Bell className="w-8 h-8 text-muted-foreground" />}
            onRetry={() => void alertsQuery.refetch()}
          >
            {notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-3 rounded-lg border transition-all ${
                  notification.read
                    ? "bg-secondary/30 border-border/30"
                    : "bg-secondary/50 border-neon-teal/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center border ${getColor(notification.type)}`}
                  >
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm">
                        {notification.title}
                      </span>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-neon-teal animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {notification.demo && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary font-mono">
                          {notification.demo}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {notification.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </DataStateNotice>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void alertsQuery.refetch()}
            disabled={alertsQuery.isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${alertsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh Status
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DemoNotifications;
