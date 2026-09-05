/**
 * ANALYTICS & LOGS SCREEN
 * Chat transcripts, AI confidence, errors
 */

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Download,
  MessageSquare,
  Brain,
  AlertTriangle,
  Clock,
  User,
  Bot,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import {
  useBotConversationLogs,
  useChatbots,
  useChatSessions,
  relativeTime,
} from '@/hooks/useSalesSupportData';

export const CBAnalyticsLogs: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: logs, isLoading: logsLoading } = useBotConversationLogs();
  const { data: chatbots, isLoading: botsLoading } = useChatbots();
  const { data: sessions } = useChatSessions();

  const isLoading = logsLoading || botsLoading;
  const logsList = logs ?? [];

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logsList;
    const q = searchQuery.toLowerCase();
    return logsList.filter(
      (l) => (l.intent ?? '').toLowerCase().includes(q) || l.outcome.toLowerCase().includes(q),
    );
  }, [logsList, searchQuery]);

  const totalChats = logsList.length;
  const avgConfidence = logsList.length
    ? Math.round(logsList.reduce((sum, l) => sum + (l.confidence ?? 0), 0) / logsList.length)
    : 0;
  const resolvedByBot = logsList.filter((l) => l.outcome === 'resolved').length;
  const positivePct = totalChats ? Math.round((resolvedByBot / totalChats) * 100) : 0;
  const errorLogs = logsList.filter((l) => l.outcome === 'error' || l.outcome === 'failed');

  const sessionMap = new Map((sessions ?? []).map((s) => [s.id, s]));

  const stats = [
    { label: 'Total Chats', value: String(totalChats), icon: MessageSquare, color: 'blue' },
    { label: 'Avg Confidence', value: `${avgConfidence}%`, icon: Brain, color: 'violet' },
    { label: 'Resolved by Bot', value: `${positivePct}%`, icon: ThumbsUp, color: 'emerald' },
    { label: 'Errors', value: String(errorLogs.length), icon: AlertTriangle, color: 'orange' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics & Logs</h1>
          <p className="text-muted-foreground text-sm mt-1">Review conversations and monitor performance</p>
        </div>
        <Button variant="outline" onClick={() => toast.success('Report export started — you will get a download link shortly')}>
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="bg-card border-border shadow-sm rounded-xl">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-${stat.color}-100 flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 text-${stat.color}-600`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="transcripts" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <TabsList className="bg-surface-2">
            <TabsTrigger value="transcripts">💬 Conversation Logs</TabsTrigger>
            <TabsTrigger value="ai-logs">🤖 AI Confidence</TabsTrigger>
            <TabsTrigger value="errors">⚠️ Error Logs</TabsTrigger>
            <TabsTrigger value="bots">🧩 Bots</TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>
        </div>

        {/* Transcripts Tab */}
        <TabsContent value="transcripts">
          <Card className="bg-card border-border shadow-sm rounded-xl">
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading conversation logs…</p>
              ) : filteredLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No conversation logs found.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => {
                    const session = log.session_id ? sessionMap.get(log.session_id) : undefined;
                    const resolvedByHuman = session?.handled_by === 'human';
                    return (
                      <div key={log.id} className="p-4 hover:bg-surface transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-foreground font-medium text-sm">
                              {(session?.visitor_name ?? 'NA').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-foreground">{session?.visitor_name ?? 'Unknown visitor'}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    resolvedByHuman ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                                  }`}
                                >
                                  {resolvedByHuman ? <User className="w-3 h-3 mr-1" /> : <Bot className="w-3 h-3 mr-1" />}
                                  {resolvedByHuman ? 'human' : 'bot'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{log.intent ?? 'Unclassified'} — {log.outcome}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {relativeTime(log.created_at)}
                                </span>
                                <span>• {log.message_count} messages</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Logs Tab */}
        <TabsContent value="ai-logs">
          <Card className="bg-card border-border shadow-sm rounded-xl">
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading logs…</p>
              ) : filteredLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No logs found.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => {
                    const confidence = Math.round(log.confidence ?? 0);
                    return (
                      <div key={log.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{log.intent ?? 'Unclassified intent'}</p>
                            <p className="text-sm text-muted-foreground mt-1">→ {log.outcome}</p>
                            <span className="text-xs text-muted-foreground mt-2 block">{relativeTime(log.created_at)}</span>
                          </div>
                          <div className="ml-4">
                            <div className={`text-center px-3 py-2 rounded-lg ${
                              confidence >= 90 ? 'bg-emerald-50' :
                              confidence >= 60 ? 'bg-amber-50' : 'bg-red-50'
                            }`}>
                              <p className={`text-lg font-bold ${
                                confidence >= 90 ? 'text-emerald-600' :
                                confidence >= 60 ? 'text-amber-600' : 'text-red-600'
                              }`}>{confidence}%</p>
                              <p className="text-[10px] text-muted-foreground">confidence</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors">
          <Card className="bg-card border-border shadow-sm rounded-xl">
            <CardContent className="p-0">
              {errorLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No errors recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {errorLogs.map((err) => (
                    <div key={err.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-100">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{err.outcome}</span>
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700">Active</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{err.intent ?? 'No intent detected'}</p>
                          <span className="text-xs text-muted-foreground">{relativeTime(err.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bots Tab */}
        <TabsContent value="bots">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(chatbots ?? []).map((bot) => (
              <Card key={bot.id} className="bg-card border-border shadow-sm rounded-xl">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="w-5 h-5 text-blue-600" />
                    {bot.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Channel: {bot.channel}</p>
                  <p>Conversations: {bot.conversations}</p>
                  <p>Resolution rate: {bot.resolution_rate}%</p>
                  <p>Escalation rate: {bot.escalation_rate}%</p>
                </CardContent>
              </Card>
            ))}
            {(!chatbots || chatbots.length === 0) && (
              <p className="text-sm text-muted-foreground py-8 text-center col-span-2">No chatbots configured.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
