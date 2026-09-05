import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowUpRight, 
  Clock,
  Shield,
  Scale,
  AlertTriangle,
  User,
  CheckCircle,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useEscalations, useTickets, useTeamMembers, useInsertRow, memberName } from '@/hooks/useSalesSupportData';

const targetLabels: Record<string, string> = {
  '1': 'pro_manager',
  '2': 'legal',
  '3': 'super_admin',
};

export const SSMEscalations: React.FC = () => {
  const { data: escalations, isLoading } = useEscalations();
  const { data: tickets } = useTickets();
  const { data: members } = useTeamMembers();
  const insertEscalation = useInsertRow('support_escalations');
  const [escalationEvidence, setEscalationEvidence] = useState('');

  const handleNewEscalation = async (target: 'pro_manager' | 'legal' | 'super_admin') => {
    if (!escalationEvidence.trim()) {
      toast.error('Evidence is mandatory for escalation');
      return;
    }
    try {
      await insertEscalation.mutateAsync({
        reference: `ESC-${Date.now()}`,
        reason: escalationEvidence,
        resolution_notes: null,
        status: 'pending',
        level: target === 'super_admin' ? 3 : target === 'legal' ? 2 : 1,
      });
      toast.success(`Escalated to ${target.replace('_', ' ')}`);
      setEscalationEvidence('');
    } catch {
      toast.error('Failed to escalate');
    }
  };

  const getTargetIcon = (level: number) => {
    if (level >= 3) return <Shield className="h-4 w-4" />;
    if (level === 2) return <Scale className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
  };

  const getTargetColor = (level: number) => {
    if (level >= 3) return 'bg-red-500/10 text-red-500';
    if (level === 2) return 'bg-purple-500/10 text-purple-500';
    return 'bg-blue-500/10 text-blue-500';
  };

  const getTargetLabel = (level: number) => level >= 3 ? 'super admin' : level === 2 ? 'legal' : 'pro manager';

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      pending: { color: 'bg-yellow-500/10 text-yellow-500', icon: Clock },
      in_progress: { color: 'bg-blue-500/10 text-blue-500', icon: ArrowUpRight },
      resolved: { color: 'bg-green-500/10 text-green-500', icon: CheckCircle }
    };
    const cfg = config[status] || config.pending;
    const Icon = cfg.icon;
    return (
      <Badge className={cfg.color}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const allEscalations = escalations ?? [];
  const pendingCount = allEscalations.filter(e => e.status === 'pending').length;

  const ticketRef = (ticketId: string | null) => (tickets ?? []).find(t => t.id === ticketId)?.reference ?? ticketId ?? '—';
  const ticketSubject = (ticketId: string | null) => (tickets ?? []).find(t => t.id === ticketId)?.subject ?? 'Escalation';

  return (
    <Card className="bg-card border-border">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ArrowUpRight className="h-5 w-5 text-primary" />
            Escalations
          </CardTitle>
          <Badge variant="outline" className={pendingCount > 0 ? 'bg-yellow-500/10 text-yellow-500' : ''}>
            {pendingCount} Pending
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Pro Manager • Legal (complaints) • Super Admin (critical) • Evidence mandatory
        </p>
      </CardHeader>
      <CardContent className="p-4">
        {/* Quick Escalation Panel */}
        <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
          <h4 className="font-medium text-foreground mb-3">Quick Escalate</h4>
          <div>
            <Textarea
              value={escalationEvidence}
              onChange={(e) => setEscalationEvidence(e.target.value)}
              placeholder="Provide evidence and context (mandatory)..."
              className="bg-background border-border mb-3"
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-blue-500/50 text-blue-500 hover:bg-blue-500/10"
                onClick={() => handleNewEscalation('pro_manager')}
              >
                <User className="h-4 w-4 mr-1" />
                Pro Manager
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-purple-500/50 text-purple-500 hover:bg-purple-500/10"
                onClick={() => handleNewEscalation('legal')}
              >
                <Scale className="h-4 w-4 mr-1" />
                Legal
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                onClick={() => handleNewEscalation('super_admin')}
              >
                <Shield className="h-4 w-4 mr-1" />
                Super Admin
              </Button>
            </div>
          </div>
        </div>

        {/* Escalation List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading escalations...</div>
        ) : (
        <div className="space-y-4">
          {allEscalations.map((escalation) => (
            <motion.div
              key={escalation.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="border border-border rounded-lg p-4 bg-background"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${getTargetColor(escalation.level)}`}>
                    {getTargetIcon(escalation.level)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-primary">{escalation.reference}</span>
                      {escalation.ticket_id && (
                        <Badge variant="outline" className="text-xs">
                          ticket
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium text-foreground">{ticketSubject(escalation.ticket_id)}</h4>
                    <p className="text-sm text-muted-foreground capitalize">
                      → {getTargetLabel(escalation.level)}
                    </p>
                  </div>
                </div>
                {getStatusBadge(escalation.status)}
              </div>

              <p className="text-sm text-foreground mb-2">{escalation.reason}</p>
              
              {escalation.resolution_notes && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <FileText className="h-3 w-3" />
                  {escalation.resolution_notes}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Owner: {memberName(members, escalation.assigned_to) ?? '—'}</span>
                <span>Escalated: {new Date(escalation.created_at).toLocaleString()}</span>
              </div>
            </motion.div>
          ))}
        </div>
        )}

        {!isLoading && allEscalations.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500 opacity-50" />
            <p>No active escalations</p>
          </div>
        )}

        <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
            <p className="text-xs text-orange-500">
              All escalations require evidence. Financial escalations are blocked - 
              commission edit and payout/refund approvals are not available to this role.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
