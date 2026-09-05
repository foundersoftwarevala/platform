import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, Clock, Users, MessageSquare, TrendingUp, TrendingDown,
  ArrowUpRight, Download, Calendar, Filter, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useGlobalActions } from '@/hooks/useGlobalActions';

interface MetricCard {
  id: string;
  label: string;
  value: string;
  change: number;
  trend: 'up' | 'down';
  icon: React.ElementType;
  color: string;
}

interface ChannelStat {
  channel: string;
  tickets: number;
  avgResponse: string;
  satisfaction: number;
}

const SupportAnalytics = () => {
  const { executeAction } = useGlobalActions();

  const [metrics] = useState<MetricCard[]>([
    { id: '1', label: 'Avg Resolution Time', value: '2.4 hrs', change: -12, trend: 'down', icon: Clock, color: 'text-emerald-400' },
    { id: '2', label: 'Agent Load', value: '68%', change: 5, trend: 'up', icon: Users, color: 'text-orange-400' },
    { id: '3', label: 'CSAT Score', value: '94.2%', change: 2.3, trend: 'up', icon: TrendingUp, color: 'text-teal-400' },
    { id: '4', label: 'First Response Time', value: '4.2 min', change: -18, trend: 'down', icon: MessageSquare, color: 'text-purple-400' },
  ]);

  const [channelStats] = useState<ChannelStat[]>([
    { channel: 'Email', tickets: 456, avgResponse: '15 min', satisfaction: 92 },
    { channel: 'Live Chat', tickets: 324, avgResponse: '2 min', satisfaction: 96 },
    { channel: 'WhatsApp', tickets: 189, avgResponse: '5 min', satisfaction: 94 },
    { channel: 'Phone', tickets: 87, avgResponse: '1 min', satisfaction: 89 },
    { channel: 'In-App', tickets: 234, avgResponse: '8 min', satisfaction: 91 },
  ]);

  const [hourlyData] = useState([
    { hour: '00', tickets: 12 }, { hour: '02', tickets: 8 }, { hour: '04', tickets: 5 },
    { hour: '06', tickets: 15 }, { hour: '08', tickets: 45 }, { hour: '10', tickets: 78 },
    { hour: '12', tickets: 65 }, { hour: '14', tickets: 82 }, { hour: '16', tickets: 90 },
    { hour: '18', tickets: 55 }, { hour: '20', tickets: 35 }, { hour: '22', tickets: 20 },
  ]);

  const handleExport = useCallback(async (format: string) => {
    await executeAction({
      actionId: `export_analytics_${format}`,
      actionType: 'export',
      entityType: 'report',
      metadata: { format, type: 'support_analytics' },
      successMessage: `Analytics exported as ${format.toUpperCase()}`,
    });
  }, [executeAction]);

  const handleRefresh = useCallback(async () => {
    await executeAction({
      actionId: 'refresh_analytics',
      actionType: 'refresh',
      entityType: 'report',
      successMessage: 'Analytics data refreshed',
    });
    toast.success('Data refreshed');
  }, [executeAction]);

  const maxTickets = Math.max(...hourlyData.map(d => d.tickets));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-teal-400" />
            Support Analytics
          </h2>
          <p className="text-muted-foreground text-sm">Real-time performance metrics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-border text-muted-foreground">
            <Calendar className="w-4 h-4 mr-2" />
            Last 7 Days
          </Button>
          <Button variant="outline" onClick={handleRefresh} className="border-border text-muted-foreground">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => handleExport('pdf')} className="bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-4 gap-4"
      >
        {metrics.map((metric) => (
          <motion.div
            key={metric.id}
            whileHover={{ scale: 1.02 }}
            className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <metric.icon className={`w-5 h-5 ${metric.color}`} />
              <div className={`flex items-center gap-1 text-xs ${metric.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                {metric.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(metric.change)}%
              </div>
            </div>
            <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
            <p className="text-xs text-muted-foreground">{metric.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Hourly Ticket Volume */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Ticket Volume (24h)</h3>
          <Badge className="bg-teal-500/20 text-teal-400">Live</Badge>
        </div>
        
        <div className="flex items-end justify-between h-40 gap-2">
          {hourlyData.map((data, idx) => (
            <motion.div
              key={idx}
              className="flex-1 flex flex-col items-center"
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              transition={{ delay: idx * 0.05 }}
            >
              <motion.div
                className="w-full bg-gradient-to-t from-teal-500 to-sky-500 rounded-t-sm"
                initial={{ height: 0 }}
                animate={{ height: `${(data.tickets / maxTickets) * 100}%` }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                style={{ minHeight: 4 }}
              />
              <span className="text-xs text-muted-foreground mt-2">{data.hour}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Channel Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">Channel Performance</h3>
        
        <div className="space-y-4">
          {channelStats.map((channel, idx) => {
            const totalTickets = channelStats.reduce((sum, c) => sum + c.tickets, 0);
            const percentage = (channel.tickets / totalTickets) * 100;
            
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="w-24 text-sm text-foreground font-medium">{channel.channel}</div>
                <div className="flex-1">
                  <div className="h-3 bg-card/60 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-teal-500 to-sky-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.1 }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground w-16">{channel.tickets} tickets</span>
                  <span className="text-teal-400 w-16">{channel.avgResponse}</span>
                  <Badge className={channel.satisfaction >= 95 ? 'bg-emerald-500/20 text-emerald-400' : channel.satisfaction >= 90 ? 'bg-teal-500/20 text-teal-400' : 'bg-yellow-500/20 text-yellow-400'}>
                    {channel.satisfaction}%
                  </Badge>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Funnel View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">Resolution Funnel</h3>
        
        <div className="flex items-center justify-between">
          {[
            { stage: 'New Tickets', count: 1234, color: 'from-red-500 to-orange-500' },
            { stage: 'In Progress', count: 856, color: 'from-orange-500 to-yellow-500' },
            { stage: 'Pending Response', count: 423, color: 'from-yellow-500 to-teal-500' },
            { stage: 'Resolved', count: 1089, color: 'from-teal-500 to-emerald-500' },
          ].map((stage, idx) => (
            <motion.div
              key={idx}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="flex flex-col items-center"
            >
              <div 
                className={`w-24 h-24 rounded-xl bg-gradient-to-br ${stage.color} flex items-center justify-center mb-2`}
                style={{ transform: `scale(${1 - idx * 0.1})` }}
              >
                <span className="text-2xl font-bold text-foreground">{stage.count}</span>
              </div>
              <span className="text-xs text-muted-foreground text-center">{stage.stage}</span>
              {idx < 3 && (
                <ArrowUpRight className="w-4 h-4 text-muted-foreground absolute right-0 top-1/2 -translate-y-1/2" />
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default SupportAnalytics;
