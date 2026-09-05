import { motion } from "framer-motion";
import { Wallet, DollarSign, TrendingUp, Award, Calendar, Target, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCommissions, useTeamMembers, memberName, currency } from "@/hooks/useSalesSupportData";

const CommissionBoard = () => {
  const { data: commissionsData, isLoading } = useCommissions();
  const { data: members } = useTeamMembers();

  const commissions = commissionsData ?? [];
  const team = members ?? [];

  const totalEarned = commissions.reduce((sum, c) => sum + Number(c.earned ?? 0), 0);
  const totalPending = commissions
    .filter(c => c.status === "pending" || c.status === "processing")
    .reduce((sum, c) => sum + (Number(c.earned ?? 0) - Number(c.paid ?? 0)), 0);
  const totalDeals = commissions.reduce((sum, c) => sum + (c.deals_closed ?? 0), 0);
  const avgRate = commissions.length
    ? (commissions.reduce((sum, c) => sum + Number(c.commission_rate ?? 0), 0) / commissions.length)
    : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "pending": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "processing": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const milestones = [
    { name: "5 Sales", reward: "$250 Bonus", target: 5 },
    { name: "10 Sales", reward: "$600 Bonus", target: 10 },
    { name: "20 Sales", reward: "1% Extra Commission", target: 20 },
    { name: "40 Sales", reward: "VIP Status + $1000", target: 40 },
  ].map(m => ({
    ...m,
    progress: Math.min(100, Math.round((totalDeals / m.target) * 100)),
    achieved: totalDeals >= m.target,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Commission Board</h2>
          <p className="text-muted-foreground">Track earnings, payouts, and incentive milestones</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-900/50 to-cyan-900/50 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-100">{currency(totalEarned)}</div>
                <div className="text-xs text-muted-foreground">Total Earned</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-cyan-100">{currency(totalPending)}</div>
                <div className="text-xs text-muted-foreground">Pending Payout</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-100">{totalDeals}</div>
                <div className="text-xs text-muted-foreground">Deals Closed</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Target className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-100">{avgRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Avg Commission Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-cyan-100 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-cyan-400" />
              Recent Commissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading && <p className="text-muted-foreground text-sm">Loading commissions…</p>}
              {!isLoading && commissions.length === 0 && <p className="text-muted-foreground text-sm">No commission records.</p>}
              {commissions.map((commission, index) => (
                <motion.div
                  key={commission.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-card/60 rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-cyan-400 text-sm">{commission.id.slice(0, 8)}</span>
                      <span className="font-medium text-foreground">{memberName(team, commission.member_id) ?? "Unassigned"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{commission.period}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-emerald-400">{currency(commission.earned)}</span>
                    <Badge className={getStatusBadge(commission.status)}>{commission.status}</Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-cyan-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-cyan-400" />
              Incentive Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {milestones.map((milestone, index) => (
              <motion.div
                key={milestone.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-lg ${milestone.achieved ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-card/60"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {milestone.achieved ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className={`font-medium ${milestone.achieved ? "text-emerald-300" : "text-foreground"}`}>
                      {milestone.name}
                    </span>
                  </div>
                  <Badge className={milestone.achieved ? "bg-emerald-500/20 text-emerald-300" : "bg-muted/40 text-muted-foreground"}>
                    {milestone.reward}
                  </Badge>
                </div>
                <Progress value={milestone.progress} className="h-2 bg-card/60" />
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className={milestone.achieved ? "text-emerald-400" : "text-cyan-400"}>{milestone.progress}%</span>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CommissionBoard;
