import { motion } from "framer-motion";
import { PageBanner, PageShell, SeedNotice } from "@/components/ai-ceo/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Settings, 
  Lock,
  Eye,
  Bell,
  Shield,
  Clock,
  Globe
} from "lucide-react";

// Read-only settings display
const settingsConfig = [
  {
    category: "Monitoring",
    icon: Eye,
    settings: [
      { label: "Real-time action monitoring", value: true, locked: true },
      { label: "Risk detection alerts", value: true, locked: true },
      { label: "Performance tracking", value: true, locked: true },
    ]
  },
  {
    category: "Notifications",
    icon: Bell,
    settings: [
      { label: "Daily summary to Boss", value: true, locked: true },
      { label: "Weekly report to CEO", value: true, locked: true },
      { label: "Critical alerts immediate", value: true, locked: true },
    ]
  },
  {
    category: "Security",
    icon: Shield,
    settings: [
      { label: "Fraud detection enabled", value: true, locked: true },
      { label: "Anomaly flagging", value: true, locked: true },
      { label: "Audit logging", value: true, locked: true },
    ]
  },
  {
    category: "System",
    icon: Globe,
    settings: [
      { label: "24/7 active mode", value: true, locked: true },
      { label: "Auto-learning enabled", value: true, locked: true },
      { label: "Multi-region monitoring", value: true, locked: true },
    ]
  },
];

const AICEOSettings = () => {
  return (
    <PageShell>
      <PageBanner
        icon={Settings}
        title="Settings"
        subtitle="AI CEO configuration surface — read-only, controlled by the system owner."
        status="Read-only mode"
      />

      <SeedNotice waitingFor="these controls being bound to real module behaviour" />

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {settingsConfig.map((category, i) => (
          <motion.div
            key={category.category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <category.icon className="w-5 h-5 text-primary-glow" />
                  {category.category}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.settings.map((setting, j) => (
                  <div 
                    key={j}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <Label className="text-sm text-foreground">{setting.label}</Label>
                      {setting.locked && (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <Switch 
                      checked={setting.value} 
                      disabled={setting.locked}
                      className="cursor-not-allowed opacity-60"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* System Info */}
      <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-glow" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-4 rounded-lg bg-surface border border-border">
              <p className="text-xs text-muted-foreground mb-1">AI Version</p>
              <p className="text-lg font-bold text-foreground">v2.0.4</p>
            </div>
            <div className="p-4 rounded-lg bg-surface border border-border">
              <p className="text-xs text-muted-foreground mb-1">Model Version</p>
              <p className="text-lg font-bold text-foreground">ML-3.2</p>
            </div>
            <div className="p-4 rounded-lg bg-surface border border-border">
              <p className="text-xs text-muted-foreground mb-1">Last Training</p>
              <p className="text-lg font-bold text-foreground">2 days ago</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Notice */}
      <div className="p-4 rounded-lg bg-muted/5 border border-muted/20">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            <strong>Settings Notice:</strong> AI CEO settings are controlled by the system and cannot be modified. Contact Boss/Owner for configuration changes.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEOSettings;
