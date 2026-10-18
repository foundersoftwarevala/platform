import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, Clock, Users, UserCheck, UserX, Settings, Plus,
  ChevronLeft, ChevronRight, Coffee, Moon, Sun, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useGlobalActions } from '@/hooks/useGlobalActions';
import { useTeamMembers, useTickets, useUpdateRow } from '@/hooks/useSalesSupportData';

const STATUS_OF: Record<string, 'available' | 'busy' | 'break' | 'offline'> = {
  online: 'available', active: 'available', busy: 'busy', away: 'break', offline: 'offline',
};

interface Agent {
  id: string;
  name: string;
  avatar: string;
  status: 'available' | 'busy' | 'break' | 'offline';
  shift: string;
  currentLoad: number;
  maxLoad: number;
  ticketsToday: number;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  agents: number;
  coverage: number;
}

const ShiftAvailability = () => {
  const { executeAction } = useGlobalActions();

  // The support team from the team directory, each with the open tickets
  // assigned to them. The six agents and three shifts here were typed in.
  const { data: members } = useTeamMembers('support');
  const { data: ticketRows } = useTickets();
  const updateMember = useUpdateRow('team_members');
  const updateTicket = useUpdateRow('support_tickets');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tickets = (ticketRows ?? []) as any[];
  const openFor = (id: string) => tickets.filter((t) => t.assigned_to === id && t.status !== 'resolved' && t.status !== 'closed');
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const agents: Agent[] = (members ?? []).map((m) => ({
    id: m.id,
    name: m.full_name,
    avatar: (m as unknown as { avatar_initials?: string }).avatar_initials || m.full_name.split(' ').map((p) => p[0]).join('').slice(0, 2),
    status: STATUS_OF[String(m.status ?? 'offline')] ?? 'offline',
    shift: String((m as unknown as { shift?: string }).shift ?? '—'),
    currentLoad: openFor(m.id).length,
    // No capacity is recorded per agent; the bar compares agents with the busiest.
    maxLoad: 0,
    ticketsToday: tickets.filter((t) => t.assigned_to === m.id && new Date(t.created_at) >= dayStart).length,
  }));
  const busiest = Math.max(1, ...agents.map((x) => x.currentLoad));
  for (const agent of agents) agent.maxLoad = busiest;
  const shifts: Shift[] = [...new Set(agents.map((x) => x.shift))].map((name) => {
    const inShift = agents.filter((x) => x.shift === name);
    return {
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      startTime: '—',
      endTime: '—',
      agents: inShift.length,
      coverage: inShift.length ? Math.round((inShift.filter((x) => x.status === 'available').length / inShift.length) * 100) : 0,
    };
  });

  // No automatic load balancer runs on the platform.
  const [loadBalancerEnabled] = useState(false);

  const handleToggleAvailability = async (agentId: string, agentName: string) => {
    const agent = agents.find((x) => x.id === agentId);
    const next = agent?.status === 'available' ? 'away' : 'online';
    try {
      await updateMember.mutateAsync({ id: agentId, values: { status: next, updated_at: new Date().toISOString() } });
      toast.success(`${agentName} is now ${next}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The status could not be changed');
    }
  };

  // Hands this agent's open tickets to the least-loaded available colleagues.
  const handleReassignTickets = async (agentId: string) => {
    const others = agents.filter((x) => x.id !== agentId && x.status === 'available');
    const load = new Map(others.map((x) => [x.id, x.currentLoad]));
    const theirs = openFor(agentId);
    if (!theirs.length) { toast.info('This agent has no open ticket to hand over.'); return; }
    if (!others.length) { toast.error('No other agent is available to take them.'); return; }
    try {
      for (const ticket of theirs) {
        const target = [...load.entries()].sort((x, y) => x[1] - y[1])[0][0];
        await updateTicket.mutateAsync({ id: ticket.id, values: { assigned_to: target, updated_at: new Date().toISOString() } });
        load.set(target, (load.get(target) ?? 0) + 1);
      }
      toast.success(`${theirs.length} ticket${theirs.length === 1 ? '' : 's'} handed over`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The tickets could not be handed over');
    }
  };

  const handleToggleLoadBalancer = useCallback(async () => {
    await executeAction({
      actionId: 'toggle_load_balancer',
      actionType: 'toggle',
      entityType: 'setting',
      metadata: { enabled: !loadBalancerEnabled },
      successMessage: `Load balancer ${!loadBalancerEnabled ? 'enabled' : 'disabled'}`,
    });
  }, [loadBalancerEnabled, executeAction]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-emerald-500';
      case 'busy': return 'bg-orange-500';
      case 'break': return 'bg-yellow-500';
      case 'offline': return 'bg-muted/40';
      default: return 'bg-muted/40';
    }
  };

  const getShiftIcon = (shift: string) => {
    switch (shift) {
      case 'Morning': return Sun;
      case 'Afternoon': return Coffee;
      case 'Night': return Moon;
      default: return Clock;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-teal-400" />
            Shift & Availability
          </h2>
          <p className="text-muted-foreground text-sm">Manage agent schedules and workload distribution</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card/60 rounded-lg px-3 py-2">
            <Zap className={`w-4 h-4 ${loadBalancerEnabled ? 'text-emerald-400' : 'text-muted-foreground'}`} />
            <span className="text-sm text-foreground">Load Balancer</span>
            <Switch checked={loadBalancerEnabled} onCheckedChange={handleToggleLoadBalancer} />
          </div>
          <Button className="bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30">
            <Plus className="w-4 h-4 mr-2" />
            Add Shift
          </Button>
        </div>
      </div>

      {/* Shift Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-3 gap-4"
      >
        {shifts.map((shift) => {
          const ShiftIcon = getShiftIcon(shift.name);
          return (
            <motion.div
              key={shift.id}
              whileHover={{ scale: 1.02 }}
              className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                    <ShiftIcon className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{shift.name}</p>
                    <p className="text-xs text-muted-foreground">{shift.startTime} - {shift.endTime}</p>
                  </div>
                </div>
                <Badge className={shift.coverage >= 90 ? 'bg-emerald-500/20 text-emerald-400' : shift.coverage >= 75 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}>
                  {shift.coverage}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{shift.agents} agents</span>
                </div>
                <Button size="sm" variant="ghost" className="text-teal-400 hover:bg-teal-500/10">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Agent Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Active Agents</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              <span className="text-muted-foreground">Busy</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span className="text-muted-foreground">Break</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-muted/40"></span>
              <span className="text-muted-foreground">Offline</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <motion.div
              key={agent.id}
              whileHover={{ scale: 1.01 }}
              className="p-4 rounded-xl bg-card/60 border border-border"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center text-foreground font-bold text-sm">
                    {agent.avatar}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-border ${getStatusColor(agent.status)}`}></span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{agent.shift} Shift</p>
                </div>
                <Badge className={`capitalize ${
                  agent.status === 'available' ? 'bg-emerald-500/20 text-emerald-400' :
                  agent.status === 'busy' ? 'bg-orange-500/20 text-orange-400' :
                  agent.status === 'break' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-muted/40 text-muted-foreground'
                }`}>
                  {agent.status}
                </Badge>
              </div>

              {/* Load Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Current Load</span>
                  <span className="text-foreground">{agent.currentLoad} open</span>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${
                      agent.currentLoad / agent.maxLoad >= 0.8 ? 'bg-red-500' :
                      agent.currentLoad / agent.maxLoad >= 0.5 ? 'bg-yellow-500' :
                      'bg-emerald-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(agent.currentLoad / agent.maxLoad) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {agent.ticketsToday} tickets today
                </span>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleToggleAvailability(agent.id, agent.name)}
                    className={agent.status === 'available' ? 'text-red-400 hover:bg-red-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}
                  >
                    {agent.status === 'available' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleReassignTickets(agent.id)}
                    className="text-teal-400 hover:bg-teal-500/10"
                  >
                    <Zap className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Weekly Schedule Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Weekly Schedule</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-foreground">Jan 13 - Jan 19, 2025</span>
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
            <div key={day} className="text-center">
              <p className="text-xs text-muted-foreground mb-2">{day}</p>
              <div className={`p-3 rounded-lg ${idx === 4 ? 'bg-teal-500/20 border border-teal-500/30' : 'bg-card/60 border border-border'}`}>
                <p className="text-lg font-bold text-foreground">{13 + idx}</p>
                <p className="text-xs text-muted-foreground">{idx < 5 ? '8 agents' : '4 agents'}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default ShiftAvailability;
