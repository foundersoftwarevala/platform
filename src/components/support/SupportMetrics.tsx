import { motion } from 'framer-motion';
import { relativeTime, useEscalations, useTeamMembers, useTickets } from '@/hooks/useSalesSupportData';
import { 
  Inbox, CheckCircle2, Clock, Smile, ArrowUpRight, 
  TrendingUp, Users, MessageCircle
} from 'lucide-react';

/**
 * The support desk's overview. Every figure here was typed in - "12 open",
 * "24 resolved today", "96% satisfaction", "5 active agents", a response-time
 * chart drawn from a fixed list of heights. They are now counted from the
 * support tickets and the support team, through the same hooks the rest of
 * Sales & Support reads.
 */
const SupportMetrics = () => {
  const ticketQuery = useTickets();
  const escalations = useEscalations().data ?? [];
  const agents = useTeamMembers("support").data ?? [];
  const desk = { loading: ticketQuery.isLoading, error: ticketQuery.error ? (ticketQuery.error as Error).message : null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tickets = (ticketQuery.data ?? []) as any[];
  const isOpen = (t: { status: string | null }) => t.status !== "resolved" && t.status !== "closed";
  const firstResponseMinutes = (t: { first_response_at?: string | null; created_at: string }) =>
    t.first_response_at ? Math.max(0, (new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / 60_000) : null;
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const since = (iso: string | null) => !!iso && new Date(iso) >= dayStart;
  const open = tickets.filter(isOpen);
  const responses = tickets.map(firstResponseMinutes).filter((m): m is number => m != null);
  const rated = tickets.filter((t) => t.csat != null);
  const avgCsat = rated.length ? rated.reduce((sum, t) => sum + Number(t.csat), 0) / rated.length : null;
  const figure = (v: string) => (desk.loading ? "…" : v);
  const metrics = [
    {
      label: 'Open Tickets', value: figure(String(open.length)), icon: Inbox,
      subtext: `${open.filter((t) => t.priority === "high" || t.priority === "urgent" || t.priority === "critical").length} high priority`,
      color: 'teal', trend: null,
    },
    {
      label: 'Resolved Today', value: figure(String(tickets.filter((t) => since(t.resolved_at)).length)), icon: CheckCircle2,
      subtext: `${tickets.filter((t) => since(t.created_at)).length} opened today`, color: 'emerald', trend: null,
    },
    {
      label: 'Avg First Response', value: figure(responses.length ? `${Math.round(responses.reduce((a, m) => a + m, 0) / responses.length)}m` : "—"),
      icon: Clock, subtext: `${responses.length} tickets answered`, color: 'sky', trend: null,
    },
    {
      label: 'Satisfaction', value: figure(avgCsat == null ? "—" : `${avgCsat.toFixed(1)}/5`), icon: Smile,
      subtext: rated.length ? `${rated.length} ratings` : 'No ratings yet', color: 'amber', trend: null,
    },
    {
      label: 'Escalations', value: figure(String(escalations.length)), icon: ArrowUpRight,
      subtext: `${tickets.filter((t) => t.sla_breached).length} past SLA`, color: 'rose', trend: null,
    },
  ];
  const recentActivity = [...tickets]
    .sort((x, y) => String(y.updated_at).localeCompare(String(x.updated_at)))
    .slice(0, 5)
    .map((t) => ({
      action: `${t.reference ?? "Ticket"} ${t.status === "resolved" || t.status === "closed" ? "resolved" : t.status.replace(/_/g, " ")} — ${t.subject}`,
      time: relativeTime(t.updated_at),
      type: t.status === "resolved" || t.status === "closed" ? 'resolved' : t.status === "new" ? 'new' : t.sla_breached ? 'escalated' : 'feedback',
    }));
  // The support team as recorded in the team directory.
  const team = [
    { name: 'Online', count: agents.filter((a) => a.status === "online" || a.status === "active").length, status: 'online' },
    { name: 'Away', count: agents.filter((a) => a.status === "away").length, status: 'busy' },
    { name: 'Offline', count: agents.filter((a) => a.status === "offline").length, status: 'away' },
  ];
  // Tickets opened in each of the last 12 hours - the desk's real load.
  const hours = Array.from({ length: 12 }, (_, i) => {
    const end = Date.now() - (11 - i) * 3_600_000;
    return tickets.filter((t) => { const at = new Date(t.created_at).getTime(); return at > end - 3_600_000 && at <= end; }).length;
  });
  const peak = Math.max(1, ...hours);

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
        <h2 className="text-2xl font-semibold text-foreground">Support overview</h2>
        <p className="text-muted-foreground mt-1">
          {desk.error ? `The desk could not be read: ${desk.error}` : "Counted from the support tickets, now"}
        </p>
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
            {recentActivity.length === 0 && (
              <p className="text-sm text-muted-foreground">{desk.loading ? "Loading…" : "No ticket activity yet."}</p>
            )}
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
            {team.map((item, index) => (
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
            <p className="text-sm text-muted-foreground mb-3">Tickets opened, last 12 hours</p>
            <div className="flex items-end gap-1 h-16">
              {hours.map((n, i) => (
                <motion.div
                  key={i}
                  title={`${n} ticket${n === 1 ? "" : "s"}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, (n / peak) * 100)}%` }}
                  transition={{ delay: 0.8 + i * 0.05, duration: 0.4 }}
                  className="flex-1 rounded-t bg-gradient-to-t from-teal-500/30 to-teal-500/60"
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>12h ago</span>
              <span>Now</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SupportMetrics;
