import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, Search, Filter, Download, RefreshCw, 
  Clock, User, Tag, AlertTriangle, CheckCircle, XCircle, 
  Activity, Zap, Shield, ArrowUpRight, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useGlobalActions } from '@/hooks/useGlobalActions';

interface LogEntry {
  id: string;
  timestamp: string;
  eventType: 'ticket' | 'token' | 'sla' | 'escalation' | 'agent' | 'ai' | 'system';
  action: string;
  actor: string;
  actorRole: string;
  targetId: string;
  targetType: string;
  details: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, any>;
}

const SystemLogs = () => {
  const { executeAction } = useGlobalActions();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const [logs] = useState<LogEntry[]>([
    { id: '1', timestamp: '2025-01-17 14:32:15', eventType: 'ticket', action: 'status_change', actor: 'John Davis', actorRole: 'L1 Support', targetId: 'TKT-1234', targetType: 'ticket', details: 'Status changed from "Open" to "In Progress"', severity: 'info' },
    { id: '2', timestamp: '2025-01-17 14:30:45', eventType: 'token', action: 'token_assigned', actor: 'System', actorRole: 'Auto-Assignment', targetId: 'TKN-5678', targetType: 'token', details: 'Token auto-assigned to Sarah Miller based on load balancer', severity: 'info' },
    { id: '3', timestamp: '2025-01-17 14:28:30', eventType: 'sla', action: 'sla_warning', actor: 'System', actorRole: 'SLA Monitor', targetId: 'TKT-1189', targetType: 'ticket', details: 'SLA breach warning: 15 minutes remaining', severity: 'warning' },
    { id: '4', timestamp: '2025-01-17 14:25:12', eventType: 'escalation', action: 'escalated', actor: 'Mike Roberts', actorRole: 'L2 Support', targetId: 'TKT-1201', targetType: 'ticket', details: 'Escalated from L1 to L2 - Technical issue requires specialist', severity: 'warning' },
    { id: '5', timestamp: '2025-01-17 14:22:00', eventType: 'agent', action: 'login', actor: 'Emily Chen', actorRole: 'L1 Support', targetId: 'USR-4567', targetType: 'user', details: 'Agent logged in from 192.168.1.45', severity: 'info' },
    { id: '6', timestamp: '2025-01-17 14:20:30', eventType: 'ai', action: 'suggestion_accepted', actor: 'John Davis', actorRole: 'L1 Support', targetId: 'AI-SUG-001', targetType: 'ai_suggestion', details: 'AI suggested reply accepted - positive learning signal', severity: 'info' },
    { id: '7', timestamp: '2025-01-17 14:18:15', eventType: 'sla', action: 'sla_breach', actor: 'System', actorRole: 'SLA Monitor', targetId: 'TKT-2001', targetType: 'ticket', details: 'SLA BREACHED - Response time exceeded by 10 minutes', severity: 'critical' },
    { id: '8', timestamp: '2025-01-17 14:15:00', eventType: 'system', action: 'fraud_detected', actor: 'Fraud Detection AI', actorRole: 'System', targetId: 'USR-9999', targetType: 'user', details: 'Suspicious activity detected - Multiple refund attempts', severity: 'error' },
    { id: '9', timestamp: '2025-01-17 14:12:45', eventType: 'ticket', action: 'resolved', actor: 'Sarah Miller', actorRole: 'L1 Support', targetId: 'TKT-1150', targetType: 'ticket', details: 'Ticket resolved - Customer confirmed issue fixed', severity: 'info' },
    { id: '10', timestamp: '2025-01-17 14:10:00', eventType: 'ai', action: 'suggestion_rejected', actor: 'Mike Roberts', actorRole: 'L2 Support', targetId: 'AI-SUG-002', targetType: 'ai_suggestion', details: 'AI suggested reply rejected - negative learning signal', severity: 'warning' },
  ]);

  const handleExport = useCallback(async (format: 'csv' | 'json' | 'pdf') => {
    await executeAction({
      actionId: `export_logs_${format}`,
      actionType: 'export',
      entityType: 'log',
      metadata: { format, filters: { type: filterType, severity: filterSeverity } },
      successMessage: `Logs exported as ${format.toUpperCase()}`,
    });
    toast.success(`Downloading ${format.toUpperCase()} file...`);
  }, [executeAction, filterType, filterSeverity]);

  const handleRefresh = useCallback(async () => {
    await executeAction({
      actionId: 'refresh_logs',
      actionType: 'refresh',
      entityType: 'log',
      successMessage: 'Logs refreshed',
    });
  }, [executeAction]);

  const handleViewDetails = useCallback(async (logId: string, targetId: string) => {
    await executeAction({
      actionId: `view_log_${logId}`,
      actionType: 'read',
      entityType: 'log',
      entityId: targetId,
      successMessage: 'Loading details',
    });
  }, [executeAction]);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'ticket': return FileText;
      case 'token': return Tag;
      case 'sla': return Clock;
      case 'escalation': return ArrowUpRight;
      case 'agent': return User;
      case 'ai': return Zap;
      case 'system': return Shield;
      default: return Activity;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'ticket': return 'text-teal-400 bg-teal-500/20';
      case 'token': return 'text-purple-400 bg-purple-500/20';
      case 'sla': return 'text-orange-400 bg-orange-500/20';
      case 'escalation': return 'text-red-400 bg-red-500/20';
      case 'agent': return 'text-blue-400 bg-blue-500/20';
      case 'ai': return 'text-yellow-400 bg-yellow-500/20';
      case 'system': return 'text-muted-foreground bg-muted/40';
      default: return 'text-muted-foreground bg-muted/40';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge className="bg-red-500/20 text-red-400"><AlertTriangle className="w-3 h-3 mr-1" />Critical</Badge>;
      case 'error': return <Badge className="bg-orange-500/20 text-orange-400"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      case 'warning': return <Badge className="bg-yellow-500/20 text-yellow-400"><AlertTriangle className="w-3 h-3 mr-1" />Warning</Badge>;
      case 'info': return <Badge className="bg-muted/40 text-muted-foreground"><CheckCircle className="w-3 h-3 mr-1" />Info</Badge>;
      default: return null;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.targetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.actor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || log.eventType === filterType;
    const matchesSeverity = filterSeverity === 'all' || log.severity === filterSeverity;
    return matchesSearch && matchesType && matchesSeverity;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6 text-teal-400" />
            System Logs & Audit Trail
          </h2>
          <p className="text-muted-foreground text-sm">Complete audit trail for disaster recovery and compliance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline" className="border-border">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => handleExport('csv')} variant="outline" className="border-border">
            CSV
          </Button>
          <Button onClick={() => handleExport('json')} variant="outline" className="border-border">
            JSON
          </Button>
          <Button onClick={() => handleExport('pdf')} className="bg-teal-500/20 text-teal-400 border border-teal-500/30">
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search logs..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/60 border-border"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 bg-card/60 border-border">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="ticket">Ticket</SelectItem>
            <SelectItem value="token">Token</SelectItem>
            <SelectItem value="sla">SLA</SelectItem>
            <SelectItem value="escalation">Escalation</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="ai">AI</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-40 bg-card/60 border-border">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Log Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-4 gap-4"
      >
        {[
          { label: 'Total Events', value: logs.length, color: 'text-teal-400' },
          { label: 'Critical', value: logs.filter(l => l.severity === 'critical').length, color: 'text-red-400' },
          { label: 'Warnings', value: logs.filter(l => l.severity === 'warning').length, color: 'text-yellow-400' },
          { label: 'AI Events', value: logs.filter(l => l.eventType === 'ai').length, color: 'text-purple-400' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Log Entries */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Event Log</h3>
          <Badge className="bg-teal-500/20 text-teal-400">{filteredLogs.length} entries</Badge>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredLogs.map((log, idx) => {
            const EventIcon = getEventIcon(log.eventType);
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                whileHover={{ x: 4 }}
                onClick={() => handleViewDetails(log.id, log.targetId)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  log.severity === 'critical' ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40' :
                  log.severity === 'error' ? 'bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40' :
                  log.severity === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40' :
                  'bg-card/60 border-border hover:border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getEventColor(log.eventType)}`}>
                    <EventIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{log.timestamp}</span>
                      <Badge className={getEventColor(log.eventType)}>{log.eventType}</Badge>
                      <span className="text-xs text-muted-foreground">{log.action}</span>
                      {getSeverityBadge(log.severity)}
                    </div>
                    <p className="text-sm text-foreground mt-1">{log.details}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>Actor: {log.actor} ({log.actorRole})</span>
                      <span>Target: {log.targetId}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default SystemLogs;
