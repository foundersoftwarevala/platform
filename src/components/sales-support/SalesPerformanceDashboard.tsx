import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Target, Clock, Star, Award, Users, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTeamMembers, useDeals, useCommissions, useTasks, currency } from "@/hooks/useSalesSupportData";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const SalesPerformanceDashboard = () => {
  const { data: members = [], isLoading: membersLoading } = useTeamMembers("sales");
  const { data: deals = [], isLoading: dealsLoading } = useDeals();
  const { data: commissions = [], isLoading: commissionsLoading } = useCommissions();
  const { data: tasks = [] } = useTasks();

  const loading = membersLoading || dealsLoading || commissionsLoading;

  const closedWonDeals = deals.filter((d) => d.stage?.toLowerCase().includes("closed") && d.stage?.toLowerCase().includes("won"));
  const totalRevenue = commissions.reduce((sum, c) => sum + Number(c.revenue ?? 0), 0);
  const revenueTarget = members.reduce((sum, m) => sum + Number(m.target_amount ?? 0), 0) || 1;
  const avgHandleTime = members.length > 0
    ? members.reduce((sum, m) => sum + Number(m.avg_response_minutes ?? 0), 0) / members.length
    : 0;
  const avgCsat = members.length > 0
    ? members.reduce((sum, m) => sum + Number(m.csat ?? 0), 0) / members.length
    : 0;

  const metrics = [
    { label: "Conversions", value: closedWonDeals.length, target: Math.max(deals.length, 1), unit: "", icon: Target, color: "cyan" },
    { label: "Revenue", value: Math.round(totalRevenue), target: Math.round(revenueTarget), unit: "$", icon: DollarSign, color: "emerald" },
    { label: "Avg. Handle Time", value: Number(avgHandleTime.toFixed(1)), target: 5, unit: " min", icon: Clock, color: "amber" },
    { label: "Satisfaction", value: Number(avgCsat.toFixed(1)), target: 5, unit: "/5", icon: Star, color: "purple" },
  ];

  const now = new Date();
  const weeklyData = WEEKDAYS.map((day, idx) => {
    const dayIndex = idx + 1; // Mon=1..Fri=5
    const dayDeals = deals.filter((d) => {
      const created = new Date(d.created_at);
      const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays < 7 && created.getDay() === dayIndex;
    });
    const dayCalls = tasks.filter((t) => {
      if (!t.due_at || t.task_type !== "call") return false;
      const due = new Date(t.due_at);
      const diffDays = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays < 7 && due.getDay() === dayIndex;
    });
    const dayDemos = tasks.filter((t) => {
      if (!t.due_at || t.task_type !== "meeting") return false;
      const due = new Date(t.due_at);
      const diffDays = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays < 7 && due.getDay() === dayIndex;
    });
    return { day, conversions: dayDeals.length, calls: dayCalls.length, demos: dayDemos.length };
  });
  const maxConversions = Math.max(1, ...weeklyData.map((d) => d.conversions));

  const leaderboard = [...members]
    .sort((a, b) => Number(b.achieved_amount ?? 0) - Number(a.achieved_amount ?? 0))
    .slice(0, 4)
    .map((m, index) => ({
      rank: index + 1,
      name: m.full_name,
      conversions: m.leads_handled,
      revenue: currency(m.achieved_amount),
      avatar: m.avatar_initials || m.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
    }));

  const behaviorScore = Math.round((avgCsat / 5) * 100);

  if (loading) {
    return <div className="text-muted-foreground">Loading performance data…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Performance Dashboard</h2>
          <p className="text-muted-foreground">Track your sales metrics and ranking</p>
        </div>
        <Badge className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-2">
          <Award className="w-4 h-4 mr-2" />
          Top Performer This Week
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const percentage = metric.target > 0 ? (metric.value / metric.target) * 100 : 0;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`bg-card/60 border-${metric.color}-500/20`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-5 h-5 text-${metric.color}-400`} />
                    <Badge className={percentage >= 100 ? "bg-emerald-500/20 text-emerald-300" : "bg-muted/40 text-muted-foreground"}>
                      {percentage >= 100 ? "Target Met" : `${Math.round(percentage)}%`}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {metric.unit === "$" ? `$${metric.value.toLocaleString()}` : `${metric.value}${metric.unit}`}
                  </div>
                  <div className="text-xs text-muted-foreground">{metric.label}</div>
                  <Progress value={Math.min(percentage, 100)} className="h-1.5 mt-2 bg-card/60" />
                  <div className="text-xs text-muted-foreground mt-1">
                    Target: {metric.unit === "$" ? `$${metric.target.toLocaleString()}` : `${metric.target}${metric.unit}`}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-cyan-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Weekly Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weeklyData.map((day, index) => (
                <motion.div
                  key={day.day}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4"
                >
                  <span className="w-10 text-muted-foreground text-sm">{day.day}</span>
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1 bg-card/60 rounded-full h-6 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(day.conversions / maxConversions) * 100}%` }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-end pr-2"
                      >
                        <span className="text-xs text-foreground font-medium">{day.conversions}</span>
                      </motion.div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-muted-foreground">{day.calls} calls</span>
                    <span className="text-muted-foreground">{day.demos} demos</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-cyan-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Team Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaderboard.length === 0 && <p className="text-sm text-muted-foreground">No sales team members yet.</p>}
              {leaderboard.map((member, index) => (
                <motion.div
                  key={member.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    member.rank === 1 ? "bg-cyan-500/20 border border-cyan-500/30" : "bg-card/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      member.rank === 1 ? "bg-amber-500 text-foreground" :
                      member.rank === 2 ? "bg-muted/40 text-foreground" :
                      member.rank === 3 ? "bg-amber-700 text-foreground" :
                      "bg-muted/40 text-muted-foreground"
                    }`}>
                      {member.rank}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center text-cyan-300 font-medium text-sm">
                      {member.avatar}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">
                        {member.name}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-400">{member.revenue}</div>
                    <div className="text-xs text-muted-foreground">{member.conversions} conversions</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-purple-900/30 to-cyan-900/30 border-purple-500/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-purple-100">Behavior Score</h3>
                <p className="text-muted-foreground">Based on response time, quality, and customer feedback</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-purple-300">{behaviorScore}</div>
              <div className="text-sm text-muted-foreground">
                {behaviorScore >= 90 ? "Excellent" : behaviorScore >= 70 ? "Good" : "Needs Improvement"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesPerformanceDashboard;
