import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Headphones, MessageSquare, Clock, CheckCircle, AlertTriangle,
  Users, TrendingUp, Phone, Mail, Search
} from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCannedResponses, useEscalations, useTickets, useUpdateRow, relativeTime } from '@/hooks/useSalesSupportData';

const SupportAgentDashboard = () => {
  const [search, setSearch] = useState('');
  const { data: tickets = [] } = useTickets();
  const { data: escalations = [] } = useEscalations();
  const { data: quickResponses = [] } = useCannedResponses();
  const updateTicket = useUpdateRow('support_tickets');
  const activeTickets = useMemo(() => tickets
    .filter((ticket) => ticket.status !== 'resolved' && ticket.status !== 'closed')
    .filter((ticket) => `${ticket.reference} ${ticket.subject} ${ticket.customer_name ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 12), [tickets, search]);
  const activeEscalations = escalations.filter((escalation) => escalation.status !== 'resolved' && escalation.status !== 'closed');
  const supportStats = {
    openTickets: activeTickets.length,
    resolvedToday: tickets.filter((ticket) => ticket.status === 'resolved' && ticket.resolved_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    avgResponseTime: 'Live',
    satisfaction: 'Live',
    escalations: activeEscalations.length,
    queueSize: activeTickets.length,
  };

  return (
    <DashboardLayout roleOverride="support">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Support Command</h1>
            <p className="text-muted-foreground">Ticket management & live chat</p>
          </div>
          <Badge className={`px-3 py-1 ${supportStats.queueSize > 5 ? 'bg-neon-orange/20 text-neon-orange' : 'bg-neon-green/20 text-neon-green'}`}>
            Queue: {supportStats.queueSize} waiting
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Open Tickets', value: supportStats.openTickets, icon: MessageSquare, color: 'text-neon-orange' },
            { label: 'Resolved Today', value: supportStats.resolvedToday, icon: CheckCircle, color: 'text-neon-green' },
            { label: 'Avg Response', value: supportStats.avgResponseTime, icon: Clock, color: 'text-neon-cyan' },
            { label: 'Satisfaction', value: `${supportStats.satisfaction}%`, icon: TrendingUp, color: 'text-primary' },
            { label: 'Escalations', value: supportStats.escalations, icon: AlertTriangle, color: 'text-neon-red' },
            { label: 'Queue Size', value: supportStats.queueSize, icon: Users, color: 'text-neon-purple' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-panel">
                <CardContent className="p-4">
                  <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tickets, users, or keywords..."
            className="pl-10 bg-secondary/30 border-border/50"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Tickets */}
          <Card className="glass-panel lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Active Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeTickets.map((ticket) => (
                  <motion.div 
                    key={ticket.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      ticket.type === 'prime' 
                        ? 'bg-neon-orange/10 border border-neon-orange/30 hover:bg-neon-orange/20' 
                        : 'bg-secondary/30 hover:bg-secondary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        ticket.priority === 'high' ? 'bg-neon-red' :
                        ticket.priority === 'medium' ? 'bg-neon-orange' : 'bg-muted-foreground'
                      }`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{ticket.reference}</span>
                        </div>
                        <p className="font-medium text-foreground text-sm">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground">{ticket.customer_name ?? 'Customer'} · {relativeTime(ticket.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateTicket.mutate({ id: ticket.id, values: { status: 'in_progress', first_response_at: new Date().toISOString() } })}>
                        Reply
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Responses */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-lg">Quick Responses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quickResponses.map((response) => (
                  <Button 
                    key={response.id}
                    variant="outline" 
                    className="w-full h-auto py-3 text-left text-xs justify-start whitespace-normal leading-snug hover:bg-primary/10"
                  >
                    {response.content ?? response.title}
                  </Button>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-border/30 space-y-3">
                <h4 className="text-sm text-foreground">Contact Options</h4>
                <Button variant="outline" className="w-full gap-2 justify-start">
                  <Phone className="w-4 h-4" />
                  Voice Call
                </Button>
                <Button variant="outline" className="w-full gap-2 justify-start">
                  <Mail className="w-4 h-4" />
                  Send Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Escalation Queue */}
        {activeEscalations.length > 0 && (
          <Card className="glass-panel border-neon-red/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-neon-red">
                <AlertTriangle className="w-5 h-5" />
                Escalated Tickets ({activeEscalations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {activeEscalations.slice(0, 6).map((esc) => (
                  <div 
                    key={esc.id}
                    className="p-3 rounded-lg bg-neon-red/10 border border-neon-red/30"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{esc.reference ?? esc.id}</span>
                      <Badge variant="outline" className="text-xs border-neon-red/50 text-neon-red">{relativeTime(esc.created_at)}</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{esc.reason ?? 'Escalation pending'}</p>
                    <p className="text-xs text-muted-foreground">Assigned: {esc.assigned_to ?? 'Unassigned'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SupportAgentDashboard;
