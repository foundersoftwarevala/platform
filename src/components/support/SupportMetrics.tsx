import { motion } from 'framer-motion';
import { 
  Inbox, CheckCircle2, Clock, Smile, ArrowUpRight, 
  TrendingUp, Users, MessageCircle
} from 'lucide-react';

const metrics = [
  { 
    label: 'Open Tickets', 
    value: '12', 
    icon: Inbox, 
    subtext: '3 high priority',
    color: 'teal',
    trend: null
  },
  { 
    label: 'Resolved Today', 
    value: '24', 
    icon: CheckCircle2, 
    subtext: '+8 from yesterday',
    color: 'emerald',
    trend: 'up'
  },
  { 
    label: 'Avg Response', 
    value: '4.2m', 
    icon: Clock, 
    subtext: 'Under 5min target',
    color: 'sky',
    trend: 'up'
  },
  { 
    label: 'Satisfaction', 
    value: '96%', 
    icon: Smile, 
    subtext: 'Excellent rating',
    color: 'amber',
    trend: 'up'
  },
  { 
    label: 'Escalations', 
    value: '2', 
    icon: ArrowUpRight, 
    subtext: 'To developer team',
    color: 'rose',
    trend: null
  },
];

const recentActivity = [
  { action: 'Ticket #1247 resolved', time: '2 min ago', type: 'resolved' },
  { action: 'New ticket from Raj Enterprises', time: '5 min ago', type: 'new' },
  { action: 'Escalated to dev team', time: '12 min ago', type: 'escalated' },
  { action: 'Client satisfaction received: 5★', time: '18 min ago', type: 'feedback' },
  { action: 'Ticket #1245 resolved', time: '25 min ago', type: 'resolved' },
];

const SupportMetrics = () => {
  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
      emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
      sky: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
      amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
      rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
    };
    return colors[color] || colors.teal;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Good afternoon, Support Team</h2>
        <p className="text-muted-foreground mt-1">Here's your overview for today</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map((metric, index) => {
          const colorClasses = getColorClasses(metric.color);
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              whileHover={{ y: -2 }}
              className={`p-5 rounded-2xl bg-card/60 backdrop-blur-xl border ${colorClasses.border} transition-all duration-300`}
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
                transition={{ delay: 0.5 + index * 0.08 }}
                className="flex items-center gap-4 p-3 rounded-xl bg-card/60 hover:bg-card/60 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'resolved' ? 'bg-emerald-400' :
                  activity.type === 'new' ? 'bg-teal-400' :
                  activity.type === 'escalated' ? 'bg-amber-400' : 'bg-sky-400'
                }`} />
                <span className="text-sm text-muted-foreground flex-1">{activity.action}</span>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Quick Stats */}
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
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-card/60">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    item.status === 'online' ? 'bg-emerald-400' :
                    item.status === 'busy' ? 'bg-amber-400' : 'bg-muted/40'
                  }`} />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                </div>
                <span className="text-lg font-semibold text-foreground">{item.count}</span>
              </div>
            ))}
          </div>

          {/* Response Time Chart */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">Response Time Today</p>
            <div className="flex items-end gap-1 h-16">
              {[35, 45, 30, 60, 40, 55, 25, 50, 35, 45, 30, 40].map((height, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: 0.8 + i * 0.05, duration: 0.4 }}
                  className="flex-1 rounded-t bg-gradient-to-t from-teal-500/30 to-teal-500/60"
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
    </div>
  );
};

export default SupportMetrics;
