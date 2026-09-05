/**
 * OVERVIEW SCREEN
 * Dashboard with key metrics and charts
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  MessageCircle,
  Clock,
  Star,
  Languages,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useChatbots, useChatSessions, useBotConversationLogs } from '@/hooks/useSalesSupportData';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CBOverview: React.FC = () => {
  const { data: chatbots, isLoading: botsLoading } = useChatbots();
  const { data: sessions, isLoading: sessionsLoading } = useChatSessions();
  const { data: logs, isLoading: logsLoading } = useBotConversationLogs();

  const isLoading = botsLoading || sessionsLoading || logsLoading;

  const bots = chatbots ?? [];
  const allSessions = sessions ?? [];
  const allLogs = logs ?? [];

  const activeBots = bots.filter((b) => b.status === 'active');
  const channelBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    bots.forEach((b) => map.set(b.channel, (map.get(b.channel) ?? 0) + 1));
    return Array.from(map.entries()).map(([channel, count]) => `${count} on ${channel}`).join(', ');
  }, [bots]);

  const liveSessions = allSessions.filter((s) => s.status === 'active' || s.status === 'open');
  const liveBotCount = liveSessions.filter((s) => s.handled_by !== 'human').length;
  const liveHumanCount = liveSessions.filter((s) => s.handled_by === 'human').length;

  const resolvedLogs = allLogs.filter((l) => l.outcome === 'resolved').length;
  const resolutionRate = allLogs.length ? Math.round((resolvedLogs / allLogs.length) * 100) : 0;

  const avgConfidence = allLogs.length
    ? Math.round(allLogs.reduce((sum, l) => sum + (l.confidence ?? 0), 0) / allLogs.length)
    : 0;

  const positiveSentiment = allSessions.filter((s) => s.sentiment === 'positive').length;
  const satisfactionPct = allSessions.length ? Math.round((positiveSentiment / allSessions.length) * 100) : 0;

  const statsCards = [
    {
      title: 'Active Chatbots',
      value: String(activeBots.length),
      subtitle: channelBreakdown || 'No chatbots configured',
      icon: Bot,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Live Conversations',
      value: String(liveSessions.length),
      subtitle: `${liveBotCount} with bot, ${liveHumanCount} with agents`,
      icon: MessageCircle,
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      title: 'Bot Resolution Rate',
      value: `${resolutionRate}%`,
      subtitle: `${resolvedLogs} of ${allLogs.length} logged conversations`,
      icon: Clock,
      color: 'from-violet-500 to-violet-600',
    },
    {
      title: 'Avg AI Confidence',
      value: `${avgConfidence}%`,
      subtitle: 'Across all conversation logs',
      icon: Languages,
      color: 'from-orange-500 to-orange-600',
    },
    {
      title: 'Customer Satisfaction',
      value: `${satisfactionPct}%`,
      subtitle: `Based on ${allSessions.length} sessions`,
      icon: Star,
      color: 'from-amber-500 to-amber-600',
    },
  ];

  const conversationsData = useMemo(() => {
    const now = new Date();
    const buckets: { day: string; conversations: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayKey = d.toDateString();
      const count = allSessions.filter((s) => new Date(s.started_at).toDateString() === dayKey).length;
      buckets.push({ day: DAY_LABELS[d.getDay()], conversations: count });
    }
    return buckets;
  }, [allSessions]);

  const resolutionData = useMemo(() => {
    const bot = allSessions.filter((s) => s.handled_by !== 'human').length;
    const human = allSessions.filter((s) => s.handled_by === 'human').length;
    const total = bot + human;
    if (total === 0) return [{ name: 'Bot Resolved', value: 0, color: '#3b82f6' }, { name: 'Human Resolved', value: 0, color: '#f59e0b' }];
    return [
      { name: 'Bot Resolved', value: Math.round((bot / total) * 100), color: '#3b82f6' },
      { name: 'Human Resolved', value: Math.round((human / total) * 100), color: '#f59e0b' },
    ];
  }, [allSessions]);

  const channelData = useMemo(() => {
    const map = new Map<string, number>();
    allSessions.forEach((s) => map.set(s.channel, (map.get(s.channel) ?? 0) + 1));
    return Array.from(map.entries()).map(([channel, chats]) => ({ channel, chats }));
  }, [allSessions]);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back! 👋</h1>
            <p className="text-blue-100 mt-1">Here's what's happening with your chatbots today</p>
          </div>
          <div className="hidden md:flex items-center gap-4 bg-card/10 rounded-xl px-4 py-3">
            <div className="text-center">
              <p className="text-2xl font-bold">{allSessions.length}</p>
              <p className="text-xs text-blue-200">Total chats</p>
            </div>
            <div className="w-px h-10 bg-card/20"></div>
            <div className="text-center">
              <p className="text-2xl font-bold">{resolutionRate}%</p>
              <p className="text-xs text-blue-200">Resolved by bot</p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading dashboard…</p>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {statsCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} className="bg-card border-border shadow-sm hover:shadow-md transition-all rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-foreground" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{stat.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Conversations Chart */}
            <Card className="bg-card border-border shadow-sm rounded-xl lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground">Conversations This Week</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Daily chat volume across all channels</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Last 7 days</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={conversationsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                        formatter={(value: number) => [`${value} chats`, 'Conversations']}
                      />
                      <Line
                        type="monotone"
                        dataKey="conversations"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#3b82f6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Resolution Pie Chart */}
            <Card className="bg-card border-border shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">Who Resolves Chats?</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Bot vs human agent resolution</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={resolutionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {resolutionData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, '']}
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                  {resolutionData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-xs text-muted-foreground">{item.name} ({item.value}%)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Channel Stats */}
          <Card className="bg-card border-border shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">Chats by Channel</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Where your customers are chatting from</p>
            </CardHeader>
            <CardContent>
              {channelData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No chat sessions yet.</p>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={channelData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                      <YAxis dataKey="channel" type="category" stroke="#94a3b8" fontSize={12} width={100} />
                      <Tooltip
                        formatter={(value: number) => [`${value}`, 'Chats']}
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="chats" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
