import { motion } from "framer-motion";
import {
  Users,
  Trophy,
  XCircle,
  Clock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLeads, useDeals, useTasks, currency, relativeTime } from "@/hooks/useSalesSupportData";

const isToday = (iso: string | null | undefined) => {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
};

const funnelStages = [
  { stage: "Leads", stages: ["new", "contacted", "qualified", "proposal", "negotiation"] },
  { stage: "Contacted", stages: ["contacted", "qualified", "proposal", "negotiation"] },
  { stage: "Qualified", stages: ["qualified", "proposal", "negotiation"] },
  { stage: "Proposal", stages: ["proposal", "negotiation"] },
  { stage: "Closed", stages: ["negotiation"] },
];

const funnelColors = ["bg-blue-500", "bg-indigo-500", "bg-purple-500", "bg-pink-500", "bg-green-500"];

const SalesCRMDashboard = () => {
  const { data: leads } = useLeads();
  const { data: deals } = useDeals();
  const { data: tasks } = useTasks();

  const allLeads = leads ?? [];
  const allDeals = deals ?? [];
  const allTasks = tasks ?? [];

  const newLeadsToday = allLeads.filter(l => isToday(l.created_at)).length;
  const dealsWon = allDeals.filter(d => d.stage === "closed");
  const dealsWonValue = dealsWon.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
  const dealsLost = 0; // no lost stage tracked in schema
  const pendingFollowups = allTasks.filter(t => t.status !== "completed").length;

  const stats = [
    { label: "New Leads Today", value: String(newLeadsToday), icon: Users, color: "blue" },
    { label: "Deals Won", value: currency(dealsWonValue), icon: Trophy, color: "green" },
    { label: "Deals Lost", value: String(dealsLost), icon: XCircle, color: "red" },
    { label: "Pending Follow-ups", value: String(pendingFollowups), icon: Clock, color: "orange" },
  ];

  const funnelData = funnelStages.map((f, i) => {
    const count = allLeads.filter(l => f.stages.includes(l.stage)).length;
    return { stage: f.stage, count, color: funnelColors[i] };
  });
  const maxFunnel = Math.max(1, funnelData[0]?.count ?? 1);

  const recentLeads = [...allLeads]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  const totalTarget = allDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0) || 1;
  const achieved = dealsWonValue;
  const progressPct = Math.min(100, Math.round((achieved / totalTarget) * 100));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your sales overview.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Calendar className="w-4 h-4" />
            This Month
          </Button>
          <Button className="gap-2 bg-blue-500 hover:bg-blue-600">
            <Users className="w-4 h-4" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-border hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${
                    stat.color === 'blue' ? 'bg-blue-100' :
                    stat.color === 'green' ? 'bg-green-100' :
                    stat.color === 'red' ? 'bg-red-100' : 'bg-orange-100'
                  }`}>
                    <stat.icon className={`w-6 h-6 ${
                      stat.color === 'blue' ? 'text-blue-600' :
                      stat.color === 'green' ? 'text-green-600' :
                      stat.color === 'red' ? 'text-red-600' : 'text-orange-600'
                    }`} />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Funnel */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Target className="w-5 h-5 text-blue-500" />
              Sales Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelData.map((item, index) => {
                const pct = Math.round((item.count / maxFunnel) * 100);
                return (
                  <motion.div
                    key={item.stage}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{item.stage}</span>
                      <span className="text-sm text-muted-foreground">{item.count} ({pct}%)</span>
                    </div>
                    <div className="h-8 bg-surface-2 rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: index * 0.1 }}
                        className={`h-full ${item.color} flex items-center justify-end pr-3`}
                      >
                        <span className="text-xs font-medium text-foreground">{item.count}</span>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Leads */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-foreground">
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Recent Leads
              </span>
              <Button variant="ghost" size="sm" className="text-blue-600">View All</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLeads.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No leads yet.</p>
              ) : recentLeads.map((lead, index) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-foreground font-medium">
                    {lead.contact_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{lead.contact_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.source} • {relativeTime(lead.created_at)}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    lead.stage === 'new' ? 'bg-blue-100 text-blue-600' :
                    lead.stage === 'contacted' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-600'
                  }`}>
                    {lead.stage}
                  </span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Target */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Monthly Sales Target
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Progress</span>
                <span className="text-sm font-medium text-foreground">{currency(achieved)} / {currency(totalTarget)}</span>
              </div>
              <Progress value={progressPct} className="h-4 bg-surface-3" />
              <p className="text-sm text-muted-foreground mt-2">{progressPct}% achieved</p>
            </div>
            <div className="text-center px-8 border-l border-border">
              <p className="text-4xl font-bold text-green-600">{currency(achieved)}</p>
              <p className="text-sm text-muted-foreground mt-1">Sales This Period</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesCRMDashboard;
