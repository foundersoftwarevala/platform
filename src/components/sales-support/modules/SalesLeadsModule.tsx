import { motion } from "framer-motion";
import { Inbox, ArrowRight, Flame, Sun, Snowflake, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeads, useTeamMembers, useUpdateRow, relativeTime, memberName, type SalesLead } from "@/hooks/useSalesSupportData";

type LeadStage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

const SalesLeadsModule = () => {
  const { data: leadsData, isLoading } = useLeads();
  const { data: reps } = useTeamMembers("sales");
  const updateLead = useUpdateRow("sales_leads");
  const leads: SalesLead[] = leadsData ?? [];
  const salesReps = reps ?? [];

  const handleAssignRep = async (leadId: string, repId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    toast.loading("Assigning rep...", { id: `assign-${leadId}` });
    try {
      await updateLead.mutateAsync({
        id: leadId,
        values: { assigned_to: repId, stage: lead?.stage === "new" ? "contacted" : lead?.stage },
      });
      toast.success(`Assigned to ${memberName(salesReps, repId) ?? "rep"}`, { id: `assign-${leadId}` });
    } catch (e) {
      toast.error("Failed to assign rep", { id: `assign-${leadId}` });
    }
  };

  const handleChangeStage = async (leadId: string, newStage: LeadStage) => {
    toast.loading("Updating stage...", { id: `stage-${leadId}` });
    try {
      await updateLead.mutateAsync({ id: leadId, values: { stage: newStage } });
      toast.success(`Stage updated to ${newStage}`, { id: `stage-${leadId}` });
    } catch (e) {
      toast.error("Failed to update stage", { id: `stage-${leadId}` });
    }
  };

  const handleConvertToCustomer = async (leadId: string) => {
    toast.loading("Converting to customer...", { id: `convert-${leadId}` });
    try {
      await updateLead.mutateAsync({ id: leadId, values: { stage: "won" } });
      toast.success("Lead converted to customer!", { id: `convert-${leadId}` });
    } catch (e) {
      toast.error("Failed to convert lead", { id: `convert-${leadId}` });
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "hot": return { icon: Flame, color: "bg-red-500/20 text-red-300", label: "HOT" };
      case "warm": return { icon: Sun, color: "bg-amber-500/20 text-amber-300", label: "WARM" };
      default: return { icon: Snowflake, color: "bg-blue-500/20 text-blue-300", label: "COLD" };
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "new": return "bg-purple-500/20 text-purple-300";
      case "contacted": return "bg-blue-500/20 text-blue-300";
      case "qualified": return "bg-cyan-500/20 text-cyan-300";
      case "proposal": return "bg-amber-500/20 text-amber-300";
      case "won": return "bg-emerald-500/20 text-emerald-300";
      case "lost": return "bg-red-500/20 text-red-300";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const activeLeads = leads.filter((l) => !["won", "lost"].includes(l.stage));
  const totalPipeline = activeLeads.reduce((sum, l) => sum + Number(l.value ?? 0), 0);
  const hotLeads = activeLeads.filter((l) => l.urgency === "hot").length;
  const avgWinProb = activeLeads.length > 0
    ? Math.round(activeLeads.reduce((sum, l) => sum + Number(l.ai_win_probability ?? 0), 0) / activeLeads.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Sales Leads Pipeline</h2>
          <p className="text-muted-foreground">Track leads through stages with AI win probability</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <Inbox className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">{activeLeads.length}</div>
            <div className="text-xs text-muted-foreground">Active Leads</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-red-500/20">
          <CardContent className="p-4 text-center">
            <Flame className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-100">{hotLeads}</div>
            <div className="text-xs text-muted-foreground">Hot Leads</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-emerald-100">${(totalPipeline / 1000).toFixed(0)}K</div>
            <div className="text-xs text-muted-foreground">Pipeline Value</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{avgWinProb}%</div>
            <div className="text-xs text-muted-foreground">Avg Win Prob</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100">Lead Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm py-6 text-center">Loading leads…</div>
          ) : leads.length === 0 ? (
            <div className="text-muted-foreground text-sm py-6 text-center">No leads yet.</div>
          ) : (
            <div className="space-y-3">
              {leads.map((lead, index) => {
                const urgency = getUrgencyBadge(lead.urgency);
                const UrgencyIcon = urgency.icon;
                const assignedName = memberName(salesReps, lead.assigned_to);
                return (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 bg-card/60 rounded-lg hover:bg-card/60 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-cyan-400 text-sm">{lead.reference}</span>
                        <Badge className={urgency.color}>
                          <UrgencyIcon className="w-3 h-3 mr-1" />
                          {urgency.label}
                        </Badge>
                        <Badge className={getStageColor(lead.stage)}>{lead.stage}</Badge>
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                          AI: {lead.ai_win_probability}% win
                        </Badge>
                      </div>
                      <div className="text-lg font-bold text-emerald-300">${Number(lead.value).toLocaleString()}</div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-foreground">{lead.company}</h4>
                        <p className="text-sm text-muted-foreground">{lead.contact_name} • {lead.email ?? "—"} • {lead.source} • {relativeTime(lead.created_at)}</p>
                        {assignedName && <p className="text-sm text-cyan-400">Assigned: {assignedName}</p>}
                      </div>

                      <div className="flex items-center gap-2">
                        {!lead.assigned_to && (
                          <Select onValueChange={(rep) => handleAssignRep(lead.id, rep)}>
                            <SelectTrigger className="w-36 bg-muted/40 border-border">
                              <SelectValue placeholder="Assign rep..." />
                            </SelectTrigger>
                            <SelectContent>
                              {salesReps.map((rep) => (
                                <SelectItem key={rep.id} value={rep.id}>{rep.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {!["won", "lost"].includes(lead.stage) && (
                          <Select value={lead.stage} onValueChange={(stage) => handleChangeStage(lead.id, stage as LeadStage)}>
                            <SelectTrigger className="w-32 bg-muted/40 border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="qualified">Qualified</SelectItem>
                              <SelectItem value="proposal">Proposal</SelectItem>
                              <SelectItem value="won">Won</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        {lead.stage === "proposal" && (
                          <Button size="sm" onClick={() => handleConvertToCustomer(lead.id)} className="bg-emerald-500 hover:bg-emerald-600">
                            <ArrowRight className="w-3 h-3 mr-1" />
                            Convert
                          </Button>
                        )}
                      </div>
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

export default SalesLeadsModule;
