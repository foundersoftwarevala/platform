import { motion } from "framer-motion";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, UserPlus, Ticket, ArrowUp, CheckCircle, Clock, Mic } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCallLogs, useTeamMembers, useUpdateRow, relativeTime, memberName } from "@/hooks/useSalesSupportData";

const CallCenterModule = () => {
  const { data: callsData, isLoading } = useCallLogs();
  const { data: members } = useTeamMembers();
  const updateCall = useUpdateRow("call_logs");

  const calls = callsData ?? [];
  const agents = members ?? [];

  const handleAssignCallback = async (callId: string, agentId: string) => {
    toast.loading("Assigning callback...", { id: `callback-${callId}` });
    try {
      await updateCall.mutateAsync({ id: callId, values: { agent_id: agentId, status: "callback_pending" } });
      toast.success(`Callback assigned to ${memberName(agents, agentId) ?? "agent"}`, { id: `callback-${callId}` });
    } catch (e) {
      toast.error("Failed to assign callback", { id: `callback-${callId}` });
    }
  };

  const handleMarkResolved = async (callId: string) => {
    toast.loading("Marking as resolved...", { id: `resolve-${callId}` });
    try {
      await updateCall.mutateAsync({ id: callId, values: { status: "completed" } });
      toast.success("Call marked as resolved", { id: `resolve-${callId}` });
    } catch (e) {
      toast.error("Failed to resolve call", { id: `resolve-${callId}` });
    }
  };

  const handleEscalate = async (callId: string) => {
    toast.loading("Escalating call...", { id: `escalate-${callId}` });
    try {
      await updateCall.mutateAsync({ id: callId, values: { status: "escalated" } });
      toast.warning("Call escalated to manager", { id: `escalate-${callId}` });
    } catch (e) {
      toast.error("Failed to escalate call", { id: `escalate-${callId}` });
    }
  };

  const handleConvertToTicket = (callId: string) => {
    toast.info("Convert to ticket", { description: "Open the Tickets module to create a ticket from this call." });
  };

  const handlePlayRecording = (callId: string) => {
    toast.info("Playing call recording...", { description: "Audio player opened" });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "inbound": return PhoneIncoming;
      case "outbound": return Phone;
      case "missed": return PhoneMissed;
      default: return Phone;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-500/20 text-emerald-300";
      case "missed": return "bg-red-500/20 text-red-300";
      case "callback_pending": return "bg-amber-500/20 text-amber-300";
      case "escalated": return "bg-purple-500/20 text-purple-300";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const formatDuration = (secs: number) => {
    if (!secs) return "-";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const missedCalls = calls.filter(c => c.direction === "missed" || c.status === "missed").length;
  const pendingCallbacks = calls.filter(c => c.status === "callback_pending").length;
  const escalatedCalls = calls.filter(c => c.status === "escalated").length;
  const avgWait = calls.length ? Math.round(calls.reduce((s, c) => s + (c.wait_seconds ?? 0), 0) / calls.length) : 0;
  const avgDuration = calls.length ? Math.round(calls.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / calls.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Call Center</h2>
          <p className="text-muted-foreground">Call logs, recordings, and AI summaries</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <Phone className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">{calls.length}</div>
            <div className="text-xs text-muted-foreground">Total Calls Today</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-red-500/20">
          <CardContent className="p-4 text-center">
            <PhoneMissed className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-100">{missedCalls}</div>
            <div className="text-xs text-muted-foreground">Missed Calls</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-100">{avgWait}s</div>
            <div className="text-xs text-muted-foreground">Avg Wait Time</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <ArrowUp className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{formatDuration(avgDuration)}</div>
            <div className="text-xs text-muted-foreground">Avg Duration</div>
          </CardContent>
        </Card>
      </div>

      {/* Calls List */}
      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100">Call Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading && <p className="text-muted-foreground text-sm">Loading calls…</p>}
            {!isLoading && calls.length === 0 && <p className="text-muted-foreground text-sm">No calls recorded.</p>}
            {calls.map((call, index) => {
              const TypeIcon = getTypeIcon(call.direction ?? call.status);
              const agentName = memberName(agents, call.agent_id);
              return (
                <motion.div
                  key={call.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 bg-card/60 rounded-lg hover:bg-card/60 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${call.status === "missed" ? "bg-red-500/20" : "bg-cyan-500/20"} flex items-center justify-center`}>
                        <TypeIcon className={`w-5 h-5 ${call.status === "missed" ? "text-red-400" : "text-cyan-400"}`} />
                      </div>
                      <div>
                        <span className="font-mono text-cyan-400 text-sm">{call.id.slice(0, 8)}</span>
                        <Badge className={`ml-2 ${getStatusColor(call.status)}`}>{call.status.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {call.duration_seconds > 0 && <span className="font-mono">{formatDuration(call.duration_seconds)}</span>}
                      <span>•</span>
                      <span>{relativeTime(call.started_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-foreground">{call.caller_name}</h4>
                      <p className="text-sm text-muted-foreground">{call.phone} {agentName && `• Agent: ${agentName}`}</p>
                      {call.notes && <p className="text-sm text-cyan-400/80 mt-1 italic">AI: {call.notes}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handlePlayRecording(call.id)} className="text-cyan-400">
                        <Mic className="w-4 h-4" />
                      </Button>

                      {(call.status === "missed" || call.status === "callback_pending") && !call.agent_id && (
                        <Select onValueChange={(agent) => handleAssignCallback(call.id, agent)}>
                          <SelectTrigger className="w-36 bg-muted/40 border-border">
                            <SelectValue placeholder="Assign callback" />
                          </SelectTrigger>
                          <SelectContent>
                            {agents.map(agent => (
                              <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {call.status !== "completed" && call.status !== "escalated" && (
                        <Button size="sm" variant="outline" onClick={() => handleEscalate(call.id)} className="border-purple-500/30 text-purple-300">
                          <ArrowUp className="w-3 h-3 mr-1" />
                          Escalate
                        </Button>
                      )}

                      <Button size="sm" variant="outline" onClick={() => handleConvertToTicket(call.id)} className="border-amber-500/30 text-amber-300">
                        <Ticket className="w-3 h-3 mr-1" />
                        To Ticket
                      </Button>

                      {call.status !== "completed" && (
                        <Button size="sm" onClick={() => handleMarkResolved(call.id)} className="bg-emerald-500 hover:bg-emerald-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Resolved
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
    </div>
  );
};

export default CallCenterModule;
