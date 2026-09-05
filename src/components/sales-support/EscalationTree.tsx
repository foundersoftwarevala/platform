import { motion } from "framer-motion";
import { AlertCircle, ArrowUp, Clock, User, Users, Shield, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useEscalations, useTickets, useUpdateRow, relativeTime } from "@/hooks/useSalesSupportData";

const escalationLevels = [
  { level: 1, name: "Sales Support", handler: "Frontline Team", responseTime: "15 min", icon: User, color: "cyan" },
  { level: 2, name: "Franchise Manager", handler: "Regional Lead", responseTime: "30 min", icon: Users, color: "amber" },
  { level: 3, name: "Super Admin", handler: "HQ Team", responseTime: "1 hour", icon: Shield, color: "red" },
];

const EscalationTree = () => {
  const { data: escalationsData, isLoading } = useEscalations();
  const { data: ticketsData } = useTickets();
  const updateEscalation = useUpdateRow("support_escalations");

  const escalations = escalationsData ?? [];
  const tickets = ticketsData ?? [];
  const ticketFor = (id: string | null) => tickets.find(t => t.id === id);

  const handleResolve = async (id: string) => {
    toast.loading("Resolving escalation...", { id: `resolve-${id}` });
    try {
      await updateEscalation.mutateAsync({ id, values: { status: "resolved" } });
      toast.success("Escalation resolved", { id: `resolve-${id}` });
    } catch {
      toast.error("Failed to resolve", { id: `resolve-${id}` });
    }
  };

  const handleEscalateUp = async (id: string, level: number) => {
    if (level >= 3) return;
    toast.loading("Escalating...", { id: `up-${id}` });
    try {
      await updateEscalation.mutateAsync({ id, values: { level: level + 1 } });
      toast.warning(`Escalated to Level ${level + 1}`, { id: `up-${id}` });
    } catch {
      toast.error("Failed to escalate", { id: `up-${id}` });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_progress": return "bg-amber-500/20 text-amber-300";
      case "pending": return "bg-blue-500/20 text-blue-300";
      case "resolved": return "bg-emerald-500/20 text-emerald-300";
      default: return "bg-muted/40 text-muted-foreground";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Escalation Tree</h2>
          <p className="text-muted-foreground">Multi-level support escalation with auto-timers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {escalationLevels.map((level, index) => {
          const Icon = level.icon;
          const countAtLevel = escalations.filter(e => e.level === level.level && e.status !== "resolved").length;
          return (
            <motion.div
              key={level.level}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`bg-card/60 border-${level.color}-500/30 relative overflow-hidden`}>
                <div className={`absolute top-0 left-0 w-1 h-full bg-${level.color}-500`} />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={`bg-${level.color}-500/20 text-${level.color}-300`}>Level {level.level}</Badge>
                    <span className="text-xs text-muted-foreground">{countAtLevel} active</span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg bg-${level.color}-500/20 flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 text-${level.color}-400`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{level.name}</h3>
                      <p className="text-xs text-muted-foreground">{level.handler}</p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Response Time: <span className={`text-${level.color}-400`}>{level.responseTime}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-cyan-400" />
            Active Escalations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading && <p className="text-muted-foreground text-sm">Loading escalations…</p>}
            {!isLoading && escalations.length === 0 && <p className="text-muted-foreground text-sm">No escalations recorded.</p>}
            {escalations.map((escalation, index) => {
              const ticket = ticketFor(escalation.ticket_id);
              return (
                <motion.div
                  key={escalation.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-card/60 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-cyan-400 text-sm">{escalation.reference}</span>
                      <Badge className={getLevelColor(escalation.level)}>Level {escalation.level}</Badge>
                      <Badge className={getStatusBadge(escalation.status)}>{escalation.status.replace('_', ' ')}</Badge>
                    </div>
                    {escalation.status !== "resolved" && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-300">{relativeTime(escalation.created_at)}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-foreground mb-3">{ticket?.subject ?? escalation.reason}</p>

                  {escalation.status !== "resolved" && (
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <Progress value={escalation.status === "in_progress" ? 60 : 30} className="h-2 bg-muted/40" />
                      </div>
                      <div className="flex gap-2">
                        {escalation.level < 3 && (
                          <Button size="sm" variant="outline" onClick={() => handleEscalateUp(escalation.id, escalation.level)} className="border-amber-500/30 text-amber-300">
                            <ArrowUp className="w-3 h-3 mr-1" />
                            Escalate
                          </Button>
                        )}
                        <Button size="sm" onClick={() => handleResolve(escalation.id)} className="bg-emerald-500 hover:bg-emerald-600 text-foreground">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Resolve
                        </Button>
                      </div>
                    </div>
                  )}

                  {escalation.status === "resolved" && (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Resolved successfully</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-amber-900/30 to-red-900/30 border-amber-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="font-medium text-amber-100">Auto-Escalation Rules</h3>
              <p className="text-sm text-muted-foreground">Issues unresolved after 15 minutes will automatically escalate to the next level</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EscalationTree;
