import { motion } from "framer-motion";
import { Ticket, Plus, ArrowUp, CheckCircle, RotateCcw, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useTickets, useTeamMembers, useUpdateRow, useInsertRow, relativeTime, memberName, type SupportTicket } from "@/hooks/useSalesSupportData";

const SupportTicketsModule = () => {
  const { data: ticketsData, isLoading } = useTickets();
  const { data: agentsData } = useTeamMembers("support");
  const updateTicket = useUpdateRow("support_tickets");
  const insertTicket = useInsertRow("support_tickets");
  const tickets: SupportTicket[] = ticketsData ?? [];
  const agents = agentsData ?? [];

  const nextReference = () => {
    const nums = tickets
      .map((t) => parseInt(t.reference?.replace(/\D/g, "") ?? "0", 10))
      .filter((n) => !Number.isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `TKT-${String(max + 1).padStart(3, "0")}`;
  };

  const handleCreateTicket = async () => {
    toast.loading("Creating ticket...", { id: "create-ticket" });
    try {
      await insertTicket.mutateAsync({
        reference: nextReference(),
        subject: "New Support Request",
        customer_name: "New Customer",
        priority: "medium",
        status: "new",
        category: "General",
      });
      toast.success("Ticket created", { id: "create-ticket" });
    } catch (e) {
      toast.error("Failed to create ticket", { id: "create-ticket" });
    }
  };

  const handleAssign = async (ticketId: string, agentId: string) => {
    toast.loading("Assigning ticket...", { id: `assign-${ticketId}` });
    try {
      await updateTicket.mutateAsync({ id: ticketId, values: { assigned_to: agentId, status: "assigned" } });
      toast.success(`Assigned to ${memberName(agents, agentId) ?? "agent"}`, { id: `assign-${ticketId}` });
    } catch (e) {
      toast.error("Failed to assign ticket", { id: `assign-${ticketId}` });
    }
  };

  const handleReassign = async (ticketId: string, agentId: string) => {
    toast.loading("Reassigning ticket...", { id: `reassign-${ticketId}` });
    try {
      await updateTicket.mutateAsync({ id: ticketId, values: { assigned_to: agentId } });
      toast.success(`Reassigned to ${memberName(agents, agentId) ?? "agent"}`, { id: `reassign-${ticketId}` });
    } catch (e) {
      toast.error("Failed to reassign ticket", { id: `reassign-${ticketId}` });
    }
  };

  const handleEscalate = async (ticketId: string) => {
    toast.loading("Escalating ticket...", { id: `escalate-${ticketId}` });
    try {
      await updateTicket.mutateAsync({ id: ticketId, values: { priority: "critical" } });
      toast.warning("Ticket escalated to critical", { id: `escalate-${ticketId}` });
    } catch (e) {
      toast.error("Failed to escalate ticket", { id: `escalate-${ticketId}` });
    }
  };

  const handleResolve = async (ticketId: string) => {
    toast.loading("Resolving ticket...", { id: `resolve-${ticketId}` });
    try {
      await updateTicket.mutateAsync({
        id: ticketId,
        values: { status: "resolved", sla_minutes_remaining: 0, resolved_at: new Date().toISOString() },
      });
      toast.success("Ticket resolved", { id: `resolve-${ticketId}` });
    } catch (e) {
      toast.error("Failed to resolve ticket", { id: `resolve-${ticketId}` });
    }
  };

  const handleReopen = async (ticketId: string) => {
    toast.loading("Reopening ticket...", { id: `reopen-${ticketId}` });
    try {
      await updateTicket.mutateAsync({ id: ticketId, values: { status: "in_progress", sla_minutes_remaining: 60, resolved_at: null } });
      toast.info("Ticket reopened", { id: `reopen-${ticketId}` });
    } catch (e) {
      toast.error("Failed to reopen ticket", { id: `reopen-${ticketId}` });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-500/20 text-red-300 border-red-500/30";
      case "high": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "medium": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-purple-500/20 text-purple-300";
      case "assigned": return "bg-blue-500/20 text-blue-300";
      case "in_progress": return "bg-amber-500/20 text-amber-300";
      case "waiting": return "bg-muted/40 text-muted-foreground";
      case "resolved": return "bg-emerald-500/20 text-emerald-300";
      case "closed": return "bg-muted/40 text-muted-foreground";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const openTickets = tickets.filter((t) => !["resolved", "closed"].includes(t.status));
  const criticalCount = tickets.filter((t) => t.priority === "critical" && t.status !== "resolved").length;
  const slaBreach = tickets.filter((t) => t.sla_minutes_remaining < 30 && t.status !== "resolved").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Support Tickets</h2>
          <p className="text-muted-foreground">Manage ticket lifecycle with SLA tracking</p>
        </div>
        <Button onClick={handleCreateTicket} className="bg-cyan-500 hover:bg-cyan-600 text-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Create Ticket
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <Ticket className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">{openTickets.length}</div>
            <div className="text-xs text-muted-foreground">Open Tickets</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-red-500/20">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-100">{criticalCount}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-100">{slaBreach}</div>
            <div className="text-xs text-muted-foreground">SLA Risk</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-emerald-100">{tickets.filter((t) => t.status === "resolved").length}</div>
            <div className="text-xs text-muted-foreground">Resolved Today</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100">Ticket Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm py-6 text-center">Loading tickets…</div>
          ) : tickets.length === 0 ? (
            <div className="text-muted-foreground text-sm py-6 text-center">No tickets yet.</div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket, index) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 bg-card/60 rounded-lg hover:bg-card/60 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-cyan-400 text-sm">{ticket.reference}</span>
                      <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                      <Badge className={getStatusColor(ticket.status)}>{ticket.status.replace('_', ' ')}</Badge>
                      <Badge variant="outline" className="text-muted-foreground">{ticket.category}</Badge>
                    </div>
                    {ticket.status !== "resolved" && ticket.status !== "closed" && (
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${ticket.sla_minutes_remaining < 30 ? "text-red-400" : "text-amber-400"}`} />
                        <span className={ticket.sla_minutes_remaining < 30 ? "text-red-300" : "text-amber-300"}>{ticket.sla_minutes_remaining} min</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-foreground">{ticket.subject}</h4>
                      <p className="text-sm text-muted-foreground">{ticket.customer_name} • {relativeTime(ticket.created_at)} • {memberName(agents, ticket.assigned_to) || "Unassigned"}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {ticket.status === "new" && (
                        <Select onValueChange={(agent) => handleAssign(ticket.id, agent)}>
                          <SelectTrigger className="w-36 bg-muted/40 border-border">
                            <SelectValue placeholder="Assign to..." />
                          </SelectTrigger>
                          <SelectContent>
                            {agents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {ticket.assigned_to && ticket.status !== "resolved" && (
                        <Select onValueChange={(agent) => handleReassign(ticket.id, agent)}>
                          <SelectTrigger className="w-36 bg-muted/40 border-border">
                            <SelectValue placeholder="Reassign..." />
                          </SelectTrigger>
                          <SelectContent>
                            {agents.filter((a) => a.id !== ticket.assigned_to).map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {ticket.status !== "resolved" && ticket.priority !== "critical" && (
                        <Button size="sm" variant="outline" onClick={() => handleEscalate(ticket.id)} className="border-amber-500/30 text-amber-300">
                          <ArrowUp className="w-3 h-3 mr-1" />
                          Escalate
                        </Button>
                      )}

                      {ticket.status !== "resolved" && ticket.status !== "closed" && (
                        <Button size="sm" onClick={() => handleResolve(ticket.id)} className="bg-emerald-500 hover:bg-emerald-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Resolve
                        </Button>
                      )}

                      {ticket.status === "resolved" && (
                        <Button size="sm" variant="outline" onClick={() => handleReopen(ticket.id)} className="border-cyan-500/30 text-cyan-300">
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>

                  {ticket.status !== "resolved" && ticket.status !== "closed" && (
                    <div className="mt-3">
                      <Progress value={Math.max(0, 100 - (ticket.sla_minutes_remaining / 120) * 100)} className="h-1" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportTicketsModule;
