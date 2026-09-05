import { motion } from "framer-motion";
import { Users, Plus, Ban, Eye, Clock, CheckCircle, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMembers, useUpdateRow, useInsertRow, type TeamMember } from "@/hooks/useSalesSupportData";

const SupportTeamModule = () => {
  const { data: agentsData, isLoading } = useTeamMembers("support");
  const updateMember = useUpdateRow("team_members");
  const insertMember = useInsertRow("team_members");
  const agents: TeamMember[] = agentsData ?? [];

  const handleAddAgent = async () => {
    toast.loading("Adding new agent...", { id: "add-agent" });
    try {
      await insertMember.mutateAsync({
        full_name: "New Agent",
        email: `agent${Date.now()}@support.com`,
        department: "support",
        role_title: "Agent",
        shift: "Morning",
        status: "offline",
      });
      toast.success("Agent added successfully", { id: "add-agent" });
    } catch (e) {
      toast.error("Failed to add agent", { id: "add-agent" });
    }
  };

  const handleAssignRole = async (agentId: string, newRole: string) => {
    toast.loading("Updating role...", { id: `role-${agentId}` });
    try {
      await updateMember.mutateAsync({ id: agentId, values: { role_title: newRole } });
      toast.success(`Role updated to ${newRole}`, { id: `role-${agentId}` });
    } catch (e) {
      toast.error("Failed to update role", { id: `role-${agentId}` });
    }
  };

  const handleChangeShift = async (agentId: string, newShift: string) => {
    toast.loading("Updating shift...", { id: `shift-${agentId}` });
    try {
      await updateMember.mutateAsync({ id: agentId, values: { shift: newShift } });
      toast.success(`Shift updated to ${newShift}`, { id: `shift-${agentId}` });
    } catch (e) {
      toast.error("Failed to update shift", { id: `shift-${agentId}` });
    }
  };

  const handleSuspend = async (agentId: string) => {
    toast.loading("Suspending agent...", { id: `suspend-${agentId}` });
    try {
      await updateMember.mutateAsync({ id: agentId, values: { status: "offline" } });
      toast.success("Agent suspended", { id: `suspend-${agentId}` });
    } catch (e) {
      toast.error("Failed to suspend agent", { id: `suspend-${agentId}` });
    }
  };

  const handleViewActivity = (agentId: string) => {
    toast.info(`Viewing activity for ${agentId}`, { description: "Activity log opened" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-emerald-500/20 text-emerald-300";
      case "busy": return "bg-amber-500/20 text-amber-300";
      case "break": return "bg-blue-500/20 text-blue-300";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Support Team Management</h2>
          <p className="text-muted-foreground">Manage agents, roles, shifts and workload distribution</p>
        </div>
        <Button onClick={handleAddAgent} className="bg-cyan-500 hover:bg-cyan-600 text-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Add Agent
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-emerald-100">{agents.filter((a) => a.status === "online").length}</div>
            <div className="text-xs text-muted-foreground">Online Agents</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-100">{agents.reduce((sum, a) => sum + (a.tickets_handled ?? 0), 0)}</div>
            <div className="text-xs text-muted-foreground">Active Tickets</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">{agents.reduce((sum, a) => sum + (a.tickets_handled ?? 0), 0)}</div>
            <div className="text-xs text-muted-foreground">Resolved Today</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <UserCog className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{agents.length}</div>
            <div className="text-xs text-muted-foreground">Total Agents</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100">Agent Roster</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm py-6 text-center">Loading agents…</div>
          ) : agents.length === 0 ? (
            <div className="text-muted-foreground text-sm py-6 text-center">No agents yet.</div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent, index) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-card/60 rounded-lg hover:bg-card/60 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-cyan-500/20 text-cyan-300">{agent.avatar_initials ?? agent.full_name.split(' ').map((n) => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-400 text-sm">{agent.id.slice(0, 8)}</span>
                        <span className="font-medium text-foreground">{agent.full_name}</span>
                        <Badge className={getStatusColor(agent.status)}>{agent.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{agent.email} • {agent.role_title} • {agent.shift} Shift</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right mr-4">
                      <div className="text-sm text-muted-foreground">{agent.tickets_handled} tickets • CSAT {agent.csat}%</div>
                      <div className="text-xs text-muted-foreground">Avg: {agent.avg_response_minutes} min</div>
                    </div>

                    <Select value={agent.role_title} onValueChange={(v) => handleAssignRole(agent.id, v)}>
                      <SelectTrigger className="w-32 bg-muted/40 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Junior Agent">Junior Agent</SelectItem>
                        <SelectItem value="Agent">Agent</SelectItem>
                        <SelectItem value="Senior Agent">Senior Agent</SelectItem>
                        <SelectItem value="Team Lead">Team Lead</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={agent.shift} onValueChange={(v) => handleChangeShift(agent.id, v)}>
                      <SelectTrigger className="w-28 bg-muted/40 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Morning">Morning</SelectItem>
                        <SelectItem value="Afternoon">Afternoon</SelectItem>
                        <SelectItem value="Night">Night</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button size="sm" variant="ghost" onClick={() => handleViewActivity(agent.id)} className="text-cyan-400">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleSuspend(agent.id)} className="text-red-400 hover:text-red-300">
                      <Ban className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportTeamModule;
