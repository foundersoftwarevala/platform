import { motion } from "framer-motion";
import { Users, Plus, Ban, Target, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useTeamMembers, useUpdateRow, useInsertRow, type TeamMember } from "@/hooks/useSalesSupportData";

const SalesTeamModule = () => {
  const { data: repsData, isLoading } = useTeamMembers("sales");
  const updateMember = useUpdateRow("team_members");
  const insertMember = useInsertRow("team_members");
  const reps: TeamMember[] = repsData ?? [];

  const handleAddRep = async () => {
    toast.loading("Adding new sales rep...", { id: "add-rep" });
    try {
      await insertMember.mutateAsync({
        full_name: "New Sales Rep",
        email: `rep${Date.now()}@sales.com`,
        department: "sales",
        role_title: "Sales Rep",
        target_amount: 30000,
        achieved_amount: 0,
        status: "active",
      });
      toast.success("Sales rep added successfully", { id: "add-rep" });
    } catch (e) {
      toast.error("Failed to add rep", { id: "add-rep" });
    }
  };

  const handleSetTarget = async (repId: string, newTarget: number) => {
    toast.loading("Updating target...", { id: `target-${repId}` });
    try {
      await updateMember.mutateAsync({ id: repId, values: { target_amount: newTarget } });
      toast.success(`Target updated to $${newTarget.toLocaleString()}`, { id: `target-${repId}` });
    } catch (e) {
      toast.error("Failed to update target", { id: `target-${repId}` });
    }
  };

  const handleSuspend = async (repId: string) => {
    const rep = reps.find((r) => r.id === repId);
    const newStatus = rep?.status === "active" ? "suspended" : "active";
    toast.loading(`${newStatus === "suspended" ? "Suspending" : "Activating"} rep...`, { id: `suspend-${repId}` });
    try {
      await updateMember.mutateAsync({ id: repId, values: { status: newStatus } });
      toast.success(`Rep ${newStatus}`, { id: `suspend-${repId}` });
    } catch (e) {
      toast.error("Failed to update rep", { id: `suspend-${repId}` });
    }
  };

  const totalTarget = reps.reduce((sum, r) => sum + Number(r.target_amount ?? 0), 0);
  const totalAchieved = reps.reduce((sum, r) => sum + Number(r.achieved_amount ?? 0), 0);
  const avgConversion = reps.length > 0
    ? Math.round(reps.reduce((sum, r) => sum + (r.target_amount > 0 ? (r.achieved_amount / r.target_amount) * 100 : 0), 0) / reps.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Sales Team Management</h2>
          <p className="text-muted-foreground">Manage sales reps, territories, and targets</p>
        </div>
        <Button onClick={handleAddRep} className="bg-emerald-500 hover:bg-emerald-600 text-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Add Sales Rep
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-emerald-100">{reps.filter((r) => r.status === "active").length}</div>
            <div className="text-xs text-muted-foreground">Active Reps</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">${(totalTarget / 1000).toFixed(0)}K</div>
            <div className="text-xs text-muted-foreground">Total Target</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-100">${(totalAchieved / 1000).toFixed(0)}K</div>
            <div className="text-xs text-muted-foreground">Achieved</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{avgConversion}%</div>
            <div className="text-xs text-muted-foreground">Avg Achievement</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100">Sales Team Roster</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm py-6 text-center">Loading reps…</div>
          ) : reps.length === 0 ? (
            <div className="text-muted-foreground text-sm py-6 text-center">No sales reps yet.</div>
          ) : (
            <div className="space-y-3">
              {reps.map((rep, index) => {
                const target = Number(rep.target_amount ?? 0);
                const achieved = Number(rep.achieved_amount ?? 0);
                const pct = target > 0 ? Math.round((achieved / target) * 100) : 0;
                return (
                  <motion.div
                    key={rep.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center justify-between p-4 bg-card/60 rounded-lg hover:bg-card/60 transition-colors ${rep.status === "suspended" ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-emerald-500/20 text-emerald-300">{rep.avatar_initials ?? rep.full_name.split(' ').map((n) => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-cyan-400 text-sm">{rep.id.slice(0, 8)}</span>
                          <span className="font-medium text-foreground">{rep.full_name}</span>
                          <Badge className={rep.status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}>{rep.status}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {rep.role_title} • {rep.leads_handled} leads • CSAT {rep.csat}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-48">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Target Progress</span>
                          <span className="text-emerald-400">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-muted-foreground">${achieved.toLocaleString()}</span>
                          <span className="text-muted-foreground">${target.toLocaleString()}</span>
                        </div>
                      </div>

                      <Input
                        type="number"
                        defaultValue={target}
                        className="w-28 bg-muted/40 border-border"
                        onBlur={(e) => handleSetTarget(rep.id, parseInt(e.target.value) || target)}
                      />

                      <Button size="sm" variant={rep.status === "active" ? "destructive" : "default"} onClick={() => handleSuspend(rep.id)}>
                        {rep.status === "active" ? <Ban className="w-4 h-4" /> : "Activate"}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesTeamModule;
