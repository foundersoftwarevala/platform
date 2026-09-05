/**
 * LOGS SCREEN
 */
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Download, AlertCircle, CheckCircle, Info, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useBotConversationLogs, useChatbots, relativeTime } from '@/hooks/useSalesSupportData';

const outcomeToLevel = (outcome: string): 'info' | 'success' | 'warning' | 'error' => {
  if (outcome === 'resolved') return 'success';
  if (outcome === 'escalated' || outcome === 'handover') return 'warning';
  if (outcome === 'failed' || outcome === 'error') return 'error';
  return 'info';
};

const getLevelIcon = (level: string) => {
  switch (level) {
    case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
    default: return <Info className="w-4 h-4 text-blue-500" />;
  }
};

const getLevelBadge = (level: string) => {
  const styles: Record<string, string> = {
    error: 'bg-red-500/10 text-red-600 border-red-500/20',
    warning: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    success: 'bg-green-500/10 text-green-600 border-green-500/20',
    info: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  };
  return styles[level] || styles.info;
};

export const SCLogs: React.FC = () => {
  const { data: logs, isLoading, refetch } = useBotConversationLogs();
  const { data: bots } = useChatbots();
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const botName = (botId: string | null) => bots?.find((b) => b.id === botId)?.name ?? 'system';

  const mapped = useMemo(
    () =>
      (logs ?? []).map((log) => ({
        id: log.id,
        time: relativeTime(log.created_at),
        level: outcomeToLevel(log.outcome),
        message: `${log.intent ?? 'Conversation'} — ${log.outcome}`,
        bot: botName(log.bot_id),
        session: log.session_id ?? 'system',
      })),
    [logs, bots],
  );

  const filteredLogs = mapped.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.bot.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">System activity & events</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => { setAutoRefresh(!autoRefresh); if (!autoRefresh) refetch(); }}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.success('Logs exported')}>
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="pl-9"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Badge variant="outline">{filteredLogs.length} entries</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Loading logs...</p>
            ) : filteredLogs.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No logs found.</p>
            ) : (
            <div className="divide-y">
              {filteredLogs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getLevelIcon(log.level)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className={getLevelBadge(log.level)}>
                          {log.level}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{log.bot}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <code className="text-xs bg-muted px-1 rounded">{log.session}</code>
                      </div>
                      <p className="text-sm">{log.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 font-mono">
                      {log.time}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
