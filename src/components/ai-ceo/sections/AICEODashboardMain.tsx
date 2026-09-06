import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  DegradedNotice,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  ShieldAlert,
  Brain,
  Eye,
  Zap,
  Send,
  Radio,
  Server,
  RefreshCw,
  Lightbulb,
  Target,
  BarChart3
} from "lucide-react";
import { useCEOSuggestions, type CEOSuggestion, type AIObservation, type ActivityEvent } from "@/hooks/useCEOSuggestions";
import { toast } from "sonner";

/**
 * Renders a measurement, or says plainly that there isn't one.
 *
 * Every tile used to carry a random number, so none of them could ever be
 * empty. Now they are counted from real tables and a figure with no source is
 * null — shown as a dash rather than a zero, because a measured zero and an
 * absent measurement mean very different things to whoever is reading this.
 */
const formatMetric = (value: number | null): string =>
  value === null ? "—" : value.toLocaleString();

// Helper functions for styling
const getImpactStyle = (impact: string) => {
  switch (impact) {
    case 'high': return 'bg-destructive/20 text-destructive border-destructive/30';
    case 'medium': return 'bg-accent-amber/20 text-accent-amber border-accent-amber/30';
    default: return 'bg-accent-emerald/20 text-accent-emerald border-accent-emerald/30';
  }
};

const getSeverityStyle = (severity: string) => {
  switch (severity) {
    case 'critical': return { bg: 'bg-destructive/10', border: 'border-destructive/30', text: 'text-destructive' };
    case 'warning': return { bg: 'bg-accent-amber/10', border: 'border-accent-amber/30', text: 'text-accent-amber' };
    default: return { bg: 'bg-primary/10', border: 'border-primary/30', text: 'text-primary-glow' };
  }
};

const getEventImpactStyle = (impact: string) => {
  switch (impact) {
    case 'positive': return 'text-accent-emerald';
    case 'negative': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
};

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    risk: 'bg-destructive/20 text-destructive',
    revenue: 'bg-accent-emerald/20 text-accent-emerald',
    operations: 'bg-primary/20 text-primary-glow',
    security: 'bg-accent-amber/20 text-accent-amber',
    compliance: 'bg-accent-pink/20 text-accent-pink'
  };
  return colors[type] || 'bg-muted/20 text-muted-foreground';
};

const AICEODashboardMain = () => {
  const {
    suggestions,
    ecosystemMetrics,
    metricSources,
    observations,
    activityEvents,
    degraded,
    isLoading,
    lastRefresh,
    isRefreshing,
    refresh,
    sendToBoss,
    getObservationsByCategory,
    getEventsByType
  } = useCEOSuggestions();

  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  const handleSendToBoss = async (suggestion: CEOSuggestion) => {
    setSendingIds(prev => new Set(prev).add(suggestion.id));
    await sendToBoss(suggestion.id);
    setSendingIds(prev => {
      const next = new Set(prev);
      next.delete(suggestion.id);
      return next;
    });
  };

  const filteredEvents = activityFilter === 'all' 
    ? activityEvents 
    : getEventsByType(activityFilter as ActivityEvent['type']);

  return (
    <PageShell>
      <PageBanner
        icon={Brain}
        title="AI CEO Dashboard"
        subtitle="Executive observer over the Software Vala platform. Every figure below is counted from the platform's own tables."
        status={
          lastRefresh
            ? `Observer · measured ${lastRefresh.toLocaleTimeString()}`
            : "Observer · measuring"
        }
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={refresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {isRefreshing ? "Recounting…" : "Recount now"}
          </Button>
        }
      />

      <DegradedNotice sources={degraded} />

      {/* Ecosystem Monitor - Live Metrics */}
      {isLoading && !ecosystemMetrics && <LoadingState label="Syncing ecosystem metrics…" rows={2} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">

        {ecosystemMetrics && ([
          { key: "systemActivityRate" as const, label: "System Activity", unit: "/24h", icon: Activity, color: "text-primary-glow", bg: "bg-primary/10" },
          { key: "deploymentFrequency" as const, label: "Deployments", unit: "/week", icon: Server, color: "text-accent-pink", bg: "bg-accent-pink/10" },
          { key: "errorVelocity" as const, label: "Upstream Errors", unit: "/hr", icon: AlertTriangle, color: "text-accent-amber", bg: "bg-accent-amber/10" },
          { key: "activeUsers" as const, label: "Accounts", unit: "", icon: Users, color: "text-accent-emerald", bg: "bg-accent-emerald/10" },
          { key: "transactionsToday" as const, label: "Orders Today", unit: "", icon: DollarSign, color: "text-primary-glow", bg: "bg-primary/10" },
          { key: "apiLatency" as const, label: "API Latency", unit: "ms", icon: Zap, color: "text-accent-amber", bg: "bg-accent-amber/10" },
        ].map((tile) => {
          const raw = ecosystemMetrics[tile.key];
          return {
            ...tile,
            value: formatMetric(raw),
            unit: raw === null ? "" : tile.unit,
            source: metricSources?.[tile.key] ?? "",
            tracked: raw !== null,
          };
        })).map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
              className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl"
              title={metric.source}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg ${metric.bg} flex items-center justify-center`}>
                    <metric.icon className={`w-4 h-4 ${metric.color}`} />
                  </div>
                  {metric.tracked && (
                    <Radio className="w-2 h-2 text-accent-emerald animate-pulse" aria-hidden="true" />
                  )}
                </div>
                <p className={`text-xl font-bold ${metric.tracked ? metric.color : "text-muted-foreground"}`}>
                  {metric.value}{metric.unit}
                </p>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                {!metric.tracked && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground/70">not tracked yet</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Grid: Observations + Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* AI Observation Panel */}
        <Card className="lg:col-span-2 card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary-glow" />
              AI Observation Panel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="change" className="w-full">
              <TabsList className="mb-4 flex w-full max-w-full justify-start overflow-x-auto bg-surface border border-border">
                <TabsTrigger value="change" className="text-xs">What Changed Today</TabsTrigger>
                <TabsTrigger value="attention" className="text-xs">Needs Attention</TabsTrigger>
                <TabsTrigger value="revenue" className="text-xs">Revenue Impact</TabsTrigger>
              </TabsList>
              
              {(['change', 'attention', 'revenue'] as const).map(category => (
                <TabsContent key={category} value={category}>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      {getObservationsByCategory(category).map((obs, i) => {
                        const style = getSeverityStyle(obs.severity);
                        return (
                          <motion.div
                            key={obs.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`p-3 rounded-lg ${style.bg} border ${style.border}`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-foreground">{obs.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{obs.detail}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`${style.bg} ${style.text} text-xs`}>
                                  {obs.severity}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{obs.timestamp}</span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* CEO Suggestion Engine */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-accent-amber" />
              CEO Suggestions
              <Badge className="ml-auto bg-accent-amber/20 text-accent-amber">
                {suggestions.filter(s => s.status === 'pending').length} Pending
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              <div className="space-y-3">
                {suggestions.slice(0, 4).map((suggestion, i) => (
                  <motion.div
                    key={suggestion.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-3 rounded-lg bg-surface border border-border hover:border-accent-amber/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{suggestion.title}</p>
                      <Badge className={getImpactStyle(suggestion.impact)}>
                        {suggestion.impact}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{suggestion.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Progress value={suggestion.confidence} className="h-1 w-16" />
                        <span className="text-xs text-primary-glow">{suggestion.confidence}%</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-primary-glow hover:text-primary-glow hover:bg-primary/10"
                        onClick={() => handleSendToBoss(suggestion)}
                        disabled={sendingIds.has(suggestion.id) || suggestion.status !== 'pending'}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        {suggestion.status === 'reviewed' ? 'Sent' : 'Send to Boss'}
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed with Filters */}
      <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
        <CardHeader className="pb-3">
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <CardTitle className="text-foreground flex min-w-0 items-center gap-2">
              <Activity className="w-5 h-5 shrink-0 text-accent-emerald" />
              <span className="truncate">Live Activity Feed</span>
            </CardTitle>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 lg:justify-end">
              {['all', 'risk', 'revenue', 'operations', 'security', 'compliance'].map(filter => (
                <Button
                  key={filter}
                  size="sm"
                  variant="ghost"
                  className={`h-7 px-3 text-xs ${
                    activityFilter === filter 
                      ? 'bg-primary/20 text-primary-glow' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActivityFilter(filter)}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {filteredEvents.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface/60 border border-border/20 hover:border-secondary/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={getTypeColor(event.type)}>
                      {event.type}
                    </Badge>
                    <div>
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{event.actor}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span>{event.action}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span className="text-foreground">{event.target}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${getEventImpactStyle(event.impact)}`}>
                      {event.impact === 'positive' ? '↑' : event.impact === 'negative' ? '↓' : '—'}
                    </span>
                    <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* AI Observer Notice */}
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-primary-glow" />
          <p className="text-sm text-primary-glow/80">
            <strong>AI CEO Notice:</strong> Observations, metrics and the activity feed are
            measured from the platform's own tables and are read-only. Suggestions are advisory:
            nothing is executed until the Boss approves it, and "Send to Boss" records the
            suggestion in the approval queue.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEODashboardMain;
