import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, Clock, Users, MessageSquare, TrendingUp, TrendingDown,
  ArrowUpRight, Download, Calendar, Filter, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useTeamMembers, useTickets } from '@/hooks/useSalesSupportData';
import { downloadCsv, stampedName } from '@/lib/export/download';
import { useTranslation } from '@/lib/i18n/use-translation';

const DAY = 86_400_000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
/** Percentage change, or 0 where the earlier period has nothing to compare with. */
const changeOf = (now: number | null, before: number | null) =>
  now == null || before == null || before === 0 ? null : Math.round(((now - before) / before) * 1000) / 10;
const trendOf = (now: number | null, before: number | null, lowerIsBetter = false) => {
  if (now == null || before == null || before === 0) return null;
  return (lowerIsBetter ? now <= before : now >= before) ? 'up' : 'down';
};
const minutes = (m: number | null) => (m == null ? '—' : m >= 90 ? `${(m / 60).toFixed(1)} hrs` : `${Math.round(m)} min`);

interface MetricCard {
  id: string;
  label: string;
  value: string;
  change: number | null;
  trend: 'up' | 'down' | null;
  icon: React.ElementType;
  color: string;
}

interface ChannelStat {
  channel: string;
  tickets: number;
  avgResponse: string;
  satisfaction: number | null;
}

/**
 * Support analytics, counted from the support tickets over the last seven days
 * and compared with the seven before.
 */
const SupportAnalytics = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    data: ticketRows,
    error: ticketsError,
    isLoading: ticketsLoading,
  } = useTickets();
  const {
    data: members,
    error: membersError,
    isLoading: membersLoading,
  } = useTeamMembers('support');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = (ticketRows ?? []) as any[];
  const now = Date.now();
  const inWindow = (t: { created_at: string }, from: number, to: number) => {
    const at = new Date(t.created_at).getTime();
    return at >= from && at < to;
  };
  const week = all.filter((t) => inWindow(t, now - 7 * DAY, now + 1));
  const prior = all.filter((t) => inWindow(t, now - 14 * DAY, now - 7 * DAY));
  const resolution = (list: typeof all) => mean(list.filter((t) => t.resolved_at).map((t) => (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 60_000));
  const response = (list: typeof all) => mean(list.filter((t) => t.first_response_at).map((t) => (new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / 60_000));
  const csat = (list: typeof all) => mean(list.filter((t) => t.csat != null).map((t) => Number(t.csat)));
  const open = all.filter((t) => t.status !== 'resolved' && t.status !== 'closed');
  const agents = (members ?? []).length;

  const metrics: MetricCard[] = [
    { id: '1', label: 'Avg Resolution Time', value: minutes(resolution(week)), change: changeOf(resolution(week), resolution(prior)), trend: trendOf(resolution(week), resolution(prior), true), icon: Clock, color: 'text-emerald-400' },
    { id: '2', label: 'Open Tickets per Agent', value: agents ? (open.length / agents).toFixed(1) : '—', change: null, trend: null, icon: Users, color: 'text-orange-400' },
    { id: '3', label: 'CSAT Score', value: csat(week) == null ? '—' : `${csat(week)!.toFixed(1)}/5`, change: changeOf(csat(week), csat(prior)), trend: trendOf(csat(week), csat(prior)), icon: TrendingUp, color: 'text-teal-400' },
    { id: '4', label: 'First Response Time', value: minutes(response(week)), change: changeOf(response(week), response(prior)), trend: trendOf(response(week), response(prior), true), icon: MessageSquare, color: 'text-purple-400' },
  ];

  const channels = [...new Set(week.map((t) => String(t.channel ?? 'other')))];
  const channelStats: ChannelStat[] = channels.map((channel) => {
    const list = week.filter((t) => String(t.channel ?? 'other') === channel);
    const c = csat(list);
    return {
      channel: channel.charAt(0).toUpperCase() + channel.slice(1),
      tickets: list.length,
      avgResponse: minutes(response(list)),
      satisfaction: c == null ? null : Math.round((c / 5) * 100),
    };
  });

  // Tickets opened in each two-hour slot of the day, over the week.
  const hourlyData = Array.from({ length: 12 }, (_, i) => ({
    hour: String(i * 2).padStart(2, '0'),
    tickets: week.filter((t) => Math.floor(new Date(t.created_at).getHours() / 2) === i).length,
  }));

  const handleExport = useCallback((_format: string) => {
    const rows = [
      ...metrics.map((m) => ({ section: 'metric', name: m.label, value: m.value, change_percent: m.change })),
      ...channelStats.map((c) => ({ section: 'channel', name: c.channel, value: c.tickets, change_percent: '' , avg_response: c.avgResponse, satisfaction_percent: c.satisfaction })),
    ];
    const n = downloadCsv(stampedName('support-analytics', 'csv'), rows);
    toast.success(`Exported ${n} rows as CSV`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketRows, members]);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['support_tickets'] });
    toast.success('Figures counted again');
  }, [queryClient]);

  if (ticketsLoading || membersLoading) {
    return <div className="p-6 text-sm text-muted-foreground">{t("manager.support_analytics.loading")}</div>;
  }
  if (ticketsError || membersError) {
    return (
      <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <span>{t("manager.support_analytics.load_failed")}</span>
        <Button variant="outline" onClick={handleRefresh}>{t("manager.console.retry")}</Button>
      </div>
    );
  }

  const maxTickets = Math.max(1, ...hourlyData.map(d => d.tickets));
  const countStatus = (...statuses: string[]) =>
    all.filter((ticket) => statuses.includes(String(ticket.status ?? "").toLowerCase())).length;
  const funnel = [
    { stage: 'New Tickets', count: countStatus('new', 'open'), color: 'from-red-500 to-orange-500' },
    { stage: 'In Progress', count: countStatus('in_progress', 'in progress'), color: 'from-orange-500 to-yellow-500' },
    { stage: 'Pending Response', count: countStatus('pending', 'pending_response', 'waiting'), color: 'from-yellow-500 to-teal-500' },
    { stage: 'Resolved', count: countStatus('resolved', 'closed'), color: 'from-teal-500 to-emerald-500' },
  ];

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
          {/* The period these figures cover; not a picker. */}
          <span className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 mr-2" />
            Last 7 Days
          </span>
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
              {metric.change != null && metric.trend ? (
                <div className={`flex items-center gap-1 text-xs ${metric.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {metric.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(metric.change)}%
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
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
                  <Badge className={channel.satisfaction == null ? 'bg-muted text-muted-foreground' : channel.satisfaction >= 95 ? 'bg-emerald-500/20 text-emerald-400' : channel.satisfaction >= 90 ? 'bg-teal-500/20 text-teal-400' : 'bg-yellow-500/20 text-yellow-400'}>
                    {channel.satisfaction == null ? '—' : `${channel.satisfaction}%`}
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
          {funnel.map((stage, idx) => (
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
