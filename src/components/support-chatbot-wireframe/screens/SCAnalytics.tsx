/**
 * SCREEN 6: ANALYTICS
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Download, TrendingUp, TrendingDown, Bot, User, ThumbsUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { toast } from 'sonner';

const analyticsData = [
  { date: 'Jan 10', totalChats: 145, botResolved: 98, humanResolved: 47, csat: 92 },
  { date: 'Jan 11', totalChats: 167, botResolved: 112, humanResolved: 55, csat: 89 },
  { date: 'Jan 12', totalChats: 189, botResolved: 134, humanResolved: 55, csat: 94 },
  { date: 'Jan 13', totalChats: 156, botResolved: 108, humanResolved: 48, csat: 91 },
  { date: 'Jan 14', totalChats: 198, botResolved: 145, humanResolved: 53, csat: 95 },
  { date: 'Jan 15', totalChats: 223, botResolved: 167, humanResolved: 56, csat: 93 },
  { date: 'Jan 16', totalChats: 234, botResolved: 178, humanResolved: 56, csat: 96 },
];

const chartData = analyticsData.map(d => ({
  ...d,
  botRate: Math.round((d.botResolved / d.totalChats) * 100),
}));

export const SCAnalytics: React.FC = () => {
  const totals = analyticsData.reduce(
    (acc, d) => ({
      chats: acc.chats + d.totalChats,
      bot: acc.bot + d.botResolved,
      human: acc.human + d.humanResolved,
    }),
    { chats: 0, bot: 0, human: 0 }
  );

  const avgCsat = Math.round(analyticsData.reduce((a, d) => a + d.csat, 0) / analyticsData.length);
  const botRate = Math.round((totals.bot / totals.chats) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Performance metrics & insights</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => toast.success('Report exported')}>
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Chats', value: totals.chats.toLocaleString(), change: '+12%', up: true, icon: TrendingUp },
          { label: 'Bot Resolved', value: `${botRate}%`, change: '+5%', up: true, icon: Bot },
          { label: 'Human Resolved', value: `${100 - botRate}%`, change: '-5%', up: true, icon: User },
          { label: 'Avg CSAT', value: `${avgCsat}%`, change: '+2%', up: true, icon: ThumbsUp },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <span className={`text-xs font-medium flex items-center gap-1 ${stat.up ? 'text-green-600' : 'text-red-500'}`}>
                    {stat.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resolution Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="totalChats" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Total Chats" />
                <Line type="monotone" dataKey="botResolved" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="Bot Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold text-right">Total Chats</TableHead>
                <TableHead className="font-semibold text-right">Bot Resolved</TableHead>
                <TableHead className="font-semibold text-right">Human Resolved</TableHead>
                <TableHead className="font-semibold text-right">CSAT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyticsData.map((row, index) => (
                <motion.tr
                  key={row.date}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-muted/50"
                >
                  <TableCell className="font-medium">{row.date}</TableCell>
                  <TableCell className="text-right">{row.totalChats}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      {row.botResolved}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                      {row.humanResolved}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={row.csat >= 90 ? 'default' : 'secondary'}>
                      {row.csat}%
                    </Badge>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
