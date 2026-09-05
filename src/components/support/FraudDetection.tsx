import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, AlertTriangle, Eye, Ban, CheckCircle, XCircle, 
  Activity, TrendingUp, Users, Flag, Search, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useGlobalActions } from '@/hooks/useGlobalActions';

interface FraudAlert {
  id: string;
  type: 'abuse' | 'spam' | 'bot' | 'chargeback' | 'impersonation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  customerId: string;
  customerName: string;
  description: string;
  detectedAt: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  riskScore: number;
}

interface BehaviorPattern {
  id: string;
  pattern: string;
  occurrences: number;
  lastSeen: string;
  isAnomaly: boolean;
}

const FraudDetection = () => {
  const { executeAction } = useGlobalActions();

  const [alerts] = useState<FraudAlert[]>([
    { id: '1', type: 'abuse', severity: 'critical', customerId: 'USR-1234', customerName: 'John Smith', description: 'Multiple refund requests with different payment methods', detectedAt: '5 min ago', status: 'pending', riskScore: 95 },
    { id: '2', type: 'spam', severity: 'high', customerId: 'USR-5678', customerName: 'Mike Johnson', description: 'Sending repetitive tickets with similar content', detectedAt: '15 min ago', status: 'investigating', riskScore: 78 },
    { id: '3', type: 'bot', severity: 'medium', customerId: 'USR-9012', customerName: 'Bot Account', description: 'Automated ticket submission pattern detected', detectedAt: '1 hour ago', status: 'pending', riskScore: 65 },
    { id: '4', type: 'chargeback', severity: 'high', customerId: 'USR-3456', customerName: 'Sarah Davis', description: 'History of chargebacks after receiving support', detectedAt: '2 hours ago', status: 'resolved', riskScore: 82 },
    { id: '5', type: 'impersonation', severity: 'critical', customerId: 'USR-7890', customerName: 'Admin Fake', description: 'Attempting to impersonate staff member', detectedAt: '30 min ago', status: 'pending', riskScore: 98 },
  ]);

  const [patterns] = useState<BehaviorPattern[]>([
    { id: '1', pattern: 'Rapid ticket creation', occurrences: 23, lastSeen: '10 min ago', isAnomaly: true },
    { id: '2', pattern: 'VPN usage with location changes', occurrences: 45, lastSeen: '5 min ago', isAnomaly: true },
    { id: '3', pattern: 'Multiple accounts same IP', occurrences: 12, lastSeen: '1 hour ago', isAnomaly: true },
    { id: '4', pattern: 'Normal support request', occurrences: 1240, lastSeen: '1 min ago', isAnomaly: false },
  ]);

  const handleInvestigate = useCallback(async (alertId: string, type: string) => {
    await executeAction({
      actionId: `investigate_${alertId}`,
      actionType: 'update',
      entityType: 'alert',
      entityId: alertId,
      metadata: { status: 'investigating', type },
      successMessage: 'Investigation started',
    });
    toast.success('Alert moved to investigation');
  }, [executeAction]);

  const handleBanUser = useCallback(async (customerId: string, customerName: string) => {
    await executeAction({
      actionId: `ban_${customerId}`,
      actionType: 'suspend',
      entityType: 'user',
      entityId: customerId,
      metadata: { customerName, reason: 'fraud_detection' },
      successMessage: `${customerName} has been suspended`,
    });
  }, [executeAction]);

  const handleDismiss = useCallback(async (alertId: string) => {
    await executeAction({
      actionId: `dismiss_${alertId}`,
      actionType: 'close',
      entityType: 'alert',
      entityId: alertId,
      successMessage: 'Alert dismissed',
    });
  }, [executeAction]);

  const handleResolve = useCallback(async (alertId: string) => {
    await executeAction({
      actionId: `resolve_${alertId}`,
      actionType: 'resolve',
      entityType: 'alert',
      entityId: alertId,
      successMessage: 'Alert resolved',
    });
  }, [executeAction]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-muted/40 text-muted-foreground border-border';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'abuse': return AlertTriangle;
      case 'spam': return Activity;
      case 'bot': return Users;
      case 'chargeback': return TrendingUp;
      case 'impersonation': return Flag;
      default: return Shield;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-400" />
            Fraud & Abuse Detection
          </h2>
          <p className="text-muted-foreground text-sm">Monitor and respond to suspicious activities</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search alerts..." 
              className="pl-10 bg-card/60 border-border w-64"
            />
          </div>
          <Button variant="outline" className="border-border text-muted-foreground">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-4 gap-4"
      >
        {[
          { label: 'Active Alerts', value: '5', change: '+2', color: 'text-red-400', bgColor: 'bg-red-500/10' },
          { label: 'Resolved Today', value: '12', change: '+5', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
          { label: 'Accounts Flagged', value: '8', change: '+1', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
          { label: 'Risk Score Avg', value: '72', change: '-3', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            whileHover={{ scale: 1.02 }}
            className={`${stat.bgColor} border border-opacity-20 rounded-xl p-4`}
          >
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <div className="flex items-end justify-between">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <span className={`text-xs ${stat.change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>
                {stat.change}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Active Alerts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card/60 backdrop-blur-xl border border-red-500/20 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-lg font-semibold text-foreground">Active Fraud Alerts</h3>
          <Badge className="bg-red-500/20 text-red-400">{alerts.filter(a => a.status === 'pending').length} Pending</Badge>
        </div>

        <div className="space-y-3">
          {alerts.map((alert) => {
            const TypeIcon = getTypeIcon(alert.type);
            return (
              <motion.div
                key={alert.id}
                whileHover={{ x: 4 }}
                className={`p-4 rounded-xl border ${getSeverityColor(alert.severity)} bg-opacity-30`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getSeverityColor(alert.severity)}`}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">{alert.customerName}</span>
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <Badge className="bg-muted/40 text-muted-foreground capitalize">{alert.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{alert.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>ID: {alert.customerId}</span>
                        <span>Detected: {alert.detectedAt}</span>
                        <span>Risk Score: <span className={alert.riskScore >= 80 ? 'text-red-400' : 'text-yellow-400'}>{alert.riskScore}%</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.status === 'pending' && (
                      <>
                        <Button 
                          size="sm" 
                          onClick={() => handleInvestigate(alert.id, alert.type)}
                          className="bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30"
                        >
                          <Eye className="w-4 h-4 mr-1" /> Investigate
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleBanUser(alert.customerId, alert.customerName)}
                          className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                        >
                          <Ban className="w-4 h-4 mr-1" /> Ban
                        </Button>
                      </>
                    )}
                    {alert.status === 'investigating' && (
                      <>
                        <Badge className="bg-blue-500/20 text-blue-400">Investigating</Badge>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleResolve(alert.id)}
                          className="text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {alert.status === 'resolved' && (
                      <Badge className="bg-emerald-500/20 text-emerald-400">Resolved</Badge>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleDismiss(alert.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Behavior Patterns */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 text-teal-400" />
          <h3 className="text-lg font-semibold text-foreground">Behavior Patterns</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {patterns.map((pattern) => (
            <motion.div
              key={pattern.id}
              whileHover={{ scale: 1.01 }}
              className={`p-4 rounded-xl border ${
                pattern.isAnomaly 
                  ? 'bg-red-500/5 border-red-500/20' 
                  : 'bg-emerald-500/5 border-emerald-500/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-foreground">{pattern.pattern}</span>
                {pattern.isAnomaly && (
                  <Badge className="bg-red-500/20 text-red-400">Anomaly</Badge>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{pattern.occurrences} occurrences</span>
                <span>Last seen: {pattern.lastSeen}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default FraudDetection;
