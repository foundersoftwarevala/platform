import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Search,
  Download,
  Lock,
  Clock,
  User,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuditLogs } from '@/hooks/useSalesSupportData';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  entityType: 'lead' | 'ticket';
  entityId: string;
  details: string;
  category: 'follow_up' | 'status_change' | 'ticket_action' | 'sla_breach' | 'ai_review';
}

export const SSMReportsAudit: React.FC = () => {
  const { data: auditRows, isLoading, error } = useAuditLogs();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const handleExportPDF = () => {
    const rows = auditRows ?? [];
    const csv = [
      ['Timestamp', 'Action', 'Module', 'Actor', 'Details'].join(','),
      ...rows.map((log) => [
        log.occurred_at,
        log.action,
        log.entity_type ?? 'sales-support',
        log.actor ?? 'SYSTEM',
        JSON.stringify(log.metadata ?? ''),
      ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-support-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} audit entries`);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'follow_up':
        return 'bg-blue-500/10 text-blue-500';
      case 'status_change':
        return 'bg-green-500/10 text-green-500';
      case 'ticket_action':
        return 'bg-purple-500/10 text-purple-500';
      case 'sla_breach':
        return 'bg-red-500/10 text-red-500';
      case 'ai_review':
        return 'bg-yellow-500/10 text-yellow-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const auditLogs: AuditEntry[] = (auditRows ?? []).map((log) => {
    const meta = typeof log.metadata === 'object' && log.metadata !== null ? log.metadata as Record<string, unknown> : {};
    const entityType = log.entity_type === 'ticket' ? 'ticket' : 'lead';
    const category = log.action.toLowerCase().includes('sla') ? 'sla_breach' : log.action.toLowerCase().includes('assign') ? 'ticket_action' : 'status_change';
    return {
      id: log.id,
      timestamp: log.occurred_at,
      action: log.action,
      actor: log.actor ?? 'SYSTEM',
      entityType,
      entityId: log.entity_id ?? '—',
      details: JSON.stringify(meta),
      category,
    };
  });
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', 'follow_up', 'status_change', 'ticket_action', 'sla_breach', 'ai_review'];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-primary" />
            Reports & Audit Trail
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              <Lock className="h-3 w-3 mr-1" />
              Immutable Log
            </Badge>
            <Button size="sm" variant="outline" onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-1" />
              Export PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {categories.map((cat) => (
              <Badge
                key={cat}
                variant={categoryFilter === cat ? 'default' : 'outline'}
                className="cursor-pointer capitalize text-xs"
                onClick={() => setCategoryFilter(cat)}
              >
                {cat.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {isLoading && <p className="py-8 text-center text-muted-foreground">Loading audit logs...</p>}
          {error && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"><strong>Audit access restricted.</strong> Audit logs are server-only and require an authenticated manager session.</div>}
          {!isLoading && !error && filteredLogs.map((log, index) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="border border-border rounded-lg p-3 bg-background"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className={getCategoryColor(log.category)}>
                    {log.category.replace('_', ' ')}
                  </Badge>
                  <span className="font-medium text-foreground">{log.action}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">{log.details}</p>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Actor: <span className="font-mono">{log.actor}</span>
                </span>
                <span>
                  {log.entityType}: <span className="font-mono text-primary">{log.entityId}</span>
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {!isLoading && !error && filteredLogs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No audit logs found</p>
          </div>
        )}

        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <Lock className="h-4 w-4 text-green-500 mt-0.5" />
            <p className="text-xs text-green-500">
              <strong>Immutable Audit Trail:</strong> All actions are permanently logged.
              Includes: Follow-ups, Status changes, Ticket actions, SLA breaches, and AI reviews.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
