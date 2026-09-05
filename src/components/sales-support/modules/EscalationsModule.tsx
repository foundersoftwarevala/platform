import { motion } from "framer-motion";
import { AlertCircle, ArrowUp, Clock, CheckCircle, User, Shield, AlertTriangle, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useEscalations, useTickets, useTeamMembers, useUpdateRow, relativeTime, memberName } from "@/hooks/useSalesSupportData";

const EscalationsModule = () => {
  const { data: escalationsData, isLoading } = useEscalations();
  const { data: ticketsData } = useTickets();
  const { data: members } = useTeamMembers();
  const updateEscalation = useUpdateRow("support_escalations");

  const escalations = escalationsData ?? [];
  const tickets = ticketsData ?? [];
  const handlers = members ?? [];

  const ticketFor = (id: string | null) => tickets.find(t => t.id === id);

  const handleAssign = async (escalationId: string, handlerId: string) => {
    toast.loading("Assigning escalation...", { id: `assign-${escalationId}` });
    try {
      await updateEscalation.mutateAsync({ id: escalationId, values: { assigned_to: handlerId, status: "in_progress" } });
      toast.success(`Assigned to ${memberName(handlers, handlerId) ?? "handler"}`, { id: `assign-${escalationId}` });
    } catch {
      toast.error("Failed to assign", { id: `assign-${escalationId}` });
    }
  };

  const handleEscalateUp = async (escalationId: string) => {
    const esc = escalations.find(e => e.id === escalationId);
    if (!esc || esc.level >= 3) return;
    toast.loading("Escalating to next level...", { id: `escalate-${escalationId}` });
    try {
      await updateEscalation.mutateAsync({ id: escalationId, values: { level: esc.level + 1, assigned_to: null } });
      toast.warning(`Escalated to Level ${esc.level + 1}`, { id: `escalate-${escalationId}` });
    } catch {
      toast.error("Failed to escalate", { id: `escalate-${escalationId}` });
    }
  };

  const handleResolve = async (escalationId: string) => {
    toast.loading("Resolving escalation...", { id: `resolve-${escalationId}` });
    try {
      await updateEscalation.mutateAsync({ id: escalationId, values: { status: "resolved" } });
      toast.success("Escalation resolved", { id: `resolve-${escalationId}` });
    } catch {
      toast.error("Failed to resolve", { id: `resolve-${escalationId}` });
    }
  };

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
      case 2: return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case 3: return "bg-red-500/20 text-red-300 border-red-500/30";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const priorityFromLevel = (level: number) => (level >= 3 ? "critical" : level === 2 ? "high" : "medium");

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-500/20 text-red-300";
      case "high": return "bg-amber-500/20 text-amber-300";
      default: return "bg-blue-500/20 text-blue-300";
    }
  };

  const pendingCount = escalations.filter(e => e.status === "pending").length;
  const criticalCount = escalations.filter(e => e.level >= 3 && e.status !== "resolved").length;
  const level3Count = escalations.filter(e => e.level === 3 && e.status !== "resolved").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Escalation Management</h2>
          <p className="text-muted-foreground">Track and manage escalated issues with SLA enforcement</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <AlertCircle className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">{escalations.filter(e => e.status !== "resolved").length}</div>
            <div className="text-xs text-muted-foreground">Active Escalations</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-100">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">Pending Assignment</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-red-500/20">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-100">{criticalCount}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <Shield className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{level3Count}</div>
            <div className="text-xs text-muted-foreground">Level 3 (Management)</div>
          </CardContent>
        </Card>
      </div>

      {/* Escalations List */}
      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100">Escalation Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading && <p className="text-muted-foreground text-sm">Loading escalations…</p>}
            {!isLoading && escalations.length === 0 && <p className="text-muted-foreground text-sm">No escalations.</p>}
            {escalations.map((esc, index) => {
              const priority = priorityFromLevel(esc.level);
              const ticket = ticketFor(esc.ticket_id);
              const assignedName = memberName(handlers, esc.assigned_to);
              return (
                <motion.div
                  key={esc.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 bg-card/60 rounded-lg hover:bg-card/60 transition-colors ${priority === "critical" ? "border-l-4 border-red-500" : ""}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-cyan-400 text-sm">{esc.reference}</span>
                      <Badge className={getLevelColor(esc.level)}>Level {esc.level}</Badge>
                      <Badge className={getPriorityColor(priority)}>{priority}</Badge>
                      {ticket && <Badge variant="outline" className="text-muted-foreground">TICKET: {ticket.reference}</Badge>}
                    </div>
                  </div>

                  <div className="mb-3">
                    <h4 className="font-medium text-foreground">{ticket?.subject ?? esc.reason}</h4>
                    <p className="text-sm text-muted-foreground">{ticket?.customer_name ?? "-"} • {relativeTime(esc.created_at)} • {assignedName || "Unassigned"}</p>
                    <p className="text-sm text-amber-400/80 mt-1">Reason: {esc.reason}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge className={esc.status === "resolved" ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-500/20 text-blue-300"}>
                      {esc.status.replace('_', ' ')}
                    </Badge>

                    <div className="flex items-center gap-2">
                      {esc.status !== "resolved" && !esc.assigned_to && (
                        <Select onValueChange={(handler) => handleAssign(esc.id, handler)}>
                          <SelectTrigger className="w-40 bg-muted/40 border-border">
                            <SelectValue placeholder="Assign handler" />
                          </SelectTrigger>
                          <SelectContent>
                            {handlers.map(handler => (
                              <SelectItem key={handler.id} value={handler.id}>{handler.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {esc.status !== "resolved" && esc.level < 3 && (
                        <Button size="sm" variant="outline" onClick={() => handleEscalateUp(esc.id)} className="border-red-500/30 text-red-300">
                          <ArrowUp className="w-3 h-3 mr-1" />
                          Level {esc.level + 1}
                        </Button>
                      )}

                      {esc.status !== "resolved" && (
                        <Button size="sm" onClick={() => handleResolve(esc.id)} className="bg-emerald-500 hover:bg-emerald-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Auto-Escalation Info */}
      <Card className="bg-gradient-to-r from-amber-900/30 to-red-900/30 border-amber-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="font-medium text-amber-100">Auto-Escalation Rules Active</h3>
              <p className="text-sm text-muted-foreground">Issues unresolved past SLA automatically escalate. Level 3 notifies management.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EscalationsModule;
