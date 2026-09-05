import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, CheckCircle, XCircle, AlertTriangle, Star, 
  Eye, RefreshCw, Download, Filter, BarChart3, Users, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useGlobalActions } from '@/hooks/useGlobalActions';

interface QualityScore {
  agentId: string;
  agentName: string;
  avatar: string;
  overallScore: number;
  compliance: number;
  tone: number;
  accuracy: number;
  slaAdherence: number;
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

  const [qualityScores] = useState<QualityScore[]>([
    { agentId: '1', agentName: 'John Davis', avatar: 'JD', overallScore: 94, compliance: 96, tone: 92, accuracy: 95, slaAdherence: 93, ticketsAudited: 45 },
    { agentId: '2', agentName: 'Sarah Miller', avatar: 'SM', overallScore: 91, compliance: 89, tone: 94, accuracy: 92, slaAdherence: 88, ticketsAudited: 52 },
    { agentId: '3', agentName: 'Mike Roberts', avatar: 'MR', overallScore: 87, compliance: 85, tone: 88, accuracy: 89, slaAdherence: 86, ticketsAudited: 38 },
    { agentId: '4', agentName: 'Emily Chen', avatar: 'EC', overallScore: 96, compliance: 98, tone: 95, accuracy: 97, slaAdherence: 94, ticketsAudited: 61 },
  ]);

  const [auditItems] = useState<AuditItem[]>([
    { id: '1', ticketId: 'TKT-1234', agentName: 'Mike Roberts', category: 'Compliance', finding: 'Missing customer verification step', severity: 'critical', status: 'pending', auditedAt: '2 hours ago' },
    { id: '2', ticketId: 'TKT-1189', agentName: 'John Davis', category: 'Tone', finding: 'Response could be more empathetic', severity: 'warning', status: 'reviewed', auditedAt: '4 hours ago' },
    { id: '3', ticketId: 'TKT-1201', agentName: 'Sarah Miller', category: 'SLA', finding: 'Response time exceeded by 5 minutes', severity: 'warning', status: 'resolved', auditedAt: '1 day ago' },
  ]);

  const [aiMisclassifications] = useState<AIMisclassification[]>([
    { id: '1', ticketId: 'TKT-2001', aiPrediction: 'Billing', actualCategory: 'Technical', confidence: 78, correctedBy: 'John Davis' },
    { id: '2', ticketId: 'TKT-2015', aiPrediction: 'General', actualCategory: 'Urgent - Account Lock', confidence: 65, correctedBy: 'Emily Chen' },
  ]);

  const [samplingConfig] = useState({
    dailyTarget: 50,
    completed: 38,
    lastSampled: '15 min ago',
  });

  const handleReviewAudit = useCallback(async (auditId: string, ticketId: string) => {
    await executeAction({
      actionId: `review_audit_${auditId}`,
      actionType: 'read',
      entityType: 'ticket',
      entityId: ticketId,
      metadata: { auditId },
      successMessage: 'Opening audit review',
    });
  }, [executeAction]);

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

  const handleExportReport = useCallback(async () => {
    await executeAction({
      actionId: 'export_qa_report',
      actionType: 'export',
      entityType: 'report',
      metadata: { type: 'quality_audit', format: 'pdf' },
      successMessage: 'Report exported',
    });
  }, [executeAction]);

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
          <span className="text-sm text-teal-400">{samplingConfig.completed}/{samplingConfig.dailyTarget} tickets</span>
        </div>
        <Progress value={(samplingConfig.completed / samplingConfig.dailyTarget) * 100} className="h-2" />
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
                  <p className={`text-2xl font-bold ${getScoreColor(agent.overallScore)}`}>{agent.overallScore}%</p>
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
                    <p className={`text-lg font-bold ${getScoreColor(metric.value)}`}>{metric.value}%</p>
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
