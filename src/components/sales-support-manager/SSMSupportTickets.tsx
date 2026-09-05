import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Headphones, 
  Clock,
  User,
  AlertTriangle,
  MessageSquare,
  Shield,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useTickets, useTeamMembers, useUpdateRow } from '@/hooks/useSalesSupportData';

export const SSMSupportTickets: React.FC = () => {
  const { data: tickets, isLoading } = useTickets();
  const { data: supportAgents } = useTeamMembers('support');
  const updateTicket = useUpdateRow('support_tickets');
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAssignTicket = async (ticketId: string, agentId: string, agentName: string) => {
    try {
      await updateTicket.mutateAsync({ id: ticketId, values: { assigned_to: agentId, status: 'assigned' } });
      toast.success(`Ticket assigned to ${agentName}`);
    } catch {
      toast.error('Failed to assign ticket');
    }
    setSelectedTicket(null);
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500 text-foreground animate-pulse',
      high: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
      medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
      low: 'bg-blue-500/10 text-blue-500 border-blue-500/30'
    };
    return <Badge className={colors[priority] || colors.low}>{(priority || 'low').toUpperCase()}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500/10 text-blue-500',
      assigned: 'bg-purple-500/10 text-purple-500',
      in_progress: 'bg-yellow-500/10 text-yellow-500',
      resolved: 'bg-green-500/10 text-green-500',
      escalated: 'bg-red-500/10 text-red-500'
    };
    return <Badge className={colors[status] || colors.new}>{status.replace('_', ' ')}</Badge>;
  };

  const formatSLATime = (mins: number) => {
    if (mins <= 0) return 'BREACHED';
    const hours = Math.floor(mins / 60);
    const minutes = Math.floor(mins % 60);
    return `${hours}h ${minutes}m`;
  };

  const getSLAColor = (mins: number, breached: boolean) => {
    if (breached || mins <= 0) return 'text-red-500 bg-red-500/10';
    if (mins < 60) return 'text-red-500 bg-red-500/10';
    if (mins < 240) return 'text-yellow-500 bg-yellow-500/10';
    return 'text-green-500 bg-green-500/10';
  };

  const allTickets = tickets ?? [];
  const activeTickets = allTickets.filter(t => t.status !== 'resolved');

  return (
    <Card className="bg-card border-border">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Headphones className="h-5 w-5 text-primary" />
            Support Tickets Queue
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
              <Shield className="h-3 w-3 mr-1" />
              Delete BLOCKED
            </Badge>
            <Badge variant="outline">
              {activeTickets.length} Active
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          One ticket → One agent • SLA timers are server-based • Auto-escalation on breach
        </p>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading tickets...</div>
        ) : (
        <div className="space-y-4">
          {activeTickets.map((ticket) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`border rounded-lg p-4 bg-background ${
                ticket.sla_breached ? 'border-red-500' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-primary">{ticket.reference}</span>
                    {getPriorityBadge(ticket.priority)}
                    {getStatusBadge(ticket.status)}
                  </div>
                  <h4 className="font-semibold text-foreground">{ticket.subject}</h4>
                  <p className="text-sm text-muted-foreground">{ticket.customer_name} • {ticket.category}</p>
                </div>
                <Badge className={`${getSLAColor(ticket.sla_minutes_remaining, ticket.sla_breached)} font-mono`}>
                  <Clock className="h-3 w-3 mr-1" />
                  SLA: {formatSLATime(ticket.sla_minutes_remaining)}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-sm mb-3">
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {ticket.channel}
                  </span>
                  {ticket.assigned_to && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {ticket.assigned_to}
                    </span>
                  )}
                </div>
              </div>

              {!ticket.assigned_to && (
                selectedTicket === ticket.id ? (
                  <div className="border-t border-border pt-3">
                    <p className="text-sm font-medium text-foreground mb-2">Assign to Support Agent:</p>
                    <div className="flex flex-wrap gap-2">
                      {(supportAgents ?? []).map((agent) => (
                        <Button
                          key={agent.id}
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignTicket(ticket.id, agent.id, agent.full_name)}
                          className="flex items-center gap-2"
                        >
                          <User className="h-3 w-3" />
                          {agent.full_name}
                          <Badge variant="secondary" className="text-xs">
                            {agent.tickets_handled} tickets
                          </Badge>
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedTicket(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setSelectedTicket(ticket.id)}
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Assign Ticket
                  </Button>
                )
              )}
            </motion.div>
          ))}
        </div>
        )}

        {!isLoading && activeTickets.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Headphones className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No active support tickets</p>
          </div>
        )}

        <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
            <p className="text-xs text-orange-500">
              SLA timers are server-based and cannot be modified. 
              Tickets nearing breach will auto-escalate. Delete is permanently blocked.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
