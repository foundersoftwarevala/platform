import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Clock, AlertCircle, Globe, Smile, Frown,
  Meh, MessageCircle, ArrowUpRight, Zap, Tag
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useTickets, useTeamMembers, useCannedResponses, useUpdateRow,
  relativeTime, memberName,
} from '@/hooks/useSalesSupportData';

const TicketInbox = () => {
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const { data: tickets, isLoading } = useTickets();
  const { data: members } = useTeamMembers();
  const { data: cannedResponses } = useCannedResponses();
  const updateTicket = useUpdateRow('support_tickets');

  const openTickets = (tickets ?? []).filter((t) => t.status !== 'resolved' && t.status !== 'closed');
  const highPriorityCount = openTickets.filter((t) => t.priority === 'high' || t.priority === 'critical').length;

  const getUrgencyConfig = (priority: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      critical: { color: 'rose', label: 'Critical' },
      high: { color: 'rose', label: 'High' },
      medium: { color: 'amber', label: 'Medium' },
      low: { color: 'emerald', label: 'Low' },
    };
    return configs[priority] || configs.medium;
  };

  const getSentimentIcon = (csat: number | null) => {
    if (csat == null) return <Meh className="w-4 h-4 text-muted-foreground" />;
    if (csat >= 4) return <Smile className="w-4 h-4 text-emerald-400" />;
    if (csat <= 2) return <Frown className="w-4 h-4 text-rose-400" />;
    return <Meh className="w-4 h-4 text-muted-foreground" />;
  };

  const handleReply = async (ticketId: string) => {
    try {
      await updateTicket.mutateAsync({
        id: ticketId,
        values: { status: 'in_progress', first_response_at: new Date().toISOString() },
      });
      toast.success('Reply logged, ticket marked in progress');
    } catch (e) {
      toast.error('Failed to update ticket');
    }
  };

  const handleEscalate = async (ticketId: string, currentPriority: string) => {
    try {
      await updateTicket.mutateAsync({
        id: ticketId,
        values: { priority: currentPriority === 'critical' ? 'critical' : 'high' },
      });
      toast.success('Ticket escalated');
    } catch (e) {
      toast.error('Failed to escalate ticket');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Ticket Inbox</h2>
          <p className="text-muted-foreground mt-1">Manage and respond to support requests</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {highPriorityCount} High Priority
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm">
            {openTickets.length} Open
          </span>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {!isLoading && openTickets.length === 0 && (
          <div className="p-8 text-center text-muted-foreground rounded-2xl border border-border bg-card/60">
            No open tickets right now.
          </div>
        )}
        {openTickets.map((ticket, index) => {
          const urgencyConfig = getUrgencyConfig(ticket.priority);
          const isSelected = selectedTicket === ticket.id;

          return (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`rounded-2xl bg-card/60 backdrop-blur-xl border transition-all duration-300 ${
                isSelected
                  ? 'border-teal-500/30 shadow-lg shadow-teal-500/5'
                  : 'border-border hover:border-border'
              }`}
            >
              {/* Ticket Header */}
              <div
                className="p-5 cursor-pointer"
                onClick={() => setSelectedTicket(isSelected ? null : ticket.id)}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className="text-sm font-mono text-muted-foreground">{ticket.reference}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium bg-${urgencyConfig.color}-500/10 text-${urgencyConfig.color}-400 border border-${urgencyConfig.color}-500/20`}>
                        {urgencyConfig.label}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-muted/40 text-muted-foreground">
                        {ticket.category}
                      </span>
                    </div>
                    <p className="text-foreground font-medium mb-2">{ticket.subject}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        {ticket.customer_name}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {relativeTime(ticket.created_at)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        {ticket.channel}
                      </span>
                      {ticket.assigned_to && (
                        <span className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5" />
                          {memberName(members, ticket.assigned_to) ?? 'Assigned'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sentiment & Quick Actions */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/60">
                      {getSentimentIcon(ticket.csat)}
                      <span className="text-xs text-muted-foreground capitalize">{ticket.status}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Actions */}
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-5 pb-5 border-t border-border"
                >
                  <div className="pt-4 space-y-4">
                    {/* Canned Responses */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Quick Responses:</p>
                      <div className="flex flex-wrap gap-2">
                        {(cannedResponses ?? []).slice(0, 4).map((response) => (
                          <motion.button
                            key={response.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => toast.info(response.body)}
                            className="px-3 py-2 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground hover:border-teal-500/20 hover:text-teal-400 transition-all text-left"
                          >
                            {response.title}
                          </motion.button>
                        ))}
                        {(cannedResponses ?? []).length === 0 && (
                          <span className="text-xs text-muted-foreground">No canned responses saved yet.</span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleReply(ticket.id)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 hover:bg-teal-500/20 transition-all text-sm font-medium"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Reply
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleEscalate(ticket.id, ticket.priority)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/60 border border-border text-muted-foreground hover:border-amber-500/20 hover:text-amber-400 transition-all text-sm font-medium"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        Escalate
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toast.info('AI assist suggestions coming soon')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/60 border border-border text-muted-foreground hover:border-sky-500/20 hover:text-sky-400 transition-all text-sm font-medium"
                      >
                        <Zap className="w-4 h-4" />
                        AI Assist
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default TicketInbox;
