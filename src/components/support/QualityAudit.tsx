import { useCallback } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  Shield, CheckCircle, XCircle, AlertTriangle, Star, 
  Eye, RefreshCw, Download, Filter, BarChart3, Users, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useGlobalActions } from '@/hooks/useGlobalActions';
import { useNavigate } from '@tanstack/react-router';
import { memberName, relativeTime, useTeamMembers, useTickets } from '@/hooks/useSalesSupportData';
import { downloadCsv, stampedName } from '@/lib/export/download';

/** A score is null where nothing on the platform measures it. */
interface QualityScore {
  agentId: string;
  agentName: string;
  avatar: string;
  overallScore: number | null;
  compliance: number | null;
  tone: number | null;
  accuracy: number | null;
  slaAdherence: number | null;
  ticketsAudited: number;
}

interface AuditItem {
  id: string;
  ticketId: string;
  agentName: string;
  category: string;
  finding: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'pending' | 'reviewed' | 'resolved';
  auditedAt: string;
}

interface AIMisclassification {
  id: string;
  ticketId: string;
  aiPrediction: string;
  actualCategory: string;
  confidence: number;
  correctedBy: string;
}

const QualityAudit = () => {
  const { executeAction } = useGlobalActions();

  // Quality from the tickets themselves: customer ratings and SLA. The four
  // agents, their scores, the audit findings and the AI corrections here were
  // typed in. Compliance, tone and accuracy are scored by nothing yet.
  const navigate = useNavigate();
  const { data: members } = useTeamMembers('support');
  const { data: ticketRows } = useTickets();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tickets = (ticketRows ?? []) as any[];
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);
  const qualityScores: QualityScore[] = (members ?? []).map((m) => {
    const theirs = tickets.filter((t) => t.assigned_to === m.id);
    const answered = theirs.filter((t) => t.first_response_at);
    const rated = theirs.filter((t) => t.csat != null);
    return {
      agentId: m.id,
      agentName: m.full_name,
      avatar: m.full_name.split(' ').map((p) => p[0]).join('').slice(0, 2),
      overallScore: rated.length ? Math.round((rated.reduce((sum, t) => sum + Number(t.csat), 0) / rated.length / 5) * 100) : null,
      compliance: null,
      tone: null,
      accuracy: null,
      slaAdherence: pct(answered.filter((t) => !t.sla_breached).length, answered.length),
      ticketsAudited: rated.length,
    };
  });

  // Findings: tickets a customer rated low, or that broke their SLA.
  const auditItems: AuditItem[] = tickets
    .filter((t) => (t.csat != null && Number(t.csat) <= 2) || t.sla_breached)
    .map((t) => ({
      id: t.id,
      ticketId: t.reference ?? t.id.slice(0, 8),
      agentName: memberName(members, t.assigned_to) ?? 'Unassigned',
      category: t.sla_breached ? 'SLA' : 'Satisfaction',
      finding: t.sla_breached ? 'SLA breached' : `Customer rated ${t.csat}/5`,
      severity: t.sla_breached && Number(t.csat ?? 5) <= 2 ? 'critical' : 'warning',
      status: t.status === 'resolved' || t.status === 'closed' ? 'resolved' : 'pending',
      auditedAt: relativeTime(t.updated_at),
    }));

  // No AI classifies tickets on the platform, so nothing has been corrected.
  const aiMisclassifications: AIMisclassification[] = [];

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const ratedToday = tickets.filter((t) => t.csat != null && new Date(t.updated_at) >= dayStart);
  const samplingConfig = {
    dailyTarget: Math.max(1, tickets.filter((t) => t.resolved_at && new Date(t.resolved_at) >= dayStart).length),
    completed: ratedToday.length,
    lastSampled: ratedToday.length ? relativeTime(ratedToday.map((t) => t.updated_at).sort().at(-1)) : '—',
  };

  // Reviewing a finding means reading the ticket, in the inbox.
  const handleReviewAudit = useCallback((_auditId: string, _ticketId: string) => {
    void navigate({ to: '/support', search: { section: 'inbox' } });
  }, [navigate]);

  const handleResolveAudit = useCallback(async (auditId: string) => {
    await executeAction({
      actionId: `resolve_audit_${auditId}`,
      actionType: 'resolve',
      entityType: 'alert',
      entityId: auditId,
      successMessage: 'Audit item resolved',
    });
  }, [executeAction]);

  const handleTriggerSampling = useCallback(async () => {
    await executeAction({
      actionId: 'trigger_sampling',
      actionType: 'sync',
      entityType: 'report',
      metadata: { type: 'random_sampling' },
      successMessage: 'Random sampling initiated',
    });
  }, [executeAction]);

  const handleExportReport = () => {
    const n = downloadCsv(stampedName('quality-audit', 'csv'), [
      ...qualityScores.map((q) => ({ kind: 'agent', name: q.agentName, customer_rating_percent: q.overallScore ?? '', sla_percent: q.slaAdherence ?? '', rated_tickets: q.ticketsAudited })),
      ...auditItems.map((i) => ({ kind: 'finding', name: i.ticketId, agent: i.agentName, finding: i.finding, status: i.status })),
    ]);
    toast.success(`Exported ${n} rows as CSV`);
  };

  const getScoreColor = (score: number) => {
    if (score >= 95) return 'text-emerald-400';
    if (score >= 85) return 'text-teal-400';
    if (score >= 75) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400';
      case 'warning': return 'bg-yellow-500/20 text-yellow-400';
      case 'info': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-muted/40 text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-teal-400" />
            Quality & Audit
          </h2>
          <p className="text-muted-foreground text-sm">Supervisor-level quality assurance and compliance</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleTriggerSampling} variant="outline" className="border-border">
            <RefreshCw className="w-4 h-4 mr-2" />
            Random Sample
          </Button>
          <Button onClick={handleExportReport} className="bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Sampling Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-xl p-4"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Daily Sampling Progress</span>
          <span className="text-sm text-teal-400">{samplingConfig.completed} rated of {samplingConfig.dailyTarget} resolved today</span>
        </div>
        <Progress value={Math.min(100, (samplingConfig.completed / samplingConfig.dailyTarget) * 100)} className="h-2" />
        <p className="text-xs text-muted-foreground mt-2">Last sampled: {samplingConfig.lastSampled}</p>
      </motion.div>

      {/* Agent Quality Scores */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-foreground">Agent Quality Scores</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {qualityScores.map((agent) => (
            <motion.div
              key={agent.agentId}
              whileHover={{ scale: 1.01 }}
              className="p-4 rounded-xl bg-card/60 border border-border"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center text-foreground font-bold">
                  {agent.avatar}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{agent.agentName}</p>
                  <p className="text-xs text-muted-foreground">{agent.ticketsAudited} tickets audited</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${agent.overallScore == null ? 'text-muted-foreground' : getScoreColor(agent.overallScore)}`}>{agent.overallScore == null ? '—' : `${agent.overallScore}%`}</p>
                  <p className="text-xs text-muted-foreground">Overall</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Compliance', value: agent.compliance },
                  { label: 'Tone', value: agent.tone },
                  { label: 'Accuracy', value: agent.accuracy },
                  { label: 'SLA', value: agent.slaAdherence },
                ].map((metric) => (
                  <div key={metric.label} className="text-center p-2 rounded-lg bg-card/60">
                    <p className={`text-lg font-bold ${metric.value == null ? 'text-muted-foreground' : getScoreColor(metric.value)}`}>{metric.value == null ? '—' : `${metric.value}%`}</p>
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Audit Findings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-foreground">Audit Findings</h3>
          <Badge className="bg-orange-500/20 text-orange-400">
            {auditItems.filter(a => a.status === 'pending').length} pending
          </Badge>
        </div>
        <div className="space-y-3">
          {auditItems.length === 0 && <p className="text-sm text-muted-foreground">No low-rated or SLA-breached ticket to review.</p>}
          {auditItems.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ x: 4 }}
              className={`p-4 rounded-xl border ${
                item.severity === 'critical' ? 'bg-red-500/5 border-red-500/20' :
                item.severity === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20' :
                'bg-card/60 border-border'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {item.severity === 'critical' ? (
                    <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  ) : item.severity === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-teal-400">{item.ticketId}</span>
                      <Badge className={getSeverityColor(item.severity)}>{item.severity}</Badge>
                      <Badge className="bg-muted/40 text-muted-foreground">{item.category}</Badge>
                    </div>
                    <p className="text-sm text-foreground mb-1">{item.finding}</p>
                    <p className="text-xs text-muted-foreground">Agent: {item.agentName} • {item.auditedAt}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'pending' && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleReviewAudit(item.id, item.ticketId)}
                        variant="ghost" 
                        className="text-teal-400 hover:bg-teal-500/10"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => handleResolveAudit(item.id)}
                        className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Resolve
                      </Button>
                    </>
                  )}
                  {item.status === 'reviewed' && <Badge className="bg-blue-500/20 text-blue-400">Reviewed</Badge>}
                  {item.status === 'resolved' && <Badge className="bg-emerald-500/20 text-emerald-400">Resolved</Badge>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* AI Misclassifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card/60 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-foreground">AI Misclassification Review</h3>
          <Badge className="bg-purple-500/20 text-purple-400">{aiMisclassifications.length} corrections</Badge>
        </div>
        <div className="space-y-3">
          {aiMisclassifications.length === 0 && <p className="text-sm text-muted-foreground">No AI classifies tickets on the platform yet, so there is nothing to correct.</p>}
          {aiMisclassifications.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-card/60 border border-border flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-teal-400">{item.ticketId}</span>
                  <Badge className="bg-red-500/20 text-red-400">{item.aiPrediction}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400">{item.actualCategory}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  AI confidence: {item.confidence}% • Corrected by: {item.correctedBy}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Used for AI learning</p>
                <Star className="w-4 h-4 text-yellow-400 inline-block" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default QualityAudit;
