import { motion } from "framer-motion";
import { PageBanner, PageShell, SeedNotice } from "@/components/ai-ceo/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  BarChart3,
  Target,
  Clock,
  Award,
  AlertCircle
} from "lucide-react";

// Mock performance data
const rolePerformance = [
  { role: "Franchises", score: 87, trend: "up", metric: "Sales conversion", change: "+12%" },
  { role: "Resellers", score: 72, trend: "stable", metric: "Lead closure", change: "+2%" },
  { role: "Support Team", score: 94, trend: "up", metric: "Resolution time", change: "-18%" },
  { role: "Sales Team", score: 68, trend: "down", metric: "New clients", change: "-8%" },
  { role: "Developers", score: 91, trend: "up", metric: "Deploy success", change: "+5%" },
];

const productivityMetrics = [
  { metric: "Avg Tasks/Day", value: "23.4", trend: "up", target: 20 },
  { metric: "Response Time", value: "4.2h", trend: "up", target: 6 },
  { metric: "Quality Score", value: "8.7/10", trend: "stable", target: 8.5 },
  { metric: "Completion Rate", value: "94%", trend: "up", target: 90 },
];

const correctiveActions = [
  { team: "Sales Team", issue: "Below target for 3 weeks", action: "Recommend training session", priority: "high" },
  { team: "Reseller #23", issue: "Low engagement", action: "Schedule check-in call", priority: "medium" },
  { team: "Region LATAM", issue: "SLA approaching breach", action: "Allocate additional resources", priority: "high" },
];

const AICEOPerformance = () => {
  return (
    <PageShell>
      <PageBanner
        icon={TrendingUp}
        title="Performance Intelligence"
        subtitle="Ecosystem-wide performance intelligence across revenue, growth, efficiency and team output."
        status="Live metrics"
      />

      <SeedNotice waitingFor="per-role performance scoring across the platform's own data" />

      {/* Productivity Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {productivityMetrics.map((metric, i) => (
          <motion.div
            key={metric.metric}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="card3d premium-halo enter-soft rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{metric.metric}</span>
                  {metric.trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-accent-emerald" />
                  ) : metric.trend === 'down' ? (
                    <TrendingDown className="w-4 h-4 text-destructive" />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <p className="text-xl font-bold text-foreground">{metric.value}</p>
                <p className="text-xs text-muted-foreground">Target: {metric.target}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Role Performance */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-glow" />
              Role Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px]">
              <div className="space-y-4">
                {rolePerformance.map((role, i) => (
                  <motion.div
                    key={role.role}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-lg bg-surface border border-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{role.role}</span>
                        {role.trend === 'up' ? (
                          <Badge className="bg-accent-emerald/20 text-accent-emerald">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            {role.change}
                          </Badge>
                        ) : role.trend === 'down' ? (
                          <Badge className="bg-destructive/20 text-destructive">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            {role.change}
                          </Badge>
                        ) : (
                          <Badge className="bg-muted/20 text-muted-foreground">
                            {role.change}
                          </Badge>
                        )}
                      </div>
                      <span className="text-lg font-bold text-primary-glow">{role.score}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={role.score} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground">{role.metric}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Corrective Actions */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Target className="w-5 h-5 text-accent-amber" />
              Suggested Corrective Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {correctiveActions.map((action, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-4 rounded-lg border ${
                    action.priority === 'high' 
                      ? 'bg-destructive/5 border-destructive/20' 
                      : 'bg-accent-amber/5 border-accent-amber/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className={`w-4 h-4 ${
                        action.priority === 'high' ? 'text-destructive' : 'text-accent-amber'
                      }`} />
                      <span className="font-medium text-foreground">{action.team}</span>
                    </div>
                    <Badge className={
                      action.priority === 'high' 
                        ? 'bg-destructive/20 text-destructive' 
                        : 'bg-accent-amber/20 text-accent-amber'
                    }>
                      {action.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{action.issue}</p>
                  <p className="text-sm text-primary-glow">→ {action.action}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Notice */}
      <div className="p-4 rounded-lg bg-accent-emerald/5 border border-accent-emerald/20">
        <div className="flex items-center gap-3">
          <Award className="w-5 h-5 text-accent-emerald" />
          <p className="text-sm text-accent-emerald/80">
            <strong>Performance Analysis:</strong> AI provides improvement suggestions based on historical patterns and peer benchmarks.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEOPerformance;
