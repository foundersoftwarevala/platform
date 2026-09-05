import { motion } from "framer-motion";
import { 
  Search, 
  Settings, 
  Globe, 
  Monitor,
  Activity,
  Users,
  Zap,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import GlobalNotificationHeader from "@/components/shared/GlobalNotificationHeader";
import type { NotificationAlert } from "@/components/shared/GlobalNotificationHeader";
import { useAuth } from "@/hooks/useAuth";

interface DemoManagerTopBarProps {
  onNotificationsClick: () => void;
  notifications?: NotificationAlert[];
  onDismissNotification?: (id: string) => void;
  onNotificationAction?: (id: string) => void;
}

const liveMetrics = [
  { label: "Active Demos", value: "47", icon: Monitor, color: "text-neon-green" },
  { label: "Live Visitors", value: "1,842", icon: Users, color: "text-neon-teal" },
  { label: "Avg Load Time", value: "1.2s", icon: Zap, color: "text-neon-cyan" },
  { label: "Regions", value: "12", icon: Globe, color: "text-primary" },
];

const DemoManagerTopBar = ({ 
  onNotificationsClick,
  notifications = [],
  onDismissNotification = () => {},
  onNotificationAction = () => {}
}: DemoManagerTopBarProps) => {
  const { user } = useAuth();
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Manager';
  const maskedId = `DM-${user?.id?.slice(0, 4).toUpperCase() || 'XXXX'}`;

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
            >
              <Icon className={`w-4 h-4 ${metric.color}`} />
              <div>
                <div className={`text-sm font-mono font-bold ${metric.color}`}>
                  {metric.value}
                </div>
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
        <Button variant="ghost" size="icon" className="text-neon-teal hover:text-neon-teal">
          <RefreshCw className="w-4 h-4" />
        </Button>

        {/* System Health */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neon-green/10 border border-neon-green/30">
          <Activity className="w-4 h-4 text-neon-green animate-pulse" />
          <span className="text-xs font-mono text-neon-green">99.9% UPTIME</span>
        </div>

        {/* Global Notification Header */}
        <GlobalNotificationHeader
          userRole="demo_manager"
          notifications={notifications}
          onDismiss={onDismissNotification}
          onAction={onNotificationAction}
        />

        {/* Settings */}
        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5" />
        </Button>

        {/* Manager Avatar with Role Badge */}
        <div className="flex items-center gap-3 pl-3 border-l border-border/50">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-neon-teal to-neon-green flex items-center justify-center">
            <Monitor className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="hidden md:block">
            <Badge variant="outline" className="bg-neon-teal/10 text-neon-teal border-neon-teal/30 text-[10px] px-1.5">
              DEMO MANAGER
            </Badge>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default DemoManagerTopBar;
