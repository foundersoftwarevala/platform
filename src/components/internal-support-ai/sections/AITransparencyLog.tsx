/**
 * Internal Support AI - AI Transparency Log
 * Read-only log showing Issue Detected, Action Taken, Reason, Outcome, Next Step
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  AlertTriangle,
  Wrench,
  MessageCircleQuestion,
  CheckCircle2,
  ArrowRight,
  Clock,
  Eye,
  Lock
} from 'lucide-react';

interface AITransparencyLogProps {
  activeView: string;
}

interface TransparencyEntry {
  id: string;
  timestamp: string;
  issueId: string;
  issueDetected: string;
  actionTaken: string;
  reason: string;
  outcome: 'success' | 'partial' | 'escalated' | 'pending';
  nextStep: string | null;
}

export const AITransparencyLog: React.FC<AITransparencyLogProps> = ({ activeView }) => {
  const [entries, setEntries] = useState<TransparencyEntry[]>([
    {
      id: 'LOG-001',
      timestamp: '12:45:32',
      issueId: 'ISS-142',
      issueDetected: 'API endpoint /api/users/profile returned 500 error',
      actionTaken: 'Attempted API reconnection and cache invalidation',
      reason: 'Server-side connection pool exhausted, requiring connection refresh',
      outcome: 'success',
      nextStep: null
    },
    {
      id: 'LOG-002',
      timestamp: '12:44:18',
      issueId: 'ISS-141',
      issueDetected: 'Access configuration for /admin/settings',
      actionTaken: 'Re-synced role permissions from authorization service',
      reason: 'User role cache was stale after recent permission update',
      outcome: 'success',
      nextStep: null
    },
    {
      id: 'LOG-003',
      timestamp: '12:43:02',
      issueId: 'ISS-140',
      issueDetected: 'UI component failed to render - TypeError in Dashboard',
      actionTaken: 'State reset and component remount attempted',
      reason: 'Corrupted local state from previous session',
      outcome: 'partial',
      nextStep: 'Requesting user confirmation of fix'
    },
    {
      id: 'LOG-004',
      timestamp: '12:41:45',
      issueId: 'ISS-139',
      issueDetected: 'Database query timeout on analytics endpoint',
      actionTaken: 'Query optimization attempted, connection refresh executed',
      reason: 'Query complexity exceeded timeout threshold',
      outcome: 'escalated',
      nextStep: 'Escalated to Database Team for query optimization'
    },
    {
      id: 'LOG-005',
      timestamp: '12:40:15',
      issueId: 'ISS-138',
      issueDetected: 'Session token expired during active session',
      actionTaken: 'Silent token refresh initiated',
      reason: 'Token expiry during long-running operation',
      outcome: 'success',
      nextStep: null
    }
  ]);

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'success': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'partial': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'escalated': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'pending': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      default: return 'bg-muted/40 text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">AI Transparency Log</h3>
                  <p className="text-[10px] text-muted-foreground">Read-only audit trail of all AI decisions and actions</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px]">
                  <Lock className="w-3 h-3 mr-1" />
                  READ-ONLY
                </Badge>
                <Badge className="bg-muted/40 text-muted-foreground border border-border text-[10px]">
                  {entries.length} Entries
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Log Entries */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Transparency Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {entries.map((entry, idx) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-4 bg-card/60 rounded-lg border border-border"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground">{entry.timestamp}</span>
                      <span className="text-xs font-mono text-cyan-400">{entry.id}</span>
                      <span className="text-[10px] text-muted-foreground">Issue: {entry.issueId}</span>
                    </div>
                    <Badge className={`${getOutcomeBadge(entry.outcome)} border text-[9px]`}>
                      {entry.outcome.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Log Details Grid */}
                  <div className="grid grid-cols-5 gap-3">
                    {/* Issue Detected */}
                    <div className="p-3 bg-red-500/5 rounded border border-red-500/10">
                      <div className="flex items-center gap-1 text-[10px] text-red-400 mb-1">
                        <AlertTriangle className="w-3 h-3" />
                        Issue Detected
                      </div>
                      <p className="text-[11px] text-muted-foreground">{entry.issueDetected}</p>
                    </div>

                    {/* Action Taken */}
                    <div className="p-3 bg-cyan-500/5 rounded border border-cyan-500/10">
                      <div className="flex items-center gap-1 text-[10px] text-cyan-400 mb-1">
                        <Wrench className="w-3 h-3" />
                        Action Taken
                      </div>
                      <p className="text-[11px] text-muted-foreground">{entry.actionTaken}</p>
                    </div>

                    {/* Reason */}
                    <div className="p-3 bg-purple-500/5 rounded border border-purple-500/10">
                      <div className="flex items-center gap-1 text-[10px] text-purple-400 mb-1">
                        <MessageCircleQuestion className="w-3 h-3" />
                        Reason
                      </div>
                      <p className="text-[11px] text-muted-foreground">{entry.reason}</p>
                    </div>

                    {/* Outcome */}
                    <div className={`p-3 rounded border ${
                      entry.outcome === 'success' 
                        ? 'bg-emerald-500/5 border-emerald-500/10' 
                        : entry.outcome === 'escalated'
                        ? 'bg-purple-500/5 border-purple-500/10'
                        : 'bg-amber-500/5 border-amber-500/10'
                    }`}>
                      <div className={`flex items-center gap-1 text-[10px] mb-1 ${
                        entry.outcome === 'success' 
                          ? 'text-emerald-400' 
                          : entry.outcome === 'escalated'
                          ? 'text-purple-400'
                          : 'text-amber-400'
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        Outcome
                      </div>
                      <p className="text-[11px] text-muted-foreground capitalize">{entry.outcome}</p>
                    </div>

                    {/* Next Step */}
                    <div className="p-3 bg-muted/40 rounded border border-border">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                        <ArrowRight className="w-3 h-3" />
                        Next Step
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {entry.nextStep || 'No further action required'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Response Rules Reminder */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              AI Response Rules (Enforced)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-500/10 rounded border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-2" />
                <p className="text-xs text-foreground font-medium mb-1">Always Show</p>
                <ul className="text-[10px] text-muted-foreground space-y-1">
                  <li>• What happened</li>
                  <li>• What was done</li>
                  <li>• Next step</li>
                </ul>
              </div>
              <div className="p-3 bg-red-500/10 rounded border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 mb-2" />
                <p className="text-xs text-foreground font-medium mb-1">Never Say</p>
                <ul className="text-[10px] text-muted-foreground space-y-1">
                  <li>• "Sorry for inconvenience"</li>
                  <li>• "Please explain"</li>
                  <li>• Fake waiting messages</li>
                </ul>
              </div>
              <div className="p-3 bg-cyan-500/10 rounded border border-cyan-500/20">
                <Clock className="w-4 h-4 text-cyan-400 mb-2" />
                <p className="text-xs text-foreground font-medium mb-1">Performance</p>
                <ul className="text-[10px] text-muted-foreground space-y-1">
                  <li>• Response &lt; 300ms</li>
                  <li>• 80-90% auto-resolution</li>
                  <li>• Human for complex only</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
