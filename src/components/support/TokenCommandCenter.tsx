import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Map, AlertTriangle, Clock, Globe, Hash, Zap, 
  TrendingUp, Eye, RefreshCw, Filter, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGlobalActions } from '@/hooks/useGlobalActions';

interface TokenHeatmapData {
  region: string;
  count: number;
  critical: number;
  breaching: number;
}

interface TokenMetric {
  id: string;
  label: string;
  value: number;
  change: number;
  color: string;
}

const TokenCommandCenter = () => {
  const { executeAction } = useGlobalActions();

  const [heatmapData] = useState<TokenHeatmapData[]>([
    { region: 'North America', count: 234, critical: 12, breaching: 3 },
    { region: 'Europe', count: 189, critical: 8, breaching: 2 },
    { region: 'Asia Pacific', count: 156, critical: 15, breaching: 5 },
    { region: 'Middle East', count: 87, critical: 4, breaching: 1 },
    { region: 'South America', count: 65, critical: 3, breaching: 0 },
    { region: 'Africa', count: 43, critical: 2, breaching: 1 },
  ]);

  const [tokensByPriority] = useState([
    { priority: 'Critical', count: 15, color: 'bg-red-500' },
    { priority: 'High', count: 45, color: 'bg-orange-500' },
    { priority: 'Medium', count: 123, color: 'bg-yellow-500' },
    { priority: 'Low', count: 234, color: 'bg-emerald-500' },
  ]);

  const [tokensByChannel] = useState([
    { channel: 'Email', count: 189, icon: '📧' },
    { channel: 'Chat', count: 156, icon: '💬' },
    { channel: 'WhatsApp', count: 98, icon: '📱' },
    { channel: 'Phone', count: 67, icon: '📞' },
    { channel: 'In-App', count: 45, icon: '🔔' },
  ]);

  const [zombieTokens] = useState([
    { id: 'TKN-001', ticketId: 'TKT-1234', lastActivity: '6 hours ago', assignee: 'John D.', status: 'stale' },
    { id: 'TKN-002', ticketId: 'TKT-1189', lastActivity: '8 hours ago', assignee: 'Sarah M.', status: 'zombie' },
    { id: 'TKN-003', ticketId: 'TKT-1201', lastActivity: '12 hours ago', assignee: 'Unassigned', status: 'zombie' },
  ]);

  const [breachingTokens] = useState([
    { id: 'TKN-101', ticketId: 'TKT-2001', timeLeft: '5 min', priority: 'critical', customer: 'Acme Corp' },
    { id: 'TKN-102', ticketId: 'TKT-2015', timeLeft: '12 min', priority: 'high', customer: 'TechStart' },
    { id: 'TKN-103', ticketId: 'TKT-2023', timeLeft: '18 min', priority: 'high', customer: 'GlobalFin' },
  ]);

  const handleViewToken = useCallback(async (tokenId: string, ticketId: string) => {
    await executeAction({
      actionId: `view_token_${tokenId}`,
      actionType: 'read',
      entityType: 'ticket',
      entityId: ticketId,
      metadata: { tokenId },
      successMessage: 'Opening ticket panel',
    });
  }, [executeAction]);

  const handleReviveZombie = useCallback(async (tokenId: string) => {
    await executeAction({
      actionId: `revive_${tokenId}`,
      actionType: 'activate',
      entityType: 'ticket',
      entityId: tokenId,
      metadata: { action: 'revive_zombie' },
      successMessage: 'Token reactivated',
    });
  }, [executeAction]);

  const handleEscalateBreaching = useCallback(async (tokenId: string, ticketId: string) => {
    await executeAction({
      actionId: `escalate_breach_${tokenId}`,
      actionType: 'escalate',
      entityType: 'ticket',
      entityId: ticketId,
      metadata: { reason: 'SLA breach prevention' },
      successMessage: 'Token escalated',
    });
  }, [executeAction]);

  const handleRefreshData = useCallback(async () => {
    await executeAction({
      actionId: 'refresh_command_center',
      actionType: 'refresh',
      entityType: 'report',
      successMessage: 'Command center refreshed',
    });
  }, [executeAction]);

  const totalTokens = heatmapData.reduce((sum, r) => sum + r.count, 0);
  const maxRegionCount = Math.max(...heatmapData.map(r => r.count));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="w-6 h-6 text-teal-400" />
            Token Command Center
          </h2>
          <p className="text-muted-foreground text-sm">Global token lifecycle monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-teal-500/20 text-teal-400 text-lg px-4 py-1">
            {totalTokens} Active Tokens
          </Badge>
          <Button onClick={handleRefreshData} variant="outline" className="border-border">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* SLA Breach Alert */}
      {breachingTokens.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
            <h3 className="font-semibold text-red-400">SLA Breach Alert - Immediate Action Required</h3>
            <Badge className="bg-red-500/20 text-red-400">{breachingTokens.length} at risk</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {breachingTokens.map((token) => (
              <motion.div
                key={token.id}
                whileHover={{ scale: 1.02 }}
                className="bg-card/60 border border-red-500/20 rounded-lg p-3 cursor-pointer"
                onClick={() => handleViewToken(token.id, token.ticketId)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-foreground">{token.ticketId}</span>
                  <Badge className="bg-red-500/20 text-red-400 text-xs animate-pulse">{token.timeLeft}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{token.customer}</p>
                <Button 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); handleEscalateBreaching(token.id, token.ticketId); }}
                  className="w-full mt-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                >
                  Escalate Now
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Heatmap by Region */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-teal-400" />
          <h3 className="text-lg font-semibold text-foreground">Token Heatmap by Region</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {heatmapData.map((region) => {
            const intensity = (region.count / maxRegionCount) * 100;
            return (
              <motion.div
                key={region.region}
                whileHover={{ scale: 1.02 }}
                className="relative overflow-hidden rounded-xl p-4 border border-teal-500/10"
                style={{
                  background: `linear-gradient(135deg, rgba(20,184,166,${intensity / 500}) 0%, rgba(56,189,248,${intensity / 600}) 100%)`
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">{region.region}</span>
                  <span className="text-2xl font-bold text-teal-400">{region.count}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-red-400">🔴 {region.critical} critical</span>
                  <span className="text-orange-400">⚠️ {region.breaching} breaching</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Priority & Channel Distribution */}
      <div className="grid grid-cols-2 gap-6">
        {/* By Priority */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-semibold text-foreground">By Priority</h3>
          </div>
          <div className="space-y-3">
            {tokensByPriority.map((item) => {
              const total = tokensByPriority.reduce((sum, p) => sum + p.count, 0);
              const percentage = (item.count / total) * 100;
              return (
                <div key={item.priority}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{item.priority}</span>
                    <span className="text-foreground font-medium">{item.count}</span>
                  </div>
                  <div className="h-2 bg-card/60 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${item.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* By Channel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Hash className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-foreground">By Channel</h3>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {tokensByChannel.map((channel) => (
              <motion.div
                key={channel.channel}
                whileHover={{ scale: 1.05 }}
                className="text-center p-3 rounded-xl bg-card/60 border border-border"
              >
                <span className="text-2xl">{channel.icon}</span>
                <p className="text-lg font-bold text-foreground mt-1">{channel.count}</p>
                <p className="text-xs text-muted-foreground">{channel.channel}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Zombie Tokens */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card/60 backdrop-blur-xl border border-yellow-500/20 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-foreground">Zombie Tokens</h3>
          <Badge className="bg-yellow-500/20 text-yellow-400">{zombieTokens.length} inactive</Badge>
        </div>
        <div className="space-y-3">
          {zombieTokens.map((token) => (
            <motion.div
              key={token.id}
              whileHover={{ x: 4 }}
              className="flex items-center justify-between p-3 rounded-xl bg-card/60 border border-border"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">{token.ticketId}</span>
                    <Badge className={token.status === 'zombie' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}>
                      {token.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last activity: {token.lastActivity} • Assigned: {token.assignee}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  onClick={() => handleViewToken(token.id, token.ticketId)}
                  variant="ghost" 
                  className="text-teal-400 hover:bg-teal-500/10"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => handleReviveZombie(token.id)}
                  className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30"
                >
                  <Zap className="w-4 h-4 mr-1" /> Revive
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default TokenCommandCenter;
