import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Ticket, User, Clock, AlertTriangle, MessageCircle, Phone, Mail,
  ArrowUp, ArrowDown, Pause, Play, Merge, RefreshCw, UserPlus,
  CheckCircle, XCircle, Filter, Search, MoreVertical, Hash
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useSystemActions } from '@/hooks/useSystemActions';

type TokenStatus = 'open' | 'in_progress' | 'on_hold' | 'closed' | 'breached';
type TokenPriority = 'low' | 'medium' | 'high' | 'critical';
type TokenChannel = 'email' | 'chat' | 'call' | 'whatsapp';
type EscalationLevel = 'L1' | 'L2' | 'L3' | 'admin';

interface Token {
  id: string;
  ticketId: string;
  customerId: string;
  customerName: string;
  channel: TokenChannel;
  priority: TokenPriority;
  slaTimer: number; // minutes remaining
  assignedAgent: string | null;
  status: TokenStatus;
  escalationLevel: EscalationLevel;
  subject: string;
  createdAt: string;
}

const initialTokens: Token[] = [
  { id: 'TKN-001', ticketId: 'TKT-1247', customerId: 'C001', customerName: 'Tech Solutions Ltd', channel: 'chat', priority: 'critical', slaTimer: 8, assignedAgent: 'Sarah Chen', status: 'in_progress', escalationLevel: 'L2', subject: 'Payment gateway failure', createdAt: '5 min ago' },
  { id: 'TKN-002', ticketId: 'TKT-1248', customerId: 'C002', customerName: 'Healthcare Plus', channel: 'email', priority: 'high', slaTimer: 25, assignedAgent: 'Mike Johnson', status: 'open', escalationLevel: 'L1', subject: 'Login issues', createdAt: '12 min ago' },
  { id: 'TKN-003', ticketId: 'TKT-1249', customerId: 'C003', customerName: 'EduLearn Academy', channel: 'call', priority: 'medium', slaTimer: 45, assignedAgent: null, status: 'open', escalationLevel: 'L1', subject: 'Feature request', createdAt: '28 min ago' },
  { id: 'TKN-004', ticketId: 'TKT-1250', customerId: 'C004', customerName: 'Retail Mart', channel: 'whatsapp', priority: 'high', slaTimer: 5, assignedAgent: 'Lisa Park', status: 'on_hold', escalationLevel: 'L1', subject: 'Invoice discrepancy', createdAt: '45 min ago' },
  { id: 'TKN-005', ticketId: 'TKT-1251', customerId: 'C005', customerName: 'Global Logistics', channel: 'email', priority: 'low', slaTimer: 120, assignedAgent: 'Emma Davis', status: 'in_progress', escalationLevel: 'L1', subject: 'Data export help', createdAt: '1 hour ago' },
];

const agents = ['Sarah Chen', 'Mike Johnson', 'Lisa Park', 'Emma Davis', 'James Wilson'];

const TokenSystem = () => {
  const { executeAction } = useSystemActions();
  const [tokens, setTokens] = useState<Token[]>(initialTokens);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleAssign = useCallback(async (tokenId: string, agent: string) => {
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, assignedAgent: agent, status: 'in_progress' } : t));
    await executeAction({
      module: 'customer_support',
      action: 'assign',
      entityType: 'token',
      entityId: tokenId,
      entityName: agent,
      successMessage: `Token assigned to ${agent}`
    });
  }, [executeAction]);

  const handleReassign = useCallback(async (tokenId: string, agent: string) => {
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, assignedAgent: agent } : t));
    await executeAction({
      module: 'customer_support',
      action: 'reassign',
      entityType: 'token',
      entityId: tokenId,
      entityName: agent,
      successMessage: `Token reassigned to ${agent}`
    });
  }, [executeAction]);

  const handlePause = useCallback(async (tokenId: string) => {
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, status: 'on_hold' } : t));
    await executeAction({
      module: 'customer_support',
      action: 'pause',
      entityType: 'token',
      entityId: tokenId,
      successMessage: 'Token paused'
    });
  }, [executeAction]);

  const handleResume = useCallback(async (tokenId: string) => {
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, status: 'in_progress' } : t));
    await executeAction({
      module: 'customer_support',
      action: 'resume',
      entityType: 'token',
      entityId: tokenId,
      successMessage: 'Token resumed'
    });
  }, [executeAction]);

  const handleEscalate = useCallback(async (tokenId: string) => {
    setTokens(prev => prev.map(t => {
      if (t.id === tokenId) {
        const levels: EscalationLevel[] = ['L1', 'L2', 'L3', 'admin'];
        const currentIdx = levels.indexOf(t.escalationLevel);
        const nextLevel = levels[Math.min(currentIdx + 1, levels.length - 1)];
        return { ...t, escalationLevel: nextLevel, priority: 'critical' };
      }
      return t;
    }));
    await executeAction({
      module: 'customer_support',
      action: 'escalate',
      entityType: 'token',
      entityId: tokenId,
      successMessage: 'Token escalated to next level'
    });
  }, [executeAction]);

  const handleMerge = useCallback(async () => {
    if (selectedTokens.length < 2) {
      toast.warning('Select at least 2 tokens to merge');
      return;
    }
    const primaryToken = selectedTokens[0];
    setTokens(prev => prev.filter(t => !selectedTokens.slice(1).includes(t.id)));
    setSelectedTokens([]);
    await executeAction({
      module: 'customer_support',
      action: 'merge' as any,
      entityType: 'tokens',
      entityId: primaryToken,
      successMessage: `${selectedTokens.length} tokens merged`
    });
  }, [selectedTokens, executeAction]);

  const handleClose = useCallback(async (tokenId: string) => {
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, status: 'closed' } : t));
    await executeAction({
      module: 'customer_support',
      action: 'update',
      entityType: 'token',
      entityId: tokenId,
      data: { status: 'closed' },
      successMessage: 'Token closed'
    });
  }, [executeAction]);

  const handleReopen = useCallback(async (tokenId: string) => {
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, status: 'open', slaTimer: 60 } : t));
    await executeAction({
      module: 'customer_support',
      action: 'update',
      entityType: 'token',
      entityId: tokenId,
      data: { status: 'open' },
      successMessage: 'Token reopened'
    });
  }, [executeAction]);

  const getChannelIcon = (channel: TokenChannel) => {
    switch (channel) {
      case 'email': return <Mail className="w-4 h-4 text-blue-400" />;
      case 'chat': return <MessageCircle className="w-4 h-4 text-emerald-400" />;
      case 'call': return <Phone className="w-4 h-4 text-amber-400" />;
      case 'whatsapp': return <MessageCircle className="w-4 h-4 text-green-400" />;
    }
  };

  const getPriorityColor = (priority: TokenPriority) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'high': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'medium': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'low': return 'bg-muted/40 text-muted-foreground border-border';
    }
  };

  const getStatusColor = (status: TokenStatus) => {
    switch (status) {
      case 'open': return 'bg-purple-500/20 text-purple-300';
      case 'in_progress': return 'bg-cyan-500/20 text-cyan-300';
      case 'on_hold': return 'bg-amber-500/20 text-amber-300';
      case 'closed': return 'bg-emerald-500/20 text-emerald-300';
      case 'breached': return 'bg-red-500/20 text-red-300';
    }
  };

  const getSLAStatus = (minutes: number) => {
    if (minutes <= 0) return { color: 'text-red-400', label: 'Breached' };
    if (minutes <= 15) return { color: 'text-red-400', label: 'Critical' };
    if (minutes <= 30) return { color: 'text-amber-400', label: 'Warning' };
    return { color: 'text-emerald-400', label: 'On Track' };
  };

  const filteredTokens = tokens.filter(token => {
    if (filterStatus !== 'all' && token.status !== filterStatus) return false;
    if (filterPriority !== 'all' && token.priority !== filterPriority) return false;
    if (searchQuery && !token.subject.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !token.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: tokens.length,
    open: tokens.filter(t => t.status === 'open').length,
    inProgress: tokens.filter(t => t.status === 'in_progress').length,
    slaBreach: tokens.filter(t => t.slaTimer <= 15 && t.status !== 'closed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Hash className="w-6 h-6 text-teal-400" />
            Token Queue
          </h2>
          <p className="text-muted-foreground mt-1">Real-time token management with SLA tracking</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedTokens.length >= 2 && (
            <Button onClick={handleMerge} variant="outline" className="border-teal-500/30 text-teal-400">
              <Merge className="w-4 h-4 mr-2" />
              Merge ({selectedTokens.length})
            </Button>
          )}
          <Button onClick={() => executeAction({ module: 'customer_support', action: 'refresh', entityType: 'tokens' })} variant="outline" className="border-border">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-teal-500/20">
          <CardContent className="p-4 text-center">
            <Ticket className="w-8 h-8 text-teal-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-teal-100">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Tokens</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{stats.open}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <Play className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">{stats.inProgress}</div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-red-500/20">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-100">{stats.slaBreach}</div>
            <div className="text-xs text-muted-foreground">SLA Risk</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tokens..."
            className="pl-10 bg-card/60 border-border"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-card/60 border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-40 bg-card/60 border-border">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Token List */}
      <Card className="bg-card/60 border-teal-500/20">
        <CardHeader>
          <CardTitle className="text-teal-100">Active Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <AnimatePresence>
              {filteredTokens.map((token, index) => {
                const slaStatus = getSLAStatus(token.slaTimer);
                const isSelected = selectedTokens.includes(token.id);
                
                return (
                  <motion.div
                    key={token.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 rounded-lg transition-colors ${
                      isSelected ? 'bg-teal-900/30 border border-teal-500/30' : 'bg-card/60 hover:bg-card/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTokens([...selectedTokens, token.id]);
                            } else {
                              setSelectedTokens(selectedTokens.filter(id => id !== token.id));
                            }
                          }}
                          className="rounded border-border"
                        />
                        <span className="font-mono text-teal-400 text-sm">{token.id}</span>
                        {getChannelIcon(token.channel)}
                        <Badge className={getPriorityColor(token.priority)}>{token.priority}</Badge>
                        <Badge className={getStatusColor(token.status)}>{token.status.replace('_', ' ')}</Badge>
                        <Badge variant="outline" className="text-muted-foreground">{token.escalationLevel}</Badge>
                      </div>
                      {token.status !== 'closed' && (
                        <div className="flex items-center gap-2">
                          <Clock className={`w-4 h-4 ${slaStatus.color}`} />
                          <span className={slaStatus.color}>{token.slaTimer} min</span>
                          <Badge variant="outline" className={slaStatus.color}>{slaStatus.label}</Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-foreground">{token.subject}</h4>
                        <p className="text-sm text-muted-foreground">
                          {token.customerName} • {token.ticketId} • {token.assignedAgent || 'Unassigned'} • {token.createdAt}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!token.assignedAgent && token.status !== 'closed' && (
                          <Select onValueChange={(agent) => handleAssign(token.id, agent)}>
                            <SelectTrigger className="w-32 h-8 bg-muted/40 border-border text-xs">
                              <SelectValue placeholder="Assign..." />
                            </SelectTrigger>
                            <SelectContent>
                              {agents.map(agent => (
                                <SelectItem key={agent} value={agent}>{agent}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {token.assignedAgent && token.status !== 'closed' && (
                          <Select onValueChange={(agent) => handleReassign(token.id, agent)}>
                            <SelectTrigger className="w-32 h-8 bg-muted/40 border-border text-xs">
                              <SelectValue placeholder="Reassign..." />
                            </SelectTrigger>
                            <SelectContent>
                              {agents.filter(a => a !== token.assignedAgent).map(agent => (
                                <SelectItem key={agent} value={agent}>{agent}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {token.status === 'in_progress' && (
                          <Button size="sm" variant="ghost" onClick={() => handlePause(token.id)}>
                            <Pause className="w-4 h-4 text-amber-400" />
                          </Button>
                        )}

                        {token.status === 'on_hold' && (
                          <Button size="sm" variant="ghost" onClick={() => handleResume(token.id)}>
                            <Play className="w-4 h-4 text-emerald-400" />
                          </Button>
                        )}

                        {token.status !== 'closed' && token.escalationLevel !== 'admin' && (
                          <Button size="sm" variant="outline" onClick={() => handleEscalate(token.id)} className="border-amber-500/30 text-amber-300 h-8">
                            <ArrowUp className="w-3 h-3 mr-1" />
                            Escalate
                          </Button>
                        )}

                        {token.status !== 'closed' && (
                          <Button size="sm" onClick={() => handleClose(token.id)} className="bg-emerald-500 hover:bg-emerald-600 h-8">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Close
                          </Button>
                        )}

                        {token.status === 'closed' && (
                          <Button size="sm" variant="outline" onClick={() => handleReopen(token.id)} className="border-teal-500/30 text-teal-300 h-8">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Reopen
                          </Button>
                        )}
                      </div>
                    </div>

                    {token.status !== 'closed' && (
                      <div className="mt-3">
                        <Progress 
                          value={Math.max(0, Math.min(100, (token.slaTimer / 120) * 100))} 
                          className="h-1"
                        />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TokenSystem;
