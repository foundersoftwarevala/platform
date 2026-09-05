/**
 * SCREEN 1: DASHBOARD
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Bot, MessageSquare, Ticket, Clock, ThumbsUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import type { ChatbotScreen } from '../SupportChatbotWireframe';
import {
  useChatbots,
  useChatSessions,
  useTickets,
  useBotConversationLogs,
  useTeamMembers,
} from '@/hooks/useSalesSupportData';

interface SCDashboardProps {
  onNavigate: (screen: ChatbotScreen) => void;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const SCDashboard: React.FC<SCDashboardProps> = ({ onNavigate }) => {
  const { data: bots = [] } = useChatbots();
  const { data: sessions = [] } = useChatSessions();
  const { data: tickets = [] } = useTickets();
  const { data: logs = [] } = useBotConversationLogs();
  const { data: support = [] } = useTeamMembers('support');

  const activeBots = bots.filter((b) => b.status === 'active').length;
  const liveSessions = sessions.filter((s) => s.status === 'active').length;
  const openTickets = tickets.filter((t) => !['resolved', 'closed'].includes(t.status)).length;
  const avgResponse = support.length
    ? Math.round(support.reduce((a, m) => a + (m.avg_response_minutes ?? 0), 0) / support.length)
    : 0;
  const csatValues = tickets.map((t) => t.csat).filter((c): c is number => typeof c === 'number');
  const csat = csatValues.length
    ? Math.round((csatValues.reduce((a, c) => a + c, 0) / (csatValues.length * 5)) * 100)
    : 0;

  const conversationsData = DAYS.map((day, i) => ({
    day,
    chats: sessions.filter((s) => new Date(s.started_at).getDay() === i).length,
  }));

  const botResolved = logs.filter((l) => l.outcome === 'resolved').length;
  const humanResolved = logs.filter((l) => l.outcome !== 'resolved').length;
  const totalResolved = botResolved + humanResolved || 1;
  const resolutionData = [
    { name: 'Bot Resolved', value: Math.round((botResolved / totalResolved) * 100) },
    { name: 'Human Resolved', value: Math.round((humanResolved / totalResolved) * 100) },
  ];

  const stats = [
    { label: 'Active Chatbots', value: String(activeBots), change: `${bots.length} total`, up: true, icon: Bot, color: 'bg-emerald-500/10 text-emerald-600' },
    { label: 'Live Conversations', value: String(liveSessions), change: `${sessions.length} total`, up: true, icon: MessageSquare, color: 'bg-blue-500/10 text-blue-600' },
    { label: 'Open Tickets', value: String(openTickets), change: `${tickets.length} total`, up: false, icon: Ticket, color: 'bg-orange-500/10 text-orange-600' },
    { label: 'Avg Response', value: `${avgResponse}m`, change: 'support team', up: true, icon: Clock, color: 'bg-purple-500/10 text-purple-600' },
    { label: 'CSAT Score', value: `${csat}%`, change: `${csatValues.length} ratings`, up: true, icon: ThumbsUp, color: 'bg-green-500/10 text-green-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Support chatbot overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('chatbots')}>
                <CardContent className="p-4">
                  <div className={`p-2 rounded-lg w-fit ${stat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-end gap-2">
                      <p className="text-xl font-bold">{stat.value}</p>
                      <span className={`text-xs font-medium flex items-center ${stat.up ? 'text-green-600' : 'text-red-500'}`}>
                        {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {stat.change}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversations per Day */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Conversations per Day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={conversationsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chatGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="chats" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#chatGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bot vs Human Resolution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Bot vs Human Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie
                    data={resolutionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {resolutionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {resolutionData.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-lg font-bold">{item.value}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
