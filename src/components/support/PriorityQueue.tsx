import { motion } from 'framer-motion';
import {
  AlertTriangle, Clock, User, ArrowUpRight,
  Zap, MessageCircle, Timer
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useTickets, useTeamMembers, useUpdateRow, relativeTime,
} from '@/hooks/useSalesSupportData';

const PriorityQueue = () => {
  const { data: tickets, isLoading } = useTickets();
  const { data: members } = useTeamMembers('support');
  const updateTicket = useUpdateRow('support_tickets');

  const priorityTickets = (tickets ?? [])
    .filter((t) => (t.priority === 'critical' || t.priority === 'high') && t.status !== 'resolved' && t.status !== 'closed')
    .sort((a, b) => a.sla_minutes_remaining - b.sla_minutes_remaining);

  const getUrgencyStyles = (level: string) => {
    if (level === 'critical') {
      return {
        border: 'border-rose-500/30',
        bg: 'bg-rose-500/5',
        badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        pulse: true
      };
    }
    return {
      border: 'border-amber-500/20',
      bg: 'bg-amber-500/5',
      badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      pulse: false
    };
  };

  const handleTakeTicket = async (ticketId: string) => {
    const available = (members ?? []).find((m) => m.status === 'available');
    try {
      await updateTicket.mutateAsync({
        id: ticketId,
        values: { status: 'in_progress', assigned_to: available?.id ?? null },
      });
      toast.success(available ? `Assigned to ${available.full_name}` : 'Ticket marked in progress');
    } catch {
      toast.error('Failed to take ticket');
    }
  };

  const handleEscalate = async (ticketId: string) => {
    try {
      await updateTicket.mutateAsync({ id: ticketId, values: { priority: 'critical' } });
      toast.success('Ticket escalated to critical');
    } catch {
      toast.error('Failed to escalate ticket');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            Priority Queue
          </h2>
          <p className="text-muted-foreground mt-1">Tickets requiring immediate attention</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="w-2 h-2 bg-rose-400 rounded-full"
          />
          <span className="text-sm text-rose-400">{priorityTickets.length} tickets need action</span>
        </div>
      </div>

      {/* SLA Warning */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-4"
      >
        <Timer className="w-5 h-5 text-amber-400" />
        <div className="flex-1">
          <p className="text-sm text-amber-400 font-medium">SLA Reminder</p>
          <p className="text-xs text-muted-foreground mt-0.5">High priority tickets should be acknowledged within 15 minutes and resolved within 1 hour.</p>
        </div>
      </motion.div>

      {/* Priority Tickets */}
      <div className="space-y-4">
        {!isLoading && priorityTickets.length === 0 && (
          <div className="p-8 text-center text-muted-foreground rounded-2xl border border-border bg-card/60">
            No high-priority tickets waiting. 🎉
          </div>
        )}
        {priorityTickets.map((ticket, index) => {
          const styles = getUrgencyStyles(ticket.priority);

          return (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-5 rounded-2xl ${styles.bg} border ${styles.border} backdrop-blur-xl relative overflow-hidden`}
            >
              {/* Urgency Indicator */}
              {styles.pulse && (
                <motion.div
                  className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono text-muted-foreground">{ticket.reference}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${styles.badge}`}>
                      {ticket.priority === 'critical' ? 'CRITICAL' : 'HIGH PRIORITY'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs bg-muted/40 text-muted-foreground">
                      {ticket.category}
                    </span>
                  </div>
                  <p className="text-foreground font-medium text-lg mb-3">{ticket.subject}</p>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="w-4 h-4" />
                      {ticket.customer_name}
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <Clock className="w-4 h-4" />
                      Opened: {relativeTime(ticket.created_at)}
                    </span>
                    <span className={`flex items-center gap-1.5 ${
                      ticket.sla_minutes_remaining < 30 ? 'text-rose-400' : 'text-muted-foreground'
                    }`}>
                      <Timer className="w-4 h-4" />
                      SLA: {ticket.sla_minutes_remaining}m {ticket.sla_breached ? '(breached)' : 'left'}
                    </span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTakeTicket(ticket.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400 hover:bg-teal-500/30 transition-all text-sm font-medium"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Take Ticket
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toast.info('AI quick fix suggestions coming soon')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/60 border border-border text-muted-foreground hover:text-sky-400 hover:border-sky-500/20 transition-all text-sm font-medium"
                  >
                    <Zap className="w-4 h-4" />
                    AI Quick Fix
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleEscalate(ticket.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/60 border border-border text-muted-foreground hover:text-amber-400 hover:border-amber-500/20 transition-all text-sm font-medium"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Escalate
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Escalation Flow */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-5 rounded-2xl bg-card/60 border border-border"
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Escalation Flow</h3>
        <div className="flex items-center justify-between">
          {['Support', 'Developer', 'R&D', 'Boss'].map((step, i) => (
            <div key={step} className="flex items-center">
              <div className={`px-4 py-2 rounded-lg ${
                i === 0 ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-card/60 text-muted-foreground'
              }`}>
                {step}
              </div>
              {i < 3 && (
                <ArrowUpRight className="w-4 h-4 text-muted-foreground mx-2" />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">All escalations are logged and tracked automatically.</p>
      </motion.div>
    </div>
  );
};

export default PriorityQueue;
