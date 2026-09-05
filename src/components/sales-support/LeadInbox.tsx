import { motion, useReducedMotion } from "framer-motion";
import { Inbox, User, Clock, Flame, Snowflake, Sun, Phone, MessageCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  useLeads,
  useTeamMembers,
  useUpdateRow,
  relativeTime,
  memberName,
} from "@/hooks/useSalesSupportData";

const LeadInbox = () => {
  const reduceMotion = useReducedMotion();
  const { data: leads, isLoading, error } = useLeads();
  const { data: members } = useTeamMembers();
  const updateLead = useUpdateRow("sales_leads");

  const rows = leads ?? [];
  const openRows = rows.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const hotCount = openRows.filter((l) => l.urgency === "hot").length;
  const warmCount = openRows.filter((l) => l.urgency === "warm").length;
  const coldCount = openRows.filter((l) => l.urgency === "cold").length;
  const qualifiedCount = rows.filter((l) => l.qualified).length;
  const conversionRate = rows.length
    ? Math.round((rows.filter((l) => l.stage === "won").length / rows.length) * 100)
    : 0;
  const avgWinProbability = rows.length
    ? Math.round(rows.reduce((sum, l) => sum + (l.ai_win_probability ?? 0), 0) / rows.length)
    : 0;

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "hot": return { icon: Flame, color: "bg-red-500/20 text-red-300 border-red-500/30", label: "HOT" };
      case "warm": return { icon: Sun, color: "bg-amber-500/20 text-amber-300 border-amber-500/30", label: "WARM" };
      case "cold": return { icon: Snowflake, color: "bg-blue-500/20 text-blue-300 border-blue-500/30", label: "COLD" };
      default: return { icon: Sun, color: "bg-muted/40 text-muted-foreground", label: "NEW" };
    }
  };

  const advanceStage = (id: string, stage: string) => {
    const order = ["new", "contacted", "qualified", "proposal", "won"];
    const next = order[Math.min(order.indexOf(stage) + 1, order.length - 1)] ?? "contacted";
    updateLead.mutate(
      { id, values: { stage: next, qualified: next !== "new" } },
      {
        onSuccess: () => toast.success(`Lead moved to ${next}`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Lead Inbox</h2>
          <p className="text-muted-foreground">Incoming leads queue with qualification tags</p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-red-500/20 text-red-300">{hotCount} Hot</Badge>
          <Badge className="bg-amber-500/20 text-amber-300">{warmCount} Warm</Badge>
          <Badge className="bg-blue-500/20 text-blue-300">{coldCount} Cold</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <Inbox className="w-8 h-8 text-cyan-400 mx-auto mb-2" aria-hidden="true" />
            <div className="text-2xl font-bold text-cyan-100">{rows.length}</div>
            <div className="text-xs text-muted-foreground">Total Leads</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <User className="w-8 h-8 text-emerald-400 mx-auto mb-2" aria-hidden="true" />
            <div className="text-2xl font-bold text-emerald-100">{qualifiedCount}</div>
            <div className="text-xs text-muted-foreground">Qualified</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" aria-hidden="true" />
            <div className="text-2xl font-bold text-amber-100">{avgWinProbability}%</div>
            <div className="text-xs text-muted-foreground">Avg Win Probability</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <Flame className="w-8 h-8 text-purple-400 mx-auto mb-2" aria-hidden="true" />
            <div className="text-2xl font-bold text-purple-100">{conversionRate}%</div>
            <div className="text-xs text-muted-foreground">Conversion Rate</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100">Incoming Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full bg-card/60" />
              ))}
            </div>
          ) : error ? (
            <p role="alert" className="text-sm text-red-300">
              Could not load leads: {error instanceof Error ? error.message : "unknown error"}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads in the queue yet.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((lead, index) => {
                const urgencyInfo = getUrgencyBadge(lead.urgency);
                const UrgencyIcon = urgencyInfo.icon;
                const owner = memberName(members, lead.assigned_to);
                return (
                  <motion.li
                    key={lead.id}
                    initial={reduceMotion ? false : { opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={reduceMotion ? { duration: 0 } : { delay: index * 0.05 }}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 bg-card/60 rounded-lg hover:bg-card/60 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-cyan-400" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-cyan-400 text-sm">{lead.reference}</span>
                          <h4 className="font-medium text-cyan-100">{lead.company}</h4>
                          <Badge className={urgencyInfo.color}>
                            <UrgencyIcon className="w-3 h-3 mr-1" aria-hidden="true" />
                            {urgencyInfo.label}
                          </Badge>
                          {lead.qualified && (
                            <Badge className="bg-emerald-500/20 text-emerald-300">Qualified</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span>{lead.contact_name}</span>
                          <span aria-hidden="true">•</span>
                          <span>{lead.category ?? "Uncategorised"}</span>
                          <span aria-hidden="true">•</span>
                          <span>{lead.source}</span>
                          {owner && (
                            <>
                              <span aria-hidden="true">•</span>
                              <span>Owner: {owner}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{relativeTime(lead.created_at)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Call ${lead.contact_name} at ${lead.company}`}
                        className="text-cyan-400 hover:text-cyan-300 min-h-11 min-w-11"
                        onClick={() =>
                          lead.phone
                            ? (window.location.href = `tel:${lead.phone}`)
                            : toast.error("No phone number on this lead")
                        }
                      >
                        <Phone className="w-4 h-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Email ${lead.contact_name} at ${lead.company}`}
                        className="text-cyan-400 hover:text-cyan-300 min-h-11 min-w-11"
                        onClick={() =>
                          lead.email
                            ? (window.location.href = `mailto:${lead.email}`)
                            : toast.error("No email on this lead")
                        }
                      >
                        <MessageCircle className="w-4 h-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        aria-label={`Advance ${lead.company} to the next pipeline stage`}
                        className="bg-cyan-500 hover:bg-cyan-600 text-foreground min-h-11 min-w-11"
                        disabled={updateLead.isPending}
                        onClick={() => advanceStage(lead.id, lead.stage)}
                      >
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadInbox;
