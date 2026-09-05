/**
 * Internal Support AI - Escalation Manager
 * Auto Task Creation, Team Routing, SLA Management, Priority Assignment
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ArrowUpCircle,
  Target,
  Users,
  Clock,
  AlertTriangle,
  Activity,
  FileText,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Zap
} from 'lucide-react';

interface EscalationManagerProps {
  activeView: string;
}

interface EscalatedIssue {
  id: string;
  originalIssueId: string;
  escalatedTo: string;
  priority: 'critical' | 'high' | 'medium';
  slaRemaining: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'resolved';
  userVisibleStatus: string;
  internalNotes: string;
  createdAt: string;
}

export const EscalationManager: React.FC<EscalationManagerProps> = ({ activeView }) => {
  const [escalatedIssues, setEscalatedIssues] = useState<EscalatedIssue[]>([
    { id: 'ESC-001', originalIssueId: 'ISS-103', escalatedTo: 'Dev Team', priority: 'critical', slaRemaining: '00:15:32', status: 'in_progress', userVisibleStatus: 'Being reviewed by specialists', internalNotes: 'Complex database migration issue', createdAt: '10:30:00' },
    { id: 'ESC-002', originalIssueId: 'ISS-105', escalatedTo: 'Security Team', priority: 'high', slaRemaining: '00:45:18', status: 'assigned', userVisibleStatus: 'Assigned to security team', internalNotes: 'Potential permission vulnerability', createdAt: '11:15:00' },
    { id: 'ESC-003', originalIssueId: 'ISS-108', escalatedTo: 'Support Lead', priority: 'medium', slaRemaining: '01:20:45', status: 'pending', userVisibleStatus: 'In escalation queue', internalNotes: 'User account sync issue', createdAt: '11:45:00' }
  ]);

  const [escalationStats, setEscalationStats] = useState({
    totalEscalated: 28,
    resolved: 22,
    pending: 3,
    inProgress: 3,
    avgResolutionTime: 45,
    slaCompliance: 94.2
  });

  const teamRouting = [
    { team: 'Dev Team', activeCount: 5, avgResponse: '12m', capacity: 85 },
    { team: 'Security Team', activeCount: 2, avgResponse: '8m', capacity: 40 },
    { team: 'Support Lead', activeCount: 3, avgResponse: '15m', capacity: 60 },
    { team: 'API Team', activeCount: 1, avgResponse: '10m', capacity: 25 },
    { team: 'Database Team', activeCount: 2, avgResponse: '20m', capacity: 50 }
  ];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-muted/40 text-muted-foreground border-border';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'assigned': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'resolved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-muted/40 text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-4">
      {/* Escalation Stats */}
      <div className="grid grid-cols-6 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border-cyan-500/20">
            <CardContent className="p-4 text-center">
              <ArrowUpCircle className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-cyan-400">{escalationStats.totalEscalated}</p>
              <p className="text-[10px] text-muted-foreground">Total Escalated</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="bg-gradient-to-br from-emerald-500/10 to-green-600/5 border-emerald-500/20">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-400">{escalationStats.resolved}</p>
              <p className="text-[10px] text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-600/5 border-amber-500/20">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-400">{escalationStats.pending}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-600/5 border-blue-500/20">
            <CardContent className="p-4 text-center">
              <Activity className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-400">{escalationStats.inProgress}</p>
              <p className="text-[10px] text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-gradient-to-br from-purple-500/10 to-violet-600/5 border-purple-500/20">
            <CardContent className="p-4 text-center">
              <Zap className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-400">{escalationStats.avgResolutionTime}m</p>
              <p className="text-[10px] text-muted-foreground">Avg Resolution</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="bg-gradient-to-br from-teal-500/10 to-cyan-600/5 border-teal-500/20">
            <CardContent className="p-4 text-center">
              <Target className="w-6 h-6 text-teal-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-teal-400">{escalationStats.slaCompliance}%</p>
              <p className="text-[10px] text-muted-foreground">SLA Compliance</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Team Routing Overview */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Team Routing & Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3">
              {teamRouting.map((team) => (
                <div
                  key={team.team}
                  className="p-3 bg-card/60 rounded-lg border border-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-foreground font-medium">{team.team}</span>
                    <Badge className="bg-cyan-500/20 text-cyan-400 text-[9px]">
                      {team.activeCount} active
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Avg Response</span>
                      <span className="text-emerald-400">{team.avgResponse}</span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">Capacity</span>
                        <span className="text-cyan-400">{team.capacity}%</span>
                      </div>
                      <Progress value={team.capacity} className="h-1.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active Escalations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Active Escalations
              </CardTitle>
              <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px]">
                {escalatedIssues.length} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {escalatedIssues.map((issue, idx) => (
                <motion.div
                  key={issue.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-4 bg-card/60 rounded-lg border border-border"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-cyan-400">{issue.id}</span>
                      <Badge className={`${getPriorityBadge(issue.priority)} border text-[9px]`}>
                        {issue.priority.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">→ {issue.escalatedTo}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-1 ${
                        issue.slaRemaining.startsWith('00:0') || issue.slaRemaining.startsWith('00:1') 
                          ? 'text-red-400' 
                          : 'text-amber-400'
                      }`}>
                        <Clock className="w-3 h-3" />
                        <span className="text-xs font-mono">{issue.slaRemaining}</span>
                      </div>
                      <Badge className={`${getStatusBadge(issue.status)} border text-[9px]`}>
                        {issue.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* User Visible Status */}
                    <div className="p-2 bg-card/60 rounded border border-border">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                        <Activity className="w-3 h-3" />
                        User-visible Progress
                      </div>
                      <p className="text-xs text-foreground">{issue.userVisibleStatus}</p>
                    </div>
                    
                    {/* Internal Notes (Hidden from user) */}
                    <div className="p-2 bg-red-500/5 rounded border border-red-500/10">
                      <div className="flex items-center gap-1 text-[10px] text-red-400 mb-1">
                        <FileText className="w-3 h-3" />
                        Internal Notes (Hidden)
                      </div>
                      <p className="text-xs text-muted-foreground">{issue.internalNotes}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
