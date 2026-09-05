import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Inbox, CheckCircle2, Clock, Smile, ArrowUpRight, Hash,
  TrendingUp, Users, AlertTriangle, Zap, Brain, Activity, Target
} from 'lucide-react';
import { useEnterpriseAudit } from '@/hooks/useEnterpriseAudit';

interface Metric {
  id: string;
  label: string;
  value: string;
  icon: React.ElementType;
  subtext: string;
  color: string;
  trend: 'up' | 'down' | null;
  filterKey: string;
}

const metrics: Metric[] = [
  { id: 'open', label: 'Open Tickets', value: '12', icon: Inbox, subtext: '3 high priority', color: 'teal', trend: null, filterKey: 'status=open' },
  { id: 'tokens', label: 'Tokens Waiting', value: '8', icon: Hash, subtext: 'In queue', color: 'purple', trend: null, filterKey: 'queue=pending' },
  { id: 'sla_breach', label: 'SLA Breaches', value: '2', icon: AlertTriangle, subtext: 'Today', color: 'rose', trend: 'down', filterKey: 'sla=breached' },
  { id: 'avg_response', label: 'Avg Response', value: '4.2m', icon: Clock, subtext: 'Under 5min target', color: 'sky', trend: 'up', filterKey: 'metric=response_time' },
  { id: 'avg_resolution', label: 'Avg Resolution', value: '2.4h', icon: Target, subtext: 'Improved 12%', color: 'emerald', trend: 'up', filterKey: 'metric=resolution_time' },
  { id: 'csat', label: 'CSAT %', value: '96%', icon: Smile, subtext: 'Excellent rating', color: 'amber', trend: 'up', filterKey: 'metric=csat' },
  { id: 'active_agents', label: 'Active Agents', value: '7', icon: Users, subtext: '2 on break', color: 'blue', trend: null, filterKey: 'agents=active' },
  { id: 'escalations', label: 'Escalations Today', value: '3', icon: ArrowUpRight, subtext: 'To dev team', color: 'orange', trend: null, filterKey: 'type=escalated' },
  { id: 'ai_resolved', label: 'AI Auto-Resolved', value: '34%', icon: Brain, subtext: '12 tickets today', color: 'violet', trend: 'up', filterKey: 'resolved_by=ai' },
  { id: 'backlog', label: 'Backlog Risk', value: 'Low', icon: Activity, subtext: 'Healthy queue', color: 'emerald', trend: null, filterKey: 'risk=backlog' },
];

const recentActivity = [
  { action: 'Ticket #1247 resolved', time: '2 min ago', type: 'resolved' },
  { action: 'New ticket from Raj Enterprises', time: '5 min ago', type: 'new' },
  { action: 'Escalated to dev team', time: '12 min ago', type: 'escalated' },
  { action: 'AI auto-resolved #1243', time: '15 min ago', type: 'ai' },
  { action: 'Client satisfaction received: 5★', time: '18 min ago', type: 'feedback' },
  { action: 'Ticket #1245 resolved', time: '25 min ago', type: 'resolved' },
];

interface EnhancedSupportMetricsProps {
  onMetricClick?: (filterKey: string) => void;
}

const EnhancedSupportMetrics = ({ onMetricClick }: EnhancedSupportMetricsProps) => {
  const { logAction } = useEnterpriseAudit();

  const handleMetricClick = useCallback(async (metric: Metric) => {
    await logAction({ action: 'metric_click', module: 'lead_manager', severity: 'low', target_id: metric.id, metadata: { filter: metric.filterKey } });
    onMetricClick?.(metric.filterKey);
  }, [logAction, onMetricClick]);

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
      emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
      sky: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
      amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
      rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
      purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
      blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
      orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
      violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
    };
    return colors[color] || colors.teal;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Support Dashboard</h2>
        <p className="text-muted-foreground mt-1">Real-time overview • Click any metric to filter</p>
      </div>

      {/* Metrics Grid - 5 columns, 2 rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map((metric, index) => {
          const colorClasses = getColorClasses(metric.color);
          return (
            <motion.div
              key={metric.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleMetricClick(metric)}
              className={`p-5 rounded-2xl bg-card/60 backdrop-blur-xl border ${colorClasses.border} transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-${metric.color}-500/10`}
            >
              <div className={`w-10 h-10 rounded-xl ${colorClasses.bg} flex items-center justify-center mb-4`}>
                <metric.icon className={`w-5 h-5 ${colorClasses.text}`} />
              </div>
              <p className="text-sm text-muted-foreground mb-1">{metric.label}</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-foreground">{metric.value}</span>
                {metric.trend === 'up' && (
                  <TrendingUp className="w-4 h-4 text-emerald-400 mb-1" />
                )}
                {metric.trend === 'down' && (
                  <TrendingUp className="w-4 h-4 text-rose-400 mb-1 transform rotate-180" />
                )}
              </div>
              <p className={`text-xs ${colorClasses.text} mt-2`}>{metric.subtext}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 rounded-2xl bg-card/60 backdrop-blur-xl border border-border"
        >
          <h3 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-400" />
            Recent Activity
          </h3>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.05 }}
                className="flex items-center gap-4 p-3 rounded-xl bg-card/60 hover:bg-card/60 transition-colors cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'resolved' ? 'bg-emerald-400' :
                  activity.type === 'new' ? 'bg-teal-400' :
                  activity.type === 'escalated' ? 'bg-amber-400' :
                  activity.type === 'ai' ? 'bg-purple-400' : 'bg-sky-400'
                }`} />
                <span className="text-sm text-muted-foreground flex-1">{activity.action}</span>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Team Status & Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-6 rounded-2xl bg-card/60 backdrop-blur-xl border border-border"
        >
          <h3 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" />
            Team Status
          </h3>
          <div className="space-y-4">
            {[
              { name: 'Active Agents', count: 5, status: 'online' },
              { name: 'In Call', count: 2, status: 'busy' },
              { name: 'On Break', count: 1, status: 'away' },
              { name: 'Handling High Priority', count: 3, status: 'critical' },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-card/60 hover:bg-card/60 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    item.status === 'online' ? 'bg-emerald-400' :
                    item.status === 'busy' ? 'bg-amber-400' :
                    item.status === 'critical' ? 'bg-rose-400' : 'bg-muted/40'
                  }`} />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                </div>
                <span className="text-lg font-semibold text-foreground">{item.count}</span>
              </div>
            ))}
          </div>

          {/* Response Time Chart */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">Hourly Ticket Volume</p>
            <div className="flex items-end gap-1 h-16">
              {[35, 45, 30, 60, 40, 55, 25, 50, 35, 45, 30, 40].map((height, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: 0.8 + i * 0.05, duration: 0.4 }}
                  className="flex-1 rounded-t bg-gradient-to-t from-teal-500/30 to-teal-500/60 hover:from-teal-500/50 hover:to-teal-500/80 transition-colors cursor-pointer"
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>8 AM</span>
              <span>Now</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* AI Insights Quick Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-teal-500/10 backdrop-blur-xl border border-purple-500/20"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">AI Insights</h3>
              <p className="text-sm text-muted-foreground">3 actionable suggestions available</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-purple-400">12</div>
              <div className="text-xs text-muted-foreground">Auto-resolved</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-teal-400">94%</div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-amber-400">2.1h</div>
              <div className="text-xs text-muted-foreground">Time saved</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EnhancedSupportMetrics;
